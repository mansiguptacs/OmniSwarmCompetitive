import os
from functools import lru_cache


@lru_cache
def get_settings():
    return Settings()


class Settings:
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    ENV: str = os.getenv("ENV", "dev")
    WEAVE_PROJECT: str = os.getenv("WEAVE_PROJECT", "ccie-agents")
    TAVILY_API_KEY: str = os.getenv("TAVILY_API_KEY", "")

    @property
    def use_mock_tools(self) -> bool:
        return self.ENV in ("dev", "test")
