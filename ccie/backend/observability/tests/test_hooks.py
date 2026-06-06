"""Post-run hook, activity feed, prompt suggestions, and Weave trace scorers."""

import os
from datetime import date

import pytest

from observability.fixture_loader import load_fixture
from observability.live_scorer import score_live_run
from observability.post_run_hook import (
    ObservedGraph,
    build_observability_activity,
    merge_observability_activity,
    on_graph_complete,
    suggest_prompt_improvements,
    wrap_graph_for_observability,
)
from observability.settings import get_observability_settings
from observability.weave_ops import (
    _aggregate,
    _summary,
    traced_competitor_count_scorer,
    traced_guardrail_scorer,
)


class FakeGraph:
    def __init__(self):
        self.invoked = False

    async def ainvoke(self, state, config=None):
        self.invoked = True
        return {
            "phase": "complete",
            "target_company": "Stripe",
            "competitors": [
                {
                    "name": "PayPal",
                    "news": [{"title": "News", "published_at": "2026-05-01"}],
                    "products": [],
                    "financials": {},
                }
            ],
        }


# --- Activity feed + prompt suggestions ---


def test_build_observability_activity():
    report = {
        "competitor_count": 3,
        "aggregate": {
            "avg_freshness": 0.5,
            "avg_relevance": 1.0,
            "guardrails_passed": False,
            "violation_count": 2,
        },
    }
    entries = build_observability_activity(report, ts=1000.0)
    assert len(entries) >= 2
    assert entries[0]["agent"] == "Observability"
    assert "Guardrails FAILED" in entries[-1]["status"]


def test_suggest_prompt_improvements_on_low_freshness():
    report = {
        "aggregate": {
            "avg_freshness": 0.1,
            "avg_relevance": 1.0,
            "guardrails_passed": True,
            "violation_count": 0,
        }
    }
    suggestions = suggest_prompt_improvements(report)
    assert any(s["issue"] == "low_freshness" for s in suggestions)


def test_merge_observability_activity():
    state = {"agent_activity": []}
    report = score_live_run(load_fixture("discovery_prompt_v1_stripe"), reference_date=date(2026, 6, 6))
    merge_observability_activity(state, report)
    assert len(state["agent_activity"]) >= 2


# --- Weave trace scorers ---


def test_aggregate_helpers():
    output = {
        "summary": {"competitor_count": 3, "is_hypothetical": False},
        "quality_report": {
            "aggregate": {
                "avg_freshness": 0.5,
                "avg_relevance": 1.0,
                "guardrails_passed": False,
                "violation_count": 2,
            }
        },
    }
    assert _aggregate(output)["avg_freshness"] == 0.5
    assert _summary(output)["competitor_count"] == 3


def test_traced_guardrail_scorer_shape():
    output = {
        "quality_report": {
            "aggregate": {"guardrails_passed": False, "violation_count": 3}
        }
    }
    result = traced_guardrail_scorer(output)
    assert result["guardrails_passed"] is False
    assert result["violation_count"] == 3


def test_traced_competitor_count_scorer():
    output = {
        "summary": {
            "competitor_count": 3,
            "is_hypothetical": True,
        }
    }
    result = traced_competitor_count_scorer(output)
    assert result["competitor_count"] == 3
    assert result["is_hypothetical"] is True


# --- Post-run hook ---


@pytest.mark.asyncio
async def test_on_graph_complete_disabled_by_default():
    os.environ.pop("CCIE_AUTO_SCORE", None)
    get_observability_settings.cache_clear()
    assert await on_graph_complete({"competitors": []}) is None


@pytest.mark.asyncio
async def test_on_graph_complete_when_enabled(monkeypatch):
    monkeypatch.setenv("CCIE_AUTO_SCORE", "1")
    get_observability_settings.cache_clear()
    graph_result = {
        "phase": "complete",
        "competitors": [
            {
                "name": "PayPal",
                "news": [{"title": "x", "published_at": "2026-05-01"}],
                "products": [],
                "financials": {},
            }
        ],
    }
    report = await on_graph_complete(graph_result)
    assert report is not None
    assert "aggregate" in report


@pytest.mark.asyncio
async def test_on_graph_complete_weave_scorers_when_enabled(monkeypatch):
    monkeypatch.setenv("CCIE_AUTO_SCORE", "1")
    monkeypatch.setenv("CCIE_AUTO_APPLY_WEAVE_SCORERS", "1")
    monkeypatch.setenv("WEAVE_DISABLED", "1")
    get_observability_settings.cache_clear()

    graph_result = {
        "phase": "complete",
        "target_company": "Stripe",
        "competitors": [
            {
                "name": "PayPal",
                "news": [{"title": "PayPal news", "published_at": "2026-05-01"}],
                "products": [{"name": "Checkout", "description": "x", "pricing": "y"}],
                "financials": {},
            }
        ],
    }
    report = await on_graph_complete(graph_result)
    assert report is not None
    assert "aggregate" in report
    assert "weave_scores" not in report


@pytest.mark.asyncio
async def test_wrap_graph_noop_when_disabled():
    os.environ.pop("CCIE_AUTO_SCORE", None)
    get_observability_settings.cache_clear()
    g = FakeGraph()
    assert wrap_graph_for_observability(g) is g


@pytest.mark.asyncio
async def test_observed_graph_invokes_and_scores(monkeypatch):
    monkeypatch.setenv("CCIE_AUTO_SCORE", "1")
    get_observability_settings.cache_clear()
    g = FakeGraph()
    result = await ObservedGraph(g).ainvoke({})
    assert g.invoked is True
    assert result["phase"] == "complete"
