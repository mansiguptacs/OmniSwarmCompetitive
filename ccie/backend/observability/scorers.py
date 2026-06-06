"""Pure-function scorers for CCIE agent outputs.

These work on dict/list payloads — no LangGraph dependency.
P1 agent outputs and fixture JSON use the same shapes.
"""

from __future__ import annotations

import re
from datetime import date, datetime
from typing import Any

# Default fallback when settings not loaded (tests). Override via CCIE_FRESHNESS_WINDOW_DAYS.
FRESHNESS_WINDOW_DAYS = 90


def _freshness_window() -> int:
    try:
        from observability.settings import get_observability_settings

        return get_observability_settings().freshness_window_days
    except Exception:
        return FRESHNESS_WINDOW_DAYS


def _parse_date(value: str) -> date | None:
    if not value or not value.strip():
        return None
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%SZ"):
        try:
            return datetime.strptime(value.strip(), fmt).date()
        except ValueError:
            continue
    return None


def _tokenize(text: str) -> set[str]:
    return {t for t in re.split(r"[^\w]+", text.lower()) if len(t) > 2}


def score_freshness(
    news_items: list[dict],
    *,
    reference_date: date | None = None,
    window_days: int | None = None,
) -> float:
    """Return 0.0–1.0 based on recency of news timestamps."""
    if not news_items:
        return 0.0

    today = reference_date or date.today()
    effective_window = window_days if window_days is not None else _freshness_window()
    item_scores: list[float] = []

    for item in news_items:
        published = _parse_date(item.get("published_at", ""))
        if published is None:
            item_scores.append(0.3)
            continue
        age_days = (today - published).days
        if age_days <= effective_window:
            item_scores.append(1.0)
        else:
            decay = max(0.0, 1.0 - (age_days - effective_window) / effective_window)
            item_scores.append(decay)

    return round(sum(item_scores) / len(item_scores), 4)


def score_relevance(
    news_items: list[dict],
    query: str,
    *,
    company: str = "",
) -> float:
    """Return 0.0–1.0 based on keyword overlap with query/company."""
    if not news_items:
        return 0.0

    keywords = _tokenize(query)
    if company:
        keywords |= _tokenize(company)

    if not keywords:
        return 0.0

    relevant = 0
    for item in news_items:
        blob = " ".join(
            str(item.get(field, ""))
            for field in ("title", "summary", "url")
        ).lower()
        if any(kw in blob for kw in keywords):
            relevant += 1

    return round(relevant / len(news_items), 4)


def score_product_coverage(products: list[dict]) -> float:
    """Return 0.0–1.0 based on how complete product records are."""
    if not products:
        return 0.0

    field_scores: list[float] = []
    for product in products:
        filled = sum(
            1
            for field in ("name", "description", "pricing")
            if str(product.get(field, "")).strip()
        )
        field_scores.append(filled / 3)

    return round(sum(field_scores) / len(field_scores), 4)


def score_competitor_completeness(competitor: dict) -> dict[str, float]:
    """Score a single competitor dict across news, products, and SWOT."""
    news = competitor.get("news") or []
    products = competitor.get("products") or []
    swot = competitor.get("swot") or {}

    swot_keys = ("strengths", "weaknesses", "opportunities", "threats")
    swot_filled = sum(1 for key in swot_keys if swot.get(key)) / len(swot_keys)

    return {
        "freshness": score_freshness(news),
        "relevance": score_relevance(news, competitor.get("name", ""), company=competitor.get("name", "")),
        "product_coverage": score_product_coverage(products),
        "swot_completeness": round(swot_filled, 4),
    }


def score_agent_output(
    output: dict[str, Any],
    *,
    query: str = "",
    reference_date: date | None = None,
) -> dict[str, float]:
    """Score a generic agent output payload (news fixture or competitor dict)."""
    news_items = output.get("news_items") or output.get("news") or []
    products = output.get("products") or []
    company = output.get("company") or output.get("name") or ""
    effective_query = query or output.get("query") or company

    scores = {
        "freshness": score_freshness(news_items, reference_date=reference_date),
        "relevance": score_relevance(news_items, effective_query, company=company),
    }
    if products:
        scores["product_coverage"] = score_product_coverage(products)
    return scores


def score_accuracy(graph_result: dict, ground_truth: dict) -> float:
    """Return 0.0–1.0 based on competitor recall + keyword coverage in outputs."""
    competitors = graph_result.get("competitors") or []
    expected = [n.lower() for n in ground_truth.get("expected_competitors") or []]
    if not expected:
        return 0.0

    found_names = {str(c.get("name", "")).lower() for c in competitors}
    name_recall = sum(1 for n in expected if n in found_names) / len(expected)

    count_ok = 1.0
    min_count = ground_truth.get("min_competitor_count")
    if min_count is not None:
        count_ok = 1.0 if len(competitors) >= min_count else len(competitors) / min_count

    keywords = [k.lower() for k in ground_truth.get("required_keywords") or []]
    keyword_score = 0.0
    if keywords:
        blob_parts: list[str] = []
        for comp in competitors:
            blob_parts.append(str(comp.get("name", "")))
            for item in comp.get("news") or []:
                blob_parts.extend(str(item.get(field, "")) for field in ("title", "summary"))
            for item in comp.get("products") or []:
                blob_parts.extend(str(item.get(field, "")) for field in ("name", "description"))
        blob = " ".join(blob_parts).lower()
        keyword_score = sum(1 for kw in keywords if kw in blob) / len(keywords)

    return round(name_recall * 0.5 + keyword_score * 0.3 + count_ok * 0.2, 4)
