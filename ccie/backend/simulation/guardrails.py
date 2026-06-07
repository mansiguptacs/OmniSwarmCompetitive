"""Lightweight grounding / consistency guards for simulation agents.

Phase 3 keeps these intentionally minimal (attach evidence, fix actor, drop
self-references, clamp). Full evaluation/scoring lands in Phase 9.
"""

from __future__ import annotations

from simulation.schemas import AgentReaction, CompanyPersona


def _clamp01(v: float) -> float:
    return round(max(0.0, min(1.0, v)), 3)


def ensure_grounded(reaction: AgentReaction, persona: CompanyPersona) -> AgentReaction:
    """Normalize a reaction so it stays consistent with its persona.

    - actor must be the persona (agents can't speak for others),
    - evidence falls back to the persona's citations when the model omitted them,
    - an agent cannot ally with itself,
    - intensity is clamped to [0, 1].
    """
    reaction.actor = persona.name
    reaction.intensity = _clamp01(reaction.intensity)

    if not reaction.evidence and persona.sources:
        reaction.evidence = persona.sources[:2]

    if reaction.ally_with:
        self_lower = persona.name.strip().lower()
        deduped: list[str] = []
        seen: set[str] = set()
        for ally in reaction.ally_with:
            key = ally.strip().lower()
            if not key or key == self_lower or key in seen:
                continue
            seen.add(key)
            deduped.append(ally)
        reaction.ally_with = deduped

    return reaction
