"""Financial Analyst agent — gathers revenue, funding, market cap per competitor."""

import logging
import time

from langchain_core.runnables import RunnableConfig

from agents.helpers import ensure_session_id, safe_emit_state
from memory.factory import get_memory_service
from state import (
    CCIEState,
    append_activity,
    find_competitor_index,
    get_competitors,
    parse_competitor,
    set_competitors,
)
from tools.financial_data import search_financials

logger = logging.getLogger(__name__)


async def run_financial_analyst(
    state: CCIEState,
    config: RunnableConfig,
    competitor_name: str,
) -> dict:
    session_id = ensure_session_id(state)
    append_activity(
        state, "Financial Analyst",
        f"Analyzing financial profile for {competitor_name} — extracting revenue, funding, valuation, and growth metrics...",
        time.time(),
    )

    financials = await search_financials(competitor_name)
    competitors = get_competitors(state)
    index = find_competitor_index(state, competitor_name)

    if index is not None and financials:
        competitor = parse_competitor(competitors[index])
        competitor.financials = financials
        competitors[index] = competitor
        set_competitors(state, competitors)

        try:
            service = get_memory_service()
            await service.save_competitors(session_id, competitors)
        except Exception:
            logger.debug("Memory persist failed for financial_analyst/%s", competitor_name, exc_info=True)

    has_data = financials is not None
    fin_summary = ""
    if has_data and financials:
        parts = []
        if getattr(financials, "revenue", None):
            parts.append(f"revenue {financials.revenue}")
        if getattr(financials, "funding_total", None):
            parts.append(f"funding {financials.funding_total}")
        fin_summary = f" — found {', '.join(parts)}" if parts else " — limited data available"
    append_activity(
        state, "Financial Analyst",
        f"Financial analysis complete for {competitor_name}{fin_summary}",
        time.time(),
    )

    await safe_emit_state(config, {"competitors": state["competitors"], "agent_activity": state["agent_activity"]})

    return {
        "competitors": state["competitors"],
        "agent_activity": state["agent_activity"],
        "session_id": session_id,
    }
