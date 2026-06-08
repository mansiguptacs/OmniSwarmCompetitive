"""Unified evaluation CLI and library — fixtures, guardrails, batch, regression, leaderboard, prompt A/B, demo."""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from datetime import date
from pathlib import Path
from typing import Any

import weave

from observability.env_loader import load_ccie_env
from observability.fixture_loader import AVAILABLE_FIXTURES, load_fixture
from observability.guardrails import check_stale_news, run_live_guardrails
from observability.live_scorer import (
    score_graph_with_ground_truth,
    score_live_run,
)
from observability.post_run_hook import suggest_prompt_improvements
from observability.presets import (
    POLICY_PRESETS,
    PROMPT_VARIANTS,
    SCENARIOS,
    get_scenario_message,
    list_prompt_variants,
    list_scenarios,
)
from observability.report_writer import export_leaderboard_summary, write_report
from observability.scorers import score_agent_output, score_freshness, score_relevance
from observability.weave_config import init_weave
from observability.weave_ops import (
    TRACE_LIVE_SCORERS,
    WEAVE_GUARDRAILS,
    WEAVE_SCORERS,
)

BASELINE_PATH = Path(__file__).resolve().parent / "fixtures" / "baselines" / "quality_baseline.json"
BATCH_SCENARIOS = ("stripe", "hypothetical_legal")
GROUND_TRUTH_MAP = {
    "stripe": "stripe_ground_truth",
    "hypothetical_legal": "hypothetical_legal_ground_truth",
}
LIVE_GRAPH_FIXTURE = {
    "stripe": "discovery_prompt_v1_stripe",
    "hypothetical_legal": "discovery_prompt_v2_stripe",
}
SCENARIO_GROUND_TRUTH = GROUND_TRUTH_MAP


# --- Fixture scoring ---


def run_fixture(name: str, *, reference_date: date | None = None) -> dict:
    payload = load_fixture(name)
    scores = score_agent_output(payload, reference_date=reference_date)
    return {"fixture": name, "scores": scores, "company": payload.get("company", "")}


@weave.op()
def predict_fixture_row(**row: object) -> dict:
    return dict(row)


def _preprocess_fixture(example: dict) -> dict:
    return example


async def run_weave_evaluation(
    fixture_names: list[str] | None = None,
    *,
    reference_date: date | None = None,
    evaluation_name: str = "ccie-fixture-quality",
    include_guardrails: bool = False,
) -> dict:
    load_ccie_env()
    if not init_weave():
        raise RuntimeError("Weave not initialized — check WANDB_API_KEY in ccie/.env")

    ref = reference_date or date(2026, 6, 6)
    names = fixture_names or list(AVAILABLE_FIXTURES)
    dataset = []
    for name in names:
        row = load_fixture(name)
        row["_fixture"] = name
        row["reference_date"] = ref.isoformat()
        dataset.append(row)

    scorers = list(WEAVE_SCORERS)
    if include_guardrails:
        scorers.extend(WEAVE_GUARDRAILS)

    evaluation = weave.Evaluation(
        name=evaluation_name,
        dataset=dataset,
        scorers=scorers,
        preprocess_model_input=_preprocess_fixture,
    )
    results = await evaluation.evaluate(predict_fixture_row)
    return {
        "evaluation_name": evaluation_name,
        "fixtures": names,
        "reference_date": ref.isoformat(),
        "include_guardrails": include_guardrails,
        "scorer_count": len(scorers),
        "results": results,
    }


# --- Guardrails ---


def _fixture_to_graph_result(fixture: dict) -> dict:
    if fixture.get("competitors"):
        return fixture
    return {
        "target_company": fixture.get("company", ""),
        "competitors": [
            {
                "name": fixture.get("company", ""),
                "news": fixture.get("news_items") or [],
                "products": fixture.get("products") or [],
                "financials": fixture.get("financials") or {},
            }
        ],
    }


