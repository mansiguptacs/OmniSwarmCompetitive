# P4 Observability — W&B Weave

> **Owner:** Person 4 only.  
> **Dashboard:** [ccie-agents Weave UI](https://wandb.ai/mohitmanoj-barade-san-jose-state-university/ccie-agents/weave)

## Layout

| Module | Purpose |
|---|---|
| `weave_config.py` | Weave init |
| `scorers.py` / `guardrails.py` / `live_scorer.py` | Quality scoring |
| `weave_ops.py` | All `@weave.op` scorers + server trace logging |
| `post_run_hook.py` | P2 auto-score hook, activity feed, prompt suggestions |
| `trace_runner.py` | Live traced graph runs |
| `eval.py` | Unified eval CLI (fixtures, guardrails, batch, regression, leaderboard, prompt A/B, demo) |
| `presets.py` | Scenarios + prompt variants + policy presets |
| `fixtures/` | Offline test data |
| `INTEGRATION.md` | P1 / P2 / P3 one-liners |

## Scorer API

```python
from observability import (
    score_freshness, score_relevance, score_accuracy,
    score_live_run, run_live_guardrails,
    build_observability_activity, suggest_prompt_improvements,
)
from observability.live_scorer import score_graph_with_ground_truth
```

## CLI

```bash
cd ccie/backend

# Live trace + score
python -m observability.trace_runner --scenario stripe --score --apply-scorers

# Unified eval (subcommands)
python -m observability.eval fixtures --all
python -m observability.eval fixtures --all --weave --guardrails
python -m observability.eval guardrails --fixture stripe_stale_news
python -m observability.eval batch --save-report
python -m observability.eval leaderboard --save-report
python -m observability.eval prompt-ab --save-report
python -m observability.eval demo --save-report
python -m observability.eval regression --fixtures-only

# Tests (test_core.py + test_hooks.py)
ENV=test WEAVE_DISABLED=1 pytest observability/tests -v
```

## Env vars (`ccie/.env`)

| Variable | Purpose |
|---|---|
| `WANDB_API_KEY` | Weave authentication |
| `WEAVE_PROJECT` | Default `ccie-agents` |
| `WEAVE_DISABLED=1` | Skip Weave (tests/CI) |
| `CCIE_STALE_NEWS_DAYS` | Guardrail threshold (default 90) |
| `CCIE_AUTO_SCORE=1` | Auto-score on server (P2 hook) |
| `CCIE_AUTO_APPLY_WEAVE_SCORERS=1` | Attach dashboard scorers on server |

## Integration

See `INTEGRATION.md` for P1 (`@trace_node`), P2 (`wrap_graph_for_observability`), P3 (activity feed).
