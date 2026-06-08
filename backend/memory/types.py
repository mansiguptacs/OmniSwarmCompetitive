"""Lightweight shared types — no heavy backend dependencies."""

from typing import TypedDict


class RedisHealthResult(TypedDict, total=False):
    connected: bool
    latency_ms: float | None
    error: str


class SearchResult(TypedDict, total=False):
    """Normalized semantic search hit."""

    document_id: str
    score: float
    content: str
    session_id: str
    entity_type: str
    entity_id: str
    metadata: dict