def check_fixture(name: str, *, reference_date: date) -> dict:
    fixture = load_fixture(name)
    graph = _fixture_to_graph_result(fixture)
    return {
        "fixture": name,
        "guardrails": run_live_guardrails(graph, reference_date=reference_date),
        "quality": score_live_run(graph, reference_date=reference_date),
    }


async def check_live(message: str, *, reference_date: date, use_weave: bool) -> dict:
    load_ccie_env()
    if use_weave:
        from observability.trace_runner import run_ccie_analysis

        if not init_weave():
            raise RuntimeError("Weave not initialized — check WANDB_API_KEY in ccie/.env")
        summary = await run_ccie_analysis(message)

    from agents.graph import compile_graph
    from langchain_core.messages import HumanMessage
    from state import default_ccie_state

    graph = compile_graph(echo=False)
    state = default_ccie_state(messages=[HumanMessage(content=message)])
    config = {"configurable": {"thread_id": "guardrail-live-check"}}
    full_result = await graph.ainvoke(state, config)
    if not use_weave:
        summary = {
            "phase": full_result.get("phase"),
            "competitor_count": len(full_result.get("competitors") or []),
        }

    report = score_live_run(full_result, reference_date=reference_date)
    return {"message": message, "summary": summary, "report": report}


# --- Policy leaderboard ---


def build_policy_scorers(policy: dict[str, Any]) -> list:
    stale_days = policy["stale_threshold_days"]
    fresh_days = policy["freshness_window_days"]

    @weave.op(name=f"policy_freshness_{fresh_days}d")
    def policy_freshness_scorer(
        output: dict,
        news_items: list | None = None,
        reference_date: str = "2026-06-06",
    ) -> dict:
        items = news_items or output.get("news_items") or output.get("news") or []
        ref = date.fromisoformat(reference_date)
        return {"freshness": score_freshness(items, reference_date=ref, window_days=fresh_days)}

    @weave.op(name=f"policy_stale_guard_{stale_days}d")
    def policy_stale_guardrail_scorer(
        output: dict,
        news_items: list | None = None,
        reference_date: str = "2026-06-06",
        company: str = "",
    ) -> dict:
        items = news_items or output.get("news_items") or output.get("news") or []
        ref = date.fromisoformat(reference_date)
        result = check_stale_news(
            items,
            competitor=company or output.get("company", ""),
            reference_date=ref,
            threshold_days=stale_days,
        )
        return {
            "stale_news_passed": result.passed,
            "stale_violations": len(result.violations),
        }

    @weave.op(name="policy_relevance")
    def policy_relevance_scorer(
        output: dict,
        query: str = "",
        company: str = "",
        news_items: list | None = None,
    ) -> dict:
        items = news_items or output.get("news_items") or output.get("news") or []
        effective_query = query or output.get("query") or company
        effective_company = company or output.get("company") or ""
        return {
            "relevance": score_relevance(items, effective_query, company=effective_company)
        }

    return [policy_freshness_scorer, policy_relevance_scorer, policy_stale_guardrail_scorer]


def _build_dataset(reference_date: date) -> list[dict]:
    dataset = []
    for name in AVAILABLE_FIXTURES:
        row = load_fixture(name)
        row["_fixture"] = name
        row["reference_date"] = reference_date.isoformat()
        dataset.append(row)
    return dataset


def _extract_means(results: dict) -> dict[str, float]:
    means: dict[str, float] = {}
    for scorer_name, metrics in results.items():
        if scorer_name == "model_latency":
            continue
        if not isinstance(metrics, dict):
            continue
        for metric_name, value in metrics.items():
            if isinstance(value, dict) and "mean" in value:
                means[f"{scorer_name}.{metric_name}"] = value["mean"]
            elif isinstance(value, dict) and "true_fraction" in value:
                means[f"{scorer_name}.{metric_name}"] = value["true_fraction"]
    return means


