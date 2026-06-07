from langchain_core.messages import HumanMessage

from llm.discovery import extract_competitors_from_search
from llm.factory import get_llm
from llm.heuristic import heuristic_classify, heuristic_discover, _supplement_known_map
from llm.schemas import (
    ClassifyResult,
    CompetitorScore,
    DiscoveryResult,
    LandscapeScores,
    SwotResult,
)
from state import Competitor, NewsItem
from tools.web_search import search_news


def _build_hypothetical_queries(description: str, target_company: str) -> list[str]:
    """Generate multiple search queries for a hypothetical company description."""
    desc = (description or target_company or "")[:200].strip()
    queries = [f"{desc} competitors"]
    words = desc.split()
    if len(words) > 3:
        queries.append(f"startups {' '.join(words[:8])} market landscape")
    queries.append(f"companies similar to {desc[:80]}")
    queries.append(f"top companies in {desc[:60]} industry market")
    return queries[:4]


def _clamp01(value: float) -> float:
    return round(max(0.0, min(1.0, value)), 3)


def _format_search_context(items: list[NewsItem]) -> str:
    if not items:
        return "No search results available."
    lines = []
    for item in items:
        lines.append(f"- {item.title}: {item.summary}")
    return "\n".join(lines)


async def classify_company(text: str) -> ClassifyResult:
    llm = get_llm()
    if llm is None:
        return heuristic_classify(text)

    structured = llm.with_structured_output(ClassifyResult)
    prompt = (
        "Classify this user input for competitive intelligence analysis.\n"
        "Determine if they named an existing company (real) or described a "
        "hypothetical startup/product idea (hypothetical).\n\n"
        f"User input:\n{text}"
    )
    try:
        result = await structured.ainvoke([HumanMessage(content=prompt)])
        if isinstance(result, ClassifyResult):
            return result
        return ClassifyResult.model_validate(result)
    except Exception:
        return heuristic_classify(text)


async def discover_competitors_for_target(
    target_company: str,
    is_hypothetical: bool,
    description: str = "",
) -> DiscoveryResult:
    if is_hypothetical:
        search_queries = _build_hypothetical_queries(description, target_company)
    else:
        search_queries = [
            f"{target_company} competitors",
            f"{target_company} alternatives rivals market",
        ]

    import asyncio
    search_tasks = [search_news(q, max_results=10) for q in search_queries]
    all_results = await asyncio.gather(*search_tasks, return_exceptions=True)
    search_results: list[NewsItem] = []
    seen_titles: set[str] = set()
    for batch in all_results:
        if isinstance(batch, Exception):
            continue
        for item in batch:
            key = item.title.lower().strip()
            if key not in seen_titles:
                seen_titles.add(key)
                search_results.append(item)

    llm = get_llm()
    if llm is None:
        return heuristic_discover(
            target_company,
            is_hypothetical,
            description,
            search_results=search_results,
        )

    structured = llm.with_structured_output(DiscoveryResult)

    if is_hypothetical:
        prompt = (
            "You are a competitive intelligence analyst.\n"
            "A user is planning a startup or product. Based on their description, "
            "identify up to 15-20 EXISTING companies that would be their competitors.\n"
            "Include direct competitors, adjacent players, and emerging startups.\n\n"
            f"User's idea/description: {description}\n"
            f"Working name (if any): {target_company or 'N/A'}\n\n"
            "Think about:\n"
            "1. What market/industry does this idea target?\n"
            "2. What existing companies serve the same customer need?\n"
            "3. Include both large incumbents and relevant startups.\n\n"
            f"Web search context:\n{_format_search_context(search_results)}\n\n"
            "Return the most relevant real competitor company names. "
            "Do NOT include the user's hypothetical company itself."
        )
    else:
        prompt = (
            "Identify up to 15-20 competitors for competitive intelligence analysis.\n"
            "Include direct competitors, adjacent players, and emerging challengers.\n"
            f"Target company: {target_company or 'N/A'}\n"
            f"Description: {description or 'N/A'}\n\n"
            f"Web search context:\n{_format_search_context(search_results)}\n\n"
            "Return only the most relevant competitor company names."
        )
    try:
        result = await structured.ainvoke([HumanMessage(content=prompt)])
        if isinstance(result, DiscoveryResult):
            if not result.competitors:
                return _discovery_fallback(
                    target_company, is_hypothetical, description, search_results
                )
            return result
        parsed = DiscoveryResult.model_validate(result)
        if not parsed.competitors:
            return _discovery_fallback(
                target_company, is_hypothetical, description, search_results
            )
        return parsed
    except Exception:
        return _discovery_fallback(
            target_company, is_hypothetical, description, search_results
        )


