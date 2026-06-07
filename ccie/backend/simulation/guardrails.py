"""Grounding / consistency guards for simulation agents.

Phase 3 added per-reaction normalization (attach evidence, fix actor, drop
self-references, clamp). Phase 9 adds a board-level pass that prunes hallucinated
alliances so the referee only ever sees real, in-roster relationships.
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

    if not (reaction.rationale or "").strip():
        reaction.rationale = (
            f"{persona.name} responds in line with its {persona.temperament} posture."
        )

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


def prune_ghost_alliances(
    reactions: list[AgentReaction], personas: list[CompanyPersona]
) -> list[AgentReaction]:
    """Drop alliance targets that aren't real companies in the roster.

    Keeps the referee/board honest: an agent can only ally with another incumbent
    that actually exists in this game (no inventing partners).
    """
    valid = {p.name.strip().lower() for p in personas}
    for r in reactions:
        if not r.ally_with:
            continue
        r.ally_with = [a for a in r.ally_with if a.strip().lower() in valid]
    return reactions
