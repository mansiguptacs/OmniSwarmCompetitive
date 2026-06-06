"""Scorers, guardrails, settings, presets, accuracy, and report helpers."""

import os
from datetime import date

import pytest

from observability.env_loader import load_ccie_env
from observability.fixture_loader import load_fixture
from observability.guardrails import (
    check_financial_hallucinations,
    check_stale_news,
    run_live_guardrails,
)
from observability.live_scorer import score_live_run
from observability.presets import (
    PROMPT_VARIANTS,
    SCENARIOS,
    get_scenario_message,
    get_variant,
    list_scenarios,
    list_variants,
)
from observability.report_writer import export_leaderboard_summary
from observability.scorers import (
    score_accuracy,
    score_agent_output,
    score_freshness,
    score_product_coverage,
    score_relevance,
)
from observability.settings import ObservabilitySettings, get_observability_settings

REFERENCE = date(2026, 6, 6)


# --- Scorers ---


def test_score_freshness_fresh_fixture():
    fixture = load_fixture("stripe_news")
    assert score_freshness(fixture["news_items"], reference_date=REFERENCE) == 1.0


def test_score_freshness_stale_fixture():
    fixture = load_fixture("stripe_stale_news")
    assert score_freshness(fixture["news_items"], reference_date=REFERENCE) < 0.5


def test_score_relevance_stripe_news():
    fixture = load_fixture("stripe_news")
    score = score_relevance(fixture["news_items"], fixture["query"], company=fixture["company"])
    assert score == 1.0


def test_score_product_coverage():
    fixture = load_fixture("stripe_products")
    assert score_product_coverage(fixture["products"]) == 1.0


@pytest.mark.parametrize("fixture_name", ["stripe_news", "stripe_stale_news", "hypothetical_legal_news"])
def test_all_news_fixtures_score_in_range(fixture_name):
    fixture = load_fixture(fixture_name)
    scores = score_agent_output(fixture, reference_date=REFERENCE)
    for value in scores.values():
        assert 0.0 <= value <= 1.0


def test_score_accuracy_stripe_discovery():
    graph = load_fixture("discovery_prompt_v1_stripe")
    gt = load_fixture("stripe_ground_truth")
    assert score_accuracy(graph, gt) >= 0.8


def test_score_accuracy_weak_discovery():
    graph = load_fixture("discovery_prompt_v2_stripe")
    gt = load_fixture("stripe_ground_truth")
    score = score_accuracy(graph, gt)
    assert score < score_accuracy(load_fixture("discovery_prompt_v1_stripe"), gt)


# --- Guardrails ---


def test_stale_news_fixture_fails_guardrail():
    fixture = load_fixture("stripe_stale_news")
    result = check_stale_news(fixture["news_items"], reference_date=REFERENCE)
    assert result.passed is False
    assert any(v.type == "stale_news" for v in result.violations)


def test_fresh_news_fixture_passes_guardrail():
    fixture = load_fixture("stripe_news")
    result = check_stale_news(fixture["news_items"], reference_date=REFERENCE)
    assert result.passed is True


def test_hallucinated_financials_fixture_fails():
    fixture = load_fixture("stripe_hallucinated_financials")
    competitor = fixture["competitors"][0]
    result = check_financial_hallucinations(competitor["financials"], competitor=competitor["name"])
    assert result.passed is False
    assert any(v.type == "unsourced_financial" for v in result.violations)


def test_sourced_financials_pass():
    financials = {"revenue": "$10B", "source": "SEC 10-K filing 2025"}
    result = check_financial_hallucinations(financials, competitor="Stripe")
    assert result.passed is True


def test_live_guardrails_on_hallucinated_fixture():
    fixture = load_fixture("stripe_hallucinated_financials")
    report = run_live_guardrails(fixture, reference_date=REFERENCE)
    assert report["passed"] is False
    assert report["violation_count"] > 0


def test_score_live_run_on_fixture_graph():
    fixture = load_fixture("stripe_hallucinated_financials")
    report = score_live_run(fixture, reference_date=REFERENCE)
    assert report["competitor_count"] == 1
    assert report["aggregate"]["guardrails_passed"] is False


# --- Settings ---


def test_default_settings():
    load_ccie_env()
    for key in (
        "CCIE_STALE_NEWS_DAYS",
        "CCIE_FRESHNESS_WINDOW_DAYS",
        "CCIE_AUTO_SCORE",
        "CCIE_AUTO_APPLY_WEAVE_SCORERS",
    ):
        os.environ.pop(key, None)
    get_observability_settings.cache_clear()
    s = ObservabilitySettings()
    assert s.stale_news_threshold_days == 90
    assert s.freshness_window_days == 90
    assert s.auto_score_enabled is False


def test_env_overrides(monkeypatch):
    monkeypatch.setenv("CCIE_STALE_NEWS_DAYS", "30")
    monkeypatch.setenv("CCIE_FRESHNESS_WINDOW_DAYS", "45")
    monkeypatch.setenv("CCIE_AUTO_SCORE", "1")
    get_observability_settings.cache_clear()
    s = get_observability_settings()
    assert s.stale_news_threshold_days == 30
    assert s.freshness_window_days == 45
    assert s.auto_score_enabled is True


# --- Presets ---


def test_list_scenarios():
    items = list_scenarios()
    assert len(items) == len(SCENARIOS)
    names = {item["name"] for item in items}
    assert "stripe" in names
    assert "hypothetical_legal" in names


def test_get_stripe_message():
    assert "Stripe" in get_scenario_message("stripe")


def test_get_hypothetical_message():
    assert "legal" in get_scenario_message("hypothetical_legal").lower()


def test_unknown_scenario_raises():
    with pytest.raises(KeyError):
        get_scenario_message("unknown")


def test_list_variants():
    assert len(list_variants()) == len(PROMPT_VARIANTS)


def test_v1_fixture_scores_better_than_v2():
    v1 = load_fixture("discovery_prompt_v1_stripe")
    v2 = load_fixture("discovery_prompt_v2_stripe")
    s1 = score_live_run(v1, reference_date=REFERENCE)
    s2 = score_live_run(v2, reference_date=REFERENCE)
    assert s1["aggregate"]["avg_relevance"] >= s2["aggregate"]["avg_relevance"]
    assert s1["competitor_count"] >= s2["competitor_count"]


def test_get_variant():
    assert get_variant("v1_baseline")["fixture"] == "discovery_prompt_v1_stripe"


def test_export_leaderboard_summary_shape():
    sample = {
        "reference_date": "2026-06-06",
        "policies_compared": ["strict", "lenient"],
        "leaderboard": {"winner": "lenient", "composite_scores": {"strict": 0.3, "lenient": 0.5}},
        "comparison": {
            "strict": {"means": {"policy_freshness_30d.freshness": 0.2}},
            "lenient": {"means": {"policy_freshness_90d.freshness": 0.4}},
        },
    }
    slim = export_leaderboard_summary(sample)
    assert slim["winner"] == "lenient"
    assert slim["type"] == "policy_ab"
    assert "policy_means" in slim