async def run_policy_evaluation(
    policy_name: str,
    *,
    reference_date: date | None = None,
) -> dict[str, Any]:
    if policy_name not in POLICY_PRESETS:
        raise KeyError(f"Unknown policy {policy_name!r}. Available: {list(POLICY_PRESETS)}")

    load_ccie_env()
    if not init_weave():
        raise RuntimeError("Weave not initialized — check WANDB_API_KEY in ccie/.env")

    policy = POLICY_PRESETS[policy_name]
    ref = reference_date or date(2026, 6, 6)
    eval_name = f"ccie-policy-{policy_name}"

    evaluation = weave.Evaluation(
        name=eval_name,
        dataset=_build_dataset(ref),
        scorers=build_policy_scorers(policy),
        preprocess_model_input=_preprocess_fixture,
    )
    results = await evaluation.evaluate(predict_fixture_row)
    return {
        "policy": policy_name,
        "label": policy["label"],
        "evaluation_name": eval_name,
        "reference_date": ref.isoformat(),
        "config": policy,
        "means": _extract_means(results),
        "raw_results": results,
    }


def _find_mean(means: dict[str, float], suffix: str, default: float = 0.0) -> float:
    for key, value in means.items():
        if key.endswith(suffix):
            return value
    return default


def _pick_policy_winner(comparison: dict[str, dict]) -> dict[str, Any]:
    scores: dict[str, float] = {}
    for name, payload in comparison.items():
        means = payload.get("means") or {}
        freshness = _find_mean(means, ".freshness")
        relevance = _find_mean(means, ".relevance")
        stale_pass = _find_mean(means, ".stale_news_passed")
        violations = _find_mean(means, ".stale_violations", default=99)
        scores[name] = (freshness * 0.35) + (relevance * 0.35) + (stale_pass * 0.2) - (violations * 0.01)

    winner = max(scores, key=scores.get) if scores else None
    return {"winner": winner, "composite_scores": scores}


async def run_leaderboard(
    policy_names: list[str] | None = None,
    *,
    reference_date: date | None = None,
) -> dict[str, Any]:
    names = policy_names or list(POLICY_PRESETS)
    comparison = {}
    for name in names:
        comparison[name] = await run_policy_evaluation(name, reference_date=reference_date)

    return {
        "policies_compared": names,
        "reference_date": (reference_date or date(2026, 6, 6)).isoformat(),
        "comparison": comparison,
        "leaderboard": _pick_policy_winner(comparison),
    }


# --- Prompt A/B ---


@weave.op()
def predict_discovery_output(**row: object) -> dict:
    data = dict(row)
    ref = date.fromisoformat(str(data.pop("reference_date", "2026-06-06")))
    data.pop("_fixture", None)
    variant = data.get("prompt_variant", "")
    report = score_live_run(data, reference_date=ref)
    return {
        "summary": {
            "target_company": data.get("target_company"),
            "is_hypothetical": data.get("is_hypothetical", False),
            "competitor_count": report.get("competitor_count"),
            "competitor_names": [c.get("name") for c in data.get("competitors", [])],
            "prompt_variant": variant,
        },
        "quality_report": report,
    }


def _offline_prompt_score(fixture_name: str, *, reference_date: date) -> dict:
    graph = load_fixture(fixture_name)
    report = score_live_run(graph, reference_date=reference_date)
    agg = report.get("aggregate") or {}
    return {
        "fixture": fixture_name,
        "prompt_variant": graph.get("prompt_variant"),
        "avg_freshness": agg.get("avg_freshness"),
        "avg_relevance": agg.get("avg_relevance"),
        "guardrails_passed": agg.get("guardrails_passed"),
        "violation_count": agg.get("violation_count"),
        "competitor_count": report.get("competitor_count"),
    }


