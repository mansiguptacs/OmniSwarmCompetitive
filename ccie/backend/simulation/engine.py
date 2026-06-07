"""Simulation engine: run a single war-game iteration end-to-end.

One iteration = player move -> CEO-agents react -> market referee adjudicates ->
new board state + decision point. The engine appends the iteration to
`SimulationState`, carries the board forward, and advances status.

Phase 2 proves the loop with N=1; Phase 4 wraps this in the human-in-the-loop
multi-turn loop.
"""

from __future__ import annotations

import random
from typing import Awaitable, Callable

from llm.factory import get_llm
from simulation.agents import gather_reactions, gather_reactions_two_pass
from simulation.evals import score_iteration_quality
from simulation.grounding import gather_grounding
from simulation.guardrails import prune_ghost_alliances
from simulation.ledger import build_iteration_entries
from simulation.referee import adjudicate
from simulation.scoring import recommend_option, score_board
from simulation.tracing import trace_adjudication, trace_reasoning
from simulation.schemas import (
    BoardState,
    CompanyBoardPosition,
    CompanyPersona,
    PlayerBoardPosition,
    SimulationIteration,
    SimulationState,
)
from simulation.store import SimulationStore
from state import NewsItem
from tools.web_search import search_news

SearchFn = Callable[[str, int], Awaitable[list[NewsItem]]]


def init_board(personas: list[CompanyPersona]) -> BoardState:
    """Neutral opening board: every incumbent at baseline, player at midpoint."""
    return BoardState(
        companies=[
            CompanyBoardPosition(name=p.name, market_position=0.5, threat=0.5)
            for p in personas
        ],
        player=PlayerBoardPosition(position=0.5, momentum=0.0, risk=0.0),
    )


def current_board(state: SimulationState) -> BoardState:
    """The latest board (last iteration's), or a fresh opening board."""
    if state.iterations:
        return state.iterations[-1].board
    return init_board(state.personas)


async def run_iteration(
    state: SimulationState,
    move: str,
    *,
    interactive: bool = True,
    search: SearchFn = search_news,
    store: SimulationStore | None = None,
    ground: bool = True,
    llm_getter: Callable[[], object] = get_llm,
) -> SimulationIteration:
    """Run one iteration against the current state and record it.

    With `interactive=True` (default), agents react in two passes so they respond
    to each other (alliances, escalation). Set `interactive=False` for a single,
    independent pass.

    A fresh `GroundingPacket` (real-world signals for this move/roster) is fetched
    and fed into the agent + referee prompts, then recorded on the iteration so the
    UI can show "what real info drove this." Pass `store` to enable the Redis TTL
    cache; `ground=False` skips grounding entirely (used by some unit tests).

    Mutates `state` (appends the iteration, advances index/status) and returns the
    newly created `SimulationIteration`.
    """
    index = state.current_index + 1
    board = current_board(state)

    # Reproducibility: seed heuristic tie-breaks per turn (Phase 9).
    if state.seed is not None:
        random.seed(state.seed + index)

    grounding = None
    if ground:
        grounding = await gather_grounding(
            move,
            [p.name for p in state.personas],
            target=state.target,
            player=state.player,
            iteration_index=index,
            search=search,
            store=store,
        )

    reactor = gather_reactions_two_pass if interactive else gather_reactions
    reactions = await reactor(
        state.personas,
        move,
        board,
        target=state.target,
        player=state.player,
        grounding=grounding,
        llm_getter=llm_getter,
    )

    # Guardrail: agents can only ally with real, in-roster companies.
    reactions = prune_ghost_alliances(reactions, state.personas)

    outcome, new_board, decision = await adjudicate(
        move,
        reactions,
        board,
        index,
        target=state.target,
        player=state.player,
        grounding=grounding,
        llm_getter=llm_getter,
    )

    # Score the new board (delta vs. the previous iteration's score).
    prev_score = state.iterations[-1].score if state.iterations else None
    score = score_board(new_board, prev_score)

    # Recommend the strongest next option (unless this is the final turn).
    if decision is not None and decision.options and index < state.max_iterations:
        rec_id, rec_reason = await recommend_option(
            new_board, decision.options, move=move, llm_getter=llm_getter
        )
        decision.recommended_option_id = rec_id
        decision.recommendation_rationale = rec_reason

    # Best-effort Weave traces (the "why") — one per iteration, shared by its cards.
    reasoning_id, reasoning_url = trace_reasoning(
        {
            "session_id": state.session_id,
            "iteration": index,
            "move": move,
            "reactions": [r.model_dump() for r in reactions],
        }
    )
    adj_id, adj_url = trace_adjudication(
        {
            "session_id": state.session_id,
            "iteration": index,
            "move": move,
            "outcome": outcome,
            "board": new_board.model_dump(),
        }
    )
    for r in reactions:
        r.weave_trace_id = reasoning_id
        r.weave_url = reasoning_url

    iteration = SimulationIteration(
        index=index,
        move=move,
        reactions=reactions,
        referee_outcome=outcome,
        board=new_board,
        decision_point=decision,
        grounding=grounding,
        score=score,
        weave_trace_id=adj_id,
        weave_url=adj_url,
    )
    # Per-iteration eval (Phase 9): grounding / persona-consistency / plausibility.
    iteration.quality = score_iteration_quality(iteration, state.personas)

    state.iterations.append(iteration)
    state.current_index = index
    state.status = "complete" if index >= state.max_iterations else "awaiting_choice"

    # Write the canonical ledger entries (the "what") to Redis.
    if store is not None:
        await store.append_ledger(
            state.session_id, build_iteration_entries(state.session_id, iteration)
        )

    return iteration
