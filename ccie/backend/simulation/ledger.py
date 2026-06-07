"""Decision ledger + reasoning replay assembly (Phase 8).

The ledger is the agents' canonical, auditable repository in Redis: every CEO
reaction, referee adjudication, player choice, and the final recommendation is
written as a `LedgerEntry` (structured "what" + evidence + `weave_trace_id` join
key into the "why"). The replay view reads this back, ordered, so clicking the
player's building reconstructs the entire run.

If the Redis ledger is empty (e.g. older sessions or a transient write failure),
`assemble_replay` reconstructs an equivalent view from the persisted
`SimulationState`, so replay is always available.
"""

from __future__ import annotations

from simulation.schemas import (
    LedgerEntry,
    SimulationIteration,
    SimulationState,
)


def build_iteration_entries(
    session_id: str, iteration: SimulationIteration
) -> list[LedgerEntry]:
    """All ledger entries produced by one completed iteration."""
    entries: list[LedgerEntry] = []
    idx = iteration.index

    for reaction in iteration.reactions:
        entries.append(
            LedgerEntry(
                session_id=session_id,
                iteration_index=idx,
                actor=reaction.actor,
                actor_kind="company",
                kind="reaction",
                summary=reaction.action,
                structured_payload={
                    "intent": reaction.intent,
                    "rationale": reaction.rationale,
                    "intensity": reaction.intensity,
                    "ally_with": reaction.ally_with,
                    "weave_url": reaction.weave_url,
                },
                evidence=reaction.evidence,
                weave_trace_id=reaction.weave_trace_id,
            )
        )

    decision_payload = {}
    if iteration.decision_point is not None:
        decision_payload = {
            "options": [o.model_dump() for o in iteration.decision_point.options],
            "recommended_option_id": iteration.decision_point.recommended_option_id,
            "recommendation_rationale": iteration.decision_point.recommendation_rationale,
        }
    entries.append(
        LedgerEntry(
            session_id=session_id,
            iteration_index=idx,
            actor="referee",
            actor_kind="referee",
            kind="adjudication",
            summary=iteration.referee_outcome,
            structured_payload={
                "board": iteration.board.model_dump(),
                "score": iteration.score.model_dump() if iteration.score else {},
                "decision": decision_payload,
                "weave_url": iteration.weave_url,
            },
            weave_trace_id=iteration.weave_trace_id,
        )
    )
    return entries


def build_choice_entry(
    session_id: str, iteration_index: int, actor: str, move: str
) -> LedgerEntry:
    return LedgerEntry(
        session_id=session_id,
        iteration_index=iteration_index,
        actor=actor,
        actor_kind="player",
        kind="choice",
        summary=move,
    )


def build_persona_entries(state: SimulationState) -> list[LedgerEntry]:
    entries: list[LedgerEntry] = []
    for persona in state.personas:
        entries.append(
            LedgerEntry(
                session_id=state.session_id,
                iteration_index=0,
                actor=persona.name,
                actor_kind="company",
                kind="persona",
                summary=persona.strategy_thesis,
                structured_payload={
                    "temperament": persona.temperament,
                    "ethos": persona.ethos,
                    "financial_firepower": persona.financial_firepower,
                },
                evidence=persona.sources[:3],
            )
        )
    return entries


def build_recommendation_entry(state: SimulationState) -> LedgerEntry:
    return LedgerEntry(
        session_id=state.session_id,
        iteration_index=state.current_index,
        actor="advisor",
        actor_kind="system",
        kind="recommendation",
        summary=state.final_recommendation,
    )


def _replay_from_state(state: SimulationState) -> list[dict]:
    """Reconstruct the per-turn replay timeline directly from the state."""
    turns: list[dict] = []
    for it in state.iterations:
        turns.append(
            {
                "index": it.index,
                "move": it.move,
                "chosen_option": it.chosen_option,
                "referee_outcome": it.referee_outcome,
                "board": it.board.model_dump(),
                "score": it.score.model_dump() if it.score else None,
                "weave_url": it.weave_url,
                "reactions": [
                    {
                        "actor": r.actor,
                        "intent": r.intent,
                        "action": r.action,
                        "rationale": r.rationale,
                        "intensity": r.intensity,
                        "ally_with": r.ally_with,
                        "evidence": [e.model_dump() for e in r.evidence],
                        "weave_trace_id": r.weave_trace_id,
                        "weave_url": r.weave_url,
                    }
                    for r in it.reactions
                ],
                "decision": (
                    it.decision_point.model_dump() if it.decision_point else None
                ),
            }
        )
    return turns


def assemble_replay(state: SimulationState, ledger: list[LedgerEntry]) -> dict:
    """Build the replay bundle the UI renders when the player building is clicked."""
    return {
        "session_id": state.session_id,
        "player": state.player.model_dump() if state.player else None,
        "target": state.target.model_dump() if state.target else None,
        "personas": [p.model_dump() for p in state.personas],
        "status": state.status,
        "current_index": state.current_index,
        "max_iterations": state.max_iterations,
        "final_recommendation": state.final_recommendation,
        "parent_session_id": state.parent_session_id,
        "branched_from_index": state.branched_from_index,
        "turns": _replay_from_state(state),
        "ledger": [e.model_dump() for e in ledger],
        "ledger_source": "redis" if ledger else "state",
    }
