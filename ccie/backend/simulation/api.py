"""FastAPI routes that expose the M&A scenario analysis simulator to the frontend.

Thin transport layer over `simulation.session`. Returns the full
`SimulationState` so the UI can render the board, reactions, and decision point.
Mounted additively in `main.py`; the baseline CCIE agent is untouched.
"""

from __future__ import annotations

import json
import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from simulation.roster import DEFAULT_SECTOR
from simulation.schemas import SimulationState
from simulation.session import (
    advance_simulation,
    advance_simulation_stream,
    end_simulation,
    fork_simulation,
    get_evals,
    get_replay,
    get_simulation,
    start_simulation,
    start_simulation_stream,
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
    seed: int | None = None


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
            seed=req.seed,
        )
    except Exception as exc:
        logger.exception("sim start failed")
        raise HTTPException(status_code=500, detail=f"start failed: {exc}") from exc


@router.post("/start/stream")
async def sim_start_stream(req: StartRequest):
    """SSE endpoint — streams progress events during simulation start."""
    if not req.target.strip() or not req.player.strip():
        raise HTTPException(status_code=400, detail="target and player are required")

    async def _generate():
        try:
            async for event in start_simulation_stream(
                req.target.strip(),
                req.player.strip(),
                sector_id=req.sector,
                initial_move=req.initial_move,
                max_iterations=req.max_iterations,
                max_incumbents=req.max_incumbents,
                seed=req.seed,
            ):
                yield f"data: {json.dumps(event, default=str)}\n\n"
        except Exception as exc:
            logger.exception("sim start stream failed")
            yield f"data: {json.dumps({'kind': 'error', 'name': None, 'data': str(exc)})}\n\n"

    return StreamingResponse(_generate(), media_type="text/event-stream")


@router.post("/advance/stream")
async def sim_advance_stream(req: AdvanceRequest):
    """SSE endpoint — streams progress events during simulation advance."""
    if not req.choice.strip():
        raise HTTPException(status_code=400, detail="choice is required")

    async def _generate():
        try:
            async for event in advance_simulation_stream(
                req.session_id, req.choice.strip()
            ):
                yield f"data: {json.dumps(event, default=str)}\n\n"
        except ValueError as exc:
            yield f"data: {json.dumps({'kind': 'error', 'name': None, 'data': str(exc)})}\n\n"
        except Exception as exc:
            logger.exception("sim advance stream failed")
            yield f"data: {json.dumps({'kind': 'error', 'name': None, 'data': str(exc)})}\n\n"

    return StreamingResponse(_generate(), media_type="text/event-stream")


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


@router.get("/evals/{session_id}")
async def sim_evals(session_id: str) -> dict:
    report = await get_evals(session_id)
    if report is None:
        raise HTTPException(status_code=404, detail="session not found")
    return report
