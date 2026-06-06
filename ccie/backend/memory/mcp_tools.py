"""MCP-ready memory query tools — callable interfaces for agent tool registration."""

from __future__ import annotations

from memory.factory import get_memory_service
from memory.schemas import CompanyRecord, CompetitorRecord, ProductRecord
from state import NewsItem, ProductItem


async def mcp_lookup_company(session_id: str, name: str) -> dict | None:
    """MCP tool: fetch target company profile from memory."""
    service = get_memory_service()
    record = await service.lookup_company(session_id, name)
    return record.model_dump() if record else None


async def mcp_lookup_competitor(session_id: str, name: str) -> dict | None:
    """MCP tool: fetch a competitor profile by name."""
    service = get_memory_service()
    record = await service.lookup_competitor(session_id, name)
    return record.model_dump() if record else None


async def mcp_lookup_news(
    session_id: str, company: str, *, limit: int = 20
) -> list[dict]:
    """MCP tool: fetch stored news items for a company or competitor."""
    service = get_memory_service()
    items = await service.lookup_news(session_id, company, limit=limit)
    return [_news_to_dict(item, session_id=session_id, company=company) for item in items]


async def mcp_lookup_products(session_id: str, company: str) -> list[dict]:
    """MCP tool: fetch stored product intel for a company."""
    service = get_memory_service()
    records = await service.lookup_products_as_records(session_id, company)
    return [record.model_dump() for record in records]


def _news_to_dict(
    item: NewsItem, *, session_id: str = "", company: str = ""
) -> dict:
    payload = item.model_dump()
    payload["session_id"] = session_id
    payload["company"] = company
    return payload


# Tool metadata for future MCP server registration.
MCP_TOOL_REGISTRY: dict[str, dict] = {
    "lookup_company": {
        "callable": mcp_lookup_company,
        "description": "Look up target company profile from competitive memory",
        "params": ["session_id", "name"],
        "returns": CompanyRecord.__name__,
    },
    "lookup_competitor": {
        "callable": mcp_lookup_competitor,
        "description": "Look up a competitor profile by name",
        "params": ["session_id", "name"],
        "returns": CompetitorRecord.__name__,
    },
    "lookup_news": {
        "callable": mcp_lookup_news,
        "description": "Fetch stored news items for a company or competitor",
        "params": ["session_id", "company", "limit"],
        "returns": "list[NewsItem]",
    },
    "lookup_products": {
        "callable": mcp_lookup_products,
        "description": "Fetch stored product intel for a company",
        "params": ["session_id", "company"],
        "returns": "list[ProductRecord]",
    },
}
