import logging
import re
from datetime import date

from langchain_core.tools import tool

from config import get_settings
from state import NewsItem, ProductItem
from tools.base import ToolResult

logger = logging.getLogger(__name__)

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

MOCK_PRODUCTS = {
    "stripe": [
        ProductItem(
            name="Payments API",
            description="Online payment processing for internet businesses.",
            pricing="2.9% + 30¢ per transaction",
        ),
        ProductItem(
            name="Billing",
            description="Subscription and invoicing management.",
            pricing="0.5% on recurring charges",
        ),
    ],
    "paypal": [
        ProductItem(
            name="Checkout",
            description="Consumer and merchant checkout solutions.",
            pricing="2.99% + fixed fee",
        ),
    ],
    "adyen": [
        ProductItem(
            name="Unified Commerce",
            description="Enterprise payment platform for global brands.",
            pricing="Custom enterprise pricing",
        ),
    ],
    "square": [
        ProductItem(
            name="Square POS",
            description="Point-of-sale hardware and software.",
            pricing="2.6% + 10¢ per transaction",
        ),
    ],
}


def _mock_competitor_discovery_results(query_lower: str, max_results: int) -> list[NewsItem]:
    discovery_map = {
        "stripe": ["PayPal", "Adyen", "Square"],
        "paypal": ["Stripe", "Adyen", "Square"],
        "apple": ["Samsung", "Google", "Microsoft"],
        "google": ["Microsoft", "Apple", "Amazon"],
        "microsoft": ["Google", "Apple", "Amazon"],
        "legal": ["Kira Systems", "Luminance", "Harvey AI"],
    }
    for key, names in discovery_map.items():
        if key in query_lower:
            return [
                NewsItem(
                    title=f"{name} competes in the same market",
                    url=f"https://example.com/{key}-{name.lower().replace(' ', '-')}",
                    summary=f"{name} is a key competitor in the {key} space.",
                    sentiment=0.0,
                )
                for name in names[:max_results]
            ]
    target = query_lower.replace("competitors", "").replace("competitor", "").strip()
    fallback_names = [f"{target.title()} rival {index}" for index in range(1, max_results + 1)]
    return [
        NewsItem(
            title=f"{name} competes in the same market",
            url=f"https://example.com/competitor-{index}",
            summary=f"{name} frequently cited as a competitor.",
            sentiment=0.0,
        )
        for index, name in enumerate(fallback_names, start=1)
    ]


def _mock_search(query: str, max_results: int) -> list[NewsItem]:
    query_lower = query.lower()
    if "competitor" in query_lower or "compete" in query_lower:
        return _mock_competitor_discovery_results(query_lower, max_results)
    if any(token in query_lower for token in ("product", "pricing", "plan", "feature")):
        company_key = next((key for key in MOCK_PRODUCTS if key in query_lower), "stripe")
        return [
            NewsItem(
                title=product.name,
                url=f"https://example.com/{company_key}-{product.name.lower().replace(' ', '-')}",
                summary=product.description,
                sentiment=0.0,
            )
            for product in MOCK_PRODUCTS[company_key][:max_results]
        ]
    for key, items in MOCK_COMPETITOR_NEWS.items():
        if key in query_lower:
            return items[:max_results]
    # Generate company-specific mock news for any company
    company = query_lower.replace("latest news", "").replace("news", "").strip()
    if company:
        name = company.title()
        return [
            NewsItem(
                title=f"{name} announces strategic expansion plans",
                url=f"https://techcrunch.com/2025/{name.lower().replace(' ', '-')}-expansion",
                summary=f"{name} is investing in new markets and product lines as part of their growth strategy.",
                sentiment=0.5,
                published_at="2025-05-20",
            ),
            NewsItem(
                title=f"{name} reports strong quarterly performance",
                url=f"https://reuters.com/business/{name.lower().replace(' ', '-')}-earnings",
                summary=f"{name} exceeded market expectations in their latest earnings report with revenue growth.",
                sentiment=0.6,
                published_at="2025-05-15",
            ),
            NewsItem(
                title=f"{name} faces competitive pressure in core market",
                url=f"https://bloomberg.com/news/{name.lower().replace(' ', '-')}-competition",
                summary=f"Analysts note increasing competitive pressure on {name} from emerging players in the space.",
                sentiment=-0.2,
                published_at="2025-05-10",
            ),
        ][:max_results]
    return MOCK_STRIPE_NEWS[:max_results]


