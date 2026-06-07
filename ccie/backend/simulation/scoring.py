"""Outcome scoring, option recommendation, and final strategy report (Phase 7).

Turns the qualitative war-game into something an executive can act on:
- `score_board`      -> a composite player score (position + momentum - risk) per turn.
- `recommend_option` -> which of the next choices best improves that score (with a
                        short rationale); heuristic, deterministic, LLM-optional.
- `final_report`     -> an evidence-aware summary of how the playthrough went and
                        what to do for real; LLM path with heuristic fallback.

Deterministic by default so tests and offline runs are stable.
"""

from __future__ import annotations

import logging
from typing import Callable

from langchain_core.messages import HumanMessage

from llm.factory import get_llm
from simulation.schemas import (
    BoardState,
    DecisionOption,
    IterationScore,
    SimulationState,
)

logger = logging.getLogger(__name__)

# Composite weights: position (standing) and momentum (trajectory) are good; risk
# is bad. A fully neutral board (position 0.5 / momentum 0 / risk 0.5) scores ~0.5;
# the zero-risk opening board scores a bit higher, which is intended.
_W_POSITION = 0.5
_W_MOMENTUM = 0.25
_W_RISK = 0.25


def _clamp01(v: float) -> float:
    return round(max(0.0, min(1.0, v)), 3)


def score_board(board: BoardState, previous: IterationScore | None = None) -> IterationScore:
    """Composite player score for a board, plus delta vs. the previous turn."""
    p = board.player
    momentum_norm = (max(-1.0, min(1.0, p.momentum)) + 1.0) / 2.0  # -1..1 -> 0..1
    composite = _clamp01(
        _W_POSITION * _clamp01(p.position)
        + _W_MOMENTUM * momentum_norm
        + _W_RISK * (1.0 - _clamp01(p.risk))
    )
    delta = round(composite - previous.composite, 3) if previous else 0.0
    return IterationScore(
        position=_clamp01(p.position),
        momentum=round(max(-1.0, min(1.0, p.momentum)), 3),
        risk=_clamp01(p.risk),
        composite=composite,
        delta=delta,
    )


# Keyword signals used by the heuristic option ranker.
_AGGRESSIVE = ("aggress", "expand", "integrate", "acquire", "counter", "escalat")
_DEFENSIVE = ("consolidate", "de-risk", "derisk", "stabil", "hold", "defend", "wait")
_ALLIANCE = ("alliance", "partner", "coalition", "ally")


def _option_text(opt: DecisionOption) -> str:
    return f"{opt.label} {opt.expected_effect} {opt.risk}".lower()


def _heuristic_recommend(
    board: BoardState, options: list[DecisionOption]
) -> tuple[str, str]:
    """Pick the option best suited to the current board posture.

    High risk -> favor de-risking; weak/negative momentum -> favor aggression;
    high rival pressure -> favor alliances. Returns (option_id, rationale).
    """
    if not options:
        return "", ""

    p = board.player
    rival_pressure = (
        sum(c.pressure for c in board.companies) / len(board.companies)
        if board.companies
        else 0.0
    )

    def desire(text: str) -> dict[str, float]:
        return {
            "aggressive": 1.0 if any(k in text for k in _AGGRESSIVE) else 0.0,
            "defensive": 1.0 if any(k in text for k in _DEFENSIVE) else 0.0,
            "alliance": 1.0 if any(k in text for k in _ALLIANCE) else 0.0,
        }

    # Posture weights from the board state.
    w_defensive = 0.4 + p.risk * 0.8
    w_aggressive = 0.4 + max(0.0, -p.momentum) * 0.8 + (0.3 if p.position < 0.5 else 0.0)
    w_alliance = 0.3 + rival_pressure * 0.7

    best_id, best_score, best_kind = options[0].id, -1.0, "balanced"
    for opt in options:
        d = desire(_option_text(opt))
        s = d["defensive"] * w_defensive + d["aggressive"] * w_aggressive + d["alliance"] * w_alliance
        if s > best_score:
            best_score, best_id = s, opt.id
            best_kind = (
                "defensive"
                if d["defensive"]
                else "aggressive"
                if d["aggressive"]
                else "alliance"
                if d["alliance"]
                else "balanced"
            )

    reason_map = {
        "defensive": f"Your risk is elevated ({p.risk:.0%}); consolidating protects your gains.",
        "aggressive": f"Momentum is weak ({p.momentum:+.2f}); pressing now reclaims initiative.",
        "alliance": f"Rival pressure is high ({rival_pressure:.0%}); a partnership shares the load.",
        "balanced": "Balanced play keeps your options open given the current board.",
    }
    return best_id, reason_map[best_kind]


