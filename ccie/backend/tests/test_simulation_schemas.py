"""Phase 0 smoke tests for the simulation package (schemas + roster)."""

from simulation.roster import (
    CORE_SOFTWARE,
    DEFAULT_SECTOR,
    get_sector,
    list_sectors,
)
from simulation.schemas import (
    AcquisitionTarget,
    AgentReaction,
    BoardState,
    CompanyPersona,
    DecisionOption,
    DecisionPoint,
    LedgerEntry,
    PlayerProfile,
    SimulationIteration,
    SimulationState,
)


def test_default_sector_has_incumbents():
    sector = get_sector()
    assert sector.name == DEFAULT_SECTOR == CORE_SOFTWARE
    assert len(sector.incumbents) >= 3
    assert sector.notes


def test_get_sector_excludes_player_and_target_case_insensitive():
    sector = get_sector(exclude=["microsoft", "Apple"])
    lowered = {name.lower() for name in sector.incumbents}
    assert "microsoft" not in lowered
    assert "apple" not in lowered


def test_get_sector_respects_max_incumbents():
    sector = get_sector(max_incumbents=2)
    assert len(sector.incumbents) == 2


def test_unknown_sector_falls_back_to_default():
    sector = get_sector("nonexistent")
    assert sector.name == DEFAULT_SECTOR
    assert CORE_SOFTWARE in list_sectors()


def test_simulation_state_defaults():
    state = SimulationState(session_id="s1")
    assert state.status == "setup"
    assert state.current_index == 0
    assert state.max_iterations == 10
    assert state.iterations == []


def test_persona_and_reaction_round_trip():
    persona = CompanyPersona(name="Amazon", temperament="aggressive")
    assert persona.temperament == "aggressive"
    assert persona.m_and_a_history == []

    reaction = AgentReaction(actor="Amazon", action="Counter-bid", intensity=0.8)
    dumped = reaction.model_dump()
    restored = AgentReaction.model_validate(dumped)
    assert restored.actor == "Amazon"
    assert restored.weave_trace_id == ""


def test_ledger_entry_has_timestamp_and_join_key():
    entry = LedgerEntry(
        session_id="s1",
        iteration_index=1,
        actor="Meta",
        kind="reaction",
        weave_trace_id="trace-123",
    )
    assert entry.ts > 0
    assert entry.weave_trace_id == "trace-123"
    assert entry.actor_kind == "company"


def test_full_iteration_assembles():
    iteration = SimulationIteration(
        index=1,
        move="Acquire startup X",
        reactions=[AgentReaction(actor="Apple", action="Wait and watch")],
        board=BoardState(),
        decision_point=DecisionPoint(
            iteration_index=1,
            situation_summary="Rivals are cautious.",
            options=[
                DecisionOption(id="a", label="Integrate fast"),
                DecisionOption(id="b", label="Hold and observe"),
            ],
        ),
    )
    assert iteration.decision_point is not None
    assert len(iteration.decision_point.options) == 2
    assert iteration.reactions[0].actor == "Apple"


def test_target_and_player_models():
    target = AcquisitionTarget(name="StartupX", capabilities=["AI search"])
    player = PlayerProfile(company="AcmeCorp")
    assert target.capabilities == ["AI search"]
    assert "Maximize" in player.objective
