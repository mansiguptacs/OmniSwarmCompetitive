"""Phase 9 tests: evals, guardrails, Redis resilience, reproducibility."""

import fakeredis
import pytest

from simulation.evals import (
    THRESHOLDS,
    grounding_coverage,
    persona_consistency,
    plausibility,
    score_iteration_quality,
    session_quality,
)
from simulation.guardrails import prune_ghost_alliances
from simulation.schemas import (
    AgentReaction,
    BoardState,
    CompanyPersona,
    Evidence,
    SimulationIteration,
)
from simulation.session import get_evals, start_simulation
from simulation.store import SimulationStore


def _persona(name, temperament):
    return CompanyPersona(name=name, temperament=temperament,
                          sources=[Evidence(claim="x", source_url="http://x")])


def _iter(reactions):
    return SimulationIteration(index=1, move="m", reactions=reactions,
                               board=BoardState())


def test_grounding_coverage():
    it = _iter([
        AgentReaction(actor="A", evidence=[Evidence(claim="c", source_url="u")]),
        AgentReaction(actor="B"),
    ])
    assert grounding_coverage(it) == 0.5
    assert grounding_coverage(_iter([])) == 0.0


def test_persona_consistency_in_band():
    personas = [_persona("Apple", "aggressive")]
    it = _iter([AgentReaction(actor="Apple", action="counter", intensity=0.8)])
    score, flags = persona_consistency(it, personas)
    assert score == 1.0
    assert flags == []


def test_persona_consistency_off_character_flags():
    personas = [_persona("Apple", "wait_and_see")]  # band 0.0-0.5
    it = _iter([AgentReaction(actor="Apple", action="nuke", intensity=1.0)])
    score, flags = persona_consistency(it, personas)
    assert score < 1.0
    assert any("off-character" in f for f in flags)


def test_persona_consistency_non_roster_actor():
    it = _iter([AgentReaction(actor="Ghost", action="x", intensity=0.5)])
    score, flags = persona_consistency(it, [_persona("Apple", "aggressive")])
    assert score == 0.0
    assert any("non-roster" in f for f in flags)


def test_plausibility_flags_ghost_and_self_ally():
    personas = [_persona("Apple", "aggressive"), _persona("Meta", "aggressive")]
    it = _iter([
        AgentReaction(actor="Apple", ally_with=["Apple", "Atlantis"]),
    ])
    score, flags = plausibility(it, personas)
    assert score < 1.0
    assert any("itself" in f for f in flags)
    assert any("unknown company" in f for f in flags)


def test_prune_ghost_alliances():
    personas = [_persona("Apple", "aggressive"), _persona("Meta", "aggressive")]
    reactions = [AgentReaction(actor="Apple", ally_with=["Meta", "Atlantis", "apple"])]
    pruned = prune_ghost_alliances(reactions, personas)
    # Only real, in-roster companies survive (case-insensitive).
    assert set(a.lower() for a in pruned[0].ally_with) <= {"meta", "apple"}
    assert "atlantis" not in [a.lower() for a in pruned[0].ally_with]


def test_score_iteration_quality_composite():
    personas = [_persona("Apple", "aggressive")]
    it = _iter([AgentReaction(actor="Apple", action="counter", intensity=0.8,
                              evidence=[Evidence(claim="c", source_url="u")])])
    q = score_iteration_quality(it, personas)
    assert q.grounding_coverage == 1.0
    assert q.persona_consistency == 1.0
    assert q.plausibility == 1.0
    assert q.composite == 1.0


@pytest.mark.asyncio
async def test_session_quality_and_endpoint():
    store = SimulationStore(client=fakeredis.FakeAsyncRedis(decode_responses=True))
    state = await start_simulation("StartupX", "Microsoft", max_iterations=2,
                                   max_incumbents=3, store=store, llm_getter=lambda: None)
    # iteration quality attached during the run
    assert state.iterations[0].quality is not None

    report = await get_evals(state.session_id, store=store)
    assert report is not None
    assert set(THRESHOLDS).issubset(report["aggregate"].keys())
    assert "passed" in report
    assert report["per_turn"]


@pytest.mark.asyncio
async def test_seed_is_persisted():
    store = SimulationStore(client=fakeredis.FakeAsyncRedis(decode_responses=True))
    state = await start_simulation("StartupX", "Microsoft", max_iterations=2,
                                   max_incumbents=3, seed=42, store=store,
                                   llm_getter=lambda: None)
    assert state.seed == 42


@pytest.mark.asyncio
async def test_save_state_retries_then_succeeds():
    """A flaky client that fails the first write should still persist via retry."""

    class FlakyRedis(fakeredis.FakeAsyncRedis):
        calls = 0

        async def set(self, *args, **kwargs):  # type: ignore[override]
            FlakyRedis.calls += 1
            if FlakyRedis.calls == 1:
                raise ConnectionError("transient")
            return await super().set(*args, **kwargs)

    store = SimulationStore(client=FlakyRedis(decode_responses=True))
    from simulation.schemas import SimulationState

    ok = await store.save_state(SimulationState(session_id="s1"))
    assert ok is True
    assert FlakyRedis.calls >= 2
