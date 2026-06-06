"""Heuristic fallbacks when LLM is unavailable or fails."""

from llm.discovery import extract_competitors_from_search
from llm.schemas import ClassifyResult, DiscoveryResult
from state import NewsItem


def extract_company_name(text: str) -> str:
    cleaned = text.strip()
    for prefix in ("analyze ", "research ", "study "):
        if cleaned.lower().startswith(prefix):
            cleaned = cleaned[len(prefix) :].strip()
    return cleaned.split(".")[0].split(",")[0].strip()


REAL_COMPETITOR_MAP: dict[str, list[str]] = {
    "stripe": ["PayPal", "Adyen", "Square"],
    "paypal": ["Stripe", "Adyen", "Square"],
    "apple": ["Samsung", "Google", "Microsoft"],
    "google": ["Microsoft", "Apple", "Amazon"],
    "microsoft": ["Google", "Apple", "Amazon"],
}

HYPOTHETICAL_COMPETITORS = ["Kira Systems", "Luminance", "Harvey AI"]


def _supplement_known_map(names: list[str], target_company: str, *, max_competitors: int = 5) -> list[str]:
    """Top up discovery with curated defaults when search extraction is sparse."""
    merged = list(names)
    defaults = REAL_COMPETITOR_MAP.get(target_company.lower().strip(), [])
    existing = {name.lower() for name in merged}
    for name in defaults:
        if name.lower() not in existing:
            merged.append(name)
        if len(merged) >= max_competitors:
            break
    return merged[:max_competitors]


def heuristic_classify(text: str) -> ClassifyResult:
    company = extract_company_name(text)
    is_hypothetical = (
        len(text.split()) > 8
        or "building" in text.lower()
        or "targeting" in text.lower()
    )
    if is_hypothetical:
        return ClassifyResult(
            is_hypothetical=True,
            target_company="",
            target_description=text.strip(),
            reasoning="Heuristic: long or descriptive input treated as hypothetical.",
        )
    return ClassifyResult(
        is_hypothetical=False,
        target_company=company,
        target_description="",
        reasoning="Heuristic: short company name treated as real company.",
    )


def heuristic_discover(
    target_company: str,
    is_hypothetical: bool,
    description: str = "",
    search_results: list[NewsItem] | None = None,
) -> DiscoveryResult:
    if search_results:
        names = extract_competitors_from_search(search_results, target_company)
        if names:
            return DiscoveryResult(
                competitors=_supplement_known_map(names, target_company),
                reasoning="Extracted competitors from web search results.",
            )

    if is_hypothetical:
        if "legal" in description.lower() or "law" in description.lower():
            names = HYPOTHETICAL_COMPETITORS
        else:
            names = ["Competitor A", "Competitor B", "Competitor C"]
        return DiscoveryResult(
            competitors=names,
            reasoning="Heuristic: inferred competitors for hypothetical company.",
        )

    key = target_company.lower().strip()
    if key in REAL_COMPETITOR_MAP:
        return DiscoveryResult(
            competitors=REAL_COMPETITOR_MAP[key],
            reasoning=f"Heuristic: known competitor map for {target_company}.",
        )

    return DiscoveryResult(
        competitors=[],
        reasoning=f"No competitors found for {target_company or 'target'}.",
    )
