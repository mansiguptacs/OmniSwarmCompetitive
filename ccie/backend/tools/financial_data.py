"""Financial data tool — fetch revenue, funding, market cap via Tavily search."""

import logging
import re

from config import get_settings
from state import NewsItem

logger = logging.getLogger(__name__)

MOCK_FINANCIALS = {
    "stripe": {
        "revenue": "$14.4B (2023 est.)",
        "funding_total": "$8.7B",
        "valuation": "$65B (2023)",
        "market_cap": "Private",
        "growth_rate": "25% YoY",
        "source": "https://example.com/stripe-financials",
    },
    "paypal": {
        "revenue": "$29.8B (2023)",
        "funding_total": "N/A (public)",
        "valuation": "N/A",
        "market_cap": "$72B",
        "growth_rate": "8% YoY",
        "source": "https://example.com/paypal-financials",
    },
    "adyen": {
        "revenue": "€1.6B (2023)",
        "funding_total": "N/A (public)",
        "valuation": "N/A",
        "market_cap": "€45B",
        "growth_rate": "22% YoY",
        "source": "https://example.com/adyen-financials",
    },
    "square": {
        "revenue": "$21.9B (2023, Block Inc.)",
        "funding_total": "N/A (public)",
        "valuation": "N/A",
        "market_cap": "$38B",
        "growth_rate": "12% YoY",
        "source": "https://example.com/square-financials",
    },
}


def _extract_financials_from_search(company: str, results: list[NewsItem]) -> dict:
    """Parse financial figures from search result snippets."""
    financials: dict = {"source": ""}
    text = " ".join(f"{r.title} {r.summary}" for r in results)

    if results:
        financials["source"] = results[0].url

    revenue = re.search(
        r"revenue\s+(?:of\s+)?\$?([\d,.]+\s*(?:billion|million|B|M|T))",
        text, re.IGNORECASE,
    )
    if revenue:
        financials["revenue"] = f"${revenue.group(1)}"

    funding = re.search(
        r"(?:funding|raised|series)\s*[:\s]+\$?([\d,.]+\s*(?:billion|million|B|M))",
        text, re.IGNORECASE,
    )
    if funding:
        financials["funding_total"] = f"${funding.group(1)}"

    valuation = re.search(
        r"valuation?[:\s]+\$?([\d,.]+\s*(?:billion|million|B|M|T))",
        text, re.IGNORECASE,
    )
    if valuation:
        financials["valuation"] = f"${valuation.group(1)}"

    market_cap = re.search(
        r"market\s*cap(?:italization)?[:\s]+\$?([\d,.]+\s*(?:billion|million|B|M|T))",
        text, re.IGNORECASE,
    )
    if market_cap:
        financials["market_cap"] = f"${market_cap.group(1)}"

    growth = re.search(
        r"(?:growth|grew|revenue grew)[:\s]+(\d+\.?\d*)\s*%",
        text, re.IGNORECASE,
    )
    if growth:
        financials["growth_rate"] = f"{growth.group(1)}% YoY"

    return financials


async def search_financials(company: str) -> dict:
    """Fetch financial data for a company. Returns a financials dict."""
    settings = get_settings()
    company_key = company.lower().strip()

    if settings.use_mock_tools:
        return MOCK_FINANCIALS.get(company_key, {
            "revenue": "Unknown",
            "funding_total": "Unknown",
            "valuation": "Unknown",
            "market_cap": "Unknown",
            "growth_rate": "Unknown",
            "source": "",
        })

    if not settings.TAVILY_API_KEY:
        logger.warning("TAVILY_API_KEY not set — returning empty financials")
        return {}

    try:
        from langchain_community.tools.tavily_search import TavilySearchResults

        search = TavilySearchResults(
            max_results=3,
            api_key=settings.TAVILY_API_KEY,
            include_answer=False,
            include_raw_content=False,
        )
        results = await search.ainvoke({
            "query": f"{company} revenue funding valuation market cap financials 2024 2025"
        })
        if not results:
            return {}

        news_items = []
        for r in results:
            if isinstance(r, str):
                news_items.append(NewsItem(title="", summary=r))
            else:
                news_items.append(NewsItem(
                    title=r.get("title", ""),
                    url=r.get("url", ""),
                    summary=r.get("content", ""),
                ))
        return _extract_financials_from_search(company, news_items)
    except Exception as exc:
        logger.exception("Financial search failed for %r: %s", company, exc)
        return {}