def _discovery_fallback(
    target_company: str,
    is_hypothetical: bool,
    description: str,
    search_results: list[NewsItem],
) -> DiscoveryResult:
    names = extract_competitors_from_search(search_results, target_company)
    if names:
        return DiscoveryResult(
            competitors=_supplement_known_map(names, target_company),
            reasoning="Fallback: extracted competitors from web search results.",
        )
    return heuristic_discover(
        target_company,
        is_hypothetical,
        description,
        search_results=search_results,
    )


def _format_competitor_context(competitor: Competitor) -> str:
    news_lines = [
        f"- {item.title}: {item.summary or item.url}"
        for item in competitor.news[:5]
    ]
    product_lines = [
        f"- {item.name}: {item.pricing or item.description}"
        for item in competitor.products[:5]
    ]
    fin = competitor.financials or {}
    fin_lines = [
        f"- {key}: {value}"
        for key, value in fin.items()
        if key not in ("source", "source_url", "as_of") and value
    ]
    return (
        f"Competitor: {competitor.name}\n"
        f"News ({len(competitor.news)} items):\n"
        + ("\n".join(news_lines) or "- none")
        + f"\nProducts ({len(competitor.products)} items):\n"
        + ("\n".join(product_lines) or "- none")
        + f"\nFinancials:\n"
        + ("\n".join(fin_lines) or "- none")
    )


async def generate_swot_for_competitor(
    competitor: Competitor,
    target_company: str,
) -> SwotResult:
    llm = get_llm()
    if llm is None:
        return SwotResult(
            strengths=[f"{competitor.name} has strong market presence"],
            weaknesses=["Potential pricing pressure in core segments"],
            opportunities=["Expansion into adjacent markets"],
            threats=[f"Competitive momentum from {len(competitor.news)} recent news signals"],
            executive_summary=(
                f"{competitor.name} is a notable competitor to {target_company or 'the target'}."
            ),
        )

    structured = llm.with_structured_output(SwotResult)
    prompt = (
        "Generate a concise SWOT analysis for competitive intelligence.\n"
        f"Target company being analyzed against: {target_company or 'N/A'}\n\n"
        f"{_format_competitor_context(competitor)}\n\n"
        "Base strengths, weaknesses, opportunities, and threats on the evidence above. "
        "Include a one-sentence executive_summary."
    )
    try:
        result = await structured.ainvoke([HumanMessage(content=prompt)])
        if isinstance(result, SwotResult):
            return result
        return SwotResult.model_validate(result)
    except Exception:
        return SwotResult(
            strengths=[f"{competitor.name} has strong market presence"],
            weaknesses=["Potential pricing pressure in core segments"],
            opportunities=["Expansion into adjacent markets"],
            threats=[f"Competitive momentum from {len(competitor.news)} recent news signals"],
            executive_summary=(
                f"{competitor.name} is a notable competitor to {target_company or 'the target'}."
            ),
        )