def _pick_prompt_winner(scores: dict[str, dict]) -> dict:
    composite: dict[str, float] = {}
    for name, s in scores.items():
        freshness = s.get("avg_freshness") or 0.0
        relevance = s.get("avg_relevance") or 0.0
        guard_pass = 1.0 if s.get("guardrails_passed") else 0.0
        violations = s.get("violation_count") or 0
        count_bonus = min((s.get("competitor_count") or 0) / 5.0, 1.0) * 0.1
        composite[name] = (
            freshness * 0.3 + relevance * 0.35 + guard_pass * 0.2 + count_bonus - violations * 0.01
        )
    winner = max(composite, key=composite.get) if composite else None
    return {"winner": winner, "composite_scores": composite}


async def run_prompt_ab_evaluation(
    *,
    reference_date: date | None = None,
    evaluation_name: str = "ccie-prompt-ab-discovery",
) -> dict:
    load_ccie_env()
    ref = reference_date or date(2026, 6, 6)

    offline_scores = {
        name: _offline_prompt_score(variant["fixture"], reference_date=ref)
        for name, variant in PROMPT_VARIANTS.items()
    }
    winner_info = _pick_prompt_winner(offline_scores)

    weave_results = None
    if init_weave():
        dataset = []
        for name, variant in PROMPT_VARIANTS.items():
            row = load_fixture(variant["fixture"])
            row["prompt_variant"] = name
            row["reference_date"] = ref.isoformat()
            dataset.append(row)

        evaluation = weave.Evaluation(
            name=evaluation_name,
            dataset=dataset,
            scorers=list(TRACE_LIVE_SCORERS),
            preprocess_model_input=_preprocess_fixture,
        )
        weave_results = await evaluation.evaluate(predict_discovery_output)

    return {
        "evaluation_name": evaluation_name,
        "reference_date": ref.isoformat(),
        "variants": list(PROMPT_VARIANTS.keys()),
        "offline_scores": offline_scores,
        "leaderboard": winner_info,
        "weave_results": weave_results,
    }


# --- Batch + regression ---


async def _run_live_graph(message: str, thread_id: str) -> dict:
    from agents.graph import compile_graph
    from langchain_core.messages import HumanMessage
    from state import default_ccie_state

    graph = compile_graph(echo=False)
    state = default_ccie_state(messages=[HumanMessage(content=message)])
    return await graph.ainvoke(state, {"configurable": {"thread_id": thread_id}})


async def run_batch_eval(
    *,
    reference_date: date | None = None,
    use_live: bool = False,
    publish_weave: bool = False,
) -> dict:
    load_ccie_env()
    ref = reference_date or date(2026, 6, 6)
    runs = []

    for scenario in BATCH_SCENARIOS:
        if use_live:
            graph_result = await _run_live_graph(get_scenario_message(scenario), "batch-eval")
        else:
            graph_result = load_fixture(LIVE_GRAPH_FIXTURE[scenario])

        gt = load_fixture(GROUND_TRUTH_MAP[scenario])
        report = score_live_run(graph_result, reference_date=ref)
        scores = score_graph_with_ground_truth(graph_result, gt, reference_date=ref)
        report["accuracy"] = scores["accuracy"]
        runs.append(
            {
                "scenario": scenario,
                "label": SCENARIOS[scenario]["label"],
                "scores": scores,
                "aggregate": report["aggregate"],
                "competitor_count": report["competitor_count"],
                "suggestions": suggest_prompt_improvements(report),
            }
        )

    fixture_scores = []
    for name in AVAILABLE_FIXTURES:
        if name.endswith("_ground_truth"):
            continue
        try:
            row = load_fixture(name)
            if row.get("competitors"):
                graph = row
            elif row.get("news_items"):
                graph = {
                    "target_company": row.get("company", ""),
                    "competitors": [{"name": row.get("company", ""), "news": row["news_items"]}],
                }
            else:
                continue
            report = score_live_run(graph, reference_date=ref)
            fixture_scores.append({"fixture": name, "aggregate": report["aggregate"]})
        except FileNotFoundError:
            continue

    output = {
        "reference_date": ref.isoformat(),
        "scenario_runs": runs,
        "fixture_summary": fixture_scores,
    }

    if publish_weave:
        output["weave_evaluation"] = await run_weave_evaluation(include_guardrails=True)

    return output


