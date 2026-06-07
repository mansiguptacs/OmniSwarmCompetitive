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

import logging
import uuid
from typing import Callable

from llm.factory import get_llm
from simulation.engine import run_iteration
from simulation.persona_builder import build_personas
from simulation.roster import DEFAULT_SECTOR, get_sector
from simulation.schemas import (
    AcquisitionTarget,
    PlayerProfile,
    SimulationState,
)
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
    session_id: str | None = None,
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
    )

    move = initial_move or f"{player_company} acquires {target_name}"
    await run_iteration(state, move, llm_getter=llm_getter)
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
    await run_iteration(state, move, llm_getter=llm_getter)
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
) -> SimulationState | None:
    """Mark a session complete early (user ends the game)."""
    store = store or get_sim_store()
    state = await store.get_state(session_id)
    if state is None:
        return None
    state.status = "complete"
    await store.save_state(state)
    return state
