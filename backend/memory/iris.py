"""Redis Iris Context Retriever adapters — interfaces and TODO hooks for future SDK wiring."""

from __future__ import annotations

import logging

from state import NewsItem, ProductItem

from memory.interfaces import IrisContextRetriever, MemoryStore
from memory.schemas import (
    IRIS_SCHEMA_REGISTRY,
    CompanyRecord,
    CompetitorRecord,
    ProductRecord,
)

logger = logging.getLogger(__name__)


class RedisIrisAdapter:
    """Bridges MemoryStore to Iris Context Retriever query patterns.

    Today: delegates to JSON keys in RedisMemory.
    Future: swap internals to Iris SDK schema registration + MCP tool generation.
    """

    def __init__(self, store: MemoryStore):
        self._store = store
        self._iris_registered = False

    def register_schemas(self) -> None:
        """Register Company, Competitor, News, Product schemas with Redis Iris."""
        # TODO(Person2): Call Redis Iris Context Retriever SDK to register schemas:
        #   for name, schema in IRIS_SCHEMA_REGISTRY.items():
        #       iris.register_schema(name, schema)
        if not self._iris_registered:
            logger.info(
                "Iris schema registration stub — %d schemas ready: %s",
                len(IRIS_SCHEMA_REGISTRY),
                ", ".join(IRIS_SCHEMA_REGISTRY),
            )
            self._iris_registered = True

    async def query_company(self, session_id: str, name: str) -> CompanyRecord | None:
        record = await self._store.get_company(session_id)
        if record and record.name.lower() == name.lower():
            return record
        return None

    async def query_competitor(
        self, session_id: str, name: str
    ) -> CompetitorRecord | None:
        competitors = await self._store.get_competitors(session_id)
        for competitor in competitors:
            if competitor.name.lower() == name.lower():
                return CompetitorRecord.from_competitor(competitor, session_id=session_id)
        return None

    async def query_news(
        self, session_id: str, company: str, *, limit: int = 20
    ) -> list[NewsItem]:
        items = await self._store.get_news(session_id, company)
        return items[:limit]

    async def query_products(
        self, session_id: str, company: str
    ) -> list[ProductItem]:
        return await self._store.get_products(session_id, company)


_iris_retriever: IrisContextRetriever | None = None


def get_iris_retriever(store: MemoryStore | None = None) -> IrisContextRetriever:
    global _iris_retriever
    if _iris_retriever is None:
        from memory.factory import get_redis_memory

        backing = store or get_redis_memory()
        _iris_retriever = RedisIrisAdapter(backing)
    return _iris_retriever


def set_iris_retriever(retriever: IrisContextRetriever) -> None:
    global _iris_retriever
    _iris_retriever = retriever


def reset_iris_retriever() -> None:
    global _iris_retriever
    _iris_retriever = None
