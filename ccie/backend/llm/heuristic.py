"""Heuristic fallbacks when LLM is unavailable or fails."""

from llm.schemas import ClassifyResult, DiscoveryResult


def extract_company_name(text: str) -> str:
    cleaned = text.strip()
    for prefix in ("analyze ", "research ", "study "):
        if cleaned.lower().startswith(prefix):
            cleaned = cleaned[len(prefix) :].strip()
    return cleaned.split(".")[0].split(",")[0].strip()


REAL_COMPETITOR_MAP: dict[str, list[str]] = {
    "stripe": ["PayPal", "Adyen", "Square"],
    "paypal": ["Stripe", "Adyen", "Square"],
}

HYPOTHETICAL_COMPETITORS = ["Kira Systems", "Luminance", "Harvey AI"]


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
) -> DiscoveryResult:
    if is_hypothetical:
        if "legal" in description.lower() or "law" in description.lower():
            names = HYPOTHETICAL_COMPETITORS
        else:
            names = ["Competitor A", "Competitor B", "Competitor C"]
        return DiscoveryResult(
            competitors=names,
            reasoning="Heuristic: inferred competitors for hypothetical company.",
        )

    key = target_company.lower()
    names = REAL_COMPETITOR_MAP.get(key, ["PayPal", "Adyen", "Square"])
    return DiscoveryResult(
        competitors=names,
        reasoning=f"Heuristic: known competitor map for {target_company}.",
    )
