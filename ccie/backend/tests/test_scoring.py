"""Tests for scoring refinements — financial signals and relative quadrant placement."""

import pytest

from agents.scoring import (
    _financial_signals,
    _parse_growth_rate,
    _parse_numeric_amount,
    compute_competitor_metrics,
    compute_market_quadrants,
)
from state import Competitor, NewsItem, ProductItem


def test_parse_numeric_amount_billions():
    assert _parse_numeric_amount("$14.4B") == pytest.approx(14_400_000_000, rel=1e-3)
    assert _parse_numeric_amount("$29.8 billion") == pytest.approx(29_800_000_000, rel=1e-3)


def test_parse_numeric_amount_millions():
    assert _parse_numeric_amount("$500M") == pytest.approx(500_000_000, rel=1e-3)
    assert _parse_numeric_amount("250 million") == pytest.approx(250_000_000, rel=1e-3)


def test_parse_numeric_amount_unknown():
    assert _parse_numeric_amount("Unknown") is None
    assert _parse_numeric_amount("N/A") is None
    assert _parse_numeric_amount("Private") is None
    assert _parse_numeric_amount("") is None


def test_parse_growth_rate():
    assert _parse_growth_rate("25% YoY") == pytest.approx(0.25, rel=1e-3)
    assert _parse_growth_rate("8%") == pytest.approx(0.08, rel=1e-3)
    assert _parse_growth_rate("") is None
    assert _parse_growth_rate(None) is None


def test_financial_signals_large_company():
    c = Competitor(
        name="BigCorp",
        financials={"revenue": "$50B", "growth_rate": "25% YoY"},
    )
    size_sig, momentum_sig = _financial_signals(c)
    assert size_sig == 1.0
    assert momentum_sig == pytest.approx(0.5, rel=1e-2)


def test_financial_signals_small_company():
    c = Competitor(
        name="SmallCo",
        financials={"revenue": "$200M", "growth_rate": "40% YoY"},
    )
    size_sig, momentum_sig = _financial_signals(c)
    assert size_sig == 0.4
    assert momentum_sig == pytest.approx(0.8, rel=1e-2)


def test_financial_signals_no_financials():
    c = Competitor(name="NoCorp")
    size_sig, momentum_sig = _financial_signals(c)
    assert size_sig == 0.0
    assert momentum_sig == 0.0


def test_metrics_differentiate_with_financials():
    """Competitors with different financials should get different threat levels."""
    big = Competitor(
        name="BigCorp",
        news=[NewsItem(title=f"news {i}") for i in range(3)],
        products=[ProductItem(name=f"prod {i}") for i in range(3)],
        financials={"revenue": "$50B", "growth_rate": "30% YoY"},
    )
    small = Competitor(
        name="SmallCo",
        news=[NewsItem(title=f"news {i}") for i in range(3)],
        products=[ProductItem(name=f"prod {i}") for i in range(3)],
        financials={"revenue": "$200M", "growth_rate": "5% YoY"},
    )

    compute_competitor_metrics(big)
    compute_competitor_metrics(small)

    assert big.threat_level > small.threat_level
    assert big.market_size > small.market_size


def test_metrics_without_financials():
    """Without financials, scoring falls back to news/product signals."""
    c = Competitor(
        name="NoFin",
        news=[NewsItem(title=f"n{i}") for i in range(5)],
        products=[ProductItem(name=f"p{i}") for i in range(5)],
    )
    compute_competitor_metrics(c)
    assert 0.0 < c.threat_level < 1.0
    assert 0.0 < c.market_size < 1.0


def test_quadrants_relative_placement():
    """Relative quadrant assignment should spread competitors across quadrants."""
    competitors = [
        Competitor(name="Alpha", threat_level=0.9, market_size=0.85),
        Competitor(name="Beta", threat_level=0.8, market_size=0.3),
        Competitor(name="Gamma", threat_level=0.3, market_size=0.7),
        Competitor(name="Delta", threat_level=0.2, market_size=0.2),
    ]
    quads = compute_market_quadrants(competitors)

    assert "Alpha" in quads["leader"]
    assert "Beta" in quads["challenger"]
    assert "Gamma" in quads["visionary"]
    assert "Delta" in quads["niche"]


def test_quadrants_all_same_stats():
    """If all competitors have identical stats, they all land in 'leader' (above avg)."""
    competitors = [
        Competitor(name="A", threat_level=0.5, market_size=0.5),
        Competitor(name="B", threat_level=0.5, market_size=0.5),
    ]
    quads = compute_market_quadrants(competitors)
    assert len(quads["leader"]) == 2


def test_quadrants_empty():
    quads = compute_market_quadrants([])
    assert all(len(v) == 0 for v in quads.values())
