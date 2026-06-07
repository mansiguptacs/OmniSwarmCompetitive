"""Simulation evals & quality scorers (Phase 9).

Three cheap, deterministic scorers run on every iteration so we can prove the sim
holds up and surface problems instead of silently hallucinating:

- **grounding_coverage** — share of reactions that carry at least one citation.
- **persona_consistency** — do reactions match each CEO's temperament/identity?
- **plausibility** — are intensities sane and alliances real (no self/ghost allies)?

`score_iteration_quality` blends these into an `IterationQuality`; `session_quality`
aggregates across a run and reports pass/fail vs. demo thresholds.
"""

from __future__ import annotations

from simulation.schemas import (
    CompanyPersona,
    IterationQuality,
    SimulationIteration,
    SimulationState,
)

# Expected intensity band per temperament (mid-point used for consistency scoring).
_TEMPERAMENT_BAND: dict[str, tuple[float, float]] = {
    "aggressive": (0.6, 1.0),
    "acquisitive": (0.5, 0.9),
    "litigious": (0.4, 0.8),
    "partner_first": (0.2, 0.6),
    "wait_and_see": (0.0, 0.5),
}

# Pass thresholds for a "demo-ready" run.
THRESHOLDS = {
    "grounding_coverage": 0.8,
    "persona_consistency": 0.6,
    "plausibility": 0.85,
    "composite": 0.7,
}


def grounding_coverage(iteration: SimulationIteration) -> float:
    if not iteration.reactions:
        return 0.0
    grounded = sum(1 for r in iteration.reactions if r.evidence)
    return round(grounded / len(iteration.reactions), 3)


def persona_consistency(
    iteration: SimulationIteration, personas: list[CompanyPersona]
) -> tuple[float, list[str]]:
    by_name = {p.name: p for p in personas}
    if not iteration.reactions:
        return 0.0, []
    scores: list[float] = []
    flags: list[str] = []
    for r in iteration.reactions:
        persona = by_name.get(r.actor)
        if persona is None:
            scores.append(0.0)
            flags.append(f"{r.actor}: reaction from a non-roster actor")
            continue
        lo, hi = _TEMPERAMENT_BAND.get(persona.temperament, (0.0, 1.0))
        if lo <= r.intensity <= hi:
            scores.append(1.0)
        else:
            # Linear falloff outside the band.
            dist = (lo - r.intensity) if r.intensity < lo else (r.intensity - hi)
            scores.append(round(max(0.0, 1.0 - dist * 2), 3))
            if dist > 0.25:
                flags.append(
                    f"{r.actor}: intensity {r.intensity:.2f} off-character "
                    f"for '{persona.temperament}'"
                )
        if not (r.action or "").strip():
            flags.append(f"{r.actor}: empty action")
    return round(sum(scores) / len(scores), 3), flags


def plausibility(
    iteration: SimulationIteration, personas: list[CompanyPersona]
) -> tuple[float, list[str]]:
    valid = {p.name.strip().lower() for p in personas}
    if not iteration.reactions:
        return 1.0, []
    penalties = 0
    checks = 0
    flags: list[str] = []
    for r in iteration.reactions:
        checks += 1
        if not (0.0 <= r.intensity <= 1.0):
            penalties += 1
            flags.append(f"{r.actor}: intensity out of [0,1]")
        for ally in r.ally_with:
            key = ally.strip().lower()
            if key == r.actor.strip().lower():
                penalties += 1
                flags.append(f"{r.actor}: allied with itself")
            elif key and key not in valid:
                penalties += 1
                flags.append(f"{r.actor}: allied with unknown company '{ally}'")
    score = 1.0 if checks == 0 else max(0.0, 1.0 - penalties / max(checks, 1))
    return round(score, 3), flags


def score_iteration_quality(
    iteration: SimulationIteration, personas: list[CompanyPersona]
) -> IterationQuality:
    gc = grounding_coverage(iteration)
    pc, pc_flags = persona_consistency(iteration, personas)
    pl, pl_flags = plausibility(iteration, personas)
    composite = round(0.4 * gc + 0.3 * pc + 0.3 * pl, 3)
    return IterationQuality(
        grounding_coverage=gc,
        persona_consistency=pc,
        plausibility=pl,
        composite=composite,
        flags=pc_flags + pl_flags,
    )


def session_quality(state: SimulationState) -> dict:
    """Aggregate quality across a run and report pass/fail vs. thresholds."""
    per_turn = []
    for it in state.iterations:
        q = it.quality or score_iteration_quality(it, state.personas)
        per_turn.append({"index": it.index, **q.model_dump()})

    n = len(per_turn) or 1

    def _avg(key: str) -> float:
        return round(sum(t[key] for t in per_turn) / n, 3)

    aggregate = {
        "grounding_coverage": _avg("grounding_coverage"),
        "persona_consistency": _avg("persona_consistency"),
        "plausibility": _avg("plausibility"),
        "composite": _avg("composite"),
    }
    passed = all(aggregate[k] >= THRESHOLDS[k] for k in THRESHOLDS)
    all_flags = [f for t in per_turn for f in t.get("flags", [])]
    return {
        "session_id": state.session_id,
        "iterations": len(state.iterations),
        "aggregate": aggregate,
        "thresholds": THRESHOLDS,
        "passed": passed,
        "per_turn": per_turn,
        "flag_count": len(all_flags),
        "flags": all_flags[:20],
    }
