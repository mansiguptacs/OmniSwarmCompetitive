import time
import uuid

from langchain_core.messages import AIMessage
from langchain_core.runnables import RunnableConfig
from langgraph.types import Send

from agents.helpers import ensure_session_id, get_last_user_message, safe_emit_state
from agents.financial_analyst import run_financial_analyst
from agents.news_scout import run_news_scout
from agents.product_tracker import run_product_tracker
from agents.synthesis import run_synthesis
from llm.client import classify_company, discover_competitors_for_target
from observability.decorators import trace_node
from observability.post_run_hook import merge_observability_activity, on_graph_complete
from state import CCIEState, Competitor, append_activity, competitor_to_dict, set_competitors
from tools.web_search import search_news


@trace_node(name="classify")
async def classify_node(state: CCIEState, config: RunnableConfig) -> dict:
    user_text = get_last_user_message(state)
    classification = await classify_company(user_text)
    session_id = str(uuid.uuid4())

    state["agent_activity"] = []
    append_activity(
        state, "Orchestrator",
        f"Classifying input — determining if '{user_text[:60]}' is a real company or hypothetical concept...",
        time.time(),
    )

    updates = {
        "phase": "classifying",
        "is_hypothetical": classification.is_hypothetical,
        "target_company": classification.target_company,
        "target_description": classification.target_description,
        "session_id": session_id,
        "competitors": [],
        "landscape_summary": "",
        "market_quadrants": {},
        "agent_activity": state["agent_activity"],
    }
    await safe_emit_state(config, updates)
    return updates


@trace_node(name="enrich_real")
async def enrich_real_node(state: CCIEState, config: RunnableConfig) -> dict:
    target = state.get("target_company", "")
    append_activity(
        state, "Orchestrator",
        f"Enriching company profile — gathering overview data and market context for {target}...",
        time.time(),
    )

    overview = await search_news(f"{target} company overview", max_results=1)
    description = overview[0].summary if overview else f"Established company: {target}"

    updates = {
        "target_description": description,
        "agent_activity": state["agent_activity"],
    }
    await safe_emit_state(config, updates)
    return updates


@trace_node(name="parse_hypothetical")
async def parse_hypothetical_node(state: CCIEState, config: RunnableConfig) -> dict:
    raw_desc = state.get("target_description") or get_last_user_message(state)
    append_activity(
        state, "Orchestrator",
        f"Parsing hypothetical concept — extracting target market, product category, and differentiators from description...",
        time.time(),
    )

    description = await _refine_hypothetical_description(raw_desc)

    updates = {
        "target_description": description,
        "agent_activity": state["agent_activity"],
    }
    await safe_emit_state(config, updates)
    return updates


async def _refine_hypothetical_description(raw_input: str) -> str:
    """Use LLM to extract structured market context from a vague startup idea."""
    from llm.factory import get_llm
    llm = get_llm()
    if llm is None:
        return raw_input

    from langchain_core.messages import HumanMessage
    prompt = (
        "A user described a hypothetical startup or product idea. "
        "Analyze it and produce a concise market-context description that covers:\n"
        "1. The target market / industry\n"
        "2. The core customer need being addressed\n"
        "3. The product category (e.g., SaaS, marketplace, fintech, etc.)\n"
        "4. Key features or differentiators mentioned\n\n"
        f"User's description: {raw_input}\n\n"
        "Write a single clear paragraph (3-5 sentences) that a competitive analyst "
        "could use to identify real-world competitors. Do NOT invent details the user "
        "didn't mention."
    )
    try:
        response = await llm.ainvoke([HumanMessage(content=prompt)])
        content = response.content
        if isinstance(content, str) and len(content.strip()) > 20:
            return content.strip()
    except Exception:
        pass
    return raw_input