async def recommend_option(
    board: BoardState,
    options: list[DecisionOption],
    *,
    move: str = "",
    llm_getter: Callable[[], object] = get_llm,
) -> tuple[str, str]:
    """Recommend the best next option (id, rationale). LLM-optional."""
    if not options:
        return "", ""
    # Heuristic is always computed (and is the offline/fallback answer).
    heuristic_id, heuristic_reason = _heuristic_recommend(board, options)

    llm = llm_getter()
    if llm is None:
        return heuristic_id, heuristic_reason

    valid_ids = {o.id for o in options}
    opts_text = "\n".join(
        f"- {o.id}: {o.label} (effect: {o.expected_effect}; risk: {o.risk})" for o in options
    )
    p = board.player
    prompt = (
        "You advise an executive in an M&A war-game. Given the board and the options, "
        "pick the single best next move to maximize position and momentum while "
        "controlling risk.\n\n"
        f"Player: position={p.position:.2f}, momentum={p.momentum:.2f}, risk={p.risk:.2f}\n"
        f"Last move: {move or 'n/a'}\n"
        f"Options:\n{opts_text}\n\n"
        "Reply with exactly: <option_id> | <one-sentence rationale>."
    )
    try:
        result = await llm.ainvoke([HumanMessage(content=prompt)])
        text = (getattr(result, "content", "") or "").strip()
        chosen, _, rationale = text.partition("|")
        chosen = chosen.strip()
        rationale = rationale.strip()
        if chosen in valid_ids:
            return chosen, rationale or heuristic_reason
    except Exception:
        logger.debug("LLM option recommendation failed", exc_info=True)
    return heuristic_id, heuristic_reason


def _trajectory(state: SimulationState) -> str:
    scores = [it.score.composite for it in state.iterations if it.score]
    if not scores:
        return "no scored turns"
    start, end = scores[0], scores[-1]
    trend = "improved" if end > start + 0.02 else "declined" if end < start - 0.02 else "held steady"
    best_idx = max(range(len(scores)), key=lambda i: scores[i])
    return (
        f"score {trend} from {start:.2f} to {end:.2f}; "
        f"best turn was #{best_idx + 1} ({scores[best_idx]:.2f})"
    )


def _heuristic_final_report(state: SimulationState) -> str:
    traj = _trajectory(state)
    moves = [f"#{it.index} {it.move}" for it in state.iterations if it.move]
    last_board = state.iterations[-1].board if state.iterations else None
    risk_note = ""
    if last_board is not None:
        risk_note = (
            f" Ending risk is {last_board.player.risk:.0%} and position "
            f"{last_board.player.position:.0%}."
        )
    return (
        f"Across {len(state.iterations)} turns, your {traj}.{risk_note} "
        f"Path played: {', '.join(moves) or 'n/a'}. "
        "Use the strongest-scoring branch as your real-world playbook, and rehearse "
        "the high-risk turns before committing capital."
    )


async def final_report(
    state: SimulationState,
    *,
    llm_getter: Callable[[], object] = get_llm,
) -> str:
    """Synthesize an evidence-aware strategy recommendation for the playthrough."""
    heuristic = _heuristic_final_report(state)
    llm = llm_getter()
    if llm is None:
        return heuristic

    turns = []
    for it in state.iterations:
        sc = f"{it.score.composite:.2f}" if it.score else "n/a"
        turns.append(f"#{it.index}: move='{it.move}' score={sc} — {it.referee_outcome[:160]}")
    player = state.player.company if state.player else "the acquirer"
    target = state.target.name if state.target else "the target"
    prompt = (
        "You are a strategy advisor. Summarize this acquisition war-game for the "
        "executive and recommend how to proceed in the real deal. Be concrete and "
        "reference how the score evolved and which moves worked.\n\n"
        f"Acquirer: {player}. Target: {target}.\n"
        f"Turns:\n" + "\n".join(turns) + "\n\n"
        "Write 3-5 sentences: what happened, the best-performing strategy, the key "
        "risks, and a clear recommended path for the real acquisition."
    )
    try:
        result = await llm.ainvoke([HumanMessage(content=prompt)])
        text = (getattr(result, "content", "") or "").strip()
        return text or heuristic
    except Exception:
        logger.debug("LLM final report failed", exc_info=True)
        return heuristic
