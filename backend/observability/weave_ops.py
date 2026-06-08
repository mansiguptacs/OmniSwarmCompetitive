"""All W&B Weave @weave.op scorers, trace feedback, and server logging."""

from __future__ import annotations

import asyncio
from datetime import date
from typing import Any

import weave

from observability.guardrails import (
    check_financial_hallucinations,
    check_stale_news,
    run_live_guardrails,
)
from observability.scorers import (
    score_accuracy,
    score_agent_output,
    score_freshness,
    score_product_coverage,
    score_relevance,
)
from observability.weave_config import init_weave

# --- Fixture evaluation scorers ---


@weave.op(name="eval_news_recency")
def freshness_scorer(
    output: dict,
    news_items: list | None = None,
    reference_date: str = "2026-06-06",
) -> dict:
    items = news_items or output.get("news_items") or output.get("news") or []
    ref = date.fromisoformat(reference_date)
    return {"freshness": score_freshness(items, reference_date=ref)}


@weave.op(name="eval_news_relevance")
def relevance_scorer(
    output: dict,
    query: str = "",
    company: str = "",
    news_items: list | None = None,
) -> dict:
    items = news_items or output.get("news_items") or output.get("news") or []
    effective_query = query or output.get("query") or company
    effective_company = company or output.get("company") or output.get("name") or ""
    return {
        "relevance": score_relevance(items, effective_query, company=effective_company)
    }


@weave.op(name="eval_product_completeness")
def product_coverage_scorer(output: dict, products: list | None = None) -> dict:
    items = products or output.get("products") or []
    return {"product_coverage": score_product_coverage(items)}


@weave.op(name="eval_overall_quality")
def ccie_quality_scorer(
    output: dict,
    reference_date: str = "2026-06-06",
    news_items: list | None = None,
    products: list | None = None,
    query: str = "",
    company: str = "",
) -> dict:
    merged = dict(output)
    if news_items is not None:
        merged["news_items"] = news_items
    if products is not None:
        merged["products"] = products
    if query:
        merged["query"] = query
    if company:
        merged["company"] = company
    return score_agent_output(merged, reference_date=date.fromisoformat(reference_date))


@weave.op(name="eval_competitor_accuracy")
def accuracy_scorer(
    output: dict,
    expected_competitors: list | None = None,
    required_keywords: list | None = None,
    min_competitor_count: int | None = None,
    competitors: list | None = None,
) -> dict:
    graph = output if output.get("competitors") else {"competitors": competitors or []}
    ground_truth = {
        "expected_competitors": expected_competitors or [],
        "required_keywords": required_keywords or [],
        "min_competitor_count": min_competitor_count,
    }
    return {"accuracy": score_accuracy(graph, ground_truth)}


WEAVE_SCORERS = [
    freshness_scorer,
    relevance_scorer,
    product_coverage_scorer,
    ccie_quality_scorer,
    accuracy_scorer,
]

# --- Guardrail scorers ---


@weave.op(name="guardrail_stale_news")
def stale_news_guardrail(
    output: dict,
    news_items: list | None = None,
    reference_date: str = "2026-06-06",
    competitor: str = "",
) -> dict:
    items = news_items or output.get("news_items") or output.get("news") or []
    ref = date.fromisoformat(reference_date)
    result = check_stale_news(
        items, competitor=competitor or output.get("company", ""), reference_date=ref
    )
    return {"stale_news_passed": result.passed, "stale_news_violations": len(result.violations)}


@weave.op(name="guardrail_unsourced_financials")
def financial_guardrail(
    output: dict,
    financials: dict | None = None,
    competitor: str = "",
) -> dict:
    fin = financials if financials is not None else output.get("financials") or {}
    if not fin and output.get("competitors"):
        violations_total = 0
        passed = True
        for comp in output["competitors"]:
            r = check_financial_hallucinations(
                comp.get("financials") or {}, competitor=comp.get("name", "")
            )
            violations_total += len(r.violations)
            passed = passed and r.passed
        return {"financial_passed": passed, "financial_violations": violations_total}
    result = check_financial_hallucinations(fin, competitor=competitor or output.get("company", ""))
    return {"financial_passed": result.passed, "financial_violations": len(result.violations)}


@weave.op(name="guardrail_all_checks")
def live_guardrail_scorer(output: dict, reference_date: str = "2026-06-06") -> dict:
    ref = date.fromisoformat(reference_date)
    report = run_live_guardrails(output, reference_date=ref)
    return {"guardrails_passed": report["passed"], "violation_count": report["violation_count"]}


