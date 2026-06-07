"""Simulation engine: run a single war-game iteration end-to-end.

One iteration = player move -> CEO-agents react -> market referee adjudicates ->
new board state + decision point. The engine appends the iteration to
`SimulationState`, carries the board forward, and advances status.

Phase 2 proves the loop with N=1; Phase 4 wraps this in the human-in-the-loop
multi-turn loop.
"""

from __future__ import annotations

from typing import Callable

from llm.factory import get_llm
from simulation.agents import gather_reactions, gather_reactions_two_pass
from simulation.referee import adjudicate
from simulation.schemas import (
    BoardState,
    CompanyBoardPosition,
    CompanyPersona,
    PlayerBoardPosition,
    SimulationIteration,
    SimulationState,
)


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
    llm_getter: Callable[[], object] = get_llm,
) -> SimulationIteration:
    """Run one iteration against the current state and record it.

    With `interactive=True` (default), agents react in two passes so they respond
    to each other (alliances, escalation). Set `interactive=False` for a single,
    independent pass.

    Mutates `state` (appends the iteration, advances index/status) and returns the
    newly created `SimulationIteration`.
    """
    index = state.current_index + 1
    board = current_board(state)

    reactor = gather_reactions_two_pass if interactive else gather_reactions
    reactions = await reactor(
        state.personas,
        move,
        board,
        target=state.target,
        player=state.player,
        llm_getter=llm_getter,
    )

    outcome, new_board, decision = await adjudicate(
        move,
        reactions,
        board,
        index,
        target=state.target,
        player=state.player,
        llm_getter=llm_getter,
    )

    iteration = SimulationIteration(
        index=index,
        move=move,
        reactions=reactions,
        referee_outcome=outcome,
        board=new_board,
        decision_point=decision,
    )

    state.iterations.append(iteration)
    state.current_index = index
    state.status = "complete" if index >= state.max_iterations else "awaiting_choice"
    return iteration
