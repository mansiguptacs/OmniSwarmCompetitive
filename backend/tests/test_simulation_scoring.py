"""Phase 7 tests: outcome scoring, option recommendation, final report, branching."""

import fakeredis
import pytest

from simulation.scoring import (
    _heuristic_final_report,
    final_report,
    recommend_option,
    score_board,
)
from simulation.schemas import (
    AcquisitionTarget,
    BoardState,
    CompanyBoardPosition,
    CompanyPersona,
    DecisionOption,
    PlayerBoardPosition,
    PlayerProfile,
    SimulationState,
)
from simulation.session import advance_simulation, fork_simulation, start_simulation
from simulation.store import SimulationStore


def _board(position=0.5, momentum=0.0, risk=0.0, companies=None):
    return BoardState(
        companies=companies or [],
        player=PlayerBoardPosition(position=position, momentum=momentum, risk=risk),
    )


def test_score_board_true_neutral_is_midpoint():
    # Midpoint position, flat momentum, midpoint risk -> ~0.5.
    s = score_board(_board(position=0.5, momentum=0.0, risk=0.5))
    assert 0.45 <= s.composite <= 0.55
    assert s.delta == 0.0


def test_score_board_zero_risk_opening_is_decent():
    # The opening board (risk=0) legitimately scores above the midpoint.
    s = score_board(_board(position=0.5, momentum=0.0, risk=0.0))
    assert s.composite > 0.55


def test_score_board_rewards_position_penalizes_risk():
    good = score_board(_board(position=0.9, momentum=0.6, risk=0.1))
    bad = score_board(_board(position=0.2, momentum=-0.6, risk=0.9))
    assert good.composite > bad.composite


def test_score_board_delta():
    first = score_board(_board(position=0.5))
    second = score_board(_board(position=0.8, momentum=0.4), previous=first)
    assert second.delta > 0


_OPTIONS = [
    DecisionOption(id="integrate", label="Integrate aggressively and expand", expected_effect="momentum", risk="retaliation"),
    DecisionOption(id="consolidate", label="Consolidate and de-risk", expected_effect="lower risk", risk="cedes initiative"),
    DecisionOption(id="alliance", label="Form a strategic alliance", expected_effect="shares pressure", risk="dilutes control"),
]


@pytest.mark.asyncio
async def test_recommend_high_risk_prefers_derisk():
    rec_id, reason = await recommend_option(
        _board(risk=0.9), _OPTIONS, llm_getter=lambda: None
    )
    assert rec_id == "consolidate"
    assert reason


@pytest.mark.asyncio
async def test_recommend_high_pressure_prefers_alliance():
    companies = [
        CompanyBoardPosition(name="A", pressure=0.9),
        CompanyBoardPosition(name="B", pressure=0.9),
    ]
    rec_id, _ = await recommend_option(
        _board(risk=0.1, momentum=0.3, companies=companies), _OPTIONS, llm_getter=lambda: None
    )
    assert rec_id == "alliance"


@pytest.mark.asyncio
async def test_recommend_weak_momentum_prefers_aggressive():
    rec_id, _ = await recommend_option(
        _board(risk=0.0, momentum=-0.8, position=0.3), _OPTIONS, llm_getter=lambda: None
    )
    assert rec_id == "integrate"


def test_heuristic_final_report_mentions_turns():
    state = SimulationState(
        player=PlayerProfile(company="Microsoft"),
        target=AcquisitionTarget(name="StartupX"),
    )
    # Build two scored iterations via the engine-style path is heavy; fake minimal.
    from simulation.schemas import IterationScore, SimulationIteration

    state.iterations = [
        SimulationIteration(index=1, move="acquire", board=_board(0.5), score=IterationScore(composite=0.5)),
        SimulationIteration(index=2, move="integrate", board=_board(0.7), score=IterationScore(composite=0.66, delta=0.16)),
    ]
    report = _heuristic_final_report(state)
    assert "2 turns" in report
    assert "improved" in report


@pytest.fixture
def store():
    return SimulationStore(client=fakeredis.FakeAsyncRedis(decode_responses=True))


@pytest.mark.asyncio
async def test_iterations_get_scores_and_recommendation(store):
    state = await start_simulation(
        "StartupX", "Microsoft", max_iterations=3, max_incumbents=3,
        store=store, llm_getter=lambda: None,
    )
    it = state.iterations[-1]
    assert it.score is not None
    assert 0.0 <= it.score.composite <= 1.0
    assert it.decision_point.recommended_option_id  # a recommendation was made
    assert it.decision_point.recommended_option_id in {o.id for o in it.decision_point.options}


@pytest.mark.asyncio
async def test_final_recommendation_on_completion(store):
    state = await start_simulation(
        "StartupX", "Microsoft", max_iterations=2, max_incumbents=3,
        store=store, llm_getter=lambda: None,
    )
    # advance to the final turn -> complete
    opt = state.iterations[-1].decision_point.options[0].id
    state = await advance_simulation(state.session_id, opt, store=store, llm_getter=lambda: None)
    assert state.status == "complete"
    assert state.final_recommendation


@pytest.mark.asyncio
async def test_fork_creates_branch(store):
    state = await start_simulation(
        "StartupX", "Microsoft", max_iterations=5, max_incumbents=3,
        store=store, llm_getter=lambda: None,
    )
    # play turn 2
    opt = state.iterations[-1].decision_point.options[0].id
    state = await advance_simulation(state.session_id, opt, store=store, llm_getter=lambda: None)
    assert state.current_index == 2

    # fork from turn 1 with a different choice
    branch = await fork_simulation(
        state.session_id, 1, "consolidate", store=store, llm_getter=lambda: None
    )
    assert branch.session_id != state.session_id
    assert branch.parent_session_id == state.session_id
    assert branch.branched_from_index == 1
    assert branch.current_index == 2
    assert len(branch.iterations) == 2
    # original is untouched
    original = await store.get_state(state.session_id)
    assert original.current_index == 2
    assert len(original.iterations) == 2


@pytest.mark.asyncio
async def test_fork_out_of_range(store):
    state = await start_simulation(
        "StartupX", "Microsoft", max_iterations=3, max_incumbents=3,
        store=store, llm_getter=lambda: None,
    )
    with pytest.raises(ValueError):
        await fork_simulation(state.session_id, 5, "x", store=store, llm_getter=lambda: None)
