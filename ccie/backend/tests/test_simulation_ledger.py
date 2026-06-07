"""Phase 8 tests: decision ledger + reasoning replay (offline)."""

import fakeredis
import pytest

from simulation.ledger import assemble_replay, build_iteration_entries
from simulation.schemas import (
    AcquisitionTarget,
    AgentReaction,
    BoardState,
    CompanyBoardPosition,
    Evidence,
    IterationScore,
    PlayerProfile,
    SimulationIteration,
    SimulationState,
)
from simulation.session import (
    advance_simulation,
    get_replay,
    start_simulation,
)
from simulation.store import SimulationStore
from simulation.tracing import trace_adjudication, trace_reasoning


@pytest.fixture
def store():
    return SimulationStore(client=fakeredis.FakeAsyncRedis(decode_responses=True))


def test_build_iteration_entries():
    it = SimulationIteration(
        index=1,
        move="acquire",
        reactions=[
            AgentReaction(actor="Apple", action="counter-bid", rationale="defend turf",
                          intensity=0.7, evidence=[Evidence(claim="news", source_url="http://x")]),
        ],
        referee_outcome="resistance is moderate",
        board=BoardState(companies=[CompanyBoardPosition(name="Apple")]),
        score=IterationScore(composite=0.6),
    )
    entries = build_iteration_entries("s1", it)
    kinds = [e.kind for e in entries]
    assert "reaction" in kinds and "adjudication" in kinds
    reaction = next(e for e in entries if e.kind == "reaction")
    assert reaction.actor == "Apple"
    assert reaction.evidence and reaction.evidence[0].source_url == "http://x"


def test_tracing_offline_returns_empty():
    # No WANDB_API_KEY in tests -> tracing is a no-op.
    assert trace_reasoning({"x": 1}) == ("", "")
    assert trace_adjudication({"x": 1}) == ("", "")


@pytest.mark.asyncio
async def test_ledger_written_during_run(store):
    state = await start_simulation(
        "StartupX", "Microsoft", max_iterations=3, max_incumbents=3,
        store=store, llm_getter=lambda: None,
    )
    ledger = await store.get_ledger(state.session_id)
    kinds = {e.kind for e in ledger}
    # personas + opening choice + first iteration's reactions + adjudication
    assert "persona" in kinds
    assert "choice" in kinds
    assert "reaction" in kinds
    assert "adjudication" in kinds


@pytest.mark.asyncio
async def test_replay_bundle_from_redis(store):
    state = await start_simulation(
        "StartupX", "Microsoft", max_iterations=3, max_incumbents=3,
        store=store, llm_getter=lambda: None,
    )
    opt = state.iterations[-1].decision_point.options[0].id
    state = await advance_simulation(state.session_id, opt, store=store, llm_getter=lambda: None)

    bundle = await get_replay(state.session_id, store=store)
    assert bundle is not None
    assert bundle["ledger_source"] == "redis"
    assert len(bundle["turns"]) == 2
    assert bundle["turns"][0]["reactions"]
    assert bundle["ledger"]
    assert bundle["player"]["company"] == "Microsoft"


@pytest.mark.asyncio
async def test_replay_unknown_session(store):
    assert await get_replay("missing", store=store) is None


def test_assemble_replay_falls_back_to_state():
    state = SimulationState(
        session_id="s1",
        player=PlayerProfile(company="MS"),
        target=AcquisitionTarget(name="T"),
        iterations=[
            SimulationIteration(index=1, move="acquire", referee_outcome="ok",
                                reactions=[AgentReaction(actor="Apple", action="bid")]),
        ],
    )
    bundle = assemble_replay(state, [])  # empty ledger
    assert bundle["ledger_source"] == "state"
    assert bundle["turns"][0]["reactions"][0]["actor"] == "Apple"
