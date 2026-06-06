import logging
import time

from langchain_core.runnables import RunnableConfig

from agents.helpers import safe_emit_state
from agents.scoring import compute_competitor_metrics, compute_market_quadrants
from llm.client import generate_landscape_summary, generate_swot_for_competitor
from memory.factory import get_memory_service
from state import (
    CCIEState,
    append_activity,
    competitor_to_dict,
    find_competitor_index,
    get_competitors,
    parse_competitor,
    set_competitors,
)

logger = logging.getLogger(__name__)


async def run_synthesis(
    state: CCIEState,
    config: RunnableConfig,
    competitor_name: str | None = None,
    landscape: bool = False,
) -> dict:
    append_activity(
        state,
        "Synthesis",
        "Generating competitive insights...",
        time.time(),
    )

    updates: dict = {"agent_activity": state["agent_activity"]}
    session_id = state.get("session_id", "")

    if landscape:
        competitors = get_competitors(state)
        scored = [compute_competitor_metrics(c) for c in competitors]
        set_competitors(state, scored)
        quadrants = compute_market_quadrants(scored)
        summary = await generate_landscape_summary(
            state.get("target_company", ""),
            scored,
            quadrants,
        )
        updates["landscape_summary"] = summary
        updates["market_quadrants"] = quadrants
        updates["competitors"] = state["competitors"]
        updates["phase"] = "complete"

        try:
            service = get_memory_service()
            await service.index_session_intel(
                session_id,
                competitors=scored,
                synthesis_by_competitor={c.name: c.swot for c in scored if c.swot},
                landscape_summary=summary,
            )
        except Exception:
            logger.debug("Memory index_session_intel failed", exc_info=True)

        await safe_emit_state(config, updates)
        return updates

    competitors = get_competitors(state)
    index = find_competitor_index(state, competitor_name or "")
    if index is not None:
        competitor = parse_competitor(competitors[index])
        swot_result = await generate_swot_for_competitor(
            competitor,
            state.get("target_company", ""),
        )
        competitor.swot = swot_result.as_dict()
        competitor = compute_competitor_metrics(competitor)
        competitor.status = "complete"
        competitors[index] = competitor
        set_competitors(state, competitors)
        updates["competitors"] = [competitor_to_dict(competitor)]

        try:
            service = get_memory_service()
            await service.index_synthesis(
                session_id,
                competitor.name,
                swot=competitor.swot,
            )
        except Exception:
            logger.debug("Memory index_synthesis failed for %s", competitor.name, exc_info=True)

    await safe_emit_state(config, updates)
    return updates
