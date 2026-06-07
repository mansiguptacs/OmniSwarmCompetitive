"""Redis-backed repository for the war-game simulator.

This is the agents' own data repository (per simulation_plan.md §4.6): personas
now, and the decision ledger in later phases. It mirrors the connection pattern of
`memory/redis_client.py` but stays isolated so the baseline is untouched.

Design notes:
- **Injectable client** for tests (pass a `fakeredis` client).
- **Best-effort**: read/write failures are swallowed and surfaced as None/False so
  a transient Redis issue never breaks a simulation run.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import Awaitable, Callable, TypeVar

from simulation.schemas import (
    CompanyPersona,
    GroundingPacket,
    LedgerEntry,
    SimulationState,
)

_KEY_PREFIX = "ccie:sim"
_WRITE_RETRIES = 3
_RETRY_BACKOFF_S = 0.15

logger = logging.getLogger(__name__)

T = TypeVar("T")


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "unknown"


async def _retry_write(label: str, op: Callable[[], Awaitable[T]]) -> bool:
    """Run a Redis write with bounded retries + backoff.

    Redis Cloud free tier can transiently drop a write; retrying makes session
    persistence reliable. On final failure we log (no longer silent) and return
    False so a run never crashes on a storage hiccup.
    """
    last_exc: Exception | None = None
    for attempt in range(1, _WRITE_RETRIES + 1):
        try:
            await op()
            return True
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            if attempt < _WRITE_RETRIES:
                await asyncio.sleep(_RETRY_BACKOFF_S * attempt)
    logger.warning("Redis write %r failed after %d attempts: %s", label, _WRITE_RETRIES, last_exc)
    return False


class SimulationStore:
    def __init__(self, client=None):
        self._client = client

    async def _get_client(self):
        if self._client is not None:
            return self._client
        import redis.asyncio as redis

        from config import get_settings

        settings = get_settings()
        self._client = redis.from_url(settings.REDIS_URL, decode_responses=True)
        return self._client

    # --- Personas -----------------------------------------------------------

    def _persona_key(self, company: str) -> str:
        return f"{_KEY_PREFIX}:persona:{slugify(company)}"

    async def save_persona(self, persona: CompanyPersona) -> bool:
        async def _op():
            client = await self._get_client()
            await client.set(
                self._persona_key(persona.name),
                json.dumps(persona.model_dump()),
            )

        return await _retry_write(f"persona:{persona.name}", _op)

    async def get_persona(self, company: str) -> CompanyPersona | None:
        try:
            client = await self._get_client()
            raw = await client.get(self._persona_key(company))
            if not raw:
                return None
            return CompanyPersona.model_validate(json.loads(raw))
        except Exception:
            return None

    # --- Simulation state (full game session) ------------------------------

    def _state_key(self, session_id: str) -> str:
        return f"{_KEY_PREFIX}:state:{slugify(session_id)}"

    async def save_state(self, state: SimulationState) -> bool:
        async def _op():
            client = await self._get_client()
            await client.set(
                self._state_key(state.session_id),
                json.dumps(state.model_dump()),
            )

        return await _retry_write(f"state:{state.session_id}", _op)

    async def get_state(self, session_id: str) -> SimulationState | None:
        try:
            client = await self._get_client()
            raw = await client.get(self._state_key(session_id))
            if not raw:
                return None
            return SimulationState.model_validate(json.loads(raw))
        except Exception:
            return None

    # --- Grounding packets (TTL cache for freshness) -----------------------

    def _grounding_key(self, cache_key: str) -> str:
        return f"{_KEY_PREFIX}:grounding:{slugify(cache_key)}"

    async def save_grounding(self, cache_key: str, packet: GroundingPacket, ttl: int) -> bool:
        try:
            client = await self._get_client()
            await client.set(
                self._grounding_key(cache_key),
                json.dumps(packet.model_dump()),
                ex=max(1, int(ttl)),
            )
            return True
        except Exception:
            return False

    async def get_grounding(self, cache_key: str) -> GroundingPacket | None:
        try:
            client = await self._get_client()
            raw = await client.get(self._grounding_key(cache_key))
            if not raw:
                return None
            return GroundingPacket.model_validate(json.loads(raw))
        except Exception:
            return None

    # --- Decision ledger (the agents' auditable repository) -----------------

    def _ledger_key(self, session_id: str) -> str:
        return f"{_KEY_PREFIX}:ledger:{slugify(session_id)}"

    async def append_ledger(self, session_id: str, entries: list[LedgerEntry]) -> bool:
        if not entries:
            return True

        async def _op():
            client = await self._get_client()
            await client.rpush(
                self._ledger_key(session_id),
                *[json.dumps(e.model_dump()) for e in entries],
            )

        return await _retry_write(f"ledger:{session_id}", _op)

    async def get_ledger(self, session_id: str) -> list[LedgerEntry]:
        try:
            client = await self._get_client()
            raw = await client.lrange(self._ledger_key(session_id), 0, -1)
            entries: list[LedgerEntry] = []
            for item in raw or []:
                try:
                    entries.append(LedgerEntry.model_validate(json.loads(item)))
                except Exception:
                    continue
            return entries
        except Exception:
            return []

    async def ping(self) -> bool:
        try:
            client = await self._get_client()
            return bool(await client.ping())
        except Exception:
            return False


_store: SimulationStore | None = None


def get_sim_store() -> SimulationStore:
    global _store
    if _store is None:
        _store = SimulationStore()
    return _store


def set_sim_store(store: SimulationStore) -> None:
    global _store
    _store = store


def reset_sim_store() -> None:
    global _store
    _store = None
