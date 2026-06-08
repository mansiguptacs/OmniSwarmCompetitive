import pytest
from langchain_core.messages import HumanMessage

from agents.graph import compile_graph
from agents.helpers import classify_input, discover_competitors
from llm.heuristic import heuristic_classify, heuristic_discover
from state import default_ccie_state


def test_classify_real_company():
    is_hypothetical, company, description = classify_input("Analyze Stripe")
    assert is_hypothetical is False
    assert company == "Stripe"
    assert description == ""


def test_classify_hypothetical_company():
    text = (
        "I'm building an AI-powered legal document review platform "
        "targeting mid-size law firms, $50-200/month pricing"
    )
    is_hypothetical, company, description = classify_input(text)
    assert is_hypothetical is True
    assert description == text


def test_discover_stripe_competitors():
    names = discover_competitors("Stripe", is_hypothetical=False)
    assert "PayPal" in names
    assert "Adyen" in names


@pytest.mark.asyncio
async def test_orchestrator_phase_transitions():
    graph = compile_graph(echo=False)
    state = default_ccie_state(messages=[HumanMessage(content="Analyze Stripe")])
    config = {"configurable": {"thread_id": "orchestrator-phases"}}
    result = await graph.ainvoke(state, config)

    assert result["phase"] == "complete"
    assert result["is_hypothetical"] is False
    competitor_names = [c["name"] for c in result["competitors"]]
    assert "PayPal" in competitor_names
    discovery_events = [
        e for e in result["agent_activity"] if "Discovered competitor" in e["status"]
    ]
    assert len(discovery_events) >= 3


@pytest.mark.asyncio
async def test_orchestrator_hypothetical_path():
    graph = compile_graph(echo=False)
    text = (
        "I'm building an AI-powered legal document review platform "
        "targeting mid-size law firms"
    )
    state = default_ccie_state(messages=[HumanMessage(content=text)])
    config = {"configurable": {"thread_id": "orchestrator-hypothetical"}}
    result = await graph.ainvoke(state, config)

    assert result["is_hypothetical"] is True
    assert len(result["competitors"]) >= 3


@pytest.mark.asyncio
async def test_same_thread_new_analysis_replaces_competitors():
    graph = compile_graph(echo=False)
    config = {"configurable": {"thread_id": "orchestrator-same-thread"}}

    stripe = await graph.ainvoke(
        default_ccie_state(messages=[HumanMessage(content="analyze stripe")]),
        config,
    )
    stripe_names = {c["name"] for c in stripe["competitors"]}
    assert stripe_names

    pan = await graph.ainvoke(
        {
            **stripe,
            "messages": stripe.get("messages", [])
            + [HumanMessage(content="analyze palo alto networks")],
        },
        config,
    )
    pan_names = {c["name"] for c in pan["competitors"]}

    assert pan.get("target_company", "").lower() == "palo alto networks"
    assert not pan_names.intersection({"PayPal", "Square", "Adyen"}), (
        f"Stale payment competitors leaked into PAN run: {pan_names}"
    )
