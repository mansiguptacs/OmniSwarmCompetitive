"""Phase 5 tests: FastAPI simulation router (offline, isolated app)."""

import fakeredis
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from llm import factory as llm_factory
from simulation.api import router
from simulation.store import SimulationStore, reset_sim_store, set_sim_store


@pytest.fixture
def client(monkeypatch):
    # Force heuristic (no LLM) + an isolated fake Redis store.
    monkeypatch.setattr(llm_factory, "get_llm", lambda: None)
    set_sim_store(SimulationStore(client=fakeredis.FakeAsyncRedis(decode_responses=True)))

    app = FastAPI()
    app.include_router(router)
    yield TestClient(app)

    reset_sim_store()


def test_health(client):
    r = client.get("/api/sim/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_start_then_state_then_advance(client):
    r = client.post("/api/sim/start", json={"target": "StartupX", "player": "Microsoft"})
    assert r.status_code == 200, r.text
    state = r.json()
    sid = state["session_id"]
    assert state["status"] == "awaiting_choice"
    assert state["current_index"] == 1
    assert len(state["iterations"]) == 1
    assert "Microsoft" not in {p["name"] for p in state["personas"]}

    # Fetch state back.
    r2 = client.get(f"/api/sim/state/{sid}")
    assert r2.status_code == 200
    assert r2.json()["session_id"] == sid

    # Advance with the first option.
    option_id = state["iterations"][0]["decision_point"]["options"][0]["id"]
    r3 = client.post("/api/sim/advance", json={"session_id": sid, "choice": option_id})
    assert r3.status_code == 200, r3.text
    assert r3.json()["current_index"] == 2


def test_start_validation(client):
    r = client.post("/api/sim/start", json={"target": "", "player": "Microsoft"})
    assert r.status_code == 400


def test_advance_unknown_session(client):
    r = client.post("/api/sim/advance", json={"session_id": "nope", "choice": "x"})
    assert r.status_code == 404


def test_state_unknown_session(client):
    r = client.get("/api/sim/state/nope")
    assert r.status_code == 404


def test_end_session(client):
    started = client.post(
        "/api/sim/start", json={"target": "StartupX", "player": "Microsoft"}
    ).json()
    sid = started["session_id"]
    r = client.post(f"/api/sim/end/{sid}")
    assert r.status_code == 200
    assert r.json()["status"] == "complete"
