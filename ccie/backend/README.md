# CCIE Backend — Agents Layer

Python LangGraph agent swarm for competitive intelligence.

## Setup

```bash
cd ccie
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run tests

```bash
cd ccie
WEAVE_DISABLED=1 ENV=test pytest backend/tests -v
```

Optional live LLM test (requires `OPENAI_API_KEY`):

```bash
INTEGRATION=1 OPENAI_API_KEY=sk-... WEAVE_DISABLED=1 pytest backend/tests/test_llm_client.py::test_classify_company_live_llm -v
```

## Real tools (B2 — evaluate agents with live data)

```bash
cd ccie/backend
source ../.venv/bin/activate
ENV=prod USE_MOCK_TOOLS=0 \
  TAVILY_API_KEY=tvly-... \
  WEAVE_DISABLED=1 uvicorn main:app --reload --port 8000
```

Then run the playground and try **Analyze Stripe**. News Scout and Product Tracker both use **Tavily web search** only (no page scraping or HTML parsing).

Optional live tool smoke test:

```bash
INTEGRATION=1 TAVILY_API_KEY=tvly-... ENV=prod USE_MOCK_TOOLS=0 \
  WEAVE_DISABLED=1 pytest backend/tests/test_tools_prod.py::test_web_search_live_tavily -v
```

## Run API server

From repo root:

```bash
cd ccie/backend
source ../.venv/bin/activate
WEAVE_DISABLED=1 uvicorn main:app --reload --port 8000
```

If you're already in `ccie/`:

```bash
cd backend
source ../.venv/bin/activate
WEAVE_DISABLED=1 uvicorn main:app --reload --port 8000
```

**Important:** run uvicorn from `ccie/backend/` (where `main.py` lives). Running it from `ccie/` will fail with `Could not import module "main"`.

Health check: `GET http://localhost:8000/health`  
CopilotKit endpoint: `POST http://localhost:8000/api/copilotkit`

## Redis (optional)

```bash
cd ccie
docker compose up -d
```

Set `REDIS_URL=redis://localhost:6379/0`.

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `OPENAI_API_KEY` | — | Recommended — classify/discover/SWOT/landscape summary (Tavily still handles search) |
| `TAVILY_API_KEY` | — | Required for real web search (`ENV=prod`) |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis connection |
| `ENV` | `dev` | `dev`/`test` use mock tools; set `prod` for Tavily search |
| `USE_MOCK_TOOLS` | — | Override: `1` force mocks, `0` force real tools |
| `WANDB_API_KEY` | — | W&B Weave tracing (see `observability/INTEGRATION.md`) |
| `WEAVE_PROJECT` | `ccie-agents` | W&B Weave project |
| `WEAVE_DISABLED` | — | Set `1` to skip Weave init |
| `CCIE_AUTO_SCORE` | — | Set `1` to auto-score every graph run (freshness, relevance, guardrails) |
| `CCIE_AUTO_APPLY_WEAVE_SCORERS` | — | Set `1` to publish scores to Weave dashboard on server runs |

## Weave observability

Integrated per `observability/INTEGRATION.md`:

- **`init_weave()`** on server startup (`main.py`)
- **`@trace_node`** on orchestrator graph nodes (visible in Weave trace tree)
- **`wrap_graph_for_observability()`** wraps the compiled graph
- **Post-run scoring** in `landscape_synthesis_node` (works with CopilotKit AG-UI streaming)

Enable in `ccie/.env`:

```bash
WANDB_API_KEY=...
# remove or comment out WEAVE_DISABLED=1
CCIE_AUTO_SCORE=1
```

Manual traced run:

```bash
cd ccie/backend
python -m observability.trace_runner --scenario stripe --score --apply-scorers
```

See `observability/README.md` for eval CLI and dashboard link.
