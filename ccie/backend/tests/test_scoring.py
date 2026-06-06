from agents.scoring import compute_competitor_metrics, compute_market_quadrants
from state import Competitor, NewsItem, ProductItem


def test_compute_competitor_metrics_from_intel():
    competitor = Competitor(
        name="PayPal",
        news=[
            NewsItem(title="PayPal expands", sentiment=0.6),
            NewsItem(title="PayPal wins deal", sentiment=0.4),
        ],
        products=[
            ProductItem(name="PayPal Commerce"),
            ProductItem(name="PayPal Checkout"),
        ],
    )

    scored = compute_competitor_metrics(competitor)

    assert 0.0 <= scored.threat_level <= 1.0
    assert 0.0 <= scored.market_size <= 1.0
    assert 0.0 <= scored.market_overlap <= 1.0
    assert scored.sentiment == 0.5


def test_compute_market_quadrants_buckets_competitors():
    competitors = [
        Competitor(name="LeaderCo", threat_level=0.8, market_size=0.7, market_overlap=0.6),
        Competitor(name="ChallengerCo", threat_level=0.7, market_size=0.4, market_overlap=0.5),
        Competitor(name="NicheCo", threat_level=0.3, market_size=0.3, market_overlap=0.3),
    ]

    quadrants = compute_market_quadrants(competitors)

    assert "LeaderCo" in quadrants["leader"]
    assert "ChallengerCo" in quadrants["challenger"]
    assert "NicheCo" in quadrants["niche"]