WEAVE_GUARDRAILS = [stale_news_guardrail, financial_guardrail, live_guardrail_scorer]

# --- Live trace scorers (quality_report in call output) ---


def _aggregate(output: dict) -> dict:
    return (output.get("quality_report") or {}).get("aggregate") or {}


def _summary(output: dict) -> dict:
    return output.get("summary") or {}


@weave.op(name="live_news_recency")
def traced_avg_freshness_scorer(output: dict) -> dict:
    return {"avg_freshness": _aggregate(output).get("avg_freshness", 0.0)}


@weave.op(name="live_news_relevance")
def traced_avg_relevance_scorer(output: dict) -> dict:
    return {"avg_relevance": _aggregate(output).get("avg_relevance", 0.0)}


@weave.op(name="live_guardrails_passed")
def traced_guardrail_scorer(output: dict) -> dict:
    agg = _aggregate(output)
    return {
        "guardrails_passed": agg.get("guardrails_passed", True),
        "violation_count": agg.get("violation_count", 0),
    }


@weave.op(name="live_competitor_count")
def traced_competitor_count_scorer(output: dict) -> dict:
    summary = _summary(output)
    return {
        "competitor_count": summary.get("competitor_count", 0),
        "is_hypothetical": summary.get("is_hypothetical", False),
    }


@weave.op(name="live_product_coverage")
def traced_product_coverage_scorer(output: dict) -> dict:
    return {"avg_product_coverage": _aggregate(output).get("avg_product_coverage", 0.0)}


@weave.op(name="live_swot_completeness")
def traced_swot_completeness_scorer(output: dict) -> dict:
    return {"avg_swot_completeness": _aggregate(output).get("avg_swot_completeness", 0.0)}


@weave.op(name="live_intel_totals")
def traced_intel_volume_scorer(output: dict) -> dict:
    agg = _aggregate(output)
    return {
        "total_news_items": agg.get("total_news_items", 0),
        "total_products": agg.get("total_products", 0),
    }


TRACE_LIVE_SCORERS = [
    traced_avg_freshness_scorer,
    traced_avg_relevance_scorer,
    traced_guardrail_scorer,
    traced_competitor_count_scorer,
    traced_product_coverage_scorer,
    traced_swot_completeness_scorer,
    traced_intel_volume_scorer,
]

# --- Trace call feedback + server log ---


async def apply_trace_scorers(call: Any) -> dict[str, Any]:
    results: dict[str, Any] = {}

    async def _apply(scorer_op: Any) -> tuple[str, Any]:
        name = getattr(scorer_op, "name", scorer_op.__name__)
        try:
            applied = await call.apply_scorer(scorer_op)
            return name, {
                "result": applied.result,
                "score_call_id": str(applied.score_call.id) if applied.score_call else None,
            }
        except Exception as exc:
            return name, {"error": str(exc)}

    pairs = await asyncio.gather(*[_apply(s) for s in TRACE_LIVE_SCORERS])
    for name, payload in pairs:
        results[name] = payload
    return results


@weave.op(name="ccie_server_post_run")
def log_server_quality(output: dict) -> dict:
    return output


async def publish_server_quality(graph_result: dict, report: dict) -> dict[str, Any] | None:
    if not init_weave():
        return None
    competitors = graph_result.get("competitors") or []
    per_comp_summary = []
    for c in competitors:
        per_comp_summary.append({
            "name": c.get("name", ""),
            "news_count": len(c.get("news") or []),
            "product_count": len(c.get("products") or []),
            "has_swot": bool(c.get("swot")),
            "threat_level": c.get("threat_level", 0),
            "sentiment": c.get("sentiment", 0),
        })
    payload = {
        "summary": {
            "phase": graph_result.get("phase"),
            "target_company": graph_result.get("target_company"),
            "is_hypothetical": graph_result.get("is_hypothetical"),
            "competitor_count": len(competitors),
            "competitor_names": [c.get("name") for c in competitors],
            "session_id": graph_result.get("session_id"),
            "per_competitor": per_comp_summary,
        },
        "quality_report": report,
        "memory": report.get("memory"),
    }
    raw = log_server_quality.call(payload)
    if asyncio.iscoroutine(raw):
        raw = await raw
    _, call = raw
    return await apply_trace_scorers(call)
