"""Vector search — configurable provider with document indexing lifecycle."""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field

from memory.interfaces import VectorSearchProvider
from memory.schemas import VectorDocument
from memory.types import SearchResult

logger = logging.getLogger(__name__)


@dataclass
class VectorSearchConfig:
    """Provider configuration — swap values when wiring Redis Iris."""

    index_name: str = "ccie_intel"
    default_limit: int = 10
    embedding_model: str = ""  # TODO(Person2): set Iris embedding model id
    extra: dict = field(default_factory=dict)


class StubVectorSearch:
    """In-memory vector search stub for dev/test until Redis Iris index exists."""

    def __init__(self, config: VectorSearchConfig | None = None):
        self._config = config or VectorSearchConfig()
        self._documents: dict[str, VectorDocument] = {}

    async def index_document(self, document: VectorDocument) -> str:
        doc_id = document.document_id or str(uuid.uuid4())
        stored = document.model_copy(update={"document_id": doc_id})
        self._documents[doc_id] = stored
        logger.debug("StubVectorSearch.index_document(%s)", doc_id)
        return doc_id

    async def update_document(self, document_id: str, document: VectorDocument) -> None:
        if document_id not in self._documents:
            raise KeyError(f"Document not found: {document_id}")
        updated = document.model_copy(update={"document_id": document_id})
        self._documents[document_id] = updated

    async def delete_document(
        self, document_id: str, *, session_id: str | None = None
    ) -> bool:
        doc = self._documents.get(document_id)
        if doc is None:
            return False
        if session_id and doc.session_id != session_id:
            return False
        del self._documents[document_id]
        return True

    async def semantic_search(
        self,
        query: str,
        *,
        session_id: str | None = None,
        limit: int | None = None,
        filters: dict | None = None,
    ) -> list[SearchResult]:
        # TODO(Person2): Replace with Redis Iris vector query (FT.SEARCH / embeddings).
        effective_limit = limit or self._config.default_limit
        query_lower = query.lower()
        hits: list[SearchResult] = []

        for doc in self._documents.values():
            if session_id and doc.session_id != session_id:
                continue
            if filters:
                if filters.get("entity_type") and doc.entity_type != filters["entity_type"]:
                    continue
                if filters.get("entity_id") and doc.entity_id != filters["entity_id"]:
                    continue
            if query_lower not in doc.content.lower():
                continue
            hits.append(
                {
                    "document_id": doc.document_id,
                    "score": 1.0,
                    "content": doc.content,
                    "session_id": doc.session_id,
                    "entity_type": doc.entity_type,
                    "entity_id": doc.entity_id,
                    "metadata": doc.metadata,
                }
            )

        return hits[:effective_limit]


_vector_search: VectorSearchProvider | None = None
_vector_config: VectorSearchConfig | None = None


def get_vector_search_config() -> VectorSearchConfig:
    global _vector_config
    if _vector_config is None:
        _vector_config = VectorSearchConfig()
    return _vector_config


def set_vector_search_config(config: VectorSearchConfig) -> None:
    global _vector_config, _vector_search
    _vector_config = config
    _vector_search = None


def get_vector_search() -> VectorSearchProvider:
    global _vector_search
    if _vector_search is None:
        _vector_search = StubVectorSearch(get_vector_search_config())
    return _vector_search


def set_vector_search(provider: VectorSearchProvider) -> None:
    global _vector_search
    _vector_search = provider


def reset_vector_search() -> None:
    global _vector_search, _vector_config
    _vector_search = None
    _vector_config = None
