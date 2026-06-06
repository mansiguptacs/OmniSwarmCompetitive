"""Memory layer protocols — storage, vector search, cache, and Iris integration hooks."""

from __future__ import annotations

from typing import Any, Callable, Protocol, runtime_checkable

from state import Competitor, NewsItem, ProductItem

from memory.schemas import CompanyRecord, CompetitorRecord, ProductRecord, VectorDocument
from memory.types import RedisHealthResult, SearchResult


@runtime_checkable
class MemoryStore(Protocol):
    """Low-level async key-value store for competitive intel."""

    async def ping(self) -> RedisHealthResult: ...

    async def save_news(
        self,
        session_id: str,
        competitor: str,
        items: list[NewsItem],
    ) -> None: ...

    async def get_news(self, session_id: str, competitor: str) -> list[NewsItem]: ...

    async def save_competitors(
        self,
        session_id: str,
        competitors: list[Competitor],
    ) -> None: ...

    async def get_competitors(self, session_id: str) -> list[Competitor]: ...

    async def save_company(self, session_id: str, company: CompanyRecord) -> None: ...

    async def get_company(self, session_id: str) -> CompanyRecord | None: ...

    async def save_products(
        self,
        session_id: str,
        company: str,
        items: list[ProductItem],
    ) -> None: ...

    async def get_products(self, session_id: str, company: str) -> list[ProductItem]: ...

    async def has_session(self, session_id: str) -> bool: ...


@runtime_checkable
class VectorSearchProvider(Protocol):
    """Semantic search and document indexing lifecycle (Redis Iris vector index)."""

    async def index_document(self, document: VectorDocument) -> str: ...

    async def update_document(self, document_id: str, document: VectorDocument) -> None: ...

    async def delete_document(
        self, document_id: str, *, session_id: str | None = None
    ) -> bool: ...

    async def semantic_search(
        self,
        query: str,
        *,
        session_id: str | None = None,
        limit: int = 10,
        filters: dict[str, Any] | None = None,
    ) -> list[SearchResult]: ...


@runtime_checkable
class CacheProvider(Protocol):
    """LLM response cache (Redis LangCache integration point)."""

    async def get(self, key: str, *, namespace: str = "default") -> str | None: ...

    async def set(
        self,
        key: str,
        value: str,
        *,
        namespace: str = "default",
        ttl_seconds: int | None = None,
    ) -> None: ...

    async def delete(self, key: str, *, namespace: str = "default") -> bool: ...

    async def get_or_compute(
        self,
        key: str,
        compute: Callable[[], Any],
        *,
        namespace: str = "default",
        ttl_seconds: int | None = None,
    ) -> str: ...


@runtime_checkable
class IrisContextRetriever(Protocol):
    """Redis Iris Context Retriever — schema registration and structured queries."""

    def register_schemas(self) -> None: ...

    async def query_company(self, session_id: str, name: str) -> CompanyRecord | None: ...

    async def query_competitor(
        self, session_id: str, name: str
    ) -> CompetitorRecord | None: ...

    async def query_news(
        self, session_id: str, company: str, *, limit: int = 20
    ) -> list[NewsItem]: ...

    async def query_products(
        self, session_id: str, company: str
    ) -> list[ProductItem]: ...
