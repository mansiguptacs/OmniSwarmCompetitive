"""Phase 4 tests: human-in-the-loop session controller (offline path)."""

import fakeredis
import pytest

from simulation.session import (
    advance_simulation,
    end_simulation,
    get_simulation,
    start_simulation,
)
from simulation.store import SimulationStore


def _no_llm():
    return None


@pytest.fixture
def store():
    fake = fakeredis.FakeAsyncRedis(decode_responses=True)
    return SimulationStore(client=fake)


@pytest.mark.asyncio
async def test_start_builds_board_and_runs_opening(store):
    state = await start_simulation(
        "StartupX", "Microsoft", store=store, llm_getter=_no_llm
    )
    # Roster excludes the player; target isn't an incumbent here.
    names = {p.name for p in state.personas}
    assert "Microsoft" not in names
    assert len(state.personas) >= 3
    assert state.current_index == 1
    assert state.status == "awaiting_choice"
    assert len(state.iterations) == 1
    assert state.iterations[0].decision_point is not None


@pytest.mark.asyncio
async def test_persistence_round_trip(store):
    started = await start_simulation(
        "StartupX", "Microsoft", session_id="sess-x", store=store, llm_getter=_no_llm
    )
    loaded = await get_simulation("sess-x", store=store)
    assert loaded is not None
    assert loaded.session_id == started.session_id
    assert len(loaded.iterations) == 1


@pytest.mark.asyncio
async def test_advance_with_option_id_records_choice(store):
    state = await start_simulation(
        "StartupX", "Microsoft", session_id="s1", store=store, llm_getter=_no_llm
    )
    option = state.iterations[0].decision_point.options[0]

    state2 = await advance_simulation("s1", option.id, store=store, llm_getter=_no_llm)
    assert state2.current_index == 2
    assert len(state2.iterations) == 2
    # The prior iteration recorded the chosen option, and the new move used its label.
    assert state2.iterations[0].chosen_option == option.id
    assert state2.iterations[1].move == option.label


@pytest.mark.asyncio
async def test_advance_with_free_text(store):
    await start_simulation(
        "StartupX", "Microsoft", session_id="s2", store=store, llm_getter=_no_llm
    )
    custom = "Spin off the consumer division and partner with a chipmaker"
    state = await advance_simulation("s2", custom, store=store, llm_getter=_no_llm)
    assert state.iterations[1].move == custom
    assert state.iterations[0].chosen_option == custom


@pytest.mark.asyncio
async def test_full_ten_turn_playthrough_completes(store):
    state = await start_simulation(
        "StartupX", "Microsoft", session_id="s3", max_iterations=10,
        store=store, llm_getter=_no_llm,
    )
    guard = 0
    while state.status != "complete" and guard < 20:
        state = await advance_simulation("s3", "consolidate", store=store, llm_getter=_no_llm)
        guard += 1

    assert state.status == "complete"
    assert state.current_index == 10
    assert len(state.iterations) == 10


@pytest.mark.asyncio
async def test_advance_after_complete_is_noop(store):
    state = await start_simulation(
        "StartupX", "Microsoft", session_id="s4", max_iterations=2,
        store=store, llm_getter=_no_llm,
    )
    state = await advance_simulation("s4", "consolidate", store=store, llm_getter=_no_llm)
    assert state.status == "complete"
    assert state.current_index == 2

    # Further advances must not exceed max_iterations.
    state = await advance_simulation("s4", "integrate", store=store, llm_getter=_no_llm)
    assert state.current_index == 2
    assert len(state.iterations) == 2


@pytest.mark.asyncio
async def test_advance_unknown_session_raises(store):
    with pytest.raises(ValueError):
        await advance_simulation("missing", "consolidate", store=store, llm_getter=_no_llm)


@pytest.mark.asyncio
async def test_end_simulation_marks_complete(store):
    await start_simulation(
        "StartupX", "Microsoft", session_id="s5", store=store, llm_getter=_no_llm
    )
    state = await end_simulation("s5", store=store)
    assert state is not None
    assert state.status == "complete"
