import pytest
from langchain_core.messages import HumanMessage
from langchain_core.runnables import RunnableConfig
from unittest.mock import patch

from agents.orchestrator import discover_competitors_node
from state import default_ccie_state


@pytest.mark.asyncio
async def test_discover_emits_per_competitor():
    state = default_ccie_state(
        target_company="Stripe",
        is_hypothetical=False,
        phase="classifying",
    )
    config = RunnableConfig(configurable={"thread_id": "discover-emit-test"})
    emitted_competitor_counts: list[int] = []

    async def capture_emit(cfg, payload):
        if "competitors" in payload:
            emitted_competitor_counts.append(len(payload["competitors"]))

    with patch("agents.orchestrator.safe_emit_state", side_effect=capture_emit):
        result = await discover_competitors_node(state, config)

    assert len(result["competitors"]) >= 3
    assert emitted_competitor_counts == [1, 2, 3]
    discovery_events = [
        entry for entry in result["agent_activity"] if "Discovered competitor" in entry["status"]
    ]
    assert len(discovery_events) >= 3
