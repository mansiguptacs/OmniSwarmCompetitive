"""Load ccie/.env for P4 scripts without modifying shared config."""

from __future__ import annotations

import os
from pathlib import Path


def load_ccie_env() -> None:
    """Load key=value pairs from ccie/.env into os.environ (no overwrite)."""
    env_path = Path(__file__).resolve().parents[2] / ".env"
    if not env_path.exists():
        return

    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)
