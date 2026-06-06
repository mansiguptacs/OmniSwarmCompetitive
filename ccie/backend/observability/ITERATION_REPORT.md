# P4 Observability — Iteration Report

> **Consolidated (Jun 2026):** Folder reduced from ~40 modules to ~18. Old CLIs merged into `eval.py`; Weave ops merged into `weave_ops.py`; activity feed + prompt optimizer merged into `post_run_hook.py`; P1/P2/P3 docs merged into `INTEGRATION.md`. See `README.md` for current commands.

---

> **Owner:** Person 4 (Observability Engineer)  
> **Scope:** All P4 code lives in `ccie/backend/observability/` only — no edits outside this folder.  
> **Tool:** [W&B Weave](https://docs.wandb.ai/weave)

This file is the single progress report. Each iteration adds a section below.

---

## Iteration 1 — Fixtures + Pure Scorers

**Date:** 2026-06-06  
**Status:** ✅ Complete  
**Goal:** Build quality scorers offline against fixture JSON while P1 builds agents.

### Deliverables

| File | Purpose |
|---|---|
| `fixtures/stripe_news.json` | Fresh news (May 2026) — high freshness score |
| `fixtures/stripe_stale_news.json` | 2023–2024 dates — guardrail test case |
| `fixtures/stripe_products.json` | Product/pricing completeness |
| `fixtures/hypothetical_legal_news.json` | Legal-tech hypothetical mode |
| `scorers.py` | Pure functions: freshness, relevance, product coverage |
| `decorators.py` | `@trace_node` shim for P1 integration (Hour 7) |
| `fixture_loader.py` | `load_fixture("stripe_news")` |
| `eval_harness.py` | Offline CLI scorer runner |
| `weave_config.py` | Graceful Weave init; skips when key missing |

### Results (offline, reference date 2026-06-06)

| Fixture | freshness | relevance | product_coverage |
|---|---|---|---|
| stripe_news | 1.0 | 1.0 | — |
| stripe_stale_news | 0.0 | 1.0 | — |
| stripe_products | — | — | 1.0 |
| hypothetical_legal_news | 1.0 | 0.67 | — |

### Commands

```bash
cd ccie/backend
python -m observability.eval_harness --all
pytest observability/tests -v   # P4-owned tests
```

### Notes for other teammates

- P1 can add `@trace_node(name="...")` from `decorators.py` when ready — one line per node.
- Scorers accept any dict matching fixture shape; no LangGraph dependency.

---

## Iteration 2 — Live Weave Tracing + Evaluation

**Date:** 2026-06-06  
**Status:** ✅ Complete  
**Goal:** Verify live traces in W&B dashboard; publish fixture eval to Weave leaderboard.

### Deliverables

| File | Purpose |
|---|---|
| `env_loader.py` | Loads `ccie/.env` for P4 scripts (no shared config changes) |
| `trace_runner.py` | Runs full CCIE graph with `WeaveTracer` + `@weave.op` wrapper |
| `weave_scorers.py` | `@weave.op` scorers for Weave Evaluation API |
| `weave_eval.py` | Publishes fixture dataset + scorers to Weave leaderboard |
| `tests/test_scorers.py` | P4-owned unit tests (inside observability/) |
| `ITERATION_REPORT.md` | This file — single progress report for all iterations |

### Commands

```bash
cd ccie/backend

# Full Stripe run → trace in W&B dashboard
python -m observability.trace_runner --message "Analyze Stripe"

# Publish fixture quality scores to Weave Evaluation
python -m observability.eval_harness --all --weave
# or: python -m observability.weave_eval
```

### Live results

**Stripe trace run** (`trace_runner --message "Analyze Stripe"`):

| Field | Value |
|---|---|
| phase | `complete` |
| target_company | Stripe |
| competitor_count | 3 (PayPal, Adyen, Square) |
| session_id | generated per run |

**Weave dashboard:** [ccie-agents Weave UI](https://wandb.ai/mohitmanoj-barade-san-jose-state-university/ccie-agents/weave)

**Sample trace call:** logged to project on each `trace_runner` invocation (see terminal `🍩` link).

**Fixture evaluation** (`weave_eval` — 4 fixtures, evaluation name `ccie-fixture-quality`):

| Scorer | Metric | Mean |
|---|---|---|
| freshness_scorer | freshness | 0.50 |
| relevance_scorer | relevance | 0.67 |
| product_coverage_scorer | product_coverage | 0.25 |
| model_latency | — | ~5ms |

Interpretation: stale-news fixture pulls freshness mean down; product-only fixture has no news (coverage scorer averages 1.0 for Stripe products, 0 for news-only rows).

### Design decisions

- **No edits outside `observability/`** — trace runner imports P1 graph but all P4 code stays in this folder to avoid merge conflicts.
- **`WeaveTracer` callback** — LangGraph/LangChain steps auto-traced without P1 adding decorators yet.
- **`@trace_node` ready** — P1 can still add one-line decorators at Hour 7 via `decorators.py`.

### Notes for other teammates

- P1: apply `@trace_node(name="classify")` etc. when ready — optional since `WeaveTracer` already captures graph steps via `trace_runner`.
- Do not modify files in `observability/` except P4.

---

## Iteration 3 — Guardrails + Live Output Scoring

**Date:** 2026-06-06  
**Status:** ✅ Complete  
**Goal:** Flag stale news and hallucinated financials; score live graph output post-run.

### Deliverables

| File | Purpose |
|---|---|
| `guardrails.py` | `check_stale_news`, `check_financial_hallucinations`, `run_live_guardrails` |
| `live_scorer.py` | `score_live_run(graph_result)` — quality + guardrails per competitor |
| `weave_guardrails.py` | `@weave.op` guardrail scorers for Weave Evaluation |
| `guardrail_check.py` | CLI for fixtures or live graph guardrail checks |
| `fixtures/stripe_hallucinated_financials.json` | Unsourced financial metrics test case |
| `P1_INTEGRATION.md` | One-page guide for P1 `@trace_node` integration |
| `tests/test_guardrails.py` | Guardrail unit tests |
| `trace_runner.py` | Added `--score` flag for live quality report |

### Guardrail rules

| Guardrail | Triggers when |
|---|---|
| `stale_news` | News older than 90 days (configurable) |
| `missing_news_date` | News item has no `published_at` |
| `unsourced_financial` | Revenue/funding/cap metrics without `source` |
| `implausible_financial` | Parsed value exceeds $5T |
| `suspicious_financial_precision` | e.g. `$999.999M`, 3+ decimal places |

### Commands

```bash
cd ccie/backend

# Guardrails on stale fixture (expect fail exit code 1)
python -m observability.guardrail_check --fixture stripe_stale_news

# Guardrails on hallucinated financials fixture
python -m observability.guardrail_check --fixture stripe_hallucinated_financials

# Live Stripe run + quality/guardrail report
python -m observability.trace_runner --message "Analyze Stripe" --score

# All P4 tests
ENV=test WEAVE_DISABLED=1 pytest observability/tests -v
```

### Live results (`trace_runner --score`)

**Stripe run with live scoring:**

| Metric | Value |
|---|---|
| avg_freshness | 0.0 (mock news dated May 2025 — correctly flagged stale) |
| avg_relevance | 1.0 |
| guardrails_passed | **false** |
| violation_count | 3 (one stale_news per competitor) |

This is expected with current mock tools — guardrails catch outdated intel before it reaches a demo. When P1/B2 swap in real Tavily news, freshness scores should rise.

**Weave dashboard:** [ccie-agents Weave UI](https://wandb.ai/mohitmanoj-barade-san-jose-state-university/ccie-agents/weave)

**Fixture guardrail checks:**

| Fixture | Result |
|---|---|
| `stripe_stale_news` | FAIL — 3 stale_news violations |
| `stripe_hallucinated_financials` | FAIL — unsourced financial metrics |
| `stripe_news` | PASS |

**Tests:** 13 passed (`pytest observability/tests -v`)

### Notes for other teammates

- **P1:** see `P1_INTEGRATION.md` for `@trace_node` usage — optional; `trace_runner` already traces via `WeaveTracer`.
- **All:** do not edit `observability/` except P4.

---

## Iteration 4 — Call Scorers + Hypothetical Scenarios

**Date:** 2026-06-06  
**Status:** ✅ Complete  
**Goal:** Attach scorers to Weave trace calls (Scores tab); run hypothetical company path; eval with guardrails.

### Deliverables

| File | Purpose |
|---|---|
| `call_feedback.py` | `apply_trace_scorers(call)` — uses `call.apply_scorer()` |
| `weave_live_scorers.py` | Scorers that read `quality_report` from traced output |
| `scenarios.py` | Presets: `stripe`, `hypothetical_legal` |
| `report_writer.py` | Optional JSON export to `observability/reports/` |
| `trace_runner.py` | `--scenario`, `--all-scenarios`, `--apply-scorers`, `--save-report` |
| `weave_eval.py` | `--guardrails` flag adds guardrail scorers to evaluation |

### Commands

```bash
cd ccie/backend

# Stripe + scores attached to trace (visible in dashboard Scores tab)
python -m observability.trace_runner --scenario stripe --score --apply-scorers

# Hypothetical legal-tech startup
python -m observability.trace_runner --scenario hypothetical_legal --score --apply-scorers

# Both scenarios + save JSON report
python -m observability.trace_runner --all-scenarios --score --apply-scorers --save-report

# Fixture eval with guardrails
python -m observability.weave_eval --guardrails --name ccie-fixture-quality-v2
```

### Live results

**Hypothetical legal run** (`--scenario hypothetical_legal --score --apply-scorers`):

| Field | Value |
|---|---|
| is_hypothetical | true |
| competitors | Kira Systems, Luminance, Harvey AI |
| guardrails_passed | false (mock news reuse — expected) |

**Dashboard Scores tab:** After `--apply-scorers`, each trace shows:
- `avg_freshness`, `avg_relevance`
- `guardrails_passed`, `violation_count`
- `competitor_count`, `is_hypothetical`

**Tests:** 20 passed (`pytest observability/tests -v`)

---

## Iteration 5 — A/B Leaderboard + Configurable Thresholds + Auto-Score Hook

**Date:** 2026-06-06  
**Status:** ✅ Complete  
**Goal:** Compare strict vs lenient policies in Weave; env-configurable thresholds; P2 hook for server auto-scoring.

### Deliverables

| File | Purpose |
|---|---|
| `settings.py` | P4 env config: `CCIE_STALE_NEWS_DAYS`, `CCIE_FRESHNESS_WINDOW_DAYS`, `CCIE_AUTO_SCORE`, etc. |
| `leaderboard.py` | A/B compare `strict` (30d) vs `lenient` (90d) policies via Weave Evaluation |
| `post_run_hook.py` | `on_graph_complete()`, `wrap_graph_for_observability()` |
| `P2_INTEGRATION.md` | One-line `main.py` integration for P2 |

### Env vars (add to `ccie/.env`)

| Variable | Default | Purpose |
|---|---|---|
| `CCIE_STALE_NEWS_DAYS` | 90 | Guardrail stale-news threshold |
| `CCIE_FRESHNESS_WINDOW_DAYS` | 90 | Freshness scorer decay window |
| `CCIE_IMPLAUSIBLE_USD_THRESHOLD` | 5e12 | Max plausible financial metric |
| `CCIE_AUTO_SCORE` | off | Enable post-run scoring on server |
| `CCIE_AUTO_APPLY_WEAVE_SCORERS` | off | Reserved for future server-side Weave scorers |

### Commands

```bash
cd ccie/backend

# A/B policy comparison → two evaluations in Weave dashboard
python -m observability.leaderboard

# Custom policies list
python -m observability.leaderboard --policies strict,lenient

# All P4 tests
ENV=test WEAVE_DISABLED=1 pytest observability/tests -v
```

### P2 integration (one line in `main.py`)

```python
from observability.post_run_hook import wrap_graph_for_observability
compiled_graph = wrap_graph_for_observability(compile_graph())
```

Set `CCIE_AUTO_SCORE=1` in `.env` to activate. See `P2_INTEGRATION.md`.

### Live results

**A/B leaderboard** (`python -m observability.leaderboard`):

| Policy | Freshness (mean) | Relevance (mean) | Stale pass rate | Composite |
|---|---|---|---|---|
| strict (30d) | lower | ~0.53 | lower | 0.375 |
| lenient (90d) | 0.40 | 0.533 | 80% | **0.481** |

**Winner:** `lenient` — published as `ccie-policy-strict` and `ccie-policy-lenient` in Weave Evaluations tab.

**Tests:** 26 passed

---

## Iteration 6 — Server Weave Scorers + Prompt A/B + Report Export

**Date:** 2026-06-06  
**Status:** ✅ Complete  
**Goal:** Wire `CCIE_AUTO_APPLY_WEAVE_SCORERS`; discovery prompt A/B via fixtures; export leaderboard reports.

### Deliverables

| File | Purpose |
|---|---|
| `weave_server_log.py` | `ccie_server_post_run` op + `publish_server_quality()` |
| `post_run_hook.py` | Calls Weave publish when `CCIE_AUTO_APPLY_WEAVE_SCORERS=1` |
| `prompt_variants.py` | `v1_baseline` vs `v2_aggressive` discovery variants |
| `prompt_ab_eval.py` | Weave Evaluation comparing prompt variant fixtures |
| `fixtures/discovery_prompt_v1_stripe.json` | Strong discovery output (3 relevant competitors) |
| `fixtures/discovery_prompt_v2_stripe.json` | Weak discovery output (irrelevant/stale) |
| `report_writer.py` | Added `export_leaderboard_summary()` |
| `leaderboard.py` | Added `--save-report` flag |

### Commands

```bash
cd ccie/backend

# Policy A/B + save slim JSON report
python -m observability.leaderboard --save-report

# Discovery prompt A/B (fixture-based until P1 exposes live prompts)
python -m observability.prompt_ab_eval --save-report

# Server auto-score + Weave scorers (after P2 wraps main.py)
# CCIE_AUTO_SCORE=1 + CCIE_AUTO_APPLY_WEAVE_SCORERS=1 in .env
```

### Live results

**Prompt A/B winner:** `v1_baseline` (composite 0.91 vs v2 0.36)
- v1: freshness 1.0, relevance 1.0, guardrails pass, 3 competitors
- v2: freshness 0.5, relevance 0.5, guardrails fail, 2 competitors

**Policy leaderboard winner:** `lenient` (unchanged from Iter 5)

**Reports saved:** `observability/reports/leaderboard_*.json`, `observability/reports/prompt_ab_*.json`

**Tests:** 31 passed

---

## Planned — Iteration 7

- _(Merged into Final — see below)_

---

## Final — Implementation Plan Complete (Person 4)

**Date:** 2026-06-06  
**Status:** ✅ All P4 tasks from `implementation_plan.md` implemented in `observability/`

### Checklist vs implementation plan

| Plan item | Status | Artifact |
|---|---|---|
| W&B Weave init + live dashboard | ✅ | `weave_config.py`, verified traces |
| LangGraph auto-tracing | ✅ | `trace_runner.py`, `WeaveTracer` |
| `@trace_node` decorator shim | ✅ | `decorators.py`, `P1_INTEGRATION.md` |
| Scorers: freshness, relevance, **accuracy** | ✅ | `scorers.py`, ground truth fixtures |
| Guardrails: stale news, hallucinated financials | ✅ | `guardrails.py` |
| Eval harness (Stripe + hypothetical) | ✅ | `eval_harness.py`, `batch_eval.py` |
| Leaderboard (prompt/policy A/B) | ✅ | `leaderboard.py`, `prompt_ab_eval.py` |
| Prompt optimization loop | ✅ | `prompt_optimizer.py` |
| Demo metrics + dashboard URL | ✅ | `demo_metrics.py` |
| Activity feed integration (stretch) | ✅ | `activity_feed.py`, `P3_INTEGRATION.md` |
| Server auto-score hook | ✅ | `post_run_hook.py`, `P2_INTEGRATION.md` |
| Regression detection | ✅ | `regression_check.py` |
| Scorer API + README docs | ✅ | `README.md` |
| Unit tests | ✅ | 36+ tests in `observability/tests/` |

### New commands (final deliverables)

```bash
python -m observability.batch_eval --save-report
python -m observability.demo_metrics --save-report
python -m observability.regression_check --fixtures-only
```

### Remaining (requires other teammates — not P4 code)

| Item | Owner |
|---|---|
| Apply `@trace_node` in orchestrator/agents | P1 |
| `wrap_graph_for_observability()` in `main.py` | P2 |
| Render observability in activity feed UI | P3 |
| Live prompt A/B when P1 exposes prompt env vars | P1 + P4 |
