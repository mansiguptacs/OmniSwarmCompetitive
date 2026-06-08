"""Financial data tool — fetch revenue, funding, market cap via Tavily search + LLM extraction."""

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
    """Regex fallback: parse financial figures from search result snippets."""
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


async def _llm_extract_financials(company: str, results: list[NewsItem]) -> dict:
    """Use LLM structured output to extract financials from search snippets."""
    from langchain_core.messages import HumanMessage
    from llm.factory import get_llm
    from llm.schemas import FinancialResult

    llm = get_llm()
    if llm is None:
        return {}

    context = "\n".join(
        f"- [{r.title}]({r.url}): {r.summary[:300]}"
        for r in results if r.summary
    )
    if not context.strip():
        return {}

    structured = llm.with_structured_output(FinancialResult)
    prompt = (
        f"Extract financial data for {company} from these search results.\n"
        "Return empty string for any field you cannot find concrete data for.\n"
        "Use the most recent figures available. Include currency and year where possible.\n\n"
        f"Search results:\n{context}"
    )
    try:
        result = await structured.ainvoke([HumanMessage(content=prompt)])
        if isinstance(result, FinancialResult):
            parsed = result
        else:
            parsed = FinancialResult.model_validate(result)
        fin = {k: v for k, v in parsed.model_dump().items() if v}
        if results:
            fin["source"] = results[0].url
        return fin
    except Exception:
        logger.debug("LLM financial extraction failed for %s", company, exc_info=True)
        return {}


async def search_financials(company: str) -> dict:
    """Fetch financial data for a company. Returns a financials dict."""
    settings = get_settings()
    company_key = company.lower().strip()

    if settings.use_mock_tools:
        return MOCK_FINANCIALS.get(company_key, {
            "revenue": f"${(hash(company_key) % 50 + 1) * 100}M (est.)",
            "funding_total": f"${(hash(company_key) % 20 + 1) * 50}M",
            "valuation": f"${(hash(company_key) % 30 + 2)}B (est.)",
            "market_cap": f"${(hash(company_key) % 100 + 5)}B",
            "growth_rate": f"{(hash(company_key) % 35 + 5)}% YoY",
            "employee_count": f"{(hash(company_key) % 50 + 1) * 1000}+",
            "source": f"https://finance.example.com/{company_key}",
        })

    if not settings.TAVILY_API_KEY:
        logger.warning("TAVILY_API_KEY not set — returning empty financials")
        return {}

    try:
        import httpx

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": settings.TAVILY_API_KEY,
                    "query": f"{company} revenue funding valuation market cap financials 2024 2025",
                    "max_results": 3,
                    "search_depth": "basic",
                    "include_answer": False,
                    "include_raw_content": False,
                },
            )
            resp.raise_for_status()
            data = resp.json()

        raw_results = data.get("results", [])
        if not raw_results:
            return {}

        news_items = [
            NewsItem(
                title=r.get("title", ""),
                url=r.get("url", ""),
                summary=r.get("content", ""),
            )
            for r in raw_results
        ]

        llm_result = await _llm_extract_financials(company, news_items)
        if llm_result and len(llm_result) > 1:
            return llm_result

        return _extract_financials_from_search(company, news_items)
    except Exception as exc:
        logger.exception("Financial search failed for %r: %s", company, exc)
        return {}
