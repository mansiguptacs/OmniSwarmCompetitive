import pytest

from config import get_settings
from memory.bootstrap import configure_memory_providers
from memory.cache import StubLangCache, get_cache_provider
from memory.factory import get_memory_service, reset_memory_service
from memory.indexing import (
    index_news_items,
    index_session_intel,
    index_synthesis_intel,
    llm_cache_namespace,
)
from memory.iris_vector import IrisVectorSearch
from memory.redis_langcache import RedisLangCache
from memory.schemas import CompanyRecord, VectorDocument
from memory.service import MemoryService
from memory.vector import StubVectorSearch, get_vector_search
from state import Competitor, NewsItem, ProductItem


@pytest.fixture
def fresh_settings(monkeypatch):
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_iris_vector_search_persists_in_redis(redis_client):
    vector = IrisVectorSearch(redis_client)
    doc_id = await vector.index_document(
        VectorDocument(
            session_id="sess-1",
            entity_type="news",
            entity_id="PayPal",
            content="PayPal expands AI fraud detection tools",
        )
    )
    hits = await vector.semantic_search(
        "AI fraud",
        session_id="sess-1",
        filters={"entity_id": "PayPal"},
    )
    assert hits[0]["document_id"] == doc_id
    assert hits[0]["entity_id"] == "PayPal"

    await vector.delete_document(doc_id, session_id="sess-1")
    assert await vector.semantic_search("AI fraud", session_id="sess-1") == []


@pytest.mark.asyncio
async def test_iris_vector_multi_competitor_partitioning(redis_client):
    vector = IrisVectorSearch(redis_client)
    await vector.index_document(
        VectorDocument(
            session_id="sess-2",
            entity_type="news",
            entity_id="PayPal",
            content="PayPal wallet update",
        )
    )
    await vector.index_document(
        VectorDocument(
            session_id="sess-2",
            entity_type="news",
            entity_id="Square",
            content="Square POS hardware launch",
        )
    )

    paypal_hits = await vector.semantic_search(
        "wallet",
        session_id="sess-2",
        filters={"entity_id": "PayPal"},
    )
    square_hits = await vector.semantic_search(
        "POS",
        session_id="sess-2",
        filters={"entity_id": "Square"},
    )
    assert paypal_hits[0]["entity_id"] == "PayPal"
    assert square_hits[0]["entity_id"] == "Square"


@pytest.mark.asyncio
async def test_redis_langcache_persists(redis_client):
    cache = RedisLangCache(redis_client)
    await cache.set("What does Stripe do?", "Payments platform", namespace="sess-3:stripe")
    assert await cache.get("What does Stripe do?", namespace="sess-3:stripe") == "Payments platform"
    assert await cache.delete("What does Stripe do?", namespace="sess-3:stripe") is True


@pytest.mark.asyncio
async def test_index_news_items(redis_client):
    service = MemoryService(redis_client, vector=IrisVectorSearch(redis_client), auto_index=False)
    items = [NewsItem(title="Stripe AI launch", summary="New fraud model")]
    doc_ids = await index_news_items(service, "idx-1", "Stripe", items)
    assert len(doc_ids) == 1
    hits = await service.semantic_search(
        "fraud",
        session_id="idx-1",
        filters={"entity_id": "Stripe", "entity_type": "news"},
    )
    assert len(hits) == 1


@pytest.mark.asyncio
async def test_index_synthesis_intel(redis_client):
    service = MemoryService(redis_client, vector=IrisVectorSearch(redis_client), auto_index=False)
    doc_ids = await index_synthesis_intel(
        service,
        "idx-2",
        "PayPal",
        swot={"strengths": ["Brand"], "weaknesses": [], "opportunities": [], "threats": []},
        landscape_summary="PayPal leads digital wallets",
    )
    assert len(doc_ids) == 2
    hits = await service.semantic_search("digital wallets", session_id="idx-2")
    assert any(hit["entity_type"] == "summary" for hit in hits)


@pytest.mark.asyncio
async def test_index_session_intel_batch(redis_client):
    service = MemoryService(redis_client, vector=IrisVectorSearch(redis_client), auto_index=False)
    result = await index_session_intel(
        service,
        "idx-3",
        company=CompanyRecord(name="Stripe", description="Payments"),
        competitors=[Competitor(name="PayPal")],
        news_by_competitor={"PayPal": [NewsItem(title="PayPal news", summary="Update")]},
        products_by_competitor={
            "PayPal": [ProductItem(name="Wallet", description="Digital wallet")]
        },
        synthesis_by_competitor={
            "PayPal": {"strengths": ["Scale"], "weaknesses": [], "opportunities": [], "threats": []}
        },
        landscape_summary="Competitive payments landscape",
    )
    assert result["company"]
    assert result["competitors"]
    assert result["news"]
    assert result["products"]
    assert result["synthesis"]


@pytest.mark.asyncio
async def test_memory_service_auto_index_on_save(redis_client):
    service = MemoryService(
        redis_client,
        vector=IrisVectorSearch(redis_client),
        auto_index=True,
    )
    await service.save_news(
        "auto-1",
        "Adyen",
        [NewsItem(title="Adyen expands", summary="European growth")],
    )
    hits = await service.semantic_search(
        "European",
        session_id="auto-1",
        filters={"entity_id": "Adyen"},
    )
    assert len(hits) == 1


@pytest.mark.asyncio
async def test_memory_service_index_synthesis_hook(redis_client):
    service = MemoryService(redis_client, vector=IrisVectorSearch(redis_client), auto_index=False)
    doc_ids = await service.index_synthesis(
        "hook-1",
        "Square",
        swot={"strengths": ["POS"], "weaknesses": [], "opportunities": [], "threats": []},
    )
    assert doc_ids


def test_llm_cache_namespace_partitioning():
    assert llm_cache_namespace("session-abc", "PayPal") == "session-abc:paypal"
    assert llm_cache_namespace("session-abc") == "session-abc"


def test_bootstrap_wires_stubs_in_test_env(fresh_settings, monkeypatch):
    monkeypatch.setenv("ENV", "test")
    get_settings.cache_clear()
    configure_memory_providers()
    assert isinstance(get_vector_search(), StubVectorSearch)
    assert isinstance(get_cache_provider(), StubLangCache)


def test_bootstrap_wires_redis_providers_in_dev(fresh_settings, monkeypatch, redis_client):
    monkeypatch.setenv("ENV", "dev")
    monkeypatch.setenv("VECTOR_BACKEND", "redis")
    monkeypatch.setenv("LANGCACHE_BACKEND", "redis")
    get_settings.cache_clear()
    configure_memory_providers()
    service = get_memory_service()
    assert service is not None
    reset_memory_service()
