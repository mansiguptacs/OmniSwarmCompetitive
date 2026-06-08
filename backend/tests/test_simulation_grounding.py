"""Phase 6 tests: real-time grounding layer (offline, deterministic)."""

import fakeredis
import pytest

from simulation.grounding import gather_grounding, grounding_context
from simulation.schemas import (
    AcquisitionTarget,
    CompanyPersona,
    PlayerProfile,
    SimulationState,
)
from simulation.store import SimulationStore
from state import NewsItem


def _news(title: str, url: str) -> NewsItem:
    return NewsItem(title=title, url=url, summary=f"{title} summary", sentiment=0.0, published_at="2026-01-01")


def make_search(mapping=None, *, fail=False):
    """A deterministic fake search; records the queries it receives."""
    calls: list[str] = []

    async def search(query: str, max_results: int):
        calls.append(query)
        if fail:
            raise RuntimeError("boom")
        # Return a hit keyed loosely off the query so per-company differs.
        token = query.split()[0]
        return [_news(f"{token} signal {i}", f"https://ex.com/{token}-{i}") for i in range(max_results)]

    search.calls = calls
    return search


@pytest.mark.asyncio
async def test_gather_grounding_builds_packet_no_store():
    search = make_search()
    packet = await gather_grounding(
        "Microsoft acquires StartupX",
        ["Apple", "Amazon"],
        target=AcquisitionTarget(name="StartupX"),
        player=PlayerProfile(company="Microsoft"),
        iteration_index=1,
        search=search,
        store=None,
    )
    assert packet.iteration_index == 1
    assert not packet.stale
    assert packet.evidence  # global evidence present
    assert "Apple" in packet.per_company and "Amazon" in packet.per_company
    # global query + one per company
    assert len(search.calls) == 3


@pytest.mark.asyncio
async def test_gather_grounding_stale_on_empty():
    async def empty(query: str, max_results: int):
        return []

    packet = await gather_grounding(
        "move", ["Apple"], search=empty, store=None
    )
    assert packet.stale is True
    assert packet.evidence == []
    assert packet.per_company == {}


@pytest.mark.asyncio
async def test_gather_grounding_handles_search_errors():
    packet = await gather_grounding(
        "move", ["Apple", "Meta"], search=make_search(fail=True), store=None
    )
    assert packet.stale is True  # degrade gracefully, never raise


@pytest.mark.asyncio
async def test_gather_grounding_caches_with_store():
    store = SimulationStore(client=fakeredis.FakeAsyncRedis(decode_responses=True))
    search1 = make_search()
    p1 = await gather_grounding("same move", ["Apple", "Meta"], search=search1, store=store, iteration_index=1)
    assert len(search1.calls) == 3
    assert not p1.stale

    # Second call with the same move+roster should hit the cache (no new searches).
    search2 = make_search()
    p2 = await gather_grounding("same move", ["Apple", "Meta"], search=search2, store=store, iteration_index=2)
    assert len(search2.calls) == 0  # served from cache
    assert p2.iteration_index == 2  # index refreshed on cache hit
    assert p2.evidence == p1.evidence


@pytest.mark.asyncio
async def test_gather_grounding_cache_key_differs_by_move():
    store = SimulationStore(client=fakeredis.FakeAsyncRedis(decode_responses=True))
    await gather_grounding("move A", ["Apple"], search=make_search(), store=store)
    s = make_search()
    # Different move -> cache miss -> fresh searches.
    await gather_grounding("move B", ["Apple"], search=s, store=store)
    assert len(s.calls) == 2  # global + Apple


def test_grounding_context_render():
    from simulation.schemas import Evidence, GroundingPacket

    packet = GroundingPacket(
        summary="Headline A | Apple: Headline B",
        per_company={"Apple": [Evidence(claim="Apple did X")]},
    )
    ctx = grounding_context(packet, "Apple")
    assert "Fresh market signals" in ctx
    assert "Apple did X" in ctx
    assert grounding_context(None) == ""


@pytest.mark.asyncio
async def test_run_iteration_attaches_grounding(monkeypatch):
    """Engine records the grounding packet on the iteration (offline heuristic)."""
    from simulation import engine

    state = SimulationState(
        session_id="s1",
        target=AcquisitionTarget(name="StartupX"),
        player=PlayerProfile(company="Microsoft"),
        personas=[
            CompanyPersona(name="Apple", temperament="aggressive"),
            CompanyPersona(name="Amazon", temperament="acquisitive"),
        ],
        max_iterations=3,
    )
    it = await engine.run_iteration(
        state,
        "Microsoft acquires StartupX",
        search=make_search(),
        store=None,
        llm_getter=lambda: None,
    )
    assert it.grounding is not None
    assert not it.grounding.stale
    # Reactions should carry fresh evidence from the grounding packet.
    assert any(r.evidence for r in it.reactions)
