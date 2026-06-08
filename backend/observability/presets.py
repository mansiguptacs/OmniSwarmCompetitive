"""Trace scenarios and prompt-variant presets."""

from __future__ import annotations

SCENARIOS: dict[str, dict[str, str]] = {
    "stripe": {
        "label": "Real company — Stripe",
        "message": "Analyze Stripe",
    },
    "hypothetical_legal": {
        "label": "Hypothetical — AI legal document review",
        "message": (
            "I'm building an AI-powered legal document review platform "
            "targeting mid-size law firms, $50-200/month pricing"
        ),
    },
}

PROMPT_VARIANTS: dict[str, dict[str, str]] = {
    "v1_baseline": {
        "label": "Discovery v1 — baseline competitor prompt",
        "agent_role": "discovery",
        "fixture": "discovery_prompt_v1_stripe",
        "description": "Conservative discovery; targets known payment competitors.",
    },
    "v2_aggressive": {
        "label": "Discovery v2 — aggressive broad-net prompt",
        "agent_role": "discovery",
        "fixture": "discovery_prompt_v2_stripe",
        "description": "Casts wider net; may include weak/irrelevant competitors.",
    },
}

POLICY_PRESETS: dict[str, dict] = {
    "strict": {"label": "Strict — 30-day stale threshold", "stale_threshold_days": 30, "freshness_window_days": 30},
    "lenient": {"label": "Lenient — 90-day stale threshold", "stale_threshold_days": 90, "freshness_window_days": 90},
}


def get_scenario_message(name: str) -> str:
    key = name.lower().strip()
    if key not in SCENARIOS:
        raise KeyError(f"Unknown scenario {name!r}. Available: {', '.join(SCENARIOS)}")
    return SCENARIOS[key]["message"]


def list_scenarios() -> list[dict[str, str]]:
    return [{"name": k, **v} for k, v in SCENARIOS.items()]


def get_prompt_variant(name: str) -> dict[str, str]:
    key = name.lower().strip()
    if key not in PROMPT_VARIANTS:
        raise KeyError(f"Unknown prompt variant {name!r}. Available: {', '.join(PROMPT_VARIANTS)}")
    return PROMPT_VARIANTS[key]


def list_prompt_variants() -> list[dict[str, str]]:
    return [{"name": k, **v} for k, v in PROMPT_VARIANTS.items()]


get_variant = get_prompt_variant
list_variants = list_prompt_variants
