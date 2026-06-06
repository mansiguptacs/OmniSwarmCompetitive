import pytest
from unittest.mock import AsyncMock, MagicMock

from llm.client import classify_company, discover_competitors_for_target
from llm.factory import reset_llm_override, set_llm_override
from llm.heuristic import heuristic_classify, heuristic_discover
from llm.schemas import ClassifyResult, DiscoveryResult


@pytest.fixture(autouse=True)
def reset_llm():
    reset_llm_override()
    yield
    reset_llm_override()


@pytest.mark.asyncio
async def test_classify_company_heuristic_fallback():
    result = await classify_company("Analyze Stripe")
    assert result.is_hypothetical is False
    assert result.target_company == "Stripe"


@pytest.mark.asyncio
async def test_classify_company_hypothetical_heuristic():
    text = (
        "I'm building an AI-powered legal document review platform "
        "targeting mid-size law firms"
    )
    result = await classify_company(text)
    assert result.is_hypothetical is True
    assert result.target_description == text


@pytest.mark.asyncio
async def test_discover_competitors_heuristic_fallback():
    result = await discover_competitors_for_target("Stripe", is_hypothetical=False)
    assert "PayPal" in result.competitors
    assert "Adyen" in result.competitors


@pytest.mark.asyncio
async def test_discover_competitors_apple_not_stripe_defaults():
    result = await discover_competitors_for_target("Apple", is_hypothetical=False)
    assert result.competitors
    assert "PayPal" not in result.competitors
    assert "Adyen" not in result.competitors
    assert "Square" not in result.competitors


@pytest.mark.asyncio
async def test_discover_competitors_hypothetical_heuristic():
    text = "AI legal document review for mid-size law firms"
    result = await discover_competitors_for_target("", True, text)
    assert len(result.competitors) >= 3


@pytest.mark.asyncio
async def test_classify_company_with_mock_llm():
    mock_structured = AsyncMock(
        return_value=ClassifyResult(
            is_hypothetical=False,
            target_company="Stripe",
            target_description="",
            reasoning="mock",
        )
    )
    mock_llm = MagicMock()
    mock_llm.with_structured_output.return_value = mock_structured
    set_llm_override(mock_llm)

    result = await classify_company("Analyze Stripe")
    assert result.target_company == "Stripe"
    mock_llm.with_structured_output.assert_called_once_with(ClassifyResult)
    mock_structured.ainvoke.assert_awaited_once()


@pytest.mark.asyncio
async def test_discover_competitors_with_mock_llm():
    mock_structured = AsyncMock(
        return_value=DiscoveryResult(
            competitors=["PayPal", "Adyen", "Square"],
            reasoning="mock discovery",
        )
    )
    mock_llm = MagicMock()
    mock_llm.with_structured_output.return_value = mock_structured
    mock_structured.ainvoke = AsyncMock(
        return_value=DiscoveryResult(
            competitors=["PayPal", "Adyen", "Square"],
            reasoning="mock discovery",
        )
    )
    set_llm_override(mock_llm)

    result = await discover_competitors_for_target("Stripe", is_hypothetical=False)
    assert result.competitors == ["PayPal", "Adyen", "Square"]
    mock_llm.with_structured_output.assert_called_once_with(DiscoveryResult)


@pytest.mark.asyncio
async def test_discover_competitors_llm_empty_falls_back():
    mock_structured = AsyncMock(
        return_value=DiscoveryResult(competitors=[], reasoning="empty")
    )
    mock_llm = MagicMock()
    mock_llm.with_structured_output.return_value = mock_structured
    mock_structured.ainvoke = AsyncMock(
        return_value=DiscoveryResult(competitors=[], reasoning="empty")
    )
    set_llm_override(mock_llm)

    result = await discover_competitors_for_target("Stripe", is_hypothetical=False)
    assert "PayPal" in result.competitors


def test_heuristic_classify_real():
    result = heuristic_classify("Analyze Stripe")
    assert result.is_hypothetical is False
    assert result.target_company == "Stripe"


def test_heuristic_discover_stripe():
    result = heuristic_discover("Stripe", is_hypothetical=False)
    assert "PayPal" in result.competitors


@pytest.mark.integration
@pytest.mark.asyncio
async def test_classify_company_live_llm(monkeypatch):
    import os

    if os.getenv("INTEGRATION") != "1" or not os.getenv("OPENAI_API_KEY"):
        pytest.skip("Set INTEGRATION=1 and OPENAI_API_KEY for live LLM test")

    from config import get_settings

    reset_llm_override()
    monkeypatch.setenv("ENV", "prod")
    get_settings.cache_clear()

    result = await classify_company("Analyze Stripe")
    assert result.is_hypothetical is False
    assert "stripe" in result.target_company.lower()

    get_settings.cache_clear()
