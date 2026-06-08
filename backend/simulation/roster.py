"""Curated sector rosters for the war-game simulator.

We start with a curated "core software / big tech" roster to keep the simulation
focused, reliable, and grounded in companies with rich public data. Dynamic,
per-sector discovery is a later enhancement (see Phase 1+ in simulation_plan.md).
"""

from __future__ import annotations

from simulation.schemas import Sector

CORE_SOFTWARE = "core_software"

# Canonical incumbent rosters keyed by sector id.
SECTOR_ROSTERS: dict[str, list[str]] = {
    CORE_SOFTWARE: [
        "Microsoft",
        "Alphabet",
        "Amazon",
        "Apple",
        "Meta",
        "Nvidia",
    ],
}

SECTOR_NOTES: dict[str, str] = {
    CORE_SOFTWARE: (
        "Big-tech core software & platforms. Dynamics revolve around platform "
        "moats, talent wars, bundling, ecosystem lock-in, and regulatory scrutiny."
    ),
}

DEFAULT_SECTOR = CORE_SOFTWARE


def _norm(name: str) -> str:
    return name.strip().lower()


def list_sectors() -> list[str]:
    return list(SECTOR_ROSTERS.keys())


def get_sector(
    sector_id: str = DEFAULT_SECTOR,
    *,
    exclude: list[str] | None = None,
    max_incumbents: int = 6,
    incumbents_override: list[str] | None = None,
) -> Sector:
    """Build a `Sector` for the given id, excluding the player/target names.

    When *incumbents_override* is supplied, use that roster (e.g. CCIE-discovered
    competitors) instead of the curated sector list.
    """
    excluded = {_norm(e) for e in (exclude or []) if e}

    if incumbents_override:
        incumbents = [
            name.strip()
            for name in incumbents_override
            if name.strip() and _norm(name) not in excluded
        ][:max_incumbents]
        return Sector(
            name="discovered_competitors",
            incumbents=incumbents,
            notes="Incumbents from live competitive-intelligence analysis.",
        )

    key = sector_id if sector_id in SECTOR_ROSTERS else DEFAULT_SECTOR
    incumbents = [
        name for name in SECTOR_ROSTERS[key] if _norm(name) not in excluded
    ][:max_incumbents]

    return Sector(
        name=key,
        incumbents=incumbents,
        notes=SECTOR_NOTES.get(key, ""),
    )
