"""Score live CCIE graph results post-run (not just fixtures)."""

from __future__ import annotations

from datetime import date
from typing import Any

from observability.guardrails import run_live_guardrails
from observability.scorers import score_accuracy, score_competitor_completeness, score_freshness, score_relevance


def score_live_run(
    graph_result: dict,
    *,
    reference_date: date | None = None,
    stale_threshold_days: int | None = None,
) -> dict[str, Any]:
    """Score + guardrail-check a full orchestrator invoke result."""
    from observability.env_loader import load_ccie_env
    from observability.settings import get_observability_settings

    load_ccie_env()
    effective_stale = (
        stale_threshold_days
        if stale_threshold_days is not None
        else get_observability_settings().stale_news_threshold_days
    )
    competitors = graph_result.get("competitors") or []
    target = graph_result.get("target_company") or ""

    per_competitor: dict[str, dict[str, Any]] = {}
    freshness_scores: list[float] = []
    relevance_scores: list[float] = []
    product_coverage_scores: list[float] = []
    swot_completeness_scores: list[float] = []

    for competitor in competitors:
        name = competitor.get("name") or "unknown"
        quality = score_competitor_completeness(competitor)
        freshness_scores.append(quality["freshness"])
        relevance_scores.append(quality["relevance"])
        product_coverage_scores.append(quality["product_coverage"])
        swot_completeness_scores.append(quality["swot_completeness"])
        guardrails = run_live_guardrails(
            {"competitors": [competitor]},
            reference_date=reference_date,
            stale_threshold_days=effective_stale,
        )["per_competitor"][0]
        per_competitor[name] = {
            "quality": quality,
            "guardrails_passed": guardrails["passed"],
            "guardrails": guardrails["guardrails"],
        }

    guardrail_report = run_live_guardrails(
        graph_result,
        reference_date=reference_date,
        stale_threshold_days=effective_stale,
    )

    total_news = sum(len(c.get("news") or []) for c in competitors)
    total_products = sum(len(c.get("products") or []) for c in competitors)

    def _avg(values: list[float]) -> float:
        return round(sum(values) / len(values), 4) if values else 0.0

    return {
        "target_company": target,
        "phase": graph_result.get("phase"),
        "is_hypothetical": graph_result.get("is_hypothetical", False),
        "competitor_count": len(competitors),
        "aggregate": {
            "avg_freshness": _avg(freshness_scores),
            "avg_relevance": _avg(relevance_scores),
            "avg_product_coverage": _avg(product_coverage_scores),
            "avg_swot_completeness": _avg(swot_completeness_scores),
            "total_news_items": total_news,
            "total_products": total_products,
            "guardrails_passed": guardrail_report["passed"],
            "violation_count": guardrail_report["violation_count"],
        },
        "guardrails": guardrail_report,
        "per_competitor": per_competitor,
    }


def score_accuracy(graph_result: dict, ground_truth: dict) -> float:
    from observability.scorers import score_accuracy as _impl

    return _impl(graph_result, ground_truth)


def score_graph_with_ground_truth(
    graph_result: dict,
    ground_truth: dict,
    *,
    reference_date: date | None = None,
) -> dict[str, float]:
    """Full score set including accuracy when ground truth is available."""
    report = score_live_run(graph_result, reference_date=reference_date)
    agg = report.get("aggregate") or {}
    scores = {
        "freshness": agg.get("avg_freshness", 0.0),
        "relevance": agg.get("avg_relevance", 0.0),
        "accuracy": score_accuracy(graph_result, ground_truth),
    }
    per_comp = report.get("per_competitor") or {}
    if per_comp:
        coverages = [p.get("quality", {}).get("product_coverage", 0.0) for p in per_comp.values()]
        scores["product_coverage"] = round(sum(coverages) / len(coverages), 4)
    return scores
