import time

from langchain_core.runnables import RunnableConfig

from agents.helpers import safe_emit_state

from state import (
    CCIEState,
    append_activity,
    find_competitor_index,
    get_competitors,
    parse_competitor,
    set_competitors,
)


def generate_swot(competitor_name: str, news_count: int, product_count: int) -> dict:
    return {
        "strengths": [
            f"{competitor_name} has strong market presence",
            f"Active product portfolio with {product_count} tracked offerings",
        ],
        "weaknesses": [
            "Potential pricing pressure in core segments",
        ],
        "opportunities": [
            "Expansion into adjacent payment and software markets",
        ],
        "threats": [
            f"Recent news volume ({news_count} items) signals competitive momentum",
        ],
    }


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

    if landscape:
        competitors = get_competitors(state)
        names = ", ".join(c.name for c in competitors)
        updates["landscape_summary"] = (
            f"Competitive landscape analysis complete for {state.get('target_company', 'target')}. "
            f"Key competitors: {names}."
        )
        updates["phase"] = "complete"
        await safe_emit_state(config, updates)
        return updates

    competitors = get_competitors(state)
    index = find_competitor_index(state, competitor_name or "")
    if index is not None:
        competitor = parse_competitor(competitors[index])
        competitor.swot = generate_swot(
            competitor.name,
            len(competitor.news),
            len(competitor.products),
        )
        competitor.status = "complete"
        competitors[index] = competitor
        set_competitors(state, competitors)
        updates["competitors"] = state["competitors"]

    await safe_emit_state(config, updates)
    return updates
