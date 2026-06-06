import pytest

from state import Competitor, NewsItem


@pytest.mark.asyncio
async def test_save_and_get_news(redis_client, sample_news):
    await redis_client.save_news("session-1", "Stripe", sample_news)
    loaded = await redis_client.get_news("session-1", "Stripe")
    assert len(loaded) == 3
    assert loaded[0].title == sample_news[0].title


@pytest.mark.asyncio
async def test_save_and_get_competitors(redis_client):
    competitors = [
        Competitor(name="PayPal"),
        Competitor(name="Adyen"),
    ]
    await redis_client.save_competitors("session-1", competitors)
    loaded = await redis_client.get_competitors("session-1")
    assert len(loaded) == 2
    assert loaded[0].name == "PayPal"


@pytest.mark.asyncio
async def test_has_session(redis_client):
    assert await redis_client.has_session("missing") is False
    await redis_client.save_competitors("session-2", [Competitor(name="Square")])
    assert await redis_client.has_session("session-2") is True
