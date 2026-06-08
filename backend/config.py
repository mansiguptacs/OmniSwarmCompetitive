import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

# Load ccie/.env (gitignored) when present
load_dotenv(Path(__file__).resolve().parents[1] / ".env")


@lru_cache
def get_settings():
    return Settings()


class Settings:
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    ENV: str = os.getenv("ENV", "dev")
    WEAVE_PROJECT: str = os.getenv("WEAVE_PROJECT", "ccie-agents")
    TAVILY_API_KEY: str = os.getenv("TAVILY_API_KEY", "")

    # Vector search (Redis Iris path)
    VECTOR_BACKEND: str = os.getenv("VECTOR_BACKEND", "redis")  # redis | stub
    VECTOR_INDEX_NAME: str = os.getenv("VECTOR_INDEX_NAME", "ccie_intel")
    VECTOR_DEFAULT_LIMIT: int = int(os.getenv("VECTOR_DEFAULT_LIMIT", "10"))
    VECTOR_EMBEDDING_MODEL: str = os.getenv("VECTOR_EMBEDDING_MODEL", "")

    # LangCache
    LANGCACHE_BACKEND: str = os.getenv("LANGCACHE_BACKEND", "redis")  # redis | stub | cloud
    LANGCACHE_ENABLED: bool = os.getenv("LANGCACHE_ENABLED", "1") == "1"
    LANGCACHE_DEFAULT_NAMESPACE: str = os.getenv("LANGCACHE_DEFAULT_NAMESPACE", "ccie")
    LANGCACHE_TTL_SECONDS: int = int(os.getenv("LANGCACHE_TTL_SECONDS", "3600"))
    LANGCACHE_HOST: str = os.getenv("LANGCACHE_HOST", "")
    LANGCACHE_CACHE_ID: str = os.getenv("LANGCACHE_CACHE_ID", "")
    LANGCACHE_API_KEY: str = os.getenv("LANGCACHE_API_KEY", "")

    # Auto-index intel into vector store on MemoryService save_* calls
    AUTO_INDEX_INTEL: bool = os.getenv("AUTO_INDEX_INTEL", "1") == "1"

    @property
    def use_mock_tools(self) -> bool:
        override = os.getenv("USE_MOCK_TOOLS", "").lower()
        if override in ("1", "true", "yes"):
            return True
        if override in ("0", "false", "no"):
            return False
        return self.ENV in ("dev", "test")

    @property
    def use_real_tools(self) -> bool:
        return not self.use_mock_tools

    @property
    def langcache_cloud_configured(self) -> bool:
        return bool(self.LANGCACHE_HOST and self.LANGCACHE_CACHE_ID and self.LANGCACHE_API_KEY)
