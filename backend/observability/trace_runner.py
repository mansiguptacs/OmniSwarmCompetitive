"""Run CCIE LangGraph with W&B Weave tracing (P4-owned entry point).

Usage:
    cd ccie/backend
    python -m observability.trace_runner
    python -m observability.trace_runner --scenario stripe --score --apply-scorers
    python -m observability.trace_runner --scenario hypothetical_legal --score --apply-scorers
    python -m observability.trace_runner --all-scenarios --score --apply-scorers --save-report
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import uuid
from typing import Any

import weave
from langchain_core.messages import HumanMessage
from weave.integrations.langchain import WeaveTracer

from observability.env_loader import load_ccie_env
from observability.live_scorer import score_live_run
from observability.presets import SCENARIOS, get_scenario_message, list_scenarios
from observability.report_writer import write_report
from observability.weave_config import init_weave
from observability.weave_ops import apply_trace_scorers


def _summarize_result(result: dict) -> dict:
    competitors = result.get("competitors") or []
    return {
        "phase": result.get("phase"),
        "target_company": result.get("target_company"),
        "is_hypothetical": result.get("is_hypothetical"),
        "competitor_count": len(competitors),
        "competitor_names": [c.get("name") for c in competitors],
        "landscape_summary": result.get("landscape_summary", "")[:200],
        "session_id": result.get("session_id"),
    }


async def _invoke_graph(user_message: str, thread_id: str | None = None) -> dict:
    from agents.graph import compile_graph
    from state import default_ccie_state

    graph = compile_graph(echo=False)
    state = default_ccie_state(messages=[HumanMessage(content=user_message)])
    tid = thread_id or f"weave-{uuid.uuid4().hex[:8]}"
    config = {
        "configurable": {"thread_id": tid},
        "callbacks": [WeaveTracer()],
    }
    return await graph.ainvoke(state, config)


@weave.op()
async def run_ccie_analysis(user_message: str, thread_id: str | None = None) -> dict:
    """Top-level traced op: full CCIE orchestrator run."""
    result = await _invoke_graph(user_message, thread_id)
    return _summarize_result(result)


@weave.op()
async def run_ccie_analysis_scored(user_message: str, thread_id: str | None = None) -> dict:
    """Traced op returning summary + live quality/guardrail report."""
    result = await _invoke_graph(user_message, thread_id)
    return {
        "summary": _summarize_result(result),
        "quality_report": score_live_run(result),
    }


async def _run_scored_with_call(
    message: str,
    *,
    apply_scorers: bool,
) -> tuple[dict, str | None, dict[str, Any] | None]:
    """Invoke scored op via .call() to obtain Call object for dashboard scorers."""
    raw = run_ccie_analysis_scored.call(message)
    output, call = await raw
    trace_call_id = str(call.id)
    weave_scores = await apply_trace_scorers(call) if apply_scorers else None
    return output, trace_call_id, weave_scores


async def _run_one(
    message: str,
    *,
    score: bool,
    apply_scorers: bool,
    weave_active: bool,
) -> dict:
    weave_scores = None
    trace_call_id = None

    if score:
        if weave_active and apply_scorers:
            output, trace_call_id, weave_scores = await _run_scored_with_call(
                message, apply_scorers=True
            )
            payload = output
        elif weave_active:
            payload = await run_ccie_analysis_scored(message)
        else:
            result = await _invoke_graph(message)
            payload = {
                "summary": _summarize_result(result),
                "quality_report": score_live_run(result),
            }
    else:
        if not weave_active:
            raise RuntimeError(
                "Weave not initialized. Set WANDB_API_KEY in ccie/.env or export it."
            )
        payload = {"summary": await run_ccie_analysis(message)}

    if trace_call_id is None:
        try:
            current = weave.require_current_call()
            trace_call_id = str(current.id)
        except Exception:
            pass

    result: dict = {
        **payload,
        "trace_call_id": trace_call_id,
        "weave_ui_hint": "Open your W&B project Weave tab → click trace → Scores tab.",
    }
    if weave_scores is not None:
        result["weave_scores"] = weave_scores
    return result


async def _main_async(
    message: str,
    *,
    score: bool,
    apply_scorers: bool,
    scenario: str | None,
    all_scenarios: bool,
    save_report: bool,
) -> dict | list[dict]:
    load_ccie_env()
    weave_active = init_weave()

    if all_scenarios:
        runs = []
        for name in SCENARIOS:
            msg = get_scenario_message(name)
            run_result = await _run_one(
                msg,
                score=score or apply_scorers,
                apply_scorers=apply_scorers,
                weave_active=weave_active,
            )
            runs.append({"scenario": name, **run_result})
        payload: dict | list[dict] = {"runs": runs}
        if save_report:
            path = write_report(payload, prefix="all_scenarios")
            payload = {"report_path": str(path), **payload}  # type: ignore[assignment]
        return payload

    effective_message = get_scenario_message(scenario) if scenario else message
    run_result = await _run_one(
        effective_message,
        score=score or apply_scorers,
        apply_scorers=apply_scorers,
        weave_active=weave_active,
    )
    payload = {"scenario": scenario or "custom", "message": effective_message, **run_result}
    if save_report:
        prefix = scenario or "custom"
        path = write_report(payload, prefix=prefix)
        payload["report_path"] = str(path)
    return payload


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run CCIE with Weave tracing")
    parser.add_argument(
        "--message",
        default="Analyze Stripe",
        help="Custom user message (ignored when --scenario or --all-scenarios is set)",
    )
    parser.add_argument(
        "--scenario",
        choices=list(SCENARIOS),
        help=f"Preset scenario ({', '.join(SCENARIOS)})",
    )
    parser.add_argument(
        "--all-scenarios",
        action="store_true",
        help="Run all preset scenarios (stripe + hypothetical_legal)",
    )
    parser.add_argument(
        "--score",
        action="store_true",
        help="Include quality_report in output",
    )
    parser.add_argument(
        "--apply-scorers",
        action="store_true",
        help="Attach Weave scorers to trace call (shows in dashboard Scores tab)",
    )
    parser.add_argument(
        "--save-report",
        action="store_true",
        help="Write JSON report to observability/reports/",
    )
    parser.add_argument(
        "--list-scenarios",
        action="store_true",
        help="Print preset scenarios and exit",
    )
    args = parser.parse_args(argv)

    if args.list_scenarios:
        print(json.dumps(list_scenarios(), indent=2))
        return 0

    output = asyncio.run(
        _main_async(
            args.message,
            score=args.score,
            apply_scorers=args.apply_scorers,
            scenario=args.scenario,
            all_scenarios=args.all_scenarios,
            save_report=args.save_report,
        )
    )
    print(json.dumps(output, indent=2, default=str))
    return 0


if __name__ == "__main__":
    sys.exit(main())
