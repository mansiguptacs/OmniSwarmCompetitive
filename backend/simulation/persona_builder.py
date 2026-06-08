"""Build CEO/company digital twins (personas) grounded in real public data.

Pipeline per company:
1. Gather real grounding evidence via targeted web searches (strategy, M&A,
   recent moves). In mock/test mode these come from the deterministic mock tool.
2. Distill a persona:
   - **LLM path** (when available): refine the curated seed using the live search
     context, returning a structured `PersonaDraft`.
   - **Heuristic path** (no LLM / failure): fall back to the curated seed so
     personas stay distinct and accurate offline.
3. Attach citations from the *real* search hits (never invented), then optionally
   cache to the Redis `SimulationStore`.

Dependencies are injectable for testing.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Awaitable, Callable

from langchain_core.messages import HumanMessage

from llm.factory import get_llm
from simulation.personas_seed import get_persona_seed
from simulation.schemas import CompanyPersona, Evidence, PersonaDraft
from simulation.store import SimulationStore
from state import NewsItem
from tools.web_search import search_news

logger = logging.getLogger(__name__)

SearchFn = Callable[[str, int], Awaitable[list[NewsItem]]]

# Facets we search to ground a persona. Order matters only for readability.
_PERSONA_FACETS = (
    "{company} corporate strategy and business model",
    "{company} acquisitions history",
    "{company} latest news and strategic moves",
)


async def _gather_evidence(company: str, search: SearchFn, per_facet: int) -> list[NewsItem]:
    queries = [facet.format(company=company) for facet in _PERSONA_FACETS]
    results = await asyncio.gather(
        *(search(q, per_facet) for q in queries),
        return_exceptions=True,
    )
    items: list[NewsItem] = []
    seen: set[str] = set()
    for batch in results:
        if isinstance(batch, Exception):
            continue
        for item in batch:
            key = (item.title or item.url).lower().strip()
            if key and key not in seen:
                seen.add(key)
                items.append(item)
    return items


def _news_to_evidence(items: list[NewsItem], limit: int = 6) -> list[Evidence]:
    evidence: list[Evidence] = []
    for item in items[:limit]:
        evidence.append(
            Evidence(
                claim=item.title or item.summary,
                source_url=item.url,
                source_title=item.title,
                as_of=item.published_at,
            )
        )
    return evidence


def _format_evidence_context(items: list[NewsItem]) -> str:
    if not items:
        return "No fresh search results available."
    return "\n".join(f"- {it.title}: {it.summary or it.url}" for it in items)


def _draft_to_persona(name: str, draft: PersonaDraft, evidence: list[Evidence]) -> CompanyPersona:
    return CompanyPersona(
        name=name,
        strategy_thesis=draft.strategy_thesis,
        ethos=draft.ethos,
        m_and_a_history=draft.m_and_a_history,
        financial_firepower=draft.financial_firepower,
        temperament=draft.temperament,
        recent_moves=draft.recent_moves,
        leadership_style=draft.leadership_style,
        sources=evidence,
    )


async def _distill_with_llm(
    company: str,
    seed: PersonaDraft | None,
    evidence_items: list[NewsItem],
    llm,
) -> PersonaDraft | None:
    structured = llm.with_structured_output(PersonaDraft)
    seed_hint = ""
    if seed is not None:
        seed_hint = (
            "\nKnown priors (refine/confirm, do not contradict without evidence):\n"
            f"- strategy: {seed.strategy_thesis}\n"
            f"- ethos: {seed.ethos}\n"
            f"- temperament: {seed.temperament}\n"
            f"- notable M&A: {', '.join(seed.m_and_a_history)}\n"
            f"- leadership: {seed.leadership_style}\n"
        )
    prompt = (
        "You are profiling a real company's leadership so an agent can role-play its "
        "CEO in an M&A war-game. Produce a concise, accurate persona based on widely "
        "known public facts and the search context below.\n\n"
        f"Company: {company}\n"
        f"{seed_hint}\n"
        f"Live search context:\n{_format_evidence_context(evidence_items)}\n\n"
        "Fill: strategy_thesis, ethos, m_and_a_history (real deals only), "
        "financial_firepower, temperament (one of aggressive/litigious/partner_first/"
        "wait_and_see/acquisitive), recent_moves, leadership_style. Be factual; do not invent deals."
    )
    try:
        result = await structured.ainvoke([HumanMessage(content=prompt)])
        if isinstance(result, PersonaDraft):
            return result
        return PersonaDraft.model_validate(result)
    except Exception:
        logger.debug("LLM persona distillation failed for %s", company, exc_info=True)
        return None


async def build_persona(
    company: str,
    *,
    search: SearchFn = search_news,
    llm_getter: Callable[[], object] = get_llm,
    store: SimulationStore | None = None,
    use_cache: bool = True,
    per_facet: int = 3,
) -> CompanyPersona:
    """Build (or load cached) a grounded persona for one company."""
    if store is not None and use_cache:
        cached = await store.get_persona(company)
        if cached is not None:
            return cached

    evidence_items = await _gather_evidence(company, search, per_facet)
    evidence = _news_to_evidence(evidence_items)
    seed = get_persona_seed(company)

    llm = llm_getter()
    draft: PersonaDraft | None = None
    if llm is not None:
        draft = await _distill_with_llm(company, seed, evidence_items, llm)

    if draft is None:
        # Heuristic fallback: curated seed keeps personas distinct & accurate.
        draft = seed or PersonaDraft(
            strategy_thesis=f"{company} competes in the core-software sector.",
            ethos="",
            temperament="wait_and_see",
        )

    persona = _draft_to_persona(company, draft, evidence)

    if store is not None:
        await store.save_persona(persona)

    return persona


async def build_personas(
    companies: list[str],
    *,
    search: SearchFn = search_news,
    llm_getter: Callable[[], object] = get_llm,
    store: SimulationStore | None = None,
    use_cache: bool = True,
    per_facet: int = 3,
) -> list[CompanyPersona]:
    """Build personas for many companies concurrently."""
    return list(
        await asyncio.gather(
            *(
                build_persona(
                    company,
                    search=search,
                    llm_getter=llm_getter,
                    store=store,
                    use_cache=use_cache,
                    per_facet=per_facet,
                )
                for company in companies
            )
        )
    )
