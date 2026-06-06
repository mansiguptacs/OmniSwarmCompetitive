"""Post-run observability hook — score every graph invoke (P2 integration point)."""

from __future__ import annotations

import logging
import time
from typing import Any

from observability.env_loader import load_ccie_env
from observability.live_scorer import score_live_run
from observability.settings import get_observability_settings

logger = logging.getLogger(__name__)


def _summarize_for_log(report: dict) -> dict:
    agg = report.get("aggregate") or {}
    return {
        "avg_freshness": agg.get("avg_freshness"),
        "avg_relevance": agg.get("avg_relevance"),
        "guardrails_passed": agg.get("guardrails_passed"),
        "violation_count": agg.get("violation_count"),
        "competitor_count": report.get("competitor_count"),
    }


def build_observability_activity(
    report: dict[str, Any],
    *,
    ts: float | None = None,
) -> list[dict[str, Any]]:
    """Return agent_activity entries matching CCIEState contract."""
    timestamp = ts if ts is not None else time.time()
    agg = report.get("aggregate") or {}
    freshness = agg.get("avg_freshness", 0.0)
    relevance = agg.get("avg_relevance", 0.0)
    passed = agg.get("guardrails_passed", True)
    violations = agg.get("violation_count", 0)

    entries: list[dict[str, Any]] = [
        {
            "agent": "Observability",
            "status": (
                f"Quality — freshness {freshness:.2f}, "
                f"relevance {relevance:.2f}, "
                f"competitors {report.get('competitor_count', 0)}"
            ),
            "ts": timestamp,
        }
    ]

    if "accuracy" in report:
        entries.append(
            {
                "agent": "Observability",
                "status": f"Accuracy score {report['accuracy']:.2f} vs ground truth",
                "ts": timestamp + 0.001,
            }
        )

    if not passed:
        entries.append(
            {
                "agent": "Observability",
                "status": f"Guardrails FAILED — {violations} violation(s) detected",
                "ts": timestamp + 0.002,
            }
        )
    else:
        entries.append(
            {
                "agent": "Observability",
                "status": "Guardrails passed — intel quality OK",
                "ts": timestamp + 0.002,
            }
        )

    return entries


def merge_observability_activity(state: dict, report: dict[str, Any]) -> None:
    """Append observability activity entries to shared state (P2 hook)."""
    state.setdefault("agent_activity", []).extend(build_observability_activity(report))


def enrich_report_with_activity(report: dict[str, Any]) -> dict[str, Any]:
    """Attach suggested agent_activity entries to a quality report."""
    return {
        **report,
        "suggested_agent_activity": build_observability_activity(report),
    }


def suggest_prompt_improvements(report: dict[str, Any]) -> list[dict[str, str]]:
    """Rule-based suggestions from a live_scorer quality report."""
    agg = report.get("aggregate") or {}
    suggestions: list[dict[str, str]] = []

    freshness = float(agg.get("avg_freshness") or 0.0)
    relevance = float(agg.get("avg_relevance") or 0.0)
    passed = bool(agg.get("guardrails_passed", True))
    violations = int(agg.get("violation_count") or 0)
    accuracy = report.get("accuracy")

    if freshness < 0.5:
        suggestions.append(
            {
                "area": "news_scout",
                "issue": "low_freshness",
                "priority": "high",
                "suggestion": (
                    "Add recency to search queries (e.g. 'after:2025-01-01') and "
                    "reject news items older than CCIE_STALE_NEWS_DAYS."
                ),
            }
        )

    if relevance < 0.7:
        suggestions.append(
            {
                "area": "discovery",
                "issue": "low_relevance",
                "priority": "high",
                "suggestion": (
                    "Tighten discovery prompt: require competitors in the same "
                    "market category as the target company; filter generic industry news."
                ),
            }
        )

    if accuracy is not None and float(accuracy) < 0.7:
        suggestions.append(
            {
                "area": "discovery",
                "issue": "low_accuracy",
                "priority": "high",
                "suggestion": (
                    "Use structured output with expected competitor schema; "
                    "cross-check names against web_search before adding to state."
                ),
            }
        )

    if not passed:
        guardrails = report.get("guardrails") or {}
        for pc in guardrails.get("per_competitor") or []:
            for g in pc.get("guardrails") or []:
                if g.get("name") == "stale_news" and not g.get("passed"):
                    suggestions.append(
                        {
                            "area": "news_scout",
                            "issue": "stale_news",
                            "priority": "medium",
                            "suggestion": (
                                f"News for {pc.get('competitor')} is outdated — "
                                "prefer Tavily with time_range='month' or filter by published_at."
                            ),
                        }
                    )
                if g.get("name") == "financial_hallucination" and not g.get("passed"):
                    suggestions.append(
                        {
                            "area": "financial_analyst",
                            "issue": "unsourced_financials",
                            "priority": "critical",
                            "suggestion": (
                                "Require financials.source URL for every metric; "
                                "never emit revenue/funding without citation."
                            ),
                        }
                    )

    if not suggestions and violations == 0:
        suggestions.append(
            {
                "area": "all",
                "issue": "none",
                "priority": "low",
                "suggestion": "Quality metrics within thresholds — no prompt changes suggested.",
            }
        )

    return suggestions


async def on_graph_complete(graph_result: dict) -> dict[str, Any] | None:
    """Score a graph result after invoke. Returns report or None if disabled."""
    load_ccie_env()
    settings = get_observability_settings()
    if not settings.auto_score_enabled:
        return None

    report = score_live_run(
        graph_result,
        stale_threshold_days=settings.stale_news_threshold_days,
    )
    summary = _summarize_for_log(report)
    logger.info("CCIE observability post-run: %s", summary)

    if not report.get("aggregate", {}).get("guardrails_passed", True):
        logger.warning(
            "CCIE guardrails failed — violations=%s",
            report.get("aggregate", {}).get("violation_count"),
        )

    if settings.auto_apply_weave_scorers:
        try:
            from observability.weave_ops import publish_server_quality

            weave_scores = await publish_server_quality(graph_result, report)
            if weave_scores:
                report["weave_scores"] = weave_scores
                logger.info("CCIE Weave scorers attached: %s", list(weave_scores.keys()))
        except Exception as exc:
            logger.warning("CCIE Weave scorer publish failed: %s", exc)

    return enrich_report_with_activity(report)


class ObservedGraph:
    """Thin wrapper around a compiled LangGraph that auto-scores after ainvoke."""

    def __init__(self, graph: Any) -> None:
        self._graph = graph

    async def ainvoke(self, state: dict, config: dict | None = None, **kwargs: Any) -> dict:
        result = await self._graph.ainvoke(state, config, **kwargs)
        await on_graph_complete(result)
        return result

    async def astream(self, *args: Any, **kwargs: Any):
        async for chunk in self._graph.astream(*args, **kwargs):
            yield chunk

    def __getattr__(self, name: str) -> Any:
        return getattr(self._graph, name)


def wrap_graph_for_observability(graph: Any) -> Any:
    """Wrap compiled graph with auto-scoring when CCIE_AUTO_SCORE=1."""
    load_ccie_env()
    if not get_observability_settings().auto_score_enabled:
        return graph
    return ObservedGraph(graph)
