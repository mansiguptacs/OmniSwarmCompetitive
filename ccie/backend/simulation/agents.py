"""CEO-agents: each incumbent reacts in-character to the player's move.

Every agent reasons from its `CompanyPersona` (the digital twin) plus the current
board and the player's move, and emits an `AgentReaction`. LLM path when available;
a temperament-driven heuristic otherwise (keeps reactions distinct & deterministic
offline for tests).
"""

from __future__ import annotations

import asyncio
import logging
from typing import Callable

from langchain_core.messages import HumanMessage

from llm.factory import get_llm
from simulation.schemas import (
    AcquisitionTarget,
    AgentReaction,
    BoardState,
    CompanyPersona,
    PlayerProfile,
    ReactionDraft,
)

logger = logging.getLogger(__name__)

# temperament -> (default action, baseline intensity)
TEMPERAMENT_PLAYBOOK: dict[str, tuple[str, float]] = {
    "aggressive": ("Launch an aggressive competitive counter-move", 0.8),
    "acquisitive": ("Pursue a counter-acquisition or rival bid", 0.7),
    "litigious": ("Apply legal and regulatory pressure", 0.6),
    "partner_first": ("Form a defensive partnership or alliance", 0.5),
    "wait_and_see": ("Monitor closely and hold position for now", 0.3),
}


def _clamp01(v: float) -> float:
    return round(max(0.0, min(1.0, v)), 3)


def _board_summary(board: BoardState) -> str:
    if not board.companies:
        return "Opening position; no prior board state."
    parts = [
        f"{c.name}: pos={c.market_position:.2f} threat={c.threat:.2f} pressure={c.pressure:.2f}"
        for c in board.companies
    ]
    parts.append(
        f"PLAYER: pos={board.player.position:.2f} momentum={board.player.momentum:.2f} "
        f"risk={board.player.risk:.2f}"
    )
    return "; ".join(parts)


def _heuristic_reaction(
    persona: CompanyPersona,
    move: str,
    target: AcquisitionTarget | None,
) -> AgentReaction:
    action, intensity = TEMPERAMENT_PLAYBOOK.get(
        persona.temperament, ("Assess the situation and respond measuredly", 0.5)
    )
    target_name = target.name if target else "the target"
    intent = f"Protect {persona.name}'s position after the {target_name} move"
    rationale = (
        f"{persona.name} acts in line with its {persona.temperament} posture and "
        f"strategy: {persona.strategy_thesis[:140] or 'core-software competition'}."
    )
    return AgentReaction(
        actor=persona.name,
        intent=intent,
        action=action,
        rationale=rationale,
        intensity=_clamp01(intensity),
        evidence=persona.sources[:2],
    )


async def react_as_ceo(
    persona: CompanyPersona,
    move: str,
    board: BoardState,
    *,
    target: AcquisitionTarget | None = None,
    player: PlayerProfile | None = None,
    llm_getter: Callable[[], object] = get_llm,
) -> AgentReaction:
    """Produce one CEO-agent's reaction to the player's move."""
    llm = llm_getter()
    if llm is None:
        return _heuristic_reaction(persona, move, target)

    structured = llm.with_structured_output(ReactionDraft)
    target_name = target.name if target else "a smaller startup"
    player_name = player.company if player else "the acquirer"
    prompt = (
        f"You ARE the CEO of {persona.name}. Stay fully in character.\n"
        f"Strategy: {persona.strategy_thesis}\n"
        f"Ethos: {persona.ethos}\n"
        f"Temperament: {persona.temperament}\n"
        f"Notable M&A: {', '.join(persona.m_and_a_history) or 'n/a'}\n"
        f"Financial firepower: {persona.financial_firepower}\n\n"
        f"Situation: {player_name} just made this move: \"{move}\" "
        f"(acquiring/affecting {target_name}).\n"
        f"Current board: {_board_summary(board)}\n\n"
        "As this CEO, decide how your company responds. Be realistic and consistent "
        "with who you are. Provide: intent (your goal), action (the concrete move you "
        "make), rationale (why, grounded in your real strategy/position), and intensity "
        "(0.0-1.0, how forcefully you respond)."
    )
    try:
        result = await structured.ainvoke([HumanMessage(content=prompt)])
        draft = result if isinstance(result, ReactionDraft) else ReactionDraft.model_validate(result)
        return AgentReaction(
            actor=persona.name,
            intent=draft.intent,
            action=draft.action,
            rationale=draft.rationale,
            intensity=_clamp01(draft.intensity),
            evidence=persona.sources[:2],
        )
    except Exception:
        logger.debug("LLM reaction failed for %s", persona.name, exc_info=True)
        return _heuristic_reaction(persona, move, target)


async def gather_reactions(
    personas: list[CompanyPersona],
    move: str,
    board: BoardState,
    *,
    target: AcquisitionTarget | None = None,
    player: PlayerProfile | None = None,
    llm_getter: Callable[[], object] = get_llm,
) -> list[AgentReaction]:
    """All CEO-agents react concurrently."""
    return list(
        await asyncio.gather(
            *(
                react_as_ceo(
                    persona,
                    move,
                    board,
                    target=target,
                    player=player,
                    llm_getter=llm_getter,
                )
                for persona in personas
            )
        )
    )
