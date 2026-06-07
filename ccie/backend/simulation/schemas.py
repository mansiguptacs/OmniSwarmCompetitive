"""Pydantic schemas for the acquisition war-game simulator.

These mirror Section 5 of `simulation_plan.md`. They are additive and independent
of the baseline `state.py` models so the existing pipeline is unaffected. The
frontend mirror lives in `ccie/frontend/types/simulation.ts`.
"""

from __future__ import annotations

import time
from typing import Literal

from pydantic import BaseModel, Field

SimStatus = Literal["setup", "running", "awaiting_choice", "complete"]
LedgerKind = Literal["reaction", "adjudication", "choice", "grounding", "persona", "recommendation"]
ActorKind = Literal["company", "referee", "player", "system"]
Temperament = Literal["aggressive", "litigious", "partner_first", "wait_and_see", "acquisitive"]


class Evidence(BaseModel):
    """A single grounding citation backing a persona field, reaction, or outcome."""

    claim: str = ""
    source_url: str = ""
    source_title: str = ""
    as_of: str = ""


class CompanyPersona(BaseModel):
    """A CEO/company digital twin distilled from real public data."""

    name: str
    strategy_thesis: str = ""
    ethos: str = ""
    m_and_a_history: list[str] = Field(default_factory=list)
    financial_firepower: str = ""
    temperament: Temperament = "wait_and_see"
    recent_moves: list[str] = Field(default_factory=list)
    leadership_style: str = ""
    sources: list[Evidence] = Field(default_factory=list)


class PersonaDraft(BaseModel):
    """LLM structured-output target for persona distillation (no citations).

    Evidence/citations are attached separately from the real search hits so the
    model can't invent sources.
    """

    strategy_thesis: str = ""
    ethos: str = ""
    m_and_a_history: list[str] = Field(default_factory=list)
    financial_firepower: str = ""
    temperament: Temperament = "wait_and_see"
    recent_moves: list[str] = Field(default_factory=list)
    leadership_style: str = ""


class AcquisitionTarget(BaseModel):
    """The smaller startup the player wants to acquire."""

    name: str
    description: str = ""
    why_attractive: str = ""
    price_estimate: str = ""
    capabilities: list[str] = Field(default_factory=list)
    sources: list[Evidence] = Field(default_factory=list)


class PlayerProfile(BaseModel):
    """The acquiring company the executive controls."""

    company: str
    resources: str = ""
    objective: str = "Maximize strategic position (position + momentum - risk)."


class Sector(BaseModel):
    """A market sector and its incumbent roster."""

    name: str
    incumbents: list[str] = Field(default_factory=list)
    notes: str = ""


class AgentReaction(BaseModel):
    """One CEO-agent's response within a single iteration."""

    actor: str
    intent: str = ""
    action: str = ""
    rationale: str = ""
    intensity: float = 0.5
    evidence: list[Evidence] = Field(default_factory=list)
    weave_trace_id: str = ""
    redis_key: str = ""


class CompanyBoardPosition(BaseModel):
    """Quantified standing for a single company on the board."""

    name: str
    market_position: float = 0.5
    threat: float = 0.5
    sentiment: float = 0.0
    pressure: float = 0.0
    alliances: list[str] = Field(default_factory=list)


class PlayerBoardPosition(BaseModel):
    position: float = 0.5
    momentum: float = 0.0
    risk: float = 0.0


class BoardState(BaseModel):
    """Quantified state of the whole board after referee adjudication."""

    companies: list[CompanyBoardPosition] = Field(default_factory=list)
    player: PlayerBoardPosition = Field(default_factory=PlayerBoardPosition)


class DecisionOption(BaseModel):
    id: str
    label: str
    expected_effect: str = ""
    risk: str = ""


class DecisionPoint(BaseModel):
    iteration_index: int
    situation_summary: str = ""
    options: list[DecisionOption] = Field(default_factory=list)
    allow_free_text: bool = True


class SimulationIteration(BaseModel):
    index: int
    move: str = ""
    reactions: list[AgentReaction] = Field(default_factory=list)
    referee_outcome: str = ""
    board: BoardState = Field(default_factory=BoardState)
    decision_point: DecisionPoint | None = None
    chosen_option: str = ""


class LedgerEntry(BaseModel):
    """An auditable record persisted to the agents' Redis repository.

    Carries `weave_trace_id` so the replay UI can join the structured "what"
    (Redis) to the reasoning "why" (Weave).
    """

    session_id: str
    iteration_index: int
    actor: str
    actor_kind: ActorKind = "company"
    kind: LedgerKind
    summary: str = ""
    structured_payload: dict = Field(default_factory=dict)
    evidence: list[Evidence] = Field(default_factory=list)
    weave_trace_id: str = ""
    ts: float = Field(default_factory=time.time)


class SimulationState(BaseModel):
    """Top-level state for a war-game session."""

    session_id: str = ""
    sector: Sector | None = None
    target: AcquisitionTarget | None = None
    player: PlayerProfile | None = None
    personas: list[CompanyPersona] = Field(default_factory=list)
    iterations: list[SimulationIteration] = Field(default_factory=list)
    current_index: int = 0
    max_iterations: int = 10
    status: SimStatus = "setup"
    final_recommendation: str = ""
