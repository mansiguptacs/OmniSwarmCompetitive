"""Backward-compatible alias — product intel comes from web search, not scraping."""

from langchain_core.tools import tool

from tools.base import ToolResult
from tools.web_search import search_products


async def scrape_products(company: str, max_results: int = 5):
    return await search_products(company, max_results=max_results)


@tool
async def web_scrape(company: str) -> str:
    """Search for product and pricing information for a company."""
    items = await search_products(company)
    return ToolResult(success=True, data=[item.model_dump() for item in items]).model_dump_json()
