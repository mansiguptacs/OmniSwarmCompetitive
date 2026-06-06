"""Redis-backed LangCache provider — local Redis with optional cloud SDK."""

from __future__ import annotations

import logging
from typing import Any, Callable

from config import get_settings
from memory.cache import CacheConfig
from memory.interfaces import CacheProvider
from memory.partitioning import cache_entry_key
from memory.redis_client import RedisMemory

logger = logging.getLogger(__name__)


class RedisLangCache:
    """Exact-match LLM response cache stored in Redis with TTL."""

    def __init__(self, store: RedisMemory, config: CacheConfig | None = None):
        self._store = store
        self._config = config or CacheConfig()

    async def _client(self):
        return await self._store._get_client()

    async def get(self, key: str, *, namespace: str = "default") -> str | None:
        if not self._config.enabled:
            return None
        client = await self._client()
        return await client.get(cache_entry_key(namespace, key))

    async def set(
        self,
        key: str,
        value: str,
        *,
        namespace: str = "default",
        ttl_seconds: int | None = None,
    ) -> None:
        if not self._config.enabled:
            return
        ttl = ttl_seconds if ttl_seconds is not None else self._config.default_ttl_seconds
        client = await self._client()
        redis_key = cache_entry_key(namespace, key)
        if ttl and ttl > 0:
            await client.set(redis_key, value, ex=ttl)
        else:
            await client.set(redis_key, value)
        logger.debug("RedisLangCache.set(%s)", redis_key)

    async def delete(self, key: str, *, namespace: str = "default") -> bool:
        client = await self._client()
        deleted = await client.delete(cache_entry_key(namespace, key))
        return bool(deleted)

    async def get_or_compute(
        self,
        key: str,
        compute: Callable[[], Any],
        *,
        namespace: str = "default",
        ttl_seconds: int | None = None,
    ) -> str:
        cached = await self.get(key, namespace=namespace)
        if cached is not None:
            return cached

        result = compute()
        if hasattr(result, "__await__"):
            result = await result

        value = str(result)
        await self.set(key, value, namespace=namespace, ttl_seconds=ttl_seconds)
        return value


class LangCacheCloudProvider:
    """Redis LangCache cloud SDK wrapper when credentials are configured."""

    def __init__(self, config: CacheConfig | None = None):
        self._config = config or CacheConfig()
        self._client = None

    def _ensure_client(self):
        if self._client is not None:
            return self._client
        settings = get_settings()
        try:
            from langcache import LangCache
        except ImportError as exc:
            raise RuntimeError(
                "langcache package required for LANGCACHE_BACKEND=cloud. "
                "Install with: pip install langcache"
            ) from exc

        self._client = LangCache(
            server_url=settings.LANGCACHE_HOST,
            cache_id=settings.LANGCACHE_CACHE_ID,
            api_key=settings.LANGCACHE_API_KEY,
        )
        return self._client

    async def get(self, key: str, *, namespace: str = "default") -> str | None:
        if not self._config.enabled:
            return None
        client = self._ensure_client()
        # LangCache SDK is sync — run in thread if needed; search uses semantic match
        response = client.search(
            prompt=key,
            attributes={"namespace": namespace},
            similarity_threshold=0.9,
        )
        entries = getattr(response, "data", None) or []
        if entries:
            first = entries[0]
            return getattr(first, "response", None) or getattr(first, "content", None)
        return None

    async def set(
        self,
        key: str,
        value: str,
        *,
        namespace: str = "default",
        ttl_seconds: int | None = None,
    ) -> None:
        if not self._config.enabled:
            return
        client = self._ensure_client()
        client.set(
            prompt=key,
            response=value,
            attributes={"namespace": namespace},
            ttl=ttl_seconds or self._config.default_ttl_seconds,
        )

    async def delete(self, key: str, *, namespace: str = "default") -> bool:
        # Cloud SDK flush-by-query not always available; no-op delete for now
        logger.debug("LangCacheCloudProvider.delete(%s:%s) — best-effort", namespace, key)
        return False

    async def get_or_compute(
        self,
        key: str,
        compute: Callable[[], Any],
        *,
        namespace: str = "default",
        ttl_seconds: int | None = None,
    ) -> str:
        cached = await self.get(key, namespace=namespace)
        if cached is not None:
            return cached

        result = compute()
        if hasattr(result, "__await__"):
            result = await result

        value = str(result)
        await self.set(key, value, namespace=namespace, ttl_seconds=ttl_seconds)
        return value
