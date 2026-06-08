# CCIE Observability — Integration Guide

> **Owner:** Person 4 (`observability/` only). Other teammates make one-line changes outside this folder.

---

## P1 — Weave tracing (Agent Architect)

### Option A — Zero P1 changes (works today)

```bash
cd ccie/backend
python -m observability.trace_runner --message "Analyze Stripe" --score
```

Attaches `WeaveTracer` to LangGraph invoke and logs the full trace to W&B.

### Option B — Per-node tracing

```python
from observability.decorators import trace_node

@trace_node(name="classify_company")
async def classify_node(state, config):
    ...
```

When `WEAVE_DISABLED=1` → no-op. When `WANDB_API_KEY` is set → each node appears in the Weave trace tree.

Score live output (no P1 changes):

```python
from observability.live_scorer import score_live_run

report = score_live_run(graph_result)
```

---

## P2 — Auto-score on every agent run (`main.py`)

### Env (`ccie/.env`)

```bash
CCIE_AUTO_SCORE=1
CCIE_STALE_NEWS_DAYS=90
CCIE_FRESHNESS_WINDOW_DAYS=90
CCIE_AUTO_APPLY_WEAVE_SCORERS=1   # optional — dashboard scorers on server
```

### One-line integration

```python
from agents.graph import compile_graph
from observability.post_run_hook import wrap_graph_for_observability

compiled_graph = wrap_graph_for_observability(compile_graph())
```

When `CCIE_AUTO_SCORE` is unset, `wrap_graph_for_observability` returns the graph unchanged.

Manual hook:

```python
from observability.post_run_hook import on_graph_complete

result = await compiled_graph.ainvoke(state, config)
await on_graph_complete(result)
```

---

## P3 — Activity feed (Frontend + P2 state wiring)

After `on_graph_complete`, quality reports include `suggested_agent_activity`:

```python
{
  "agent": "Observability",
  "status": "Quality — freshness 0.00, relevance 1.00, competitors 3",
  "ts": 1717680000.0
}
```

Backend (P2):

```python
from observability.post_run_hook import merge_observability_activity, on_graph_complete

report = await on_graph_complete(graph_result)
if report:
    merge_observability_activity(state, report)
```

Frontend: render `agent_activity` entries where `agent === "Observability"` with a distinct style; warn on guardrail failures.

---

## Do not

- Edit files inside `observability/` unless you are P4
- Duplicate scorer logic — import from `observability` package only
- Call `weave.init()` outside `weave_config.init_weave()`
