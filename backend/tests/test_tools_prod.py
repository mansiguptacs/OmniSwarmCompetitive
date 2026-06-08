import os

import pytest

from tools.web_search import search_news, search_products


@pytest.mark.skipif(os.getenv("INTEGRATION") != "1", reason="Set INTEGRATION=1 to run live tool tests")
@pytest.mark.skipif(not os.getenv("TAVILY_API_KEY"), reason="TAVILY_API_KEY required")
@pytest.mark.asyncio
async def test_web_search_live_tavily(monkeypatch):
    monkeypatch.setenv("ENV", "prod")
    monkeypatch.setenv("USE_MOCK_TOOLS", "0")
    from config import get_settings

    get_settings.cache_clear()

    items = await search_news("Stripe payments news", max_results=3)
    get_settings.cache_clear()
    assert len(items) >= 1
    assert items[0].title


@pytest.mark.skipif(os.getenv("INTEGRATION") != "1", reason="Set INTEGRATION=1 to run live tool tests")
@pytest.mark.skipif(not os.getenv("TAVILY_API_KEY"), reason="TAVILY_API_KEY required")
@pytest.mark.asyncio
async def test_search_products_live_tavily(monkeypatch):
    monkeypatch.setenv("ENV", "prod")
    monkeypatch.setenv("USE_MOCK_TOOLS", "0")
    from config import get_settings

    get_settings.cache_clear()

    items = await search_products("Stripe", max_results=3)
    get_settings.cache_clear()
    assert len(items) >= 1
    assert items[0].name
