"""Central MemoryService — reusable facade over storage, Iris, vector search, and cache."""

from __future__ import annotations

from typing import Any

from config import get_settings
from state import Competitor, NewsItem, ProductItem

from memory.cache import get_cache_provider
from memory.interfaces import CacheProvider, IrisContextRetriever, MemoryStore, VectorSearchProvider
from memory.iris import RedisIrisAdapter
from memory.schemas import CompanyRecord, CompetitorRecord, ProductRecord, VectorDocument
from memory.types import SearchResult
from memory.vector import get_vector_search


class MemoryService:
    """High-level memory API for agents, MCP tools, and API endpoints."""

    def __init__(
        self,
        store: MemoryStore,
        *,
        iris: IrisContextRetriever | None = None,
        vector: VectorSearchProvider | None = None,
        cache: CacheProvider | None = None,
        auto_index: bool | None = None,
    ):
        self._store = store
        self._iris = iris or RedisIrisAdapter(store)
        self._vector = vector or get_vector_search()
        self._cache = cache or get_cache_provider()
        self._auto_index = (
            auto_index if auto_index is not None else get_settings().AUTO_INDEX_INTEL
        )
        self._iris.register_schemas()

    @property
    def store(self) -> MemoryStore:
        return self._store

    @property
    def vector(self) -> VectorSearchProvider:
        return self._vector

    @property
    def cache(self) -> CacheProvider:
        return self._cache

    async def ping(self) -> dict:
        return await self._store.ping()

    async def has_session(self, session_id: str) -> bool:
        return await self._store.has_session(session_id)

    # --- Company ---

    async def save_company(self, session_id: str, company: CompanyRecord) -> None:
        await self._store.save_company(session_id, company)
        if self._auto_index:
            from memory.indexing import index_company_profile

            await index_company_profile(self, session_id, company)

    async def lookup_company(self, session_id: str, name: str) -> CompanyRecord | None:
        return await self._iris.query_company(session_id, name)

    # --- Competitors ---

    async def save_competitors(
        self, session_id: str, competitors: list[Competitor]
    ) -> None:
        await self._store.save_competitors(session_id, competitors)
        if self._auto_index:
            from memory.indexing import index_competitor_profile

            for competitor in competitors:
                await index_competitor_profile(self, session_id, competitor)

    async def get_competitors(self, session_id: str) -> list[Competitor]:
        return await self._store.get_competitors(session_id)

    async def lookup_competitor(
        self, session_id: str, name: str
    ) -> CompetitorRecord | None:
        return await self._iris.query_competitor(session_id, name)

    # --- News ---

    async def save_news(
        self, session_id: str, competitor: str, items: list[NewsItem]
    ) -> None:
        await self._store.save_news(session_id, competitor, items)
        if self._auto_index and items:
            from memory.indexing import index_news_items

            await index_news_items(self, session_id, competitor, items)

    async def lookup_news(
        self, session_id: str, company: str, *, limit: int = 20
    ) -> list[NewsItem]:
        return await self._iris.query_news(session_id, company, limit=limit)

    # --- Products ---

    async def save_products(
        self, session_id: str, company: str, items: list[ProductItem]
    ) -> None:
        await self._store.save_products(session_id, company, items)
        if self._auto_index and items:
            from memory.indexing import index_product_items

            await index_product_items(self, session_id, company, items)

    async def lookup_products(
        self, session_id: str, company: str
    ) -> list[ProductItem]:
        return await self._iris.query_products(session_id, company)

    async def lookup_products_as_records(
        self, session_id: str, company: str
    ) -> list[ProductRecord]:
        products = await self.lookup_products(session_id, company)
        return [
            ProductRecord.from_product(p, company=company, session_id=session_id)
            for p in products
        ]

    # --- Vector search document lifecycle ---

    async def index_document(self, document: VectorDocument) -> str:
        return await self._vector.index_document(document)

    async def update_document(self, document_id: str, document: VectorDocument) -> None:
        await self._vector.update_document(document_id, document)

    async def delete_document(
        self, document_id: str, *, session_id: str | None = None
    ) -> bool:
        return await self._vector.delete_document(document_id, session_id=session_id)

    async def semantic_search(
        self,
        query: str,
        *,
        session_id: str | None = None,
        limit: int = 10,
        filters: dict[str, Any] | None = None,
    ) -> list[SearchResult]:
        return await self._vector.semantic_search(
            query,
            session_id=session_id,
            limit=limit,
            filters=filters,
        )

    # --- LangCache ---

    async def get_cached_response(
        self, prompt: str, *, namespace: str = "default"
    ) -> str | None:
        return await self._cache.get(prompt, namespace=namespace)

    async def cache_response(
        self,
        prompt: str,
        response: str,
        *,
        namespace: str = "default",
        ttl_seconds: int | None = None,
    ) -> None:
        await self._cache.set(
            prompt, response, namespace=namespace, ttl_seconds=ttl_seconds
        )

    async def get_or_cache_response(
        self,
        prompt: str,
        compute,
        *,
        namespace: str = "default",
        ttl_seconds: int | None = None,
    ) -> str:
        return await self._cache.get_or_compute(
            prompt,
            compute,
            namespace=namespace,
            ttl_seconds=ttl_seconds,
        )

    # --- Index hooks (Person 1 integration surface) ---

    async def index_synthesis(
        self,
        session_id: str,
        competitor: str,
        *,
        swot: dict | None = None,
        landscape_summary: str = "",
    ) -> list[str]:
        from memory.indexing import index_synthesis_intel

        return await index_synthesis_intel(
            self,
            session_id,
            competitor,
            swot=swot,
            landscape_summary=landscape_summary,
        )

    async def index_session_intel(self, session_id: str, **kwargs) -> dict[str, list[str]]:
        from memory.indexing import index_session_intel

        return await index_session_intel(self, session_id, **kwargs)
