"""Phase 1 tests: persona builder + simulation store (offline / heuristic path)."""

import pytest

from simulation.persona_builder import build_persona, build_personas
from simulation.roster import get_sector
from simulation.schemas import CompanyPersona
from simulation.store import SimulationStore, slugify
from state import NewsItem


def _no_llm():
    return None


async def _empty_search(query: str, max_results: int) -> list[NewsItem]:
    return []


def _counting_search():
    calls = {"n": 0}

    async def search(query: str, max_results: int) -> list[NewsItem]:
        calls["n"] += 1
        return [
            NewsItem(title=f"{query[:20]} result", url="https://example.com/x", summary="s"),
        ]

    return search, calls


@pytest.fixture
def sim_store():
    import fakeredis

    fake = fakeredis.FakeAsyncRedis(decode_responses=True)
    return SimulationStore(client=fake)


@pytest.mark.asyncio
async def test_personas_are_distinct_offline():
    msft = await build_persona("Microsoft", llm_getter=_no_llm, search=_empty_search)
    apple = await build_persona("Apple", llm_getter=_no_llm, search=_empty_search)

    assert msft.name == "Microsoft"
    assert apple.name == "Apple"
    # Curated seeds give clearly different temperament + strategy.
    assert msft.temperament == "acquisitive"
    assert apple.temperament == "wait_and_see"
    assert msft.strategy_thesis != apple.strategy_thesis
    assert "LinkedIn" in msft.m_and_a_history


@pytest.mark.asyncio
async def test_persona_attaches_real_evidence():
    search, _ = _counting_search()
    persona = await build_persona("Amazon", llm_getter=_no_llm, search=search)
    assert persona.sources, "expected citations from search hits"
    assert all(e.source_url for e in persona.sources)


@pytest.mark.asyncio
async def test_unknown_company_falls_back_gracefully():
    persona = await build_persona("ZzzUnknownCorp", llm_getter=_no_llm, search=_empty_search)
    assert isinstance(persona, CompanyPersona)
    assert persona.name == "ZzzUnknownCorp"
    assert persona.temperament == "wait_and_see"
    assert persona.strategy_thesis  # non-empty generic thesis


@pytest.mark.asyncio
async def test_build_personas_for_sector():
    sector = get_sector()
    personas = await build_personas(sector.incumbents, llm_getter=_no_llm, search=_empty_search)
    assert len(personas) == len(sector.incumbents)
    assert {p.name for p in personas} == set(sector.incumbents)


@pytest.mark.asyncio
async def test_store_persona_round_trip(sim_store):
    persona = await build_persona("Meta", llm_getter=_no_llm, search=_empty_search)
    assert await sim_store.save_persona(persona) is True
    loaded = await sim_store.get_persona("Meta")
    assert loaded is not None
    assert loaded.name == "Meta"
    assert loaded.temperament == persona.temperament


@pytest.mark.asyncio
async def test_cache_hit_skips_search(sim_store):
    search, calls = _counting_search()

    first = await build_persona("Nvidia", llm_getter=_no_llm, search=search, store=sim_store)
    calls_after_first = calls["n"]
    assert calls_after_first > 0
    assert first.name == "Nvidia"

    # Second call should hit the cache and not search again.
    second = await build_persona("Nvidia", llm_getter=_no_llm, search=search, store=sim_store)
    assert calls["n"] == calls_after_first
    assert second.name == "Nvidia"


def test_slugify():
    assert slugify("Alphabet Inc.") == "alphabet-inc"
    assert slugify("") == "unknown"
