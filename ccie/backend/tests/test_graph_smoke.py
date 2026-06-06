import pytest
from langchain_core.messages import HumanMessage

from agents.graph import compile_graph
from state import default_ccie_state


@pytest.fixture
def echo_graph():
    return compile_graph(echo=True)


@pytest.fixture
def orchestrator_graph():
    return compile_graph(echo=False)


@pytest.mark.asyncio
async def test_echo_graph_completes(echo_graph):
    state = default_ccie_state(messages=[HumanMessage(content="Analyze Stripe")])
    config = {"configurable": {"thread_id": "test-thread-echo"}}
    result = await echo_graph.ainvoke(state, config)
    assert result["phase"] == "complete"
    assert result["target_company"] == "Stripe"
    assert len(result["agent_activity"]) >= 1


@pytest.mark.asyncio
async def test_orchestrator_graph_full_run(orchestrator_graph):
    state = default_ccie_state(messages=[HumanMessage(content="Analyze Stripe")])
    config = {"configurable": {"thread_id": "test-thread-orchestrator"}}
    result = await orchestrator_graph.ainvoke(state, config)
    assert result["phase"] == "complete"
    assert result["is_hypothetical"] is False
    assert result["target_company"] == "Stripe"
    assert len(result["competitors"]) >= 3
    assert result["landscape_summary"]


def test_health_endpoint():
    from fastapi.testclient import TestClient
    from main import app

    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
