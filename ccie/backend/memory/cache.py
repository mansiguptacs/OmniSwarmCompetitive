"""LangCache abstraction — injectable LLM response cache provider."""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Any, Callable

from memory.interfaces import CacheProvider

logger = logging.getLogger(__name__)


@dataclass
class CacheConfig:
    """Provider configuration — swap values when wiring Redis LangCache."""

    default_namespace: str = "ccie"
    default_ttl_seconds: int = 3600
    enabled: bool = True
    extra: dict = field(default_factory=dict)


@dataclass
class _CacheEntry:
    value: str
    expires_at: float | None


class StubLangCache:
    """In-memory cache stub until Redis LangCache SDK is wired."""

    def __init__(self, config: CacheConfig | None = None):
        self._config = config or CacheConfig()
        self._entries: dict[str, _CacheEntry] = {}

    def _cache_key(self, key: str, namespace: str) -> str:
        return f"{namespace}:{key}"

    def _is_expired(self, entry: _CacheEntry) -> bool:
        return entry.expires_at is not None and time.time() > entry.expires_at

    async def get(self, key: str, *, namespace: str = "default") -> str | None:
        if not self._config.enabled:
            return None
        cache_key = self._cache_key(key, namespace)
        entry = self._entries.get(cache_key)
        if entry is None or self._is_expired(entry):
            if entry is not None:
                del self._entries[cache_key]
            return None
        return entry.value

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
        expires_at = time.time() + ttl if ttl > 0 else None
        cache_key = self._cache_key(key, namespace)
        self._entries[cache_key] = _CacheEntry(value=value, expires_at=expires_at)
        logger.debug("StubLangCache.set(%s)", cache_key)

    async def delete(self, key: str, *, namespace: str = "default") -> bool:
        cache_key = self._cache_key(key, namespace)
        if cache_key in self._entries:
            del self._entries[cache_key]
            return True
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


_cache_provider: CacheProvider | None = None
_cache_config: CacheConfig | None = None


def get_cache_config() -> CacheConfig:
    global _cache_config
    if _cache_config is None:
        _cache_config = CacheConfig()
    return _cache_config


def set_cache_config(config: CacheConfig) -> None:
    global _cache_config, _cache_provider
    _cache_config = config
    _cache_provider = None


def get_cache_provider() -> CacheProvider:
    global _cache_provider
    if _cache_provider is None:
        _cache_provider = StubLangCache(get_cache_config())
    return _cache_provider


def set_cache_provider(provider: CacheProvider) -> None:
    global _cache_provider
    _cache_provider = provider


def reset_cache_provider() -> None:
    global _cache_provider, _cache_config
    _cache_provider = None
    _cache_config = None
