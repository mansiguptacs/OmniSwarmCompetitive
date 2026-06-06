"""Competitive metrics for 3D encoding and landscape quadrants."""

from state import Competitor


def compute_competitor_metrics(competitor: Competitor) -> Competitor:
    """Derive threat, size, and overlap from collected intel."""
    news_count = len(competitor.news)
    product_count = len(competitor.products)

    sentiment = competitor.sentiment
    if news_count and sentiment == 0.0:
        sentiment = sum(item.sentiment for item in competitor.news) / news_count

    news_signal = min(1.0, news_count / 5)
    product_signal = min(1.0, product_count / 5)

    competitor.sentiment = round(max(-1.0, min(1.0, sentiment)), 3)
    competitor.threat_level = round(
        min(1.0, max(0.0, 0.35 + news_signal * 0.25 + product_signal * 0.2 + (sentiment + 1) * 0.1)),
        3,
    )
    competitor.market_size = round(
        min(1.0, max(0.0, 0.25 + product_signal * 0.45 + news_signal * 0.2)),
        3,
    )
    competitor.market_overlap = round(
        min(1.0, max(0.0, 0.4 + product_signal * 0.35 + news_signal * 0.15)),
        3,
    )
    return competitor


def compute_market_quadrants(competitors: list[Competitor]) -> dict[str, list[str]]:
    """Bucket competitors into leader/challenger/niche/visionary."""
    quadrants: dict[str, list[str]] = {
        "leader": [],
        "challenger": [],
        "niche": [],
        "visionary": [],
    }

    for competitor in competitors:
        name = competitor.name
        if competitor.threat_level >= 0.65 and competitor.market_size >= 0.55:
            quadrants["leader"].append(name)
        elif competitor.threat_level >= 0.55:
            quadrants["challenger"].append(name)
        elif competitor.market_overlap < 0.45:
            quadrants["niche"].append(name)
        else:
            quadrants["visionary"].append(name)

    return quadrants
