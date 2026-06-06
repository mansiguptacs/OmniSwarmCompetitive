"""Multi-competitor key partitioning — session + entity namespaces."""

from __future__ import annotations

import hashlib
import re


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "unknown"


def vector_document_key(session_id: str, entity_id: str, document_id: str) -> str:
    """Redis key for a single indexed vector document."""
    return f"ccie:vector:{session_id}:{slugify(entity_id)}:{document_id}"


def vector_session_index_key(session_id: str) -> str:
    """Set of document IDs for a session."""
    return f"ccie:vector:index:{session_id}"


def vector_entity_index_key(session_id: str, entity_id: str) -> str:
    """Set of document IDs for a competitor within a session."""
    return f"ccie:vector:index:{session_id}:{slugify(entity_id)}"


def cache_entry_key(namespace: str, prompt: str) -> str:
    """Redis key for a cached LLM response."""
    digest = hashlib.sha256(prompt.encode("utf-8")).hexdigest()[:24]
    return f"ccie:langcache:{namespace}:{digest}"


def cache_namespace(session_id: str, entity_id: str | None = None) -> str:
    """Partition cache by session and optional competitor."""
    if entity_id:
        return f"{session_id}:{slugify(entity_id)}"
    return session_id
