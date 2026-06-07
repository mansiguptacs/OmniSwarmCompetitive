"""Market referee: adjudicate CEO reactions into a new board state + choices.

Takes the player's move and all CEO-agent reactions, then resolves them into:
- a narrative `outcome_summary`,
- an updated `BoardState` (quantified deltas),
- a `DecisionPoint` (the strategic choices offered to the player next).

LLM path when available; deterministic heuristic otherwise.
"""

from __future__ import annotations

import logging
from copy import deepcopy
from typing import Callable

from langchain_core.messages import HumanMessage

from llm.factory import get_llm
from simulation.schemas import (
    AcquisitionTarget,
    AgentReaction,
    BoardState,
    DecisionOption,
    DecisionPoint,
    PlayerProfile,
    RefereeDraft,
)

logger = logging.getLogger(__name__)


def _clamp01(v: float) -> float:
    return round(max(0.0, min(1.0, v)), 3)


def _clamp_signed(v: float) -> float:
    return round(max(-1.0, min(1.0, v)), 3)


def _reactions_text(reactions: list[AgentReaction]) -> str:
    if not reactions:
        return "No competitor reacted."
    return "\n".join(
        f"- {r.actor}: {r.action} (intensity {r.intensity:.2f}) — {r.rationale[:160]}"
        for r in reactions
    )


def _heuristic_adjudicate(
    move: str,
    reactions: list[AgentReaction],
    board: BoardState,
    iteration_index: int,
    target: AcquisitionTarget | None,
) -> tuple[str, BoardState, DecisionPoint]:
    new_board = deepcopy(board)
    by_actor = {r.actor: r for r in reactions}

    total_intensity = sum(r.intensity for r in reactions) or 0.0
    avg_intensity = total_intensity / len(reactions) if reactions else 0.0

    for company in new_board.companies:
        reaction = by_actor.get(company.name)
        if reaction is None:
            continue
        # A forceful reaction raises that company's threat and its own pressure.
        company.threat = _clamp01(company.threat + reaction.intensity * 0.15)
        company.pressure = _clamp01(company.pressure + reaction.intensity * 0.10)
        company.market_position = _clamp01(
            company.market_position + (reaction.intensity - 0.5) * 0.05
        )

    # The player's move meets resistance proportional to total reaction intensity.
    resistance = avg_intensity
    new_board.player.risk = _clamp01(new_board.player.risk + resistance * 0.25)
    new_board.player.momentum = _clamp_signed(
        new_board.player.momentum + (0.25 - resistance * 0.3)
    )
    new_board.player.position = _clamp01(
        new_board.player.position + (0.1 - resistance * 0.12)
    )

    strongest = max(reactions, key=lambda r: r.intensity, default=None)
    target_name = target.name if target else "the target"
    if strongest is not None:
        outcome = (
            f"After \"{move}\", {len(reactions)} rivals responded. "
            f"{strongest.actor} pushed back hardest ({strongest.action}). "
            f"Resistance to the {target_name} play is "
            f"{'high' if resistance > 0.6 else 'moderate' if resistance > 0.35 else 'low'}."
        )
    else:
        outcome = f"After \"{move}\", rivals stayed quiet — an open window for the {target_name} play."

    options = [
        DecisionOption(
            id="integrate",
            label="Integrate the acquisition aggressively and expand",
            expected_effect="Faster synergy capture; higher momentum",
            risk="Invites stronger rival retaliation",
        ),
        DecisionOption(
            id="consolidate",
            label="Consolidate and de-risk before the next move",
            expected_effect="Lower risk; steadier position",
            risk="Cedes initiative to rivals",
        ),
        DecisionOption(
            id="alliance",
            label="Form a strategic alliance to counter the incumbents",
            expected_effect="Shares pressure; opens partnerships",
            risk="Dilutes control and upside",
        ),
    ]
    decision = DecisionPoint(
        iteration_index=iteration_index,
        situation_summary=outcome,
        options=options,
        allow_free_text=True,
    )
    return outcome, new_board, decision


def _apply_llm_deltas(board: BoardState, draft: RefereeDraft) -> BoardState:
    new_board = deepcopy(board)
    by_name = {c.name: c for c in new_board.companies}
    for delta in draft.companies:
        company = by_name.get(delta.name)
        if company is None:
            continue
        if delta.market_position is not None:
            company.market_position = _clamp01(delta.market_position)
        if delta.threat is not None:
            company.threat = _clamp01(delta.threat)
        if delta.sentiment is not None:
            company.sentiment = _clamp_signed(delta.sentiment)
        if delta.pressure is not None:
            company.pressure = _clamp01(delta.pressure)
    if draft.player is not None:
        if draft.player.position is not None:
            new_board.player.position = _clamp01(draft.player.position)
        if draft.player.momentum is not None:
            new_board.player.momentum = _clamp_signed(draft.player.momentum)
        if draft.player.risk is not None:
            new_board.player.risk = _clamp01(draft.player.risk)
    return new_board


async def adjudicate(
    move: str,
    reactions: list[AgentReaction],
    board: BoardState,
    iteration_index: int,
    *,
    target: AcquisitionTarget | None = None,
    player: PlayerProfile | None = None,
    llm_getter: Callable[[], object] = get_llm,
) -> tuple[str, BoardState, DecisionPoint]:
    """Resolve reactions into (outcome_summary, new_board, decision_point)."""
    llm = llm_getter()
    if llm is None:
        return _heuristic_adjudicate(move, reactions, board, iteration_index, target)

    structured = llm.with_structured_output(RefereeDraft)
    company_names = ", ".join(c.name for c in board.companies) or "none"
    prompt = (
        "You are a neutral market referee in an M&A war-game. Resolve how the "
        "competitors' reactions interact and update the board.\n\n"
        f"Player move: \"{move}\"\n"
        f"Companies on the board: {company_names}\n"
        f"Reactions:\n{_reactions_text(reactions)}\n\n"
        "Return: outcome_summary (2-3 sentences on what happened and how moves "
        "interacted); per-company new absolute scores 0..1 for market_position, "
        "threat, sentiment(-1..1), pressure (only include changed companies); player "
        "new scores (position 0..1, momentum -1..1, risk 0..1); and 2-4 strategic "
        "options the player should choose from next (each with expected_effect and risk)."
    )
    try:
        result = await structured.ainvoke([HumanMessage(content=prompt)])
        draft = result if isinstance(result, RefereeDraft) else RefereeDraft.model_validate(result)
        new_board = _apply_llm_deltas(board, draft)
        options = draft.options or _heuristic_adjudicate(
            move, reactions, board, iteration_index, target
        )[2].options
        decision = DecisionPoint(
            iteration_index=iteration_index,
            situation_summary=draft.outcome_summary,
            options=options,
            allow_free_text=True,
        )
        return draft.outcome_summary, new_board, decision
    except Exception:
        logger.debug("LLM referee failed at iteration %s", iteration_index, exc_info=True)
        return _heuristic_adjudicate(move, reactions, board, iteration_index, target)
