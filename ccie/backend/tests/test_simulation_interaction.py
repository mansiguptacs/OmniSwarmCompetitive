"""Phase 3 tests: multi-agent interaction (two-pass) + referee alliances."""

import pytest

from simulation.agents import gather_reactions_two_pass
from simulation.engine import init_board, run_iteration
from simulation.guardrails import ensure_grounded
from simulation.referee import adjudicate
from simulation.schemas import (
    AcquisitionTarget,
    AgentReaction,
    CompanyPersona,
    PlayerProfile,
    SimulationState,
)


def _no_llm():
    return None


def _high_pressure_personas() -> list[CompanyPersona]:
    # Three forceful rivals + one cautious player → triggers second-pass behavior.
    return [
        CompanyPersona(name="Amazon", temperament="aggressive"),
        CompanyPersona(name="Meta", temperament="aggressive"),
        CompanyPersona(name="Alphabet", temperament="acquisitive"),
        CompanyPersona(name="Apple", temperament="wait_and_see"),
    ]


def _calm_personas() -> list[CompanyPersona]:
    return [
        CompanyPersona(name="Apple", temperament="wait_and_see"),
        CompanyPersona(name="Nvidia", temperament="wait_and_see"),
    ]


@pytest.mark.asyncio
async def test_defensive_agent_forms_alliance_under_pressure():
    personas = _high_pressure_personas()
    board = init_board(personas)
    reactions = await gather_reactions_two_pass(
        personas, "Acquire StartupX", board, llm_getter=_no_llm
    )
    apple = next(r for r in reactions if r.actor == "Apple")
    assert apple.ally_with, "cautious CEO should seek an alliance when rivals are aggressive"
    assert "Apple" not in apple.ally_with  # never allies with self


@pytest.mark.asyncio
async def test_aggressive_agent_escalates_under_pressure():
    personas = _high_pressure_personas()
    board = init_board(personas)
    reactions = await gather_reactions_two_pass(
        personas, "Acquire StartupX", board, llm_getter=_no_llm
    )
    amazon = next(r for r in reactions if r.actor == "Amazon")
    assert amazon.intensity > 0.8  # escalated above its 0.8 first-pass baseline
    assert amazon.action.startswith("Escalate")


@pytest.mark.asyncio
async def test_low_pressure_leaves_reactions_unchanged():
    personas = _calm_personas()
    board = init_board(personas)
    reactions = await gather_reactions_two_pass(
        personas, "Acquire StartupX", board, llm_getter=_no_llm
    )
    for r in reactions:
        assert not r.ally_with
        assert not r.action.startswith("Escalate")


@pytest.mark.asyncio
async def test_referee_records_alliances_and_adds_coordination_penalty():
    personas = _high_pressure_personas()
    board = init_board(personas)

    allied = [
        AgentReaction(actor="Apple", action="Form a defensive alliance with Amazon",
                      intensity=0.5, ally_with=["Amazon"]),
        AgentReaction(actor="Amazon", action="Aggressive push", intensity=0.8),
    ]
    solo = [
        AgentReaction(actor="Apple", action="Hold", intensity=0.5),
        AgentReaction(actor="Amazon", action="Aggressive push", intensity=0.8),
    ]

    _, board_allied, _ = await adjudicate("Acquire StartupX", allied, board, 1, llm_getter=_no_llm)
    _, board_solo, _ = await adjudicate("Acquire StartupX", solo, board, 1, llm_getter=_no_llm)

    apple = next(c for c in board_allied.companies if c.name == "Apple")
    amazon = next(c for c in board_allied.companies if c.name == "Amazon")
    assert "Amazon" in apple.alliances
    assert "Apple" in amazon.alliances  # recorded bidirectionally
    # Coordinated rivals push player risk higher than the un-allied case.
    assert board_allied.player.risk > board_solo.player.risk


def test_guardrail_strips_self_alliance():
    persona = CompanyPersona(name="Meta", temperament="aggressive")
    reaction = AgentReaction(actor="Meta", ally_with=["Meta", "Apple", "apple"])
    cleaned = ensure_grounded(reaction, persona)
    assert "Meta" not in cleaned.ally_with
    assert cleaned.ally_with == ["Apple"]  # deduped, self removed


@pytest.mark.asyncio
async def test_engine_interactive_default_produces_interaction():
    personas = _high_pressure_personas()
    state = SimulationState(
        session_id="s", personas=personas,
        target=AcquisitionTarget(name="StartupX"), player=PlayerProfile(company="Acme"),
    )
    iteration = await run_iteration(state, "Acquire StartupX", llm_getter=_no_llm)
    assert any(r.ally_with for r in iteration.reactions)
