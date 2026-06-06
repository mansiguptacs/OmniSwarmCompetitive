"""Redis-backed vector search — IrisVectorSearch with session/competitor partitioning."""

from __future__ import annotations

import json
import logging
import uuid

from memory.interfaces import VectorSearchProvider
from memory.partitioning import (
    vector_document_key,
    vector_entity_index_key,
    vector_session_index_key,
)
from memory.redis_client import RedisMemory
from memory.schemas import VectorDocument
from memory.types import SearchResult
from memory.vector import VectorSearchConfig

logger = logging.getLogger(__name__)


def _tokenize(text: str) -> set[str]:
    return {token for token in text.lower().split() if len(token) > 2}


def _score_content(query: str, content: str) -> float:
    """Token overlap scorer — swap for Iris embeddings when VECTOR_BACKEND=iris_cloud."""
    query_tokens = _tokenize(query)
    if not query_tokens:
        return 0.0
    content_tokens = _tokenize(content)
    if not content_tokens:
        return 0.0
    overlap = len(query_tokens & content_tokens)
    return overlap / len(query_tokens)


class IrisVectorSearch:
    """Production vector provider backed by Redis JSON keys and partitioned indexes.

    Local/dev: token-overlap search on persisted documents.
    Future: replace _score_content with Redis Iris embedding + FT.SEARCH.
    """

    def __init__(
        self,
        store: RedisMemory,
        config: VectorSearchConfig | None = None,
    ):
        self._store = store
        self._config = config or VectorSearchConfig()

    async def _client(self):
        return await self._store._get_client()

    async def index_document(self, document: VectorDocument) -> str:
        doc_id = document.document_id or str(uuid.uuid4())
        entity_id = document.entity_id or "global"
        stored = document.model_copy(
            update={"document_id": doc_id, "entity_id": entity_id}
        )
        payload = stored.model_dump()
        client = await self._client()
        key = vector_document_key(stored.session_id, entity_id, doc_id)
        await client.set(key, json.dumps(payload))
        await client.sadd(vector_session_index_key(stored.session_id), doc_id)
        await client.sadd(
            vector_entity_index_key(stored.session_id, entity_id),
            doc_id,
        )
        logger.debug("IrisVectorSearch.index_document(%s)", key)
        return doc_id

    async def update_document(self, document_id: str, document: VectorDocument) -> None:
        entity_id = document.entity_id or "global"
        client = await self._client()
        key = vector_document_key(document.session_id, entity_id, document_id)
        if not await client.exists(key):
            raise KeyError(f"Document not found: {document_id}")
        updated = document.model_copy(
            update={"document_id": document_id, "entity_id": entity_id}
        )
        await client.set(key, json.dumps(updated.model_dump()))

    async def delete_document(
        self, document_id: str, *, session_id: str | None = None
    ) -> bool:
        client = await self._client()
        pattern = (
            f"ccie:vector:{session_id}:*:{document_id}"
            if session_id
            else f"ccie:vector:*:*:{document_id}"
        )
        keys = await client.keys(pattern)
        if not keys:
            return False

        for key in keys:
            raw = await client.get(key)
            if not raw:
                continue
            doc = VectorDocument.model_validate(json.loads(raw))
            await client.delete(key)
            await client.srem(vector_session_index_key(doc.session_id), document_id)
            await client.srem(
                vector_entity_index_key(doc.session_id, doc.entity_id),
                document_id,
            )
        return True

    async def _load_documents(
        self,
        *,
        session_id: str | None,
        entity_id: str | None,
    ) -> list[VectorDocument]:
        client = await self._client()
        doc_ids: set[str] = set()

        if session_id and entity_id:
            doc_ids.update(
                await client.smembers(
                    vector_entity_index_key(session_id, entity_id)
                )
            )
        elif session_id:
            doc_ids.update(await client.smembers(vector_session_index_key(session_id)))
        else:
            async for key in client.scan_iter(match="ccie:vector:*:*"):
                if ":index:" in key:
                    continue
                raw = await client.get(key)
                if raw:
                    doc_ids.add(VectorDocument.model_validate(json.loads(raw)).document_id)

        documents: list[VectorDocument] = []
        for doc_id in doc_ids:
            if session_id and entity_id:
                key = vector_document_key(session_id, entity_id, doc_id)
                raw = await client.get(key)
            elif session_id:
                matches = await client.keys(f"ccie:vector:{session_id}:*:{doc_id}")
                raw = await client.get(matches[0]) if matches else None
            else:
                matches = await client.keys(f"ccie:vector:*:*:{doc_id}")
                raw = await client.get(matches[0]) if matches else None
            if raw:
                documents.append(VectorDocument.model_validate(json.loads(raw)))
        return documents

    async def semantic_search(
        self,
        query: str,
        *,
        session_id: str | None = None,
        limit: int | None = None,
        filters: dict | None = None,
    ) -> list[SearchResult]:
        effective_limit = limit or self._config.default_limit
        entity_id = filters.get("entity_id") if filters else None
        entity_type = filters.get("entity_type") if filters else None

        documents = await self._load_documents(
            session_id=session_id,
            entity_id=entity_id,
        )

        hits: list[SearchResult] = []
        for doc in documents:
            if entity_type and doc.entity_type != entity_type:
                continue
            score = _score_content(query, doc.content)
            if score <= 0:
                continue
            hits.append(
                {
                    "document_id": doc.document_id,
                    "score": round(score, 4),
                    "content": doc.content,
                    "session_id": doc.session_id,
                    "entity_type": doc.entity_type,
                    "entity_id": doc.entity_id,
                    "metadata": doc.metadata,
                }
            )

        hits.sort(key=lambda hit: hit.get("score", 0), reverse=True)
        return hits[:effective_limit]
