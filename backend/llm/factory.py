from typing import Any

from config import get_settings

_llm_override: Any | None = None


def set_llm_override(llm: Any | None) -> None:
    global _llm_override
    _llm_override = llm


def reset_llm_override() -> None:
    global _llm_override
    _llm_override = None


def get_llm_override() -> Any | None:
    return _llm_override


def get_llm():
    """Return a LangChain chat model, test override, or None (use heuristic fallback)."""
    if _llm_override is not None:
        return _llm_override

    settings = get_settings()
    if settings.ENV == "test" or not settings.OPENAI_API_KEY:
        return None

    from langchain_openai import ChatOpenAI

    return ChatOpenAI(model="gpt-4o-mini", api_key=settings.OPENAI_API_KEY, temperature=0)