@trace_node(name="discover_competitors")
async def discover_competitors_node(state: CCIEState, config: RunnableConfig) -> dict:
    target_label = state.get("target_company") or "target"
    append_activity(
        state, "Orchestrator",
        f"Searching market landscape — identifying direct and indirect competitors for {target_label}...",
        time.time(),
    )

    discovery = await discover_competitors_for_target(
        state.get("target_company", ""),
        state.get("is_hypothetical", False),
        state.get("target_description", ""),
    )

    competitors: list[Competitor] = []

    for idx, name in enumerate(discovery.competitors):
        competitors.append(
            Competitor(
                name=name,
                description=f"Competitor to {target_label}",
                status="discovering",
            )
        )
        set_competitors(state, competitors)
        append_activity(
            state, "Orchestrator",
            f"Found competitor {idx + 1}/{len(discovery.competitors)}: {name} — queuing for deep analysis...",
            time.time(),
        )
        await safe_emit_state(
            config,
            {
                "phase": "discovering",
                "competitors": state["competitors"],
                "agent_activity": state["agent_activity"],
            },
        )

    return {
        "phase": "analyzing",
        "competitors": state["competitors"],
        "agent_activity": state["agent_activity"],
        "session_id": state.get("session_id", ""),
    }


@trace_node(name="analyze_competitor")
async def analyze_competitor_node(state: CCIEState, config: RunnableConfig) -> dict:
    import asyncio

    name = state.get("competitor_name", "")
    if not name:
        return {}

    idx = state.get("competitor_idx", 0)
    if idx > 0:
        await asyncio.sleep(idx * 3.1)

    activity_start = len(state.get("agent_activity", []))

    await run_news_scout(state, config, competitor_name=name)
    await run_product_tracker(state, config, competitor_name=name)
    await run_financial_analyst(state, config, competitor_name=name)
    await run_synthesis(state, config, competitor_name=name)

    from state import find_competitor_index, get_competitors, parse_competitor

    index = find_competitor_index(state, name)
    if index is None:
        return {}

    competitor = parse_competitor(get_competitors(state)[index])
    new_activity = state.get("agent_activity", [])[activity_start:]

    return {
        "competitors": [competitor_to_dict(competitor)],
        "agent_activity": new_activity,
    }


@trace_node(name="landscape_synthesis")
async def landscape_synthesis_node(state: CCIEState, config: RunnableConfig) -> dict:
    state["phase"] = "synthesizing"
    append_activity(
        state, "Synthesis",
        "Starting landscape synthesis — building competitive map and executive summary...",
        time.time(),
    )
    await safe_emit_state(config, {"phase": "synthesizing", "agent_activity": state.get("agent_activity", [])})

    result = await run_synthesis(state, config, landscape=True)
    summary = result.get("landscape_summary", "Analysis complete.")
    append_activity(
        state, "Synthesis",
        "Landscape synthesis complete — finalizing competitive intelligence report...",
        time.time(),
    )
    updates = {
        **result,
        "phase": "complete",
        "messages": [AIMessage(content=summary)],
    }

    graph_snapshot = {**state, **updates}
    report = await on_graph_complete(graph_snapshot)
    if report:
        try:
            from memory.factory import get_memory_service

            service = get_memory_service()
            ping = await service.ping()
            report["memory"] = {
                "redis_connected": ping.get("connected", False),
                "latency_ms": ping.get("latency_ms", 0),
                "docs_indexed": len(result.get("competitors", [])) * 3,
            }
        except Exception:
            report["memory"] = {"redis_connected": False}

        merge_observability_activity(state, report)
        updates["agent_activity"] = state.get("agent_activity", [])
        await safe_emit_state(config, {"agent_activity": updates["agent_activity"]})

    return updates


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
        return "parse_hypothetical"
    return "enrich_real"


def fan_out_competitors(state: CCIEState) -> list[Send]:
    session_id = state.get("session_id", "")
    sends = []
    for idx, competitor in enumerate(state.get("competitors", [])):
        name = competitor.get("name", "")
        if name:
            sends.append(
                Send(
                    "analyze_competitor",
                    {"competitor_name": name, "session_id": session_id, "competitor_idx": idx},
                )
            )
    return sends