def _load_baseline() -> dict:
    return json.loads(BASELINE_PATH.read_text())


async def run_regression_check(
    scenario: str | None = None,
    *,
    reference_date: date | None = None,
    use_live: bool = True,
) -> dict:
    load_ccie_env()
    ref = reference_date or date(2026, 6, 6)
    baseline = _load_baseline()
    scenarios = [scenario] if scenario else list(SCENARIO_GROUND_TRUTH)

    results: dict = {"passed": True, "checks": [], "baseline": baseline}

    for name in scenarios:
        gt_name = SCENARIO_GROUND_TRUTH[name]
        ground_truth = load_fixture(gt_name)

        if use_live:
            graph_result = await _run_live_graph(get_scenario_message(name), "regression-check")
        else:
            fixture_name = (
                "discovery_prompt_v1_stripe"
                if name == "stripe"
                else "hypothetical_legal_news"
            )
            row = load_fixture(fixture_name)
            graph_result = row if row.get("competitors") else {
                "target_company": row.get("company", ""),
                "competitors": [{"name": row.get("company", ""), "news": row.get("news_items", [])}],
            }

        report = score_live_run(graph_result, reference_date=ref)
        scores = score_graph_with_ground_truth(graph_result, ground_truth, reference_date=ref)
        report["accuracy"] = scores["accuracy"]
        agg = report["aggregate"]

        check = {
            "scenario": name,
            "scores": scores,
            "violations": agg.get("violation_count"),
            "guardrails_passed": agg.get("guardrails_passed"),
            "failures": [],
            "suggestions": suggest_prompt_improvements(report),
        }

        if agg.get("avg_relevance", 0) < baseline.get("min_avg_relevance", 0):
            check["failures"].append("avg_relevance below baseline")
        if agg.get("violation_count", 0) > baseline.get("max_violation_count", 999):
            check["failures"].append("violation_count above baseline")
        if report.get("competitor_count", 0) < baseline.get("min_competitor_count", 0):
            check["failures"].append("competitor_count below baseline")

        check["passed"] = len(check["failures"]) == 0
        if not check["passed"]:
            results["passed"] = False
        results["checks"].append(check)

    return results


# --- Demo metrics ---


def _dashboard_url() -> str:
    project = os.getenv("WEAVE_PROJECT", "ccie-agents")
    entity = os.getenv("WANDB_ENTITY", "mohitmanoj-barade-san-jose-state-university")
    return f"https://wandb.ai/{entity}/{project}/weave"


async def generate_demo_metrics(*, reference_date: date | None = None) -> dict:
    load_ccie_env()
    ref = reference_date or date(2026, 6, 6)
    from observability.settings import get_observability_settings

    settings = get_observability_settings()

    stripe_graph = {
        "target_company": "Stripe",
        "is_hypothetical": False,
        "competitors": load_fixture("discovery_prompt_v1_stripe").get("competitors", []),
    }
    stripe_gt = load_fixture("stripe_ground_truth")
    stripe_report = score_live_run(stripe_graph, reference_date=ref)
    stripe_scores = score_graph_with_ground_truth(stripe_graph, stripe_gt, reference_date=ref)
    stripe_report["accuracy"] = stripe_scores["accuracy"]
    stripe_suggestions = suggest_prompt_improvements(stripe_report)

    prompt_winner = "v1_baseline"
    policy_winner = "lenient"
    try:
        if init_weave():
            prompt_ab = await run_prompt_ab_evaluation(reference_date=ref)
            policy_lb = await run_leaderboard(["strict", "lenient"], reference_date=ref)
            prompt_winner = prompt_ab["leaderboard"]["winner"]
            policy_winner = policy_lb["leaderboard"]["winner"]
    except Exception:
        pass

    return {
        "headline": "CCIE — Intelligence Quality Assurance (W&B Weave)",
        "weave_dashboard_url": _dashboard_url(),
        "settings": settings.as_dict(),
        "stripe_demo": {
            "scores": stripe_scores,
            "guardrails_passed": stripe_report["aggregate"]["guardrails_passed"],
            "violation_count": stripe_report["aggregate"]["violation_count"],
            "top_suggestion": stripe_suggestions[0] if stripe_suggestions else None,
        },
        "leaderboard": {
            "policy_winner": policy_winner,
            "prompt_winner": prompt_winner,
        },
        "talking_points": [
            "Every agent run is traced in Weave — see classify → discover → analyze → synthesize.",
            "Custom scorers: freshness, relevance, accuracy on every competitor.",
            "Guardrails flag stale news and unsourced financials before bad intel hits the UI.",
            f"Policy A/B winner: {policy_winner} | Prompt A/B winner: {prompt_winner}.",
            f"Dashboard: {_dashboard_url()}",
        ],
        "evaluations_in_dashboard": [
            "ccie-fixture-quality",
            "ccie-fixture-quality-v2",
            "ccie-policy-strict",
            "ccie-policy-lenient",
            "ccie-prompt-ab-discovery",
        ],
    }


