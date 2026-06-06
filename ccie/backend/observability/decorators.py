"""Thin Weave tracing shim for P1 graph nodes.

Usage (one line at integration time):

    from observability.decorators import trace_node

    @trace_node(name="classify_company")
    async def classify_node(state, config):
        ...
"""

from __future__ import annotations

import functools
import os
from collections.abc import Callable
from typing import Any, TypeVar

F = TypeVar("F", bound=Callable[..., Any])


def _weave_enabled() -> bool:
    return os.getenv("WEAVE_DISABLED", "").lower() not in ("1", "true", "yes")


def trace_node(name: str | None = None) -> Callable[[F], F]:
    """Wrap a graph node with @weave.op when Weave is enabled."""

    def decorator(fn: F) -> F:
        if not _weave_enabled():
            return fn

        try:
            import weave

            op_name = name or fn.__name__
            return weave.op(name=op_name)(fn)  # type: ignore[return-value]
        except Exception:
            return fn

    return decorator


def trace_callable(fn: F, *, name: str | None = None) -> F:
    """Apply trace_node inline without decorator syntax."""
    return trace_node(name=name)(fn)


def passthrough_trace(name: str) -> Callable[[F], F]:
    """No-op trace wrapper for tests — records name on function metadata."""

    def decorator(fn: F) -> F:
        @functools.wraps(fn)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            return await fn(*args, **kwargs)

        wrapper.__trace_name__ = name  # type: ignore[attr-defined]
        return wrapper  # type: ignore[return-value]

    return decorator
