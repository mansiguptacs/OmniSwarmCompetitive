import pytest
from langchain_core.runnables import RunnableConfig

from agents.news_scout import run_news_scout
from state import default_ccie_state, get_competitors


@pytest.mark.asyncio
async def test_news_scout_populates_news(sample_state):
    config = RunnableConfig(configurable={"thread_id": "news-test"})
    result = await run_news_scout(sample_state, config, competitor_name="Stripe")

    competitors = get_competitors({**sample_state, **result})
    assert len(competitors) >= 1
    stripe = next(c for c in competitors if c.name == "Stripe")
    assert len(stripe.news) == 3
    assert stripe.sentiment != 0.0


@pytest.mark.asyncio
async def test_news_scout_logs_activity(sample_state):
    config = RunnableConfig(configurable={"thread_id": "news-activity-test"})
    result = await run_news_scout(sample_state, config, competitor_name="Stripe")

    agents = [entry["agent"] for entry in result["agent_activity"]]
    assert "News Scout" in agents
