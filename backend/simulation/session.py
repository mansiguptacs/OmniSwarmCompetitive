"""Turn-by-turn controller for the acquisition war-game (human-in-the-loop).

Lifecycle:
    start_simulation(...)   -> builds the board, runs iteration 1 (the acquisition),
                               pauses at `awaiting_choice`.
    advance_simulation(...) -> applies the user's choice (option id or free text) as
                               the next move, runs the next iteration, pauses again.
    ... repeat until `current_index == max_iterations` -> `complete`.

State is persisted to the `SimulationStore` between turns so a session survives
across requests (the frontend drives this loop turn by turn). The actual LangGraph/
CopilotKit endpoint wiring happens in the frontend phase; this module is the
transport-agnostic core so it stays fully testable.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from typing import AsyncIterator, Callable

from llm.factory import get_llm
from simulation.agents import ProgressCallback
from simulation.engine import run_iteration
from simulation.evals import session_quality
from simulation.ledger import (
    assemble_replay,
    build_choice_entry,
    build_persona_entries,
    build_recommendation_entry,
)
from simulation.persona_builder import build_personas
from simulation.roster import DEFAULT_SECTOR, get_sector
from simulation.schemas import (
    AcquisitionTarget,
    PlayerProfile,
    SimulationState,
)
from simulation.scoring import final_report
from simulation.store import SimulationStore, get_sim_store

logger = logging.getLogger(__name__)


def _resolve_move(state: SimulationState, choice: str) -> str:
    """Translate the user's choice into the next move string.

    If `choice` matches an option (by id or label) from the last decision point,
    use that option's label and record the chosen id. Otherwise treat it as a
    free-text move.
    """
    choice = (choice or "").strip()
    last = state.iterations[-1] if state.iterations else None
    if last is not None and last.decision_point is not None:
        for opt in last.decision_point.options:
            if choice.lower() in (opt.id.lower(), opt.label.lower()):
                last.chosen_option = opt.id
                return opt.label
        last.chosen_option = choice  # free-text move
    return choice


async def start_simulation(
    target_name: str,
    player_company: str,
    *,
    sector_id: str = DEFAULT_SECTOR,
    initial_move: str | None = None,
    max_iterations: int = 10,
    max_incumbents: int = 6,
    incumbents: list[str] | None = None,
    session_id: str | None = None,
    seed: int | None = None,
    store: SimulationStore | None = None,
    llm_getter: Callable[[], object] = get_llm,
) -> SimulationState:
    """Begin a new war-game and run the opening iteration (the acquisition)."""
    store = store or get_sim_store()
    session_id = session_id or uuid.uuid4().hex

    sector = get_sector(
        sector_id,
        exclude=[player_company, target_name],
        max_incumbents=max_incumbents,
        incumbents_override=incumbents,
    )
    personas = await build_personas(
        sector.incumbents, llm_getter=llm_getter, store=store
    )

    state = SimulationState(
        session_id=session_id,
        sector=sector,
        target=AcquisitionTarget(name=target_name),
        player=PlayerProfile(company=player_company),
        personas=personas,
        max_iterations=max_iterations,
        status="running",
        seed=seed,
    )

    move = initial_move or f"{player_company} acquires {target_name}"
    # Seed the ledger: personas (the agents' baseline) + the opening move.
    await store.append_ledger(session_id, build_persona_entries(state))
    await store.append_ledger(
        session_id, [build_choice_entry(session_id, 1, player_company, move)]
    )
    await run_iteration(state, move, store=store, llm_getter=llm_getter)
    if state.status == "complete" and not state.final_recommendation:
        state.final_recommendation = await final_report(state, llm_getter=llm_getter)
        await store.append_ledger(session_id, [build_recommendation_entry(state)])
    await store.save_state(state)
    return state


async def advance_simulation(
    session_id: str,
    choice: str,
    *,
    store: SimulationStore | None = None,
    llm_getter: Callable[[], object] = get_llm,
) -> SimulationState:
    """Apply the user's choice and run the next iteration."""
    store = store or get_sim_store()
    state = await store.get_state(session_id)
    if state is None:
        raise ValueError(f"No simulation found for session {session_id!r}")

    if state.status == "complete" or state.current_index >= state.max_iterations:
        state.status = "complete"
        await store.save_state(state)
        return state

    move = _resolve_move(state, choice)
    player_name = state.player.company if state.player else "player"
    await store.append_ledger(
        session_id,
        [build_choice_entry(session_id, state.current_index + 1, player_name, move)],
    )
    await run_iteration(state, move, store=store, llm_getter=llm_getter)
    if state.status == "complete" and not state.final_recommendation:
        state.final_recommendation = await final_report(state, llm_getter=llm_getter)
        await store.append_ledger(session_id, [build_recommendation_entry(state)])
    await store.save_state(state)
    return state