def _heuristic_scores(competitors: list[Competitor]) -> dict[str, CompetitorScore]:
    """Differentiated fallback scores (avoids the all-0.9 saturation).

    Discovery returns competitors roughly by relevance, so earlier entries get
    higher base scores; sentiment nudges threat. Spread keeps buildings distinct.
    """
    out: dict[str, CompetitorScore] = {}
    total = max(1, len(competitors))
    for i, c in enumerate(competitors):
        rank = 1.0 - (i / total)  # first listed → ~1.0, last → small
        sent = (c.sentiment + 1) / 2  # 0..1
        out[c.name] = CompetitorScore(
            name=c.name,
            threat_level=_clamp01(0.35 + rank * 0.45 + sent * 0.12),
            market_size=_clamp01(0.30 + rank * 0.55),
            market_overlap=_clamp01(0.40 + rank * 0.30 + sent * 0.08),
        )
    return out


async def score_competitors(
    target_company: str,
    competitors: list[Competitor],
) -> dict[str, CompetitorScore]:
    """Score each competitor (threat/size/overlap) using the model's real-world
    knowledge so the 3D buildings differ. Falls back to a varied heuristic."""
    if not competitors:
        return {}

    fallback = _heuristic_scores(competitors)
    llm = get_llm()
    if llm is None:
        return fallback

    names = ", ".join(c.name for c in competitors)
    structured = llm.with_structured_output(LandscapeScores)
    prompt = (
        "Score these competitors of a target company for a competitive map.\n"
        "For EACH competitor give three floats from 0.0 to 1.0 that MUST vary "
        "meaningfully between competitors (do not give everyone the same value):\n"
        "- threat_level: competitive threat to the target (market power + momentum)\n"
        "- market_size: relative company size / overall market presence\n"
        "- market_overlap: how directly it competes with the target's core business\n\n"
        f"Target: {target_company or 'N/A'}\n"
        f"Competitors: {names}\n"
        "Use real-world knowledge of each company's size and positioning."
    )
    try:
        result = await structured.ainvoke([HumanMessage(content=prompt)])
        parsed = result if isinstance(result, LandscapeScores) else LandscapeScores.model_validate(result)
        by_name = {s.name.strip().lower(): s for s in parsed.scores}
        merged: dict[str, CompetitorScore] = {}
        for c in competitors:
            s = by_name.get(c.name.strip().lower())
            if s is None:
                merged[c.name] = fallback[c.name]
            else:
                merged[c.name] = CompetitorScore(
                    name=c.name,
                    threat_level=_clamp01(s.threat_level),
                    market_size=_clamp01(s.market_size),
                    market_overlap=_clamp01(s.market_overlap),
                )
        return merged
    except Exception:
        return fallback


async def generate_landscape_summary(
    target_company: str,
    competitors: list[Competitor],
    quadrants: dict[str, list[str]],
) -> str:
    llm = get_llm()
    names = ", ".join(c.name for c in competitors)
    quadrant_text = "\n".join(
        f"- {key}: {', '.join(values) if values else 'none'}"
        for key, values in quadrants.items()
    )
    fallback = (
        f"Competitive landscape analysis complete for {target_company or 'target'}. "
        f"Key competitors: {names}."
    )

    if llm is None:
        return fallback

    fin_summary_parts = []
    for c in competitors:
        fin = c.financials or {}
        rev = fin.get("revenue") or fin.get("market_cap")
        if rev:
            fin_summary_parts.append(f"{c.name}: {rev}")
    fin_text = "; ".join(fin_summary_parts) if fin_summary_parts else "Not available"

    prompt = (
        "Write a punchy 1-2 sentence executive summary of this competitive "
        "landscape (max ~40 words). Name only the 2-3 most important rivals; "
        "do not list every competitor.\n"
        f"Target: {target_company or 'N/A'}\n"
        f"Competitors: {names}\n"
        f"Financial highlights: {fin_text}\n"
        f"Market quadrants:\n{quadrant_text}\n"
    )
    try:
        response = await llm.ainvoke([HumanMessage(content=prompt)])
        content = response.content
        if isinstance(content, str) and content.strip():
            return content.strip()
    except Exception:
        pass
    return fallback
