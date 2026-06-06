import pytest

from observability.settings import get_observability_settings


@pytest.fixture(autouse=True)
def clear_settings_cache():
    get_observability_settings.cache_clear()
    yield
    get_observability_settings.cache_clear()
