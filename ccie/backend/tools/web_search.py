from langchain_core.tools import tool

from config import get_settings
from state import NewsItem
from tools.base import ToolResult

MOCK_STRIPE_NEWS = [
    NewsItem(
        title="Stripe expands global payments",
        url="https://example.com/stripe-global",
        summary="Stripe launches new cross-border payment features.",
        sentiment=0.6,
        published_at="2025-05-01",
    ),
    NewsItem(
        title="Stripe partners with major banks",
        url="https://example.com/stripe-banks",
        summary="Stripe announces banking partnerships in Europe.",
        sentiment=0.5,
        published_at="2025-05-10",
    ),
    NewsItem(
        title="Stripe faces regulatory scrutiny",
        url="https://example.com/stripe-regulation",
        summary="Regulators review Stripe compliance updates.",
        sentiment=-0.1,
        published_at="2025-05-15",
    ),
]

MOCK_COMPETITOR_NEWS = {
    "paypal": [
        NewsItem(
            title="PayPal launches new merchant tools",
            url="https://example.com/paypal-tools",
            summary="PayPal expands SMB payment offerings.",
            sentiment=0.4,
            published_at="2025-05-02",
        ),
    ],
    "adyen": [
        NewsItem(
            title="Adyen reports strong enterprise growth",
            url="https://example.com/adyen-growth",
            summary="Adyen wins large enterprise payment deals.",
            sentiment=0.7,
            published_at="2025-05-03",
        ),
    ],
    "square": [
        NewsItem(
            title="Square introduces new POS features",
            url="https://example.com/square-pos",
            summary="Square enhances in-person payment hardware.",
            sentiment=0.5,
            published_at="2025-05-04",
        ),
    ],
}


class WebSearchTool:
    async def search(self, query: str, max_results: int = 5) -> list[NewsItem]:
        settings = get_settings()
        if settings.use_mock_tools:
            query_lower = query.lower()
            if "competitor" in query_lower or "compete" in query_lower:
                return []
            for key, items in MOCK_COMPETITOR_NEWS.items():
                if key in query_lower:
                    return items[:max_results]
            return MOCK_STRIPE_NEWS[:max_results]

        try:
            from langchain_community.tools.tavily_search import TavilySearchResults

            if not settings.TAVILY_API_KEY:
                return MOCK_STRIPE_NEWS[:max_results]

            search = TavilySearchResults(max_results=max_results)
            results = await search.ainvoke({"query": query})
            news_items: list[NewsItem] = []
            for result in results:
                news_items.append(
                    NewsItem(
                        title=result.get("title", ""),
                        url=result.get("url", ""),
                        summary=result.get("content", ""),
                        sentiment=0.0,
                    )
                )
            return news_items
        except Exception:
            return MOCK_STRIPE_NEWS[:max_results]


_web_search_tool = WebSearchTool()


async def search_news(query: str, max_results: int = 5) -> list[NewsItem]:
    return await _web_search_tool.search(query, max_results=max_results)


@tool
async def web_search(query: str) -> str:
    """Search recent news about a company or market topic."""
    items = await search_news(query)
    return ToolResult(success=True, data=[item.model_dump() for item in items]).model_dump_json()
