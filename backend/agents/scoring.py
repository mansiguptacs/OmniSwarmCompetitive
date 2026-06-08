"""Competitive metrics for 3D encoding and landscape quadrants."""

import re

from state import Competitor


def _parse_numeric_amount(value: str) -> float | None:
    """Parse a financial string like '$14.4B' or '$29.8 billion' into a raw number."""
    if not value or value.lower() in ("unknown", "n/a", "private", ""):
        return None
    text = str(value).strip().upper().replace(",", "")
    match = re.search(r"[\d.]+", text)
    if not match:
        return None
    amount = float(match.group())
    if "T" in text or "TRILLION" in text:
        amount *= 1_000_000_000_000
    elif "B" in text or "BILLION" in text:
        amount *= 1_000_000_000
    elif "M" in text or "MILLION" in text:
        amount *= 1_000_000
    return amount


def _parse_growth_rate(value: str) -> float | None:
    """Extract a growth percentage like '25% YoY' -> 0.25."""
    if not value:
        return None
    match = re.search(r"(\d+\.?\d*)\s*%", value)
    if match:
        return float(match.group(1)) / 100.0
    return None


def _financial_signals(competitor: Competitor) -> tuple[float, float]:
    """Return (size_signal, momentum_signal) from financials, each 0.0-1.0."""
    fin = competitor.financials or {}
    if not fin:
        return 0.0, 0.0

    rev = _parse_numeric_amount(fin.get("revenue", ""))
    cap = _parse_numeric_amount(fin.get("market_cap", ""))
    growth = _parse_growth_rate(fin.get("growth_rate", ""))

    size_val = rev or cap or 0
    if size_val >= 50_000_000_000:
        size_signal = 1.0
    elif size_val >= 10_000_000_000:
        size_signal = 0.8
    elif size_val >= 1_000_000_000:
        size_signal = 0.6
    elif size_val >= 100_000_000:
        size_signal = 0.4
    elif size_val > 0:
        size_signal = 0.2
    else:
        size_signal = 0.0

    if growth is not None:
        momentum_signal = min(1.0, max(0.0, growth / 0.50))
    else:
        momentum_signal = 0.0

    return size_signal, momentum_signal


def compute_competitor_metrics(competitor: Competitor) -> Competitor:
    """Derive threat, size, and overlap from collected intel + financials."""
    news_count = len(competitor.news)
    product_count = len(competitor.products)

    sentiment = competitor.sentiment
    if news_count and sentiment == 0.0:
        sentiment = sum(item.sentiment for item in competitor.news) / news_count

    news_signal = min(1.0, news_count / 5)
    product_signal = min(1.0, product_count / 5)

    size_signal, momentum_signal = _financial_signals(competitor)

    competitor.sentiment = round(max(-1.0, min(1.0, sentiment)), 3)

    if size_signal > 0 or momentum_signal > 0:
        competitor.threat_level = round(min(1.0, max(0.0,
            0.15
            + size_signal * 0.25
            + momentum_signal * 0.20
            + news_signal * 0.15
            + product_signal * 0.10
            + (sentiment + 1) * 0.075
        )), 3)
        competitor.market_size = round(min(1.0, max(0.0,
            size_signal * 0.55
            + product_signal * 0.25
            + news_signal * 0.10
            + momentum_signal * 0.10
        )), 3)
    else:
        competitor.threat_level = round(min(1.0, max(0.0,
            0.30
            + news_signal * 0.25
            + product_signal * 0.20
            + (sentiment + 1) * 0.125
        )), 3)
        competitor.market_size = round(min(1.0, max(0.0,
            0.20
            + product_signal * 0.45
            + news_signal * 0.25
        )), 3)

    competitor.market_overlap = round(min(1.0, max(0.0,
        0.35
        + product_signal * 0.35
        + news_signal * 0.15
        + momentum_signal * 0.15
    )), 3)

    return competitor


def compute_market_quadrants(competitors: list[Competitor]) -> dict[str, list[str]]:
    """Bucket competitors into leader/challenger/niche/visionary using relative ranking."""
    quadrants: dict[str, list[str]] = {
        "leader": [],
        "challenger": [],
        "niche": [],
        "visionary": [],
    }

    if not competitors:
        return quadrants

    threats = [c.threat_level for c in competitors]
    sizes = [c.market_size for c in competitors]
    avg_threat = sum(threats) / len(threats)
    avg_size = sum(sizes) / len(sizes)

    for competitor in competitors:
        high_threat = competitor.threat_level >= avg_threat
        high_size = competitor.market_size >= avg_size

        if high_threat and high_size:
            quadrants["leader"].append(competitor.name)
        elif high_threat and not high_size:
            quadrants["challenger"].append(competitor.name)
        elif not high_threat and high_size:
            quadrants["visionary"].append(competitor.name)
        else:
            quadrants["niche"].append(competitor.name)

    return quadrants
