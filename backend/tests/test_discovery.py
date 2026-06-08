from llm.discovery import extract_competitors_from_search
from state import NewsItem


def test_extract_from_list_pattern():
    results = [
        NewsItem(
            title="Apple Competitors: Complete List",
            summary="View the competitive landscape for Apple, featuring companies like Spotify, Google, and Microsoft.",
        )
    ]
    names = extract_competitors_from_search(results, "Apple")
    assert "Spotify" in names
    assert "Google" in names
    assert "Microsoft" in names
    assert "Apple" not in names


def test_extract_from_mock_titles():
    results = [
        NewsItem(title="Samsung competes in the same market", summary=""),
        NewsItem(title="Google competes in the same market", summary=""),
    ]
    names = extract_competitors_from_search(results, "Apple")
    assert names == ["Samsung", "Google"]


def test_extract_known_companies_from_text():
    results = [
        NewsItem(
            title="Apple's Top Competitors",
            summary="Alphabet Inc. ($GOOGL) Parent of Google, offers Android, Pixel devices.",
        )
    ]
    names = extract_competitors_from_search(results, "Apple")
    assert "Google" in names or "Alphabet" in names
