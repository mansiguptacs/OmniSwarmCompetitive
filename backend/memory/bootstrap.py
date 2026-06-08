"""Wire memory providers at application startup."""

from __future__ import annotations

import logging

from config import get_settings
from memory.cache import CacheConfig, StubLangCache, set_cache_config, set_cache_provider
from memory.factory import get_redis_memory, reset_memory_service
from memory.iris_vector import IrisVectorSearch
from memory.redis_langcache import LangCacheCloudProvider, RedisLangCache
from memory.vector import StubVectorSearch, VectorSearchConfig, set_vector_search, set_vector_search_config

logger = logging.getLogger(__name__)


def configure_memory_providers() -> None:
    """Select vector search and cache backends based on environment config."""
    settings = get_settings()

    set_vector_search_config(
        VectorSearchConfig(
            index_name=settings.VECTOR_INDEX_NAME,
            default_limit=settings.VECTOR_DEFAULT_LIMIT,
            embedding_model=settings.VECTOR_EMBEDDING_MODEL,
        )
    )
    set_cache_config(
        CacheConfig(
            default_namespace=settings.LANGCACHE_DEFAULT_NAMESPACE,
            default_ttl_seconds=settings.LANGCACHE_TTL_SECONDS,
            enabled=settings.LANGCACHE_ENABLED,
        )
    )

    if settings.ENV == "test":
        set_vector_search(StubVectorSearch())
        set_cache_provider(StubLangCache())
        logger.info("Memory providers: vector=stub, cache=stub (ENV=test)")
        reset_memory_service()
        return

    store = get_redis_memory()

    if settings.VECTOR_BACKEND == "stub":
        set_vector_search(StubVectorSearch())
    else:
        set_vector_search(IrisVectorSearch(store))
        logger.info("Memory providers: vector=iris_redis (partitioned Redis index)")

    if settings.LANGCACHE_BACKEND == "cloud" and settings.langcache_cloud_configured:
        set_cache_provider(LangCacheCloudProvider())
        logger.info("Memory providers: cache=langcache_cloud")
    elif settings.LANGCACHE_BACKEND == "stub":
        set_cache_provider(StubLangCache())
        logger.info("Memory providers: cache=stub")
    else:
        set_cache_provider(RedisLangCache(store))
        logger.info("Memory providers: cache=redis_langcache")

    reset_memory_service()
