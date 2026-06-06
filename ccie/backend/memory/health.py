"""Redis connectivity checks for startup validation, health endpoints, and diagnostics."""

from __future__ import annotations

import logging
import time

from config import get_settings
from memory.types import RedisHealthResult

logger = logging.getLogger(__name__)


async def ping_redis(url: str | None = None) -> RedisHealthResult:
    """Direct Redis ping — used by CLI diagnostics (no copilotkit/langgraph deps)."""
    import redis.asyncio as redis

    redis_url = url or get_settings().REDIS_URL
    started = time.perf_counter()
    client = redis.from_url(redis_url, decode_responses=True)
    try:
        pong = await client.ping()
        latency_ms = round((time.perf_counter() - started) * 1000, 2)
        return {"connected": bool(pong), "latency_ms": latency_ms}
    except Exception as exc:
        return {"connected": False, "latency_ms": None, "error": str(exc)}
    finally:
        await client.aclose()


async def check_redis_connection() -> RedisHealthResult:
    """Ping Redis via the shared memory client (used by FastAPI /health)."""
    from memory.factory import get_redis_memory

    memory = get_redis_memory()
    return await memory.ping()


async def verify_redis_on_startup(*, strict: bool | None = None) -> RedisHealthResult:
    """Validate Redis at application startup.

    When *strict* is True (default in prod), raises on failure.
    In dev/test, logs a warning and allows the app to start.
    """
    settings = get_settings()
    if strict is None:
        strict = settings.ENV == "prod"

    result = await check_redis_connection()
    if result.get("connected"):
        logger.info(
            "Redis connection verified (latency_ms=%.2f)",
            result.get("latency_ms", 0),
        )
        return result

    message = result.get("error", "Redis ping failed")
    if strict:
        raise RuntimeError(f"Redis startup validation failed: {message}")

    logger.warning("Redis unavailable at startup (non-strict): %s", message)
    return result


def format_health_status(redis_result: RedisHealthResult) -> dict:
    """Build the redis section of the /health response."""
    connected = bool(redis_result.get("connected"))
    payload: dict = {
        "connected": connected,
        "latency_ms": redis_result.get("latency_ms"),
    }
    if error := redis_result.get("error"):
        payload["error"] = error
    return payload


async def run_diagnostics() -> dict:
    """Full Redis diagnostics for the CLI script."""
    settings = get_settings()
    started = time.perf_counter()
    redis_result = await ping_redis()
    elapsed_ms = round((time.perf_counter() - started) * 1000, 2)

    return {
        "redis_url": settings.REDIS_URL.split("@")[-1],  # omit credentials
        "env": settings.ENV,
        "connected": redis_result.get("connected", False),
        "latency_ms": redis_result.get("latency_ms"),
        "diagnostics_latency_ms": elapsed_ms,
        "error": redis_result.get("error"),
    }
