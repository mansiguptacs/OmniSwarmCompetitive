"""Acquisition War-Game Simulator.

Forward-looking, multi-agent M&A simulation built additively on top of the CCIE
baseline. Each incumbent is an autonomous CEO-agent (a digital twin grounded in
public data); the user war-games an acquisition across up to 10 branching
iterations. See `simulation_plan.md` at the repo root for the full design.

This package is intentionally isolated from the live `agents/` orchestrator so the
existing competitive-intelligence baseline keeps working unchanged.
"""
