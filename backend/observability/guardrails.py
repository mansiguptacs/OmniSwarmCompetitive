"""Production guardrails for CCIE agent outputs.

Pure functions — flag stale news and unsourced/suspicious financial figures.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field as dc_field
from datetime import date
from typing import Any, Literal

from observability.scorers import _parse_date


def _default_stale_threshold() -> int:
    try:
        from observability.settings import get_observability_settings

        return get_observability_settings().stale_news_threshold_days
    except Exception:
        return 90


def _implausible_usd_threshold() -> float:
    try:
        from observability.settings import get_observability_settings

        return get_observability_settings().implausible_usd_threshold
    except Exception:
        return 5_000_000_000_000

ViolationType = Literal[
    "stale_news",
    "missing_news_date",
    "unsourced_financial",
    "implausible_financial",
    "suspicious_financial_precision",
]

# Back-compat alias for tests/imports
FRESHNESS_WINDOW_DAYS = 90

FINANCIAL_METRIC_KEYS = frozenset({
    "revenue",
    "market_cap",
    "market_capitalization",
    "funding",
    "funding_total",
    "valuation",
    "arr",
    "mrr",
    "growth_rate",
    "profit",
    "ebitda",
})

@dataclass
class GuardrailViolation:
    type: ViolationType
    message: str
    competitor: str = ""
    metric: str = ""
    details: dict[str, Any] = dc_field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "type": self.type,
            "message": self.message,
            "competitor": self.competitor,
            "field": self.metric,
            "details": self.details,
        }


@dataclass
class GuardrailResult:
    name: str
    passed: bool
    violations: list[GuardrailViolation] = dc_field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "passed": self.passed,
            "violation_count": len(self.violations),
            "violations": [v.to_dict() for v in self.violations],
        }


def _parse_usd_amount(value: str | int | float) -> float | None:
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip().upper().replace(",", "")
    match = re.search(r"[\d.]+", text)
    if not match:
        return None
    amount = float(match.group())
    if "T" in text:
        amount *= 1_000_000_000_000
    elif "B" in text:
        amount *= 1_000_000_000
    elif "M" in text:
        amount *= 1_000_000
    elif "K" in text:
        amount *= 1_000
    return amount


def _has_suspicious_precision(value: str | int | float) -> bool:
    text = str(value)
    if re.search(r"\.\d{3,}", text):
        return True
    if re.fullmatch(r"\d+\.999+\d*", text.replace(",", "")):
        return True
    return False


def check_stale_news(
    news_items: list[dict],
    *,
    competitor: str = "",
    reference_date: date | None = None,
    threshold_days: int | None = None,
) -> GuardrailResult:
    """Flag news items older than threshold or missing publish dates."""
    today = reference_date or date.today()
    effective_threshold = threshold_days if threshold_days is not None else _default_stale_threshold()
    violations: list[GuardrailViolation] = []

    for item in news_items:
        title = item.get("title", "Untitled")
        published = _parse_date(item.get("published_at", ""))
        if published is None:
            violations.append(
                GuardrailViolation(
                    type="missing_news_date",
                    message=f"News item missing published_at: {title!r}",
                    competitor=competitor,
                    metric="published_at",
                    details={"title": title},
                )
            )
            continue
        age_days = (today - published).days
        if age_days > effective_threshold:
            violations.append(
                GuardrailViolation(
                    type="stale_news",
                    message=(
                        f"News is {age_days} days old (threshold {effective_threshold}d): {title!r}"
                    ),
                    competitor=competitor,
                    metric="published_at",
                    details={"title": title, "age_days": age_days, "published_at": str(published)},
                )
            )

    return GuardrailResult(
        name="stale_news",
        passed=len(violations) == 0,
        violations=violations,
    )


def check_financial_hallucinations(
    financials: dict,
    *,
    competitor: str = "",
) -> GuardrailResult:
    """Flag financial metrics without sources or with suspicious values."""
    violations: list[GuardrailViolation] = []
    if not financials:
        return GuardrailResult(name="financial_hallucination", passed=True)

    has_source = bool(str(financials.get("source", "")).strip() or financials.get("source_url"))

    for key, value in financials.items():
        if key in ("source", "source_url", "as_of"):
            continue
        key_lower = key.lower()
        if key_lower not in FINANCIAL_METRIC_KEYS and not any(
            m in key_lower for m in ("revenue", "funding", "cap", "valuation", "profit")
        ):
            continue
        if value in (None, "", "unknown", "N/A"):
            continue

        if not has_source:
            violations.append(
                GuardrailViolation(
                    type="unsourced_financial",
                    message=f"Financial metric {key!r} has no source citation",
                    competitor=competitor,
                    metric=key,
                    details={"value": value},
                )
            )

        parsed = _parse_usd_amount(value)
        if parsed is not None and parsed > _implausible_usd_threshold():
            violations.append(
                GuardrailViolation(
                    type="implausible_financial",
                    message=f"Financial metric {key!r} exceeds plausibility threshold",
                    competitor=competitor,
                    metric=key,
                    details={"value": value, "parsed_usd": parsed},
                )
            )

        if _has_suspicious_precision(value):
            violations.append(
                GuardrailViolation(
                    type="suspicious_financial_precision",
                    message=f"Financial metric {key!r} has suspicious precision",
                    competitor=competitor,
                    metric=key,
                    details={"value": value},
                )
            )

    return GuardrailResult(
        name="financial_hallucination",
        passed=len(violations) == 0,
        violations=violations,
    )


def run_competitor_guardrails(
    competitor: dict,
    *,
    reference_date: date | None = None,
    stale_threshold_days: int | None = None,
) -> dict[str, Any]:
    """Run all guardrails on a single competitor dict."""
    name = competitor.get("name", "")
    news = competitor.get("news") or []
    financials = competitor.get("financials") or {}
    effective_stale = stale_threshold_days if stale_threshold_days is not None else _default_stale_threshold()

    stale = check_stale_news(
        news,
        competitor=name,
        reference_date=reference_date,
        threshold_days=effective_stale,
    )
    financial = check_financial_hallucinations(financials, competitor=name)

    results = [stale, financial]
    return {
        "competitor": name,
        "passed": all(r.passed for r in results),
        "guardrails": [r.to_dict() for r in results],
    }


def run_live_guardrails(
    graph_result: dict,
    *,
    reference_date: date | None = None,
    stale_threshold_days: int | None = None,
) -> dict[str, Any]:
    """Run guardrails across all competitors in a live graph result."""
    effective_stale = stale_threshold_days if stale_threshold_days is not None else _default_stale_threshold()
    competitors = graph_result.get("competitors") or []
    per_competitor = [
        run_competitor_guardrails(
            c,
            reference_date=reference_date,
            stale_threshold_days=effective_stale,
        )
        for c in competitors
    ]
    all_violations = [
        v
        for pc in per_competitor
        for g in pc["guardrails"]
        for v in g["violations"]
    ]
    return {
        "passed": all(pc["passed"] for pc in per_competitor),
        "competitor_count": len(per_competitor),
        "violation_count": len(all_violations),
        "per_competitor": per_competitor,
    }
