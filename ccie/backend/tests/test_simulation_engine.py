"""Phase 2 tests: one full simulation iteration (heuristic / offline path)."""

import pytest

from simulation.agents import gather_reactions, react_as_ceo
from simulation.engine import current_board, init_board, run_iteration
from simulation.referee import adjudicate
from simulation.schemas import (
    AcquisitionTarget,
    BoardState,
    CompanyPersona,
    PlayerProfile,
    SimulationState,
)


def _no_llm():
    return None


def _personas() -> list[CompanyPersona]:
    return [
        CompanyPersona(name="Amazon", temperament="aggressive", strategy_thesis="Customer obsession."),
        CompanyPersona(name="Apple", temperament="wait_and_see", strategy_thesis="Vertical integration."),
    ]


def _state() -> SimulationState:
    return SimulationState(
        session_id="sess-1",
        personas=_personas(),
        target=AcquisitionTarget(name="StartupX"),
        player=PlayerProfile(company="AcmeCorp"),
        max_iterations=10,
    )


def test_init_board_matches_personas():
    board = init_board(_personas())
    assert {c.name for c in board.companies} == {"Amazon", "Apple"}
    assert board.player.position == 0.5
    assert board.player.risk == 0.0


def test_current_board_uses_init_when_no_iterations():
    state = _state()
    board = current_board(state)
    assert len(board.companies) == 2


@pytest.mark.asyncio
async def test_reaction_intensity_varies_by_temperament():
    board = init_board(_personas())
    aggressive, cautious = _personas()
    r_aggr = await react_as_ceo(aggressive, "Acquire StartupX", board, llm_getter=_no_llm)
    r_calm = await react_as_ceo(cautious, "Acquire StartupX", board, llm_getter=_no_llm)
    assert r_aggr.actor == "Amazon"
    assert r_aggr.intensity > r_calm.intensity


@pytest.mark.asyncio
async def test_gather_reactions_one_per_persona():
    board = init_board(_personas())
    reactions = await gather_reactions(_personas(), "Acquire StartupX", board, llm_getter=_no_llm)
    assert {r.actor for r in reactions} == {"Amazon", "Apple"}


@pytest.mark.asyncio
async def test_adjudicate_updates_board_and_offers_choices():
    personas = _personas()
    board = init_board(personas)
    reactions = await gather_reactions(personas, "Acquire StartupX", board, llm_getter=_no_llm)
    outcome, new_board, decision = await adjudicate(
        "Acquire StartupX", reactions, board, 1, llm_getter=_no_llm
    )
    assert isinstance(outcome, str) and outcome
    assert {c.name for c in new_board.companies} == {"Amazon", "Apple"}
    # Aggressive reactor's threat should rise above baseline.
    amazon = next(c for c in new_board.companies if c.name == "Amazon")
    assert amazon.threat > 0.5
    assert decision.iteration_index == 1
    assert len(decision.options) >= 2
    assert decision.allow_free_text is True


@pytest.mark.asyncio
async def test_run_iteration_records_and_advances():
    state = _state()
    iteration = await run_iteration(state, "Acquire StartupX", llm_getter=_no_llm)
    assert iteration.index == 1
    assert state.current_index == 1
    assert state.status == "awaiting_choice"
    assert len(state.iterations) == 1
    # The move met resistance, raising player risk above the 0.0 baseline.
    assert iteration.board.player.risk > 0.0
    assert iteration.decision_point is not None


@pytest.mark.asyncio
async def test_run_until_max_marks_complete_and_carries_board():
    state = _state()
    state.max_iterations = 2
    it1 = await run_iteration(state, "Acquire StartupX", llm_getter=_no_llm)
    it2 = await run_iteration(state, "Integrate aggressively", llm_getter=_no_llm)
    assert state.status == "complete"
    assert state.current_index == 2
    assert len(state.iterations) == 2
    # Board carries forward: threat accumulates across turns for the aggressive rival.
    amazon1 = next(c for c in it1.board.companies if c.name == "Amazon")
    amazon2 = next(c for c in it2.board.companies if c.name == "Amazon")
    assert amazon2.threat >= amazon1.threat


@pytest.mark.asyncio
async def test_board_state_default_factory_independent():
    a = BoardState()
    b = BoardState()
    a.player.risk = 0.9
    assert b.player.risk == 0.0