async def get_simulation(
    session_id: str,
    *,
    store: SimulationStore | None = None,
) -> SimulationState | None:
    """Load the current state of a session."""
    store = store or get_sim_store()
    return await store.get_state(session_id)


async def end_simulation(
    session_id: str,
    *,
    store: SimulationStore | None = None,
    llm_getter: Callable[[], object] = get_llm,
) -> SimulationState | None:
    """Mark a session complete early (user ends the game)."""
    store = store or get_sim_store()
    state = await store.get_state(session_id)
    if state is None:
        return None
    state.status = "complete"
    if not state.final_recommendation:
        state.final_recommendation = await final_report(state, llm_getter=llm_getter)
        await store.append_ledger(session_id, [build_recommendation_entry(state)])
    await store.save_state(state)
    return state


async def get_replay(
    session_id: str,
    *,
    store: SimulationStore | None = None,
) -> dict | None:
    """Assemble the click-to-audit replay bundle (Redis ledger + state)."""
    store = store or get_sim_store()
    state = await store.get_state(session_id)
    if state is None:
        return None
    ledger = await store.get_ledger(session_id)
    return assemble_replay(state, ledger)


async def get_evals(
    session_id: str,
    *,
    store: SimulationStore | None = None,
) -> dict | None:
    """Return the quality/eval report for a session (Phase 9)."""
    store = store or get_sim_store()
    state = await store.get_state(session_id)
    if state is None:
        return None
    return session_quality(state)


async def fork_simulation(
    session_id: str,
    from_index: int,
    choice: str,
    *,
    store: SimulationStore | None = None,
    llm_getter: Callable[[], object] = get_llm,
) -> SimulationState:
    """Backtrack to an earlier turn and explore an alternate branch.

    Creates a NEW session that copies the original up to (and including) iteration
    `from_index`, then applies `choice` as the move for the next turn — letting the
    exec compare "what if I'd chosen differently" without losing the original run.
    """
    store = store or get_sim_store()
    original = await store.get_state(session_id)
    if original is None:
        raise ValueError(f"No simulation found for session {session_id!r}")
    if from_index < 1 or from_index >= len(original.iterations):
        raise ValueError(
            f"from_index {from_index} out of range (1..{len(original.iterations) - 1})"
        )

    branch = original.model_copy(deep=True)
    branch.session_id = uuid.uuid4().hex
    branch.parent_session_id = session_id
    branch.branched_from_index = from_index
    branch.iterations = branch.iterations[:from_index]
    branch.current_index = from_index
    branch.status = "awaiting_choice"
    branch.final_recommendation = ""

    move = _resolve_move(branch, choice)
    await run_iteration(branch, move, store=store, llm_getter=llm_getter)
    if branch.status == "complete" and not branch.final_recommendation:
        branch.final_recommendation = await final_report(branch, llm_getter=llm_getter)
    await store.save_state(branch)
    return branch


# ── Streaming helpers (SSE) ──────────────────────────────────────

def _make_progress_emitter(queue: asyncio.Queue) -> ProgressCallback:
    """Return a sync callback that pushes events into an asyncio queue."""
    def _emit(kind: str, name: str | None, data: object) -> None:
        queue.put_nowait({"kind": kind, "name": name, "data": data})
    return _emit


