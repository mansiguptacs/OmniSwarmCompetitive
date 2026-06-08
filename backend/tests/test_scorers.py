from datetime import date

import pytest

from observability.fixture_loader import load_fixture
from observability.scorers import (
    score_agent_output,
    score_freshness,
    score_product_coverage,
    score_relevance,
)


REFERENCE = date(2026, 6, 6)


def test_score_freshness_fresh_fixture():
    fixture = load_fixture("stripe_news")
    score = score_freshness(fixture["news_items"], reference_date=REFERENCE)
    assert score == 1.0


def test_score_freshness_stale_fixture():
    fixture = load_fixture("stripe_stale_news")
    score = score_freshness(fixture["news_items"], reference_date=REFERENCE)
    assert score < 0.5


def test_score_relevance_stripe_news():
    fixture = load_fixture("stripe_news")
    score = score_relevance(
        fixture["news_items"],
        fixture["query"],
        company=fixture["company"],
    )
    assert score == 1.0


def test_score_relevance_hypothetical_legal():
    fixture = load_fixture("hypothetical_legal_news")
    score = score_relevance(
        fixture["news_items"],
        "legal document review AI",
        company="",
    )
    assert score >= 0.66


def test_score_product_coverage():
    fixture = load_fixture("stripe_products")
    score = score_product_coverage(fixture["products"])
    assert score == 1.0


def test_score_agent_output_combined():
    fixture = load_fixture("stripe_news")
    scores = score_agent_output(fixture, reference_date=REFERENCE)
    assert scores["freshness"] == 1.0
    assert scores["relevance"] == 1.0
    assert "product_coverage" not in scores


@pytest.mark.parametrize("fixture_name", ["stripe_news", "stripe_stale_news", "hypothetical_legal_news"])
def test_all_news_fixtures_score_in_range(fixture_name):
    fixture = load_fixture(fixture_name)
    scores = score_agent_output(fixture, reference_date=REFERENCE)
    for value in scores.values():
        assert 0.0 <= value <= 1.0