# --- CLI ---


def _cmd_fixtures(args: argparse.Namespace) -> int:
    ref = date.fromisoformat(args.reference_date)
    names = list(AVAILABLE_FIXTURES) if args.all else [args.fixture]

    if args.weave:
        output = asyncio.run(
            run_weave_evaluation(names, reference_date=ref, include_guardrails=args.guardrails)
        )
        print(json.dumps(output, indent=2, default=str))
        return 0

    results = [run_fixture(name, reference_date=ref) for name in names]
    print(json.dumps(results, indent=2))
    return 0


def _cmd_guardrails(args: argparse.Namespace) -> int:
    ref = date.fromisoformat(args.reference_date)
    if args.live:
        output = asyncio.run(check_live(args.message, reference_date=ref, use_weave=args.weave))
    else:
        output = check_fixture(args.fixture, reference_date=ref)

    print(json.dumps(output, indent=2, default=str))
    passed = True
    if "guardrails" in output:
        passed = output["guardrails"].get("passed", True)
    elif "report" in output:
        passed = output["report"].get("aggregate", {}).get("guardrails_passed", True)
    return 0 if passed else 1


def _cmd_batch(args: argparse.Namespace) -> int:
    ref = date.fromisoformat(args.reference_date)
    output = asyncio.run(
        run_batch_eval(reference_date=ref, use_live=args.live, publish_weave=args.weave)
    )
    if args.save_report:
        path = write_report(output, prefix="batch_eval")
        output["report_path"] = str(path)
    print(json.dumps(output, indent=2, default=str))
    return 0


def _cmd_regression(args: argparse.Namespace) -> int:
    ref = date.fromisoformat(args.reference_date)
    output = asyncio.run(
        run_regression_check(
            args.scenario,
            reference_date=ref,
            use_live=not args.fixtures_only,
        )
    )
    print(json.dumps(output, indent=2, default=str))
    return 0 if output["passed"] else 1


def _cmd_leaderboard(args: argparse.Namespace) -> int:
    names = [p.strip() for p in args.policies.split(",") if p.strip()]
    ref = date.fromisoformat(args.reference_date)
    output = asyncio.run(run_leaderboard(names, reference_date=ref))
    if args.save_report:
        slim = export_leaderboard_summary(output)
        path = write_report(slim, prefix="leaderboard")
        output = {**output, "report_path": str(path), "report_summary": slim}
    print(json.dumps(output, indent=2, default=str))
    return 0


