"""Load P4 fixture JSON for offline scorer development."""

from __future__ import annotations

import json
from pathlib import Path

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"

AVAILABLE_FIXTURES = (
    "stripe_news",
    "stripe_stale_news",
    "stripe_products",
    "hypothetical_legal_news",
    "stripe_hallucinated_financials",
)


def load_fixture(name: str) -> dict:
    """Load a named fixture (with or without .json suffix)."""
    stem = name.removesuffix(".json")
    for path in (
        FIXTURES_DIR / f"{stem}.json",
        FIXTURES_DIR / "baselines" / f"{stem}.json",
    ):
        if path.exists():
            return json.loads(path.read_text())
    available = ", ".join(AVAILABLE_FIXTURES)
    raise FileNotFoundError(f"Unknown fixture '{name}'. Available: {available}")
