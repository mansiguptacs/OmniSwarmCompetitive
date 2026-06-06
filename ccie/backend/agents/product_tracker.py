import time

from langchain_core.runnables import RunnableConfig

from agents.helpers import ensure_session_id, safe_emit_state
from memory.factory import get_redis_memory
from state import (
    CCIEState,
    append_activity,
    find_competitor_index,
    get_competitors,
    parse_competitor,
    set_competitors,
)
from tools.web_search import search_products

async def run_product_tracker(
    state: CCIEState,
    config: RunnableConfig,
    competitor_name: str,
) -> dict:
    session_id = ensure_session_id(state)
    append_activity(
        state,
        "Product Tracker",
        f"Analyzing products for {competitor_name}...",
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
            redis = get_redis_memory()
            await redis.save_competitors(session_id, competitors)
        except Exception:
            pass

    await safe_emit_state(config, {"competitors": state["competitors"]})

    return {
        "competitors": state["competitors"],
        "agent_activity": state["agent_activity"],
        "session_id": session_id,
    }