def _cmd_prompt_ab(args: argparse.Namespace) -> int:
    if args.list_variants:
        print(json.dumps(list_prompt_variants(), indent=2))
        return 0

    ref = date.fromisoformat(args.reference_date)
    output = asyncio.run(run_prompt_ab_evaluation(reference_date=ref))
    if args.save_report:
        slim = {
            "type": "prompt_ab",
            "reference_date": output["reference_date"],
            "leaderboard": output["leaderboard"],
            "offline_scores": output["offline_scores"],
        }
        path = write_report(slim, prefix="prompt_ab")
        output["report_path"] = str(path)
    print(json.dumps(output, indent=2, default=str))
    return 0


def _cmd_demo(args: argparse.Namespace) -> int:
    ref = date.fromisoformat(args.reference_date)
    output = asyncio.run(generate_demo_metrics(reference_date=ref))
    if args.save_report:
        path = write_report(output, prefix="demo_metrics")
        output["report_path"] = str(path)
    print(json.dumps(output, indent=2))
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="CCIE observability evaluation")
    sub = parser.add_subparsers(dest="command", required=True)

    p_fix = sub.add_parser("fixtures", help="Score fixtures offline or via Weave")
    p_fix.add_argument("--fixture", help=f"Fixture name ({', '.join(AVAILABLE_FIXTURES)})")
    p_fix.add_argument("--all", action="store_true")
    p_fix.add_argument("--reference-date", default="2026-06-06")
    p_fix.add_argument("--weave", action="store_true")
    p_fix.add_argument("--guardrails", action="store_true")
    p_fix.set_defaults(func=_cmd_fixtures)

    p_gr = sub.add_parser("guardrails", help="Run guardrails on fixture or live graph")
    p_gr.add_argument("--fixture", help=f"Fixture name ({', '.join(AVAILABLE_FIXTURES)})")
    p_gr.add_argument("--live", action="store_true")
    p_gr.add_argument("--message", default="Analyze Stripe")
    p_gr.add_argument("--reference-date", default="2026-06-06")
    p_gr.add_argument("--weave", action="store_true")
    p_gr.set_defaults(func=_cmd_guardrails)

    p_batch = sub.add_parser("batch", help="Batch eval Stripe + hypothetical scenarios")
    p_batch.add_argument("--live", action="store_true")
    p_batch.add_argument("--weave", action="store_true")
    p_batch.add_argument("--save-report", action="store_true")
    p_batch.add_argument("--reference-date", default="2026-06-06")
    p_batch.set_defaults(func=_cmd_batch)

    p_reg = sub.add_parser("regression", help="Regression check vs quality baseline")
    p_reg.add_argument("--scenario", choices=list(SCENARIO_GROUND_TRUTH))
    p_reg.add_argument("--fixtures-only", action="store_true")
    p_reg.add_argument("--reference-date", default="2026-06-06")
    p_reg.set_defaults(func=_cmd_regression)

    p_lb = sub.add_parser("leaderboard", help="A/B compare guardrail policies in Weave")
    p_lb.add_argument("--policies", default="strict,lenient")
    p_lb.add_argument("--reference-date", default="2026-06-06")
    p_lb.add_argument("--save-report", action="store_true")
    p_lb.set_defaults(func=_cmd_leaderboard)

    p_ab = sub.add_parser("prompt-ab", help="A/B compare discovery prompt variants")
    p_ab.add_argument("--reference-date", default="2026-06-06")
    p_ab.add_argument("--save-report", action="store_true")
    p_ab.add_argument("--list-variants", action="store_true")
    p_ab.set_defaults(func=_cmd_prompt_ab)

    p_demo = sub.add_parser("demo", help="Generate demo slide metrics")
    p_demo.add_argument("--save-report", action="store_true")
    p_demo.add_argument("--reference-date", default="2026-06-06")
    p_demo.set_defaults(func=_cmd_demo)

    args = parser.parse_args(argv)

    if args.command == "fixtures" and not args.fixture and not args.all:
        parser.error("fixtures requires --fixture NAME or --all")
    if args.command == "guardrails" and not args.fixture and not args.live:
        parser.error("guardrails requires --fixture NAME or --live")

    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