_DATE_PATTERN = re.compile(
    r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}"
    r"|"
    r"\d{4}-\d{2}-\d{2}"
)
_MONTH_MAP = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}


def _extract_date_from_text(text: str) -> str:
    """Best-effort date extraction from content when published_date is missing."""
    match = _DATE_PATTERN.search(text)
    if not match:
        return ""
    raw = match.group()
    if re.match(r"\d{4}-\d{2}-\d{2}", raw):
        return raw
    try:
        parts = re.sub(r"[.,]", "", raw).split()
        month_str = parts[0][:3].lower()
        month = _MONTH_MAP.get(month_str, 1)
        day = int(parts[1])
        year = int(parts[2])
        return date(year, month, day).isoformat()
    except (ValueError, IndexError):
        return ""


def _tavily_result_to_news_item(result: dict | str) -> NewsItem:
    if isinstance(result, str):
        return NewsItem(title="Untitled", summary=result, published_at=_extract_date_from_text(result))
    published = str(result.get("published_date", "") or "").strip()
    if not published:
        content = result.get("content", "") or result.get("raw_content", "") or ""
        title = result.get("title", "") or ""
        published = _extract_date_from_text(f"{title} {content}")
    return NewsItem(
        title=result.get("title", "") or "Untitled",
        url=result.get("url", ""),
        summary=result.get("content", "") or result.get("raw_content", "") or "",
        sentiment=0.0,
        published_at=published,
    )


def _search_hit_to_product(hit: NewsItem) -> ProductItem:
    combined = f"{hit.title} {hit.summary}".strip()
    pricing = "See source"
    if any(symbol in combined for symbol in ("%", "$", "€", "£")):
        pricing = hit.summary or hit.title
    return ProductItem(
        name=hit.title,
        description=hit.summary,
        pricing=pricing,
    )


class WebSearchTool:
    async def search(self, query: str, max_results: int = 5) -> list[NewsItem]:
        settings = get_settings()
        if settings.use_mock_tools:
            return _mock_search(query, max_results)

        if not settings.TAVILY_API_KEY:
            logger.warning("TAVILY_API_KEY not set — returning empty search results")
            return []

        try:
            return await _tavily_search_raw(query, settings.TAVILY_API_KEY, max_results)
        except Exception as exc:
            logger.exception("Tavily search failed for query %r: %s", query, exc)
            return []


async def _tavily_search_raw(query: str, api_key: str, max_results: int = 5) -> list[NewsItem]:
    """Call Tavily REST API directly — avoids the deprecated LangChain wrapper."""
    import httpx

    search_depth = "advanced" if ("news" in query.lower() or "latest" in query.lower()) else "basic"

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            "https://api.tavily.com/search",
            json={
                "api_key": api_key,
                "query": query,
                "max_results": max_results,
                "search_depth": search_depth,
                "include_answer": False,
                "include_raw_content": False,
            },
        )
        resp.raise_for_status()
        data = resp.json()

    results = data.get("results", [])
    return [_tavily_result_to_news_item(r) for r in results[:max_results]]


_web_search_tool = WebSearchTool()


async def search_news(query: str, max_results: int = 5) -> list[NewsItem]:
    return await _web_search_tool.search(query, max_results=max_results)


async def search_products(company: str, max_results: int = 5) -> list[ProductItem]:
    settings = get_settings()
    company_key = company.lower().strip()
    if settings.use_mock_tools:
        if company_key in MOCK_PRODUCTS:
            return MOCK_PRODUCTS[company_key][:max_results]
        name = company.strip().title()
        return [
            ProductItem(name=f"{name} Core Platform", description=f"Main product offering from {name}", pricing="Contact sales"),
            ProductItem(name=f"{name} Enterprise", description=f"Enterprise-grade solution with advanced features", pricing="Custom pricing"),
            ProductItem(name=f"{name} Analytics", description=f"Data and analytics tools for business intelligence", pricing="Included"),
        ][:max_results]

    hits = await search_news(
        f"{company} products pricing plans features",
        max_results=max_results,
    )
    return [_search_hit_to_product(hit) for hit in hits]


@tool
async def web_search(query: str) -> str:
    """Search the web for news, products, pricing, or competitive intelligence."""
    items = await search_news(query)
    return ToolResult(success=True, data=[item.model_dump() for item in items]).model_dump_json()
