"""Write P4 run reports to observability/reports/ (gitignored by ccie/.gitignore patterns)."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPORTS_DIR = Path(__file__).resolve().parent / "reports"


def write_report(payload: dict[str, Any], *, prefix: str = "run") -> Path:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    path = REPORTS_DIR / f"{prefix}_{ts}.json"
    path.write_text(json.dumps(payload, indent=2, default=str))
    return path


def export_leaderboard_summary(leaderboard_result: dict[str, Any]) -> dict[str, Any]:
    """Slim export for reports/ — omits raw Weave eval payloads."""
    comparison = leaderboard_result.get("comparison") or {}
    return {
        "type": "policy_ab",
        "reference_date": leaderboard_result.get("reference_date"),
        "policies_compared": leaderboard_result.get("policies_compared"),
        "winner": (leaderboard_result.get("leaderboard") or {}).get("winner"),
        "composite_scores": (leaderboard_result.get("leaderboard") or {}).get("composite_scores"),
        "policy_means": {
            name: (payload.get("means") or {})
            for name, payload in comparison.items()
        },
    }