async def start_simulation_stream(
    target_name: str,
    player_company: str,
    *,
    sector_id: str = DEFAULT_SECTOR,
    initial_move: str | None = None,
    max_iterations: int = 10,
    max_incumbents: int = 6,
    incumbents: list[str] | None = None,
    session_id: str | None = None,
    seed: int | None = None,
    store: SimulationStore | None = None,
    llm_getter: Callable[[], object] = get_llm,
) -> AsyncIterator[dict]:
    """Same as *start_simulation* but yields progress events via SSE."""
    store = store or get_sim_store()
    session_id = session_id or uuid.uuid4().hex

    sector = get_sector(
        sector_id,
        exclude=[player_company, target_name],
        max_incumbents=max_incumbents,
        incumbents_override=incumbents,
    )
    personas = await build_personas(
        sector.incumbents, llm_getter=llm_getter, store=store
    )

    state = SimulationState(
        session_id=session_id,
        sector=sector,
        target=AcquisitionTarget(name=target_name),
        player=PlayerProfile(company=player_company),
        personas=personas,
        max_iterations=max_iterations,
        status="running",
        seed=seed,
    )

    yield {"kind": "personas", "name": None, "data": [p.model_dump() for p in personas]}

    move = initial_move or f"{player_company} acquires {target_name}"
    await store.append_ledger(session_id, build_persona_entries(state))
    await store.append_ledger(
        session_id, [build_choice_entry(session_id, 1, player_company, move)]
    )

    queue: asyncio.Queue = asyncio.Queue()
    emitter = _make_progress_emitter(queue)

    async def _run_bg():
        await run_iteration(state, move, store=store, llm_getter=llm_getter, on_progress=emitter)
        queue.put_nowait(None)  # sentinel

    task = asyncio.create_task(_run_bg())

    while True:
        event = await queue.get()
        if event is None:
            break
        serialisable = dict(event)
        data = serialisable.get("data")
        if data is not None and hasattr(data, "model_dump"):
            serialisable["data"] = data.model_dump()
        elif data is not None and not isinstance(data, (dict, list, str, int, float, bool, type(None))):
            serialisable["data"] = str(data)
        yield serialisable

    await task

    if state.status == "complete" and not state.final_recommendation:
        state.final_recommendation = await final_report(state, llm_getter=llm_getter)
        await store.append_ledger(session_id, [build_recommendation_entry(state)])
    await store.save_state(state)

    yield {"kind": "complete", "name": None, "data": state.model_dump()}


async def advance_simulation_stream(
    session_id: str,
    choice: str,
    *,
    store: SimulationStore | None = None,
    llm_getter: Callable[[], object] = get_llm,
) -> AsyncIterator[dict]:
    """Same as *advance_simulation* but yields progress events via SSE."""
    store = store or get_sim_store()
    state = await store.get_state(session_id)
    if state is None:
        raise ValueError(f"No simulation found for session {session_id!r}")

    if state.status == "complete" or state.current_index >= state.max_iterations:
        state.status = "complete"
        await store.save_state(state)
        yield {"kind": "complete", "name": None, "data": state.model_dump()}
        return

    move = _resolve_move(state, choice)
    player_name = state.player.company if state.player else "player"
    await store.append_ledger(
        session_id,
        [build_choice_entry(session_id, state.current_index + 1, player_name, move)],
    )

    queue: asyncio.Queue = asyncio.Queue()
    emitter = _make_progress_emitter(queue)

    async def _run_bg():
        await run_iteration(state, move, store=store, llm_getter=llm_getter, on_progress=emitter)
        queue.put_nowait(None)

    task = asyncio.create_task(_run_bg())

    while True:
        event = await queue.get()
        if event is None:
            break
        serialisable = dict(event)
        data = serialisable.get("data")
        if data is not None and hasattr(data, "model_dump"):
            serialisable["data"] = data.model_dump()
        elif data is not None and not isinstance(data, (dict, list, str, int, float, bool, type(None))):
            serialisable["data"] = str(data)
        yield serialisable

    await task

    if state.status == "complete" and not state.final_recommendation:
        state.final_recommendation = await final_report(state, llm_getter=llm_getter)
        await store.append_ledger(session_id, [build_recommendation_entry(state)])
    await store.save_state(state)

    yield {"kind": "complete", "name": None, "data": state.model_dump()}
