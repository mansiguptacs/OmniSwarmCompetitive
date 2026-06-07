"""Real-time grounding layer (Phase 6).

Per iteration, fetch the freshest real-world signals relevant to the player's move
and the companies on the board, cache them in Redis with a TTL (freshness window),
and package them so the agent + referee prompts — and the UI — are anchored to
current public data.

Design:
- **Targeted, not exhaustive**: a small set of move-relevant queries (one global +
  one per company) instead of re-scraping everything every turn.
- **Cached with TTL**: identical move+roster within the freshness window reuses the
  cached packet; expiry forces an automatic refresh (so data never goes stale).
- **Graceful degradation**: if live data is sparse, the packet is marked `stale`
  and carries whatever evidence exists — we never invent facts.

Dependencies (search, store) are injectable for offline tests.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
from typing import Awaitable, Callable

from simulation.schemas import (
    AcquisitionTarget,
    Evidence,
    GroundingPacket,
    PlayerProfile,
)
from simulation.store import SimulationStore
from state import NewsItem
from tools.web_search import search_news

logger = logging.getLogger(__name__)

SearchFn = Callable[[str, int], Awaitable[list[NewsItem]]]

DEFAULT_TTL_SECONDS = 1800  # 30-minute freshness window
_MAX_PER_COMPANY = 2
_MAX_GLOBAL = 6


def _cache_key(move: str, companies: list[str]) -> str:
    raw = move.strip().lower() + "||" + "|".join(sorted(c.lower() for c in companies))
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:20]


def _to_evidence(items: list[NewsItem], limit: int) -> list[Evidence]:
    out: list[Evidence] = []
    for item in items[:limit]:
        claim = (item.title or item.summary or "").strip()
        if not claim:
            continue
        out.append(
            Evidence(
                claim=claim,
                source_url=item.url or "",
                source_title=item.title or "",
                as_of=item.published_at or "",
            )
        )
    return out


async def _company_signals(
    company: str, query: str, search: SearchFn, per_query: int
) -> tuple[str, list[NewsItem]]:
    try:
        return company, await search(query, per_query)
    except Exception:
        logger.debug("grounding search failed for %s", company, exc_info=True)
        return company, []


def _summarize(global_items: list[NewsItem], per_company_items: dict[str, list[NewsItem]]) -> str:
    headlines: list[str] = [it.title for it in global_items if it.title][:3]
    for company, items in per_company_items.items():
        if items and items[0].title:
            headlines.append(f"{company}: {items[0].title}")
    headlines = headlines[:5]
    return " | ".join(headlines)


async def gather_grounding(
    move: str,
    companies: list[str],
    *,
    target: AcquisitionTarget | None = None,
    player: PlayerProfile | None = None,
    iteration_index: int = 0,
    search: SearchFn = search_news,
    store: SimulationStore | None = None,
    ttl: int = DEFAULT_TTL_SECONDS,
    per_query: int = 2,
    use_cache: bool = True,
) -> GroundingPacket:
    """Fetch (or load cached) fresh signals for one iteration.

    `store=None` disables caching entirely (used by offline unit tests so no Redis
    round-trip happens). Always returns a packet; on total failure it is `stale`.
    """
    cache_key = _cache_key(move, companies)
    if store is not None and use_cache:
        cached = await store.get_grounding(cache_key)
        if cached is not None:
            cached.iteration_index = iteration_index
            cached.move = move
            return cached

    target_name = target.name if target else "the target"
    player_name = player.company if player else "the acquirer"
    global_query = f"{player_name} {move} {target_name} acquisition market reaction news"

    global_task = _company_signals("__global__", global_query, search, _MAX_GLOBAL)
    company_tasks = [
        _company_signals(
            c,
            f"{c} response strategy {target_name} acquisition latest news",
            search,
            per_query,
        )
        for c in companies
    ]

    results = await asyncio.gather(global_task, *company_tasks, return_exceptions=True)

    global_items: list[NewsItem] = []
    per_company_items: dict[str, list[NewsItem]] = {}
    for res in results:
        if isinstance(res, Exception):
            continue
        name, items = res
        if name == "__global__":
            global_items = items
        else:
            per_company_items[name] = items

    per_company_ev: dict[str, list[Evidence]] = {
        name: _to_evidence(items, _MAX_PER_COMPANY)
        for name, items in per_company_items.items()
        if items
    }

    # De-duplicated global evidence (global hits + first hit from each company).
    merged: list[NewsItem] = list(global_items)
    for items in per_company_items.values():
        merged.extend(items[:1])
    seen: set[str] = set()
    deduped: list[NewsItem] = []
    for it in merged:
        key = (it.url or it.title or "").lower().strip()
        if key and key not in seen:
            seen.add(key)
            deduped.append(it)

    evidence = _to_evidence(deduped, _MAX_GLOBAL)
    has_data = bool(evidence or per_company_ev)

    packet = GroundingPacket(
        iteration_index=iteration_index,
        move=move,
        summary=_summarize(global_items, per_company_items),
        evidence=evidence,
        per_company=per_company_ev,
        stale=not has_data,
    )

    if store is not None and use_cache and has_data:
        await store.save_grounding(cache_key, packet, ttl)

    return packet


def grounding_context(packet: GroundingPacket | None, company: str | None = None) -> str:
    """Render a compact, prompt-ready block of fresh signals (global + company)."""
    if packet is None:
        return ""
    lines: list[str] = []
    if packet.summary:
        lines.append(f"Fresh market signals: {packet.summary}")
    if company and packet.per_company.get(company):
        own = "; ".join(e.claim for e in packet.per_company[company] if e.claim)
        if own:
            lines.append(f"Signals about {company}: {own}")
    if packet.stale and not lines:
        return ""
    return "\n".join(lines)
