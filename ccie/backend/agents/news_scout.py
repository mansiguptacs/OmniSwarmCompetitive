import time

from langchain_core.runnables import RunnableConfig

from agents.helpers import ensure_session_id, safe_emit_state
from memory.factory import get_redis_memory
from state import (
    CCIEState,
    Competitor,
    append_activity,
    find_competitor_index,
    get_competitors,
    set_competitors,
)
from tools.web_search import search_news

async def run_news_scout(
    state: CCIEState,
    config: RunnableConfig,
    competitor_name: str | None = None,
) -> dict:
    target = competitor_name or state.get("target_company", "")
    session_id = ensure_session_id(state)
    append_activity(
        state,
        "News Scout",
        f"Scanning {target} for latest news...",
        time.time(),
    )

    news_items = await search_news(f"{target} latest news")
    competitors = get_competitors(state)
    index = find_competitor_index(state, target)

    competitor = Competitor(name=target, news=news_items, status="analyzing")
    if news_items:
        competitor.sentiment = sum(item.sentiment for item in news_items) / len(news_items)

    if index is None:
        competitors.append(competitor)
    else:
        competitors[index] = competitor

    set_competitors(state, competitors)

    try:
        redis = get_redis_memory()
        await redis.save_news(session_id, target, news_items)
        await redis.save_competitors(session_id, competitors)
    except Exception:
        pass

    await safe_emit_state(config, {"competitors": state["competitors"]})

    return {
        "competitors": state["competitors"],
        "agent_activity": state["agent_activity"],
        "session_id": session_id,
    }
