import time

from langchain_core.messages import AIMessage
from langchain_core.runnables import RunnableConfig

from agents.helpers import (
    classify_input,
    discover_competitors,
    ensure_session_id,
    get_last_user_message,
    safe_emit_state,
)
from agents.news_scout import run_news_scout
from agents.product_tracker import run_product_tracker
from agents.synthesis import run_synthesis
from state import CCIEState, Competitor, append_activity, set_competitors


async def classify_node(state: CCIEState, config: RunnableConfig) -> dict:
    user_text = get_last_user_message(state)
    is_hypothetical, target_company, target_description = classify_input(user_text)
    session_id = ensure_session_id(state)

    append_activity(state, "Orchestrator", "Classifying company input...", time.time())

    updates = {
        "phase": "classifying",
        "is_hypothetical": is_hypothetical,
        "target_company": target_company,
        "target_description": target_description,
        "session_id": session_id,
        "agent_activity": state["agent_activity"],
    }
    await safe_emit_state(config, updates)
    return updates


async def discover_competitors_node(state: CCIEState, config: RunnableConfig) -> dict:
    append_activity(state, "Orchestrator", "Discovering competitors...", time.time())
    names = discover_competitors(
        state.get("target_company", ""),
        state.get("is_hypothetical", False),
        state.get("target_description", ""),
    )
    competitors = [
        Competitor(name=name, description=f"Competitor to {state.get('target_company', 'target')}")
        for name in names
    ]
    set_competitors(state, competitors)

    updates = {
        "phase": "discovering",
        "competitors": state["competitors"],
        "agent_activity": state["agent_activity"],
    }
    await safe_emit_state(config, updates)
    return updates


async def analyze_competitors_node(state: CCIEState, config: RunnableConfig) -> dict:
    state["phase"] = "analyzing"
    append_activity(state, "Orchestrator", "Running competitor analysis swarms...", time.time())
    await safe_emit_state(config, {"phase": "analyzing"})

    for competitor in state.get("competitors", []):
        name = competitor.get("name", "")
        if not name:
            continue
        await run_news_scout(state, config, competitor_name=name)
        await run_product_tracker(state, config, competitor_name=name)
        await run_synthesis(state, config, competitor_name=name)

    return {
        "competitors": state["competitors"],
        "agent_activity": state["agent_activity"],
        "phase": "analyzing",
    }


async def landscape_synthesis_node(state: CCIEState, config: RunnableConfig) -> dict:
    state["phase"] = "synthesizing"
    result = await run_synthesis(state, config, landscape=True)
    summary = result.get("landscape_summary", "Analysis complete.")
    return {
        **result,
        "messages": [AIMessage(content=summary)],
    }


async def echo_ack_node(state: CCIEState, config: RunnableConfig) -> dict:
    """Minimal hello-world node for smoke tests."""
    user_text = get_last_user_message(state)
    target_company = user_text.replace("Analyze ", "").replace("analyze ", "").strip()
    session_id = ensure_session_id(state)
    append_activity(state, "Orchestrator", "Received input", time.time())

    return {
        "target_company": target_company,
        "phase": "complete",
        "session_id": session_id,
        "agent_activity": state["agent_activity"],
        "messages": [AIMessage(content=f"Received analysis request for {target_company}.")],
    }


def route_after_classify(state: CCIEState) -> str:
    if state.get("is_hypothetical"):
        return "discover"
    return "discover"
