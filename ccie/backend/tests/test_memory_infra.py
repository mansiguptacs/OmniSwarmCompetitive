import pytest

from memory.factory import get_memory_service, set_memory_service
from memory.health import check_redis_connection, format_health_status, verify_redis_on_startup
from memory.mcp_tools import (
    MCP_TOOL_REGISTRY,
    mcp_lookup_company,
    mcp_lookup_competitor,
    mcp_lookup_news,
    mcp_lookup_products,
)
from memory.schemas import CompanyRecord, IRIS_SCHEMA_REGISTRY
from memory.service import MemoryService
from memory.vector import StubVectorSearch, get_vector_search, set_vector_search
from state import Competitor, NewsItem, ProductItem


@pytest.mark.asyncio
async def test_redis_ping(redis_client):
    result = await redis_client.ping()
    assert result["connected"] is True
    assert result["latency_ms"] is not None


@pytest.mark.asyncio
async def test_check_redis_connection(redis_client):
    result = await check_redis_connection()
    assert result["connected"] is True


@pytest.mark.asyncio
async def test_verify_redis_on_startup_non_strict(redis_client):
    result = await verify_redis_on_startup(strict=False)
    assert result["connected"] is True


def test_format_health_status_connected():
    payload = format_health_status({"connected": True, "latency_ms": 1.5})
    assert payload == {"connected": True, "latency_ms": 1.5}


def test_format_health_status_disconnected():
    payload = format_health_status(
        {"connected": False, "latency_ms": None, "error": "connection refused"}
    )
    assert payload["connected"] is False
    assert payload["error"] == "connection refused"


@pytest.mark.asyncio
async def test_save_and_get_company(redis_client):
    service = MemoryService(redis_client)
    company = CompanyRecord(name="Stripe", description="Payments platform")
    await service.save_company("session-co", company)
    found = await service.lookup_company("session-co", "Stripe")
    assert found is not None
    assert found.name == "Stripe"


@pytest.mark.asyncio
async def test_save_and_get_products(redis_client):
    service = MemoryService(redis_client)
    products = [ProductItem(name="Payments API", pricing="$0.30 + 2.9%")]
    await service.save_products("session-pr", "Stripe", products)
    loaded = await service.lookup_products("session-pr", "Stripe")
    assert len(loaded) == 1
    assert loaded[0].name == "Payments API"


@pytest.mark.asyncio
async def test_memory_service_competitor_lookup(redis_client):
    service = MemoryService(redis_client)
    await service.save_competitors(
        "session-comp",
        [Competitor(name="PayPal", threat_level=0.8)],
    )
    record = await service.lookup_competitor("session-comp", "PayPal")
    assert record is not None
    assert record.name == "PayPal"
    assert record.threat_level == 0.8


@pytest.mark.asyncio
async def test_memory_service_semantic_search_stub(redis_client):
    service = MemoryService(redis_client)
    results = await service.semantic_search("competitors pivoting to AI")
    assert results == []


@pytest.mark.asyncio
async def test_get_memory_service_factory(redis_client):
    service = get_memory_service()
    await service.save_news(
        "session-factory",
        "Adyen",
        [NewsItem(title="Adyen expands", sentiment=0.3)],
    )
    items = await service.lookup_news("session-factory", "Adyen")
    assert len(items) == 1


@pytest.mark.asyncio
async def test_mcp_lookup_company(redis_client):
    service = MemoryService(redis_client)
    set_memory_service(service)
    await service.save_company("mcp-co", CompanyRecord(name="Stripe"))
    result = await mcp_lookup_company("mcp-co", "Stripe")
    assert result["name"] == "Stripe"


@pytest.mark.asyncio
async def test_mcp_lookup_competitor(redis_client):
    service = MemoryService(redis_client)
    set_memory_service(service)
    await service.save_competitors("mcp-comp", [Competitor(name="Square")])
    result = await mcp_lookup_competitor("mcp-comp", "Square")
    assert result["name"] == "Square"


@pytest.mark.asyncio
async def test_mcp_lookup_news(redis_client, sample_news):
    service = MemoryService(redis_client)
    set_memory_service(service)
    await service.save_news("mcp-news", "Stripe", sample_news)
    results = await mcp_lookup_news("mcp-news", "Stripe", limit=2)
    assert len(results) == 2
    assert results[0]["company"] == "Stripe"


@pytest.mark.asyncio
async def test_mcp_lookup_products(redis_client):
    service = MemoryService(redis_client)
    set_memory_service(service)
    await service.save_products(
        "mcp-prod",
        "Stripe",
        [ProductItem(name="Billing", pricing="Usage-based")],
    )
    results = await mcp_lookup_products("mcp-prod", "Stripe")
    assert len(results) == 1
    assert results[0]["company"] == "Stripe"


def test_mcp_tool_registry_has_four_tools():
    assert set(MCP_TOOL_REGISTRY) == {
        "lookup_company",
        "lookup_competitor",
        "lookup_news",
        "lookup_products",
    }


def test_iris_schema_registry():
    assert set(IRIS_SCHEMA_REGISTRY) == {
        "Company",
        "Competitor",
        "NewsItem",
        "Product",
        "VectorDocument",
    }


@pytest.mark.asyncio
async def test_stub_vector_search_empty():
    stub = StubVectorSearch()
    assert await stub.semantic_search("test query", session_id="s1") == []
