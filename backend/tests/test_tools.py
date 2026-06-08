import pytest

from state import Competitor, NewsItem
from tools.web_search import search_news
from tools.web_scrape import scrape_products


@pytest.mark.asyncio
async def test_web_search_mock_returns_three_items():
    items = await search_news("Stripe latest news")
    assert len(items) == 3
    assert items[0].title


@pytest.mark.asyncio
async def test_web_scrape_mock_returns_products():
    items = await scrape_products("PayPal")
    assert len(items) >= 1
    assert items[0].name


@pytest.mark.asyncio
async def test_web_search_competitor_specific():
    items = await search_news("PayPal latest news")
    assert len(items) >= 1
    assert "PayPal" in items[0].title
