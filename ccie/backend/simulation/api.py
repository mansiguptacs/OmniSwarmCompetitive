"""FastAPI routes that expose the war-game simulator to the frontend.

Thin transport layer over `simulation.session`. Returns the full
`SimulationState` so the UI can render the board, reactions, and decision point.
Mounted additively in `main.py`; the baseline CCIE agent is untouched.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from simulation.roster import DEFAULT_SECTOR
from simulation.schemas import SimulationState
from simulation.session import (
    advance_simulation,
    end_simulation,
    fork_simulation,
    get_replay,
    get_simulation,
    start_simulation,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sim", tags=["simulation"])


class StartRequest(BaseModel):
    target: str
    player: str
    sector: str = DEFAULT_SECTOR
    initial_move: str | None = None
    max_iterations: int = 10
    max_incumbents: int = 6


class AdvanceRequest(BaseModel):
    session_id: str
    choice: str


class ForkRequest(BaseModel):
    session_id: str
    from_index: int
    choice: str


@router.get("/health")
async def sim_health() -> dict:
    return {"status": "ok", "feature": "acquisition-war-game"}


@router.post("/start", response_model=SimulationState)
async def sim_start(req: StartRequest) -> SimulationState:
    if not req.target.strip() or not req.player.strip():
        raise HTTPException(status_code=400, detail="target and player are required")
    try:
        return await start_simulation(
            req.target.strip(),
            req.player.strip(),
            sector_id=req.sector,
            initial_move=req.initial_move,
            max_iterations=req.max_iterations,
            max_incumbents=req.max_incumbents,
        )
    except Exception as exc:
        logger.exception("sim start failed")
        raise HTTPException(status_code=500, detail=f"start failed: {exc}") from exc


@router.post("/advance", response_model=SimulationState)
async def sim_advance(req: AdvanceRequest) -> SimulationState:
    if not req.choice.strip():
        raise HTTPException(status_code=400, detail="choice is required")
    try:
        return await advance_simulation(req.session_id, req.choice.strip())
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("sim advance failed")
        raise HTTPException(status_code=500, detail=f"advance failed: {exc}") from exc


@router.post("/fork", response_model=SimulationState)
async def sim_fork(req: ForkRequest) -> SimulationState:
    if not req.choice.strip():
        raise HTTPException(status_code=400, detail="choice is required")
    try:
        return await fork_simulation(req.session_id, req.from_index, req.choice.strip())
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("sim fork failed")
        raise HTTPException(status_code=500, detail=f"fork failed: {exc}") from exc


@router.get("/state/{session_id}", response_model=SimulationState)
async def sim_state(session_id: str) -> SimulationState:
    state = await get_simulation(session_id)
    if state is None:
        raise HTTPException(status_code=404, detail="session not found")
    return state


@router.post("/end/{session_id}", response_model=SimulationState)
async def sim_end(session_id: str) -> SimulationState:
    state = await end_simulation(session_id)
    if state is None:
        raise HTTPException(status_code=404, detail="session not found")
    return state


@router.get("/replay/{session_id}")
async def sim_replay(session_id: str) -> dict:
    bundle = await get_replay(session_id)
    if bundle is None:
        raise HTTPException(status_code=404, detail="session not found")
    return bundle
