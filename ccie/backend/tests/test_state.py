import time

from state import (
    AgentActivity,
    CCIEState,
    Competitor,
    NewsItem,
    append_activity,
    default_ccie_state,
    parse_competitor,
    set_competitors,
)


def test_ccie_state_defaults():
    state = default_ccie_state()
    assert state["target_company"] == ""
    assert state["is_hypothetical"] is False
    assert state["competitors"] == []
    assert state["phase"] == "idle"
    assert state["agent_activity"] == []


def test_competitor_append():
    state = default_ccie_state()
    competitors = [Competitor(name="PayPal", description="Digital payments platform")]
    set_competitors(state, competitors)
    assert len(state["competitors"]) == 1
    assert state["competitors"][0]["name"] == "PayPal"
    assert state["competitors"][0]["status"] == "discovering"


def test_phase_transitions():
    state = default_ccie_state(phase="idle")
    state["phase"] = "classifying"
    assert state["phase"] == "classifying"
    state["phase"] = "discovering"
    state["phase"] = "analyzing"
    state["phase"] = "synthesizing"
    state["phase"] = "complete"
    assert state["phase"] == "complete"


def test_json_round_trip():
    state = default_ccie_state(
        target_company="Stripe",
        phase="analyzing",
    )
    competitors = [
        Competitor(
            name="PayPal",
            news=[NewsItem(title="PayPal news", sentiment=0.5)],
        )
    ]
    set_competitors(state, competitors)
    append_activity(state, "News Scout", "Scanning", time.time())

    restored_competitors = [parse_competitor(c) for c in state["competitors"]]
    assert state["target_company"] == "Stripe"
    assert restored_competitors[0].name == "PayPal"
    assert restored_competitors[0].news[0].title == "PayPal news"
    assert state["phase"] == "analyzing"
    assert len(state["agent_activity"]) == 1


def test_parse_competitor_from_dict():
    competitor = parse_competitor({"name": "Adyen", "threat_level": 0.7})
    assert competitor.name == "Adyen"
    assert competitor.threat_level == 0.7
