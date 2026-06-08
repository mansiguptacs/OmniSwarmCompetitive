import pytest

from memory.cache import (
    CacheConfig,
    StubLangCache,
    get_cache_provider,
    set_cache_provider,
)
from memory.schemas import VectorDocument
from memory.service import MemoryService
from memory.vector import StubVectorSearch, VectorSearchConfig


@pytest.mark.asyncio
async def test_vector_index_update_delete_lifecycle():
    vector = StubVectorSearch()
    doc_id = await vector.index_document(
        VectorDocument(
            session_id="s1",
            entity_type="news",
            entity_id="stripe-1",
            content="Stripe is pivoting to AI-powered fraud detection",
        )
    )
    assert doc_id

    await vector.update_document(
        doc_id,
        VectorDocument(
            session_id="s1",
            entity_type="news",
            entity_id="stripe-1",
            content="Stripe expands AI fraud tools globally",
        ),
    )

    hits = await vector.semantic_search("AI fraud", session_id="s1")
    assert len(hits) == 1
    assert hits[0]["document_id"] == doc_id

    deleted = await vector.delete_document(doc_id, session_id="s1")
    assert deleted is True
    assert await vector.semantic_search("AI fraud", session_id="s1") == []


@pytest.mark.asyncio
async def test_vector_semantic_search_filters():
    vector = StubVectorSearch()
    await vector.index_document(
        VectorDocument(
            session_id="s1",
            entity_type="news",
            entity_id="paypal",
            content="PayPal launches new wallet",
        )
    )
    await vector.index_document(
        VectorDocument(
            session_id="s1",
            entity_type="product",
            entity_id="paypal",
            content="PayPal launches new wallet feature",
        )
    )

    news_hits = await vector.semantic_search(
        "wallet",
        session_id="s1",
        filters={"entity_type": "news"},
    )
    assert len(news_hits) == 1
    assert news_hits[0]["entity_type"] == "news"


@pytest.mark.asyncio
async def test_vector_search_config():
    config = VectorSearchConfig(index_name="ccie_demo", default_limit=5)
    vector = StubVectorSearch(config)
    for i in range(8):
        await vector.index_document(
            VectorDocument(session_id="s1", content=f"competitor intel item {i}")
        )
    hits = await vector.semantic_search("intel", session_id="s1")
    assert len(hits) == 5


@pytest.mark.asyncio
async def test_memory_service_document_lifecycle(redis_client):
    service = MemoryService(redis_client, vector=StubVectorSearch())
    doc_id = await service.index_document(
        VectorDocument(
            session_id="svc-1",
            entity_type="summary",
            content="Square is strongest in in-person POS",
        )
    )
    results = await service.semantic_search(
        "POS",
        session_id="svc-1",
        filters={"entity_type": "summary"},
    )
    assert results[0]["document_id"] == doc_id


@pytest.mark.asyncio
async def test_stub_lang_cache_get_set_delete():
    cache = StubLangCache()
    await cache.set("prompt-1", "cached answer", namespace="ccie")
    assert await cache.get("prompt-1", namespace="ccie") == "cached answer"
    assert await cache.delete("prompt-1", namespace="ccie") is True
    assert await cache.get("prompt-1", namespace="ccie") is None


@pytest.mark.asyncio
async def test_stub_lang_cache_get_or_compute():
    cache = StubLangCache()
    calls = {"count": 0}

    async def compute():
        calls["count"] += 1
        return "computed"

    first = await cache.get_or_compute("q1", compute, namespace="llm")
    second = await cache.get_or_compute("q1", compute, namespace="llm")
    assert first == "computed"
    assert second == "computed"
    assert calls["count"] == 1


@pytest.mark.asyncio
async def test_stub_lang_cache_disabled():
    cache = StubLangCache(CacheConfig(enabled=False))
    await cache.set("k", "v")
    assert await cache.get("k") is None


@pytest.mark.asyncio
async def test_memory_service_cache_methods(redis_client):
    service = MemoryService(redis_client, cache=StubLangCache())
    await service.cache_response("What does Stripe do?", "Payments platform", namespace="llm")
    cached = await service.get_cached_response("What does Stripe do?", namespace="llm")
    assert cached == "Payments platform"


@pytest.mark.asyncio
async def test_memory_service_get_or_cache_response(redis_client):
    service = MemoryService(redis_client, cache=StubLangCache())
    calls = {"n": 0}

    async def compute():
        calls["n"] += 1
        return "fresh intel"

    r1 = await service.get_or_cache_response("query-a", compute, namespace="agents")
    r2 = await service.get_or_cache_response("query-a", compute, namespace="agents")
    assert r1 == "fresh intel"
    assert r2 == "fresh intel"
    assert calls["n"] == 1


@pytest.mark.asyncio
async def test_injectable_cache_provider(redis_client):
    class TrackingCache:
        def __init__(self):
            self.keys: list[str] = []

        async def get(self, key, *, namespace="default"):
            return None

        async def set(self, key, value, *, namespace="default", ttl_seconds=None):
            self.keys.append(f"{namespace}:{key}")

        async def delete(self, key, *, namespace="default"):
            return False

        async def get_or_compute(self, key, compute, *, namespace="default", ttl_seconds=None):
            return str(compute())

    tracking = TrackingCache()
    set_cache_provider(tracking)
    service = MemoryService(redis_client, cache=get_cache_provider())
    await service.cache_response("p", "r", namespace="test")
    assert tracking.keys == ["test:p"]


@pytest.mark.asyncio
async def test_injectable_vector_search_provider(redis_client):
    class FakeVectorSearch:
        async def index_document(self, document):
            return "fake-id"

        async def update_document(self, document_id, document):
            pass

        async def delete_document(self, document_id, *, session_id=None):
            return True

        async def semantic_search(self, query, *, session_id=None, limit=10, filters=None):
            return [{"document_id": "fake-id", "score": 0.9, "content": query}]

    from memory.vector import get_vector_search, set_vector_search

    set_vector_search(FakeVectorSearch())
    service = MemoryService(redis_client, vector=get_vector_search())
    results = await service.semantic_search("threat analysis", session_id="vec-1")
    assert results[0]["content"] == "threat analysis"
