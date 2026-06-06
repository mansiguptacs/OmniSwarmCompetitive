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
