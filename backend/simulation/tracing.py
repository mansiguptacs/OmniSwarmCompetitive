"""Best-effort W&B Weave tracing for the war-game (Phase 8).

Each iteration emits a Weave-traced op whose output is the structured reasoning
(per-CEO decisions + referee adjudication). We capture the call's id and UI URL so
the replay can deep-link "why" a decision happened, while Redis (the ledger) holds
the canonical "what".

Everything here is best-effort: if Weave isn't configured (no WANDB_API_KEY, or
WEAVE_DISABLED), the helpers return empty strings and the simulation is unaffected.
This keeps tests fully offline.
"""

from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)


def _tracing_allowed() -> bool:
    """Disable tracing in tests (and when explicitly turned off)."""
    if os.getenv("ENV", "").lower() == "test":
        return False
    if os.getenv("WEAVE_DISABLED", "").lower() in ("1", "true", "yes"):
        return False
    return True

_OPS_READY = False
_trace_reasoning_op = None
_trace_adjudication_op = None


def _ensure_ops() -> bool:
    """Lazily define the Weave ops once tracing is active. Returns readiness."""
    global _OPS_READY, _trace_reasoning_op, _trace_adjudication_op
    if _OPS_READY:
        return True
    if not _tracing_allowed():
        return False
    try:
        from observability.weave_config import init_weave

        if not init_weave():
            return False
        import weave

        @weave.op(name="sim_iteration_reasoning")
        def _reasoning(payload: dict) -> dict:  # noqa: ANN001
            return payload

        @weave.op(name="sim_referee_adjudication")
        def _adjudication(payload: dict) -> dict:  # noqa: ANN001
            return payload

        _trace_reasoning_op = _reasoning
        _trace_adjudication_op = _adjudication
        _OPS_READY = True
        return True
    except Exception:
        logger.debug("Weave tracing unavailable", exc_info=True)
        return False


def _invoke(op, payload: dict) -> tuple[str, str]:
    try:
        raw = op.call(payload)
        # weave op.call returns (result, call)
        if isinstance(raw, tuple) and len(raw) == 2:
            _, call = raw
        else:
            call = raw
        trace_id = str(getattr(call, "id", "") or "")
        url = str(getattr(call, "ui_url", "") or "")
        return trace_id, url
    except Exception:
        logger.debug("Weave trace call failed", exc_info=True)
        return "", ""


def trace_reasoning(payload: dict) -> tuple[str, str]:
    """Trace one iteration's CEO reasoning. Returns (trace_id, ui_url) or ('','')."""
    if not _ensure_ops():
        return "", ""
    return _invoke(_trace_reasoning_op, payload)


def trace_adjudication(payload: dict) -> tuple[str, str]:
    """Trace the referee adjudication. Returns (trace_id, ui_url) or ('','')."""
    if not _ensure_ops():
        return "", ""
    return _invoke(_trace_adjudication_op, payload)


def weave_project_url() -> str:
    """Best-effort link to the Weave project dashboard (or '')."""
    if not _tracing_allowed():
        return ""
    try:
        from observability.weave_config import init_weave

        if not init_weave():
            return ""
        from config import get_settings

        project = get_settings().WEAVE_PROJECT
        return f"https://wandb.ai/home (project: {project})" if project else ""
    except Exception:
        return ""
