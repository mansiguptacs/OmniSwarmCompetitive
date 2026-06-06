"""Tests for Financial Analyst agent and financial data tool."""

import pytest
from langchain_core.messages import HumanMessage
from langchain_core.runnables import RunnableConfig

from state import CCIEState, Competitor, default_ccie_state, get_competitors
from tools.financial_data import (
    MOCK_FINANCIALS,
    _extract_financials_from_search,
    search_financials,
)


@pytest.mark.asyncio
async def test_search_financials_mock():
    result = await search_financials("Stripe")
    assert result["revenue"] == "$14.4B (2023 est.)"
    assert result["valuation"] == "$65B (2023)"
    assert "source" in result


@pytest.mark.asyncio
async def test_search_financials_unknown_company():
    result = await search_financials("UnknownCorp123")
    assert result["revenue"] == "Unknown"


def test_extract_financials_from_search():
    from state import NewsItem

    items = [
        NewsItem(
            title="Acme revenue hits $5 billion",
            url="https://example.com/acme",
            summary="Acme reported revenue of $5 billion and a valuation of $20 billion.",
        ),
        NewsItem(
            title="Acme growth",
            url="https://example.com/acme2",
            summary="The company grew 30% year over year with a market cap of $15 billion.",
        ),
    ]
    result = _extract_financials_from_search("Acme", items)
    assert result.get("revenue") is not None
    assert "5" in result["revenue"]
    assert result.get("growth_rate") is not None
    assert "30" in result["growth_rate"]
    assert result.get("source") == "https://example.com/acme"


@pytest.mark.asyncio
async def test_financial_analyst_populates_state():
    from agents.financial_analyst import run_financial_analyst

    state = default_ccie_state(
        messages=[HumanMessage(content="Analyze Stripe")],
        target_company="Stripe",
        phase="analyzing",
        session_id="test-session",
    )
    state["competitors"] = [
        Competitor(name="PayPal", status="analyzing").model_dump()
    ]

    config = RunnableConfig(configurable={"thread_id": "test"})
    result = await run_financial_analyst(state, config, competitor_name="PayPal")

    competitors = get_competitors(state)
    paypal = next((c for c in competitors if c.name == "PayPal"), None)
    assert paypal is not None
    assert paypal.financials.get("revenue") is not None
    assert paypal.financials.get("source") is not None


def test_mock_financials_coverage():
    assert "stripe" in MOCK_FINANCIALS
    assert "paypal" in MOCK_FINANCIALS
    assert "adyen" in MOCK_FINANCIALS
    assert "square" in MOCK_FINANCIALS
    for company, data in MOCK_FINANCIALS.items():
        assert "revenue" in data, f"{company} missing revenue"
        assert "source" in data, f"{company} missing source"
