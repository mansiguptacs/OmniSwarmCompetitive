import json
from unittest.mock import AsyncMock, MagicMock

import pytest
from langchain_core.messages import AIMessage, HumanMessage

from config import get_settings
from memory.bootstrap import configure_memory_providers
from memory.cache import reset_cache_provider
from memory.factory import reset_memory_service, reset_redis_memory, set_redis_memory
from memory.iris import reset_iris_retriever
from memory.redis_client import RedisMemory
from memory.vector import reset_vector_search
from state import AgentActivity, CCIEState, Competitor, NewsItem, default_ccie_state


@pytest.fixture(autouse=True)
def reset_memory_factory(monkeypatch):
    monkeypatch.setenv("ENV", "test")
    monkeypatch.setenv("AUTO_INDEX_INTEL", "0")
    get_settings.cache_clear()
    reset_redis_memory()
    reset_memory_service()
    reset_iris_retriever()
    reset_vector_search()
    reset_cache_provider()
    configure_memory_providers()
    yield
    get_settings.cache_clear()
    reset_redis_memory()
    reset_memory_service()
    reset_iris_retriever()
    reset_vector_search()
    reset_cache_provider()


@pytest.fixture
def sample_state() -> CCIEState:
    return default_ccie_state(
        messages=[HumanMessage(content="Analyze Stripe")],
        target_company="Stripe",
        phase="idle",
    )


@pytest.fixture
def mock_llm():
    llm = MagicMock()
    llm.ainvoke = AsyncMock(
        return_value=AIMessage(content='{"competitors": ["PayPal", "Adyen", "Square"]}')
    )
    llm.invoke = MagicMock(
        return_value=AIMessage(content='{"competitors": ["PayPal", "Adyen", "Square"]}')
    )
    return llm


@pytest.fixture
def redis_client():
    import fakeredis

    fake = fakeredis.FakeAsyncRedis(decode_responses=True)
    memory = RedisMemory(client=fake)
    set_redis_memory(memory)
    return memory


@pytest.fixture
def echo_graph():
    from agents.graph import compile_graph

    return compile_graph(echo=True)


@pytest.fixture
def orchestrator_graph():
    from agents.graph import compile_graph

    return compile_graph(echo=False)


@pytest.fixture
def sample_news() -> list[NewsItem]:
    return [
        NewsItem(
            title="Stripe expands payments",
            url="https://example.com/1",
            summary="Stripe launches new feature",
            sentiment=0.6,
            published_at="2025-01-01",
        ),
        NewsItem(
            title="Stripe funding round",
            url="https://example.com/2",
            summary="Stripe raises capital",
            sentiment=0.4,
            published_at="2025-01-02",
        ),
        NewsItem(
            title="Stripe regulatory news",
            url="https://example.com/3",
            summary="New compliance updates",
            sentiment=-0.2,
            published_at="2025-01-03",
        ),
    ]
