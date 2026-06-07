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
from tools.web_search import search_products

logger = logging.getLogger(__name__)


async def run_product_tracker(
    state: CCIEState,
    config: RunnableConfig,
    competitor_name: str,
) -> dict:
    session_id = ensure_session_id(state)
    append_activity(
        state, "Product Tracker",
        f"Mapping product portfolio for {competitor_name} — identifying key offerings, pricing tiers, and feature sets...",
        time.time(),
    )

    products = await search_products(competitor_name)
    competitors = get_competitors(state)
    index = find_competitor_index(state, competitor_name)

    if index is not None:
        competitor = parse_competitor(competitors[index])
        competitor.products = products
        competitors[index] = competitor
        set_competitors(state, competitors)

        try:
            service = get_memory_service()
            await service.save_products(session_id, competitor_name, products)
            await service.save_competitors(session_id, competitors)
        except Exception:
            logger.debug("Memory persist failed for product_tracker/%s", competitor_name, exc_info=True)

    n = len(products)
    append_activity(
        state, "Product Tracker",
        f"Product analysis done for {competitor_name}: {n} product{'s' if n != 1 else ''} identified",
        time.time(),
    )

    await safe_emit_state(config, {"competitors": state["competitors"], "agent_activity": state["agent_activity"]})

    return {
        "competitors": state["competitors"],
        "agent_activity": state["agent_activity"],
        "session_id": session_id,
    }
