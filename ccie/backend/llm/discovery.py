"""Competitor discovery helpers — extract names from search when LLM is unavailable."""

import re

from state import NewsItem

KNOWN_COMPANIES = sorted(
    [
        "Alphabet",
        "Samsung",
        "Microsoft",
        "Amazon",
        "Meta",
        "Google",
        "Spotify",
        "Netflix",
        "Huawei",
        "Xiaomi",
        "Sony",
        "PayPal",
        "Adyen",
        "Square",
        "Stripe",
        "Shopify",
        "Salesforce",
        "Oracle",
        "IBM",
        "Intel",
        "Nvidia",
        "Tesla",
        "Uber",
        "Airbnb",
        "Kira Systems",
        "Luminance",
        "Harvey AI",
        "Visa",
        "Mastercard",
        "Block",
        "Dell",
        "HP",
        "Lenovo",
        "Apple",
    ],
    key=len,
    reverse=True,
)

EXPLICIT_LIST_PATTERNS = (
    r"(?:companies like|featuring companies like|such as|including)\s+([^.!\n]+)",
)

GENERIC_TOKENS = {
    "inc",
    "llc",
    "corp",
    "company",
    "companies",
    "the",
    "and",
    "or",
    "top",
    "best",
    "major",
    "biggest",
    "leading",
    "alternative",
    "alternatives",
    "competitor",
    "competitors",
    "market",
    "tech",
    "technology",
    "smartphones",
    "computers",
    "tablets",
    "wearables",
    "services",
    "software",
    "hardware",
    "products",
    "devices",
    "others",
    "options",
    "landscape",
    "space",
    "industry",
    "today",
    "article",
    "additionally",
    "other",
    "option",
    "gateways",
    "gateway",
    "providers",
    "provider",
    "business",
    "businesses",
    "platform",
    "platforms",
}


def _normalize_name(name: str) -> str:
    cleaned = re.sub(r"\([^)]*\)", "", name)
    cleaned = re.sub(r"\$[A-Z]+", "", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" .,-")
    return cleaned


def _is_valid_name(name: str, *, exclude: set[str]) -> bool:
    key = name.lower().strip()
    if not key or key in exclude or key in GENERIC_TOKENS:
        return False
    if len(name) < 2 or len(name) > 40:
        return False
    if name.islower() and name not in {c.lower() for c in KNOWN_COMPANIES}:
        return False
    return True


def _split_candidate_list(text: str, *, exclude: set[str]) -> list[str]:
    parts = re.split(r",|\band\b|\&", text, flags=re.IGNORECASE)
    names = []
    known_lower = {company.lower() for company in KNOWN_COMPANIES}
    for part in parts:
        name = _normalize_name(part)
        if not _is_valid_name(name, exclude=exclude):
            continue
        if name.lower() in known_lower:
            names.append(name)
    return names


def _mock_title_competitor(title: str) -> str | None:
    if " competes in the same market" in title:
        return _normalize_name(title.split(" competes in the same market")[0])
    if " is a major competitor" in title:
        return _normalize_name(title.split(" is a major competitor")[0])
    if " is a key competitor" in title:
        return _normalize_name(title.split(" is a key competitor")[0])
    return None


def _known_companies_in_text(text: str, *, exclude: set[str]) -> list[str]:
    found: list[str] = []
    for company in KNOWN_COMPANIES:
        if company.lower() in exclude:
            continue
        if re.search(rf"\b{re.escape(company)}\b", text, flags=re.IGNORECASE):
            found.append(company)
    return found


def extract_competitors_from_search(
    search_results: list[NewsItem],
    target_company: str,
    *,
    max_competitors: int = 20,
) -> list[str]:
    """Derive competitor names from Tavily/mock search hits."""
    exclude = {target_company.lower().strip()} if target_company else set()
    exclude.update({"apple inc", "inc", "corp"})

    candidates: list[str] = []

    for item in search_results:
        combined = f"{item.title}. {item.summary}"

        mock_name = _mock_title_competitor(item.title)
        if mock_name and _is_valid_name(mock_name, exclude=exclude):
            candidates.append(mock_name)

        candidates.extend(_known_companies_in_text(combined, exclude=exclude))

        for pattern in EXPLICIT_LIST_PATTERNS:
            match = re.search(pattern, combined, flags=re.IGNORECASE)
            if match:
                candidates.extend(_split_candidate_list(match.group(1), exclude=exclude))

        vs_match = re.search(
            r"(?i)\bvs\.?\s+(?:its\s+)?(?:biggest\s+)?competitors?\b",
            item.title,
        )
        if not vs_match:
            title_vs = re.search(
                r"(?i)\b([A-Z][A-Za-z0-9&\.\-]{1,30})\s+vs\.?\s+([A-Z][A-Za-z0-9&\.\-]{1,30})",
                item.title,
            )
            if title_vs:
                for group in title_vs.groups():
                    name = _normalize_name(group)
                    if _is_valid_name(name, exclude=exclude):
                        candidates.append(name)

    deduped: list[str] = []
    seen: set[str] = set()
    for name in candidates:
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(name)
        if len(deduped) >= max_competitors:
            break

    return deduped
