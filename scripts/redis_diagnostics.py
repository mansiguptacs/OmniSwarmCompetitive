#!/usr/bin/env python3
"""Redis connectivity diagnostics for CCIE infrastructure.

Usage:
    python scripts/redis_diagnostics.py

Requires only the project venv (or `pip install redis`):
    source .venv/bin/activate
    python scripts/redis_diagnostics.py
"""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND_DIR))

try:
    from memory.health import run_diagnostics  # noqa: E402
except ModuleNotFoundError as exc:
    if exc.name == "redis":
        print(
            json.dumps(
                {
                    "error": "Missing dependency: redis",
                    "hint": "Run: source .venv/bin/activate && pip install -r requirements.txt",
                },
                indent=2,
            )
        )
        raise SystemExit(1) from exc
    raise


async def main() -> int:
    report = await run_diagnostics()
    print(json.dumps(report, indent=2))
    return 0 if report.get("connected") else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
