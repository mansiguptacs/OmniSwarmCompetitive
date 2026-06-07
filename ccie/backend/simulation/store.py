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

import json
import re

from simulation.schemas import CompanyPersona

_KEY_PREFIX = "ccie:sim"


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "unknown"


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
        try:
            client = await self._get_client()
            await client.set(
                self._persona_key(persona.name),
                json.dumps(persona.model_dump()),
            )
            return True
        except Exception:
            return False

    async def get_persona(self, company: str) -> CompanyPersona | None:
        try:
            client = await self._get_client()
            raw = await client.get(self._persona_key(company))
            if not raw:
                return None
            return CompanyPersona.model_validate(json.loads(raw))
        except Exception:
            return None

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
