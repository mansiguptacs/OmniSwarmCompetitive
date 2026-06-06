import pytest
from langchain_core.messages import HumanMessage

from agents.graph import compile_graph
from agents.product_tracker import run_product_tracker
from agents.synthesis import run_synthesis
from state import default_ccie_state, get_competitors, set_competitors, Competitor


@pytest.mark.asyncio
async def test_product_tracker_populates_products(sample_state):
    competitors = [Competitor(name="PayPal")]
    set_competitors(sample_state, competitors)
    config = {"configurable": {"thread_id": "product-test"}}

    result = await run_product_tracker(sample_state, config, competitor_name="PayPal")
    merged = {**sample_state, **result}
    competitor = get_competitors(merged)[0]
    assert len(competitor.products) >= 1


@pytest.mark.asyncio
async def test_synthesis_generates_swot(sample_state):
    competitors = [
        Competitor(name="PayPal", news=[], products=[]),
    ]
    set_competitors(sample_state, competitors)
    config = {"configurable": {"thread_id": "synthesis-test"}}

    await run_synthesis(sample_state, config, competitor_name="PayPal")
    competitor = get_competitors(sample_state)[0]
    assert "strengths" in competitor.swot
    assert "weaknesses" in competitor.swot
    assert "opportunities" in competitor.swot
    assert "threats" in competitor.swot


@pytest.mark.asyncio
async def test_full_integration(orchestrator_graph, redis_client):
    state = default_ccie_state(messages=[HumanMessage(content="Analyze Stripe")])
    config = {"configurable": {"thread_id": "integration-test"}}
    result = await orchestrator_graph.ainvoke(state, config)

    assert result["phase"] == "complete"
    assert len(result["competitors"]) >= 3

    for competitor_data in result["competitors"]:
        competitor = Competitor.model_validate(competitor_data)
        assert competitor.news
        assert competitor.products
        assert competitor.swot

    session_id = result["session_id"]
    assert session_id
    assert await redis_client.has_session(session_id) is True
