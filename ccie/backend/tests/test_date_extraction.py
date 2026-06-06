"""Tests for improved date extraction from Tavily results."""

from tools.web_search import _extract_date_from_text, _tavily_result_to_news_item


def test_extract_iso_date():
    assert _extract_date_from_text("Published on 2025-06-01") == "2025-06-01"


def test_extract_named_month():
    assert _extract_date_from_text("January 15, 2025 — Stripe announces") == "2025-01-15"


def test_extract_abbreviated_month():
    assert _extract_date_from_text("Jun 3, 2025 report") == "2025-06-03"


def test_extract_abbreviated_month_with_period():
    assert _extract_date_from_text("Mar. 22, 2025 update") == "2025-03-22"


def test_no_date_found():
    assert _extract_date_from_text("No dates here at all") == ""


def test_tavily_result_with_published_date():
    item = _tavily_result_to_news_item({
        "title": "Test",
        "url": "https://example.com",
        "content": "Some content from May 10, 2025",
        "published_date": "2025-06-01",
    })
    assert item.published_at == "2025-06-01"


def test_tavily_result_extracts_from_content():
    item = _tavily_result_to_news_item({
        "title": "Test",
        "url": "https://example.com",
        "content": "Published on February 20, 2025. Stripe releases new API.",
        "published_date": "",
    })
    assert item.published_at == "2025-02-20"


def test_tavily_result_extracts_from_title():
    item = _tavily_result_to_news_item({
        "title": "March 5, 2025 — PayPal launches feature",
        "url": "https://example.com",
        "content": "Details about the launch.",
        "published_date": None,
    })
    assert item.published_at == "2025-03-05"
