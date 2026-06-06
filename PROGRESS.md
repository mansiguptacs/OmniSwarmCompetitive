# CCIE — Progress Tracker

> Last updated: **2026-06-06**  
> Reference: [`implementation_plan.md`](implementation_plan.md)

---

## Current Status

| Area | Status | Notes |
|---|---|---|
| **Agents layer (backend)** | ✅ Complete | LangGraph swarm, Redis, CopilotKit endpoint live |
| **Frontend** | ⬜ Not started | CopilotKit info page only (backend registry at `:8000/api/copilotkit/`) |
| **Integration (chat UI)** | ⬜ Blocked on frontend | Backend ready for `useCoAgent({ name: "ccie_agent" })` |
| **3D War Room** | ⬜ Not started | Depends on shared state flowing to frontend |
| **MVP Phase** | **Between Phase 1 & 2** | Backend exceeds Phase 1 scope; chat UI still missing |

---

## Completed Work

### Backend scaffold & config
- [x] `ccie/requirements.txt` — pinned LangGraph, CopilotKit, FastAPI, Redis, pytest, Weave
- [x] `ccie/pytest.ini` — async test config
- [x] `ccie/backend/config.py` — env vars (`OPENAI_API_KEY`, `REDIS_URL`, `ENV`, etc.)
- [x] `ccie/docker-compose.yml` — Redis service
- [x] `ccie/.gitignore` — venv, cache, `.env`

### Shared state contract
- [x] `ccie/backend/state.py` — `CCIEState`, `Competitor`, `NewsItem`, `ProductItem`, helpers
- [x] Tests: `backend/tests/test_state.py` (5 tests)

### FastAPI + CopilotKit bridge
- [x] `ccie/backend/main.py` — `LangGraphAGUIAgent` as `ccie_agent` at `/api/copilotkit`
- [x] `GET /health` endpoint
- [x] CopilotKit registry page verified in browser (`ccie_agent`, `langgraph_agui`)
- [x] Tests: `backend/tests/test_graph_smoke.py` (echo graph + health)

### Tools (mock-first)
- [x] `ccie/backend/tools/base.py` — `ToolResult`
- [x] `ccie/backend/tools/web_search.py` — mock news + optional Tavily
- [x] `ccie/backend/tools/web_scrape.py` — mock products/pricing
- [x] LangChain `@tool` wrappers exported
- [x] Tests: `backend/tests/test_tools.py` (3 tests)

### Specialist agents
- [x] `ccie/backend/agents/news_scout.py` — news fetch, sentiment, Redis persist
- [x] `ccie/backend/agents/product_tracker.py` — product scrape per competitor
- [x] `ccie/backend/agents/synthesis.py` — SWOT + landscape summary
- [x] `ccie/backend/agents/helpers.py` — classify, discover, safe state emit
- [x] Tests: `backend/tests/test_news_scout.py`, product/synthesis in `test_integration.py`

### Orchestrator graph
- [x] `ccie/backend/agents/orchestrator.py` — classify → discover → analyze → synthesize
- [x] `ccie/backend/agents/graph.py` — compiles full orchestrator + echo smoke graph
- [x] Real company path (`Analyze Stripe` → PayPal, Adyen, Square)
- [x] Hypothetical path (long description → legal-tech competitors)
- [x] Tests: `backend/tests/test_orchestrator.py` (5 tests)

### Redis memory
- [x] `ccie/backend/memory/schemas.py` — `CompanyRecord`, `StoredNewsItem`
- [x] `ccie/backend/memory/redis_client.py` — namespaced JSON keys
- [x] `ccie/backend/memory/factory.py` — injectable client for tests
- [x] Tests: `backend/tests/test_redis_client.py` (3 tests)

### Observability
- [x] `ccie/backend/observability/weave_config.py` — W&B Weave init (`WEAVE_DISABLED=1` to skip)

### End-to-end
- [x] `ccie/backend/tests/test_integration.py` — full Stripe run + Redis session check
- [x] **24/24 tests passing** (`WEAVE_DISABLED=1 ENV=test pytest backend/tests -v`)

### Docs
- [x] `ccie/backend/README.md` — setup, run, env vars

---

## Verified Milestones

| Checkpoint | Target | Status |
|---|---|---|
| Agent registry live | `localhost:8000/api/copilotkit/` shows `ccie_agent` | ✅ Verified 2026-06-06 |
| pytest green | 24 tests | ✅ Verified 2026-06-06 |
| Backend server | `uvicorn main:app --port 8000` | ✅ Running |
| Chat UI shows agent output | User types "Stripe" → chat response | ⬜ Not yet |
| Shared state → UI | `useCoAgent` renders competitors | ⬜ Not yet |
| 3D buildings on discovery | R3F scene updates from state | ⬜ Not yet |

---

## Next Steps (Prioritized)

### Sprint A — Frontend skeleton + chat (Phase 1 completion)
**Goal:** User types "Analyze Stripe" → agent runs → result shows in chat.

| # | Task | Owner track | Done |
|---|---|---|---|
| A1 | Scaffold `ccie/frontend/` — Next.js + TypeScript | Frontend | ⬜ |
| A2 | Install CopilotKit (`@copilotkit/react-core`, `@copilotkit/runtime`) | Frontend | ⬜ |
| A3 | `app/layout.tsx` — `<CopilotKit>` provider, dark theme | Frontend | ⬜ |
| A4 | `app/api/copilotkit/route.ts` — proxy to `http://localhost:8000/api/copilotkit` | Frontend | ⬜ |
| A5 | `app/page.tsx` — chat panel + company input form | Frontend | ⬜ |
| A6 | Wire `useCoAgent({ name: "ccie_agent" })` with `CCIEState` TypeScript types | Frontend | ⬜ |
| A7 | **Integration test:** type "Analyze Stripe" in chat → see response + state update | All | ⬜ |

**Gate:** Day 1 Hour 4 checkpoint from implementation plan.

---

### Sprint B — GenUI + live state display (Phase 2)
**Goal:** Agent discovers competitors → UI renders them in real time.

| # | Task | Owner track | Done |
|---|---|---|---|
| B1 | `AgentActivityFeed.tsx` — render `state.agent_activity` | Frontend | ⬜ |
| B2 | `CompetitorCard.tsx` — name, sentiment, threat, status | Frontend | ⬜ |
| B3 | `useCoAgentStateRender` — inline state updates in chat | Frontend | ⬜ |
| B4 | Phase indicator UI (`idle` → `classifying` → … → `complete`) | Frontend | ⬜ |
| B5 | `NewsTimeline.tsx` — news items per competitor | Frontend | ⬜ |
| B6 | `SWOTTable.tsx` — SWOT from synthesis agent | Frontend | ⬜ |
| B7 | **Integration test:** competitors appear as agents finish each one | All | ⬜ |

**Gate:** Day 1 Hour 9 checkpoint.

---

### Sprint C — Memory & agent hardening (Phase 2 backend)
**Goal:** Production-ready intel quality and persistence.

| # | Task | Owner track | Done |
|---|---|---|---|
| C1 | Start Redis locally (`docker compose up -d`) and verify live persistence | Infra | ⬜ |
| C2 | Replace heuristic classifier/discovery with LLM structured output | Agents | ⬜ |
| C3 | Enable real web search (`TAVILY_API_KEY`, `ENV=prod`) | Agents | ⬜ |
| C4 | Weave scorers — freshness, relevance on agent outputs | Observability | ⬜ |
| C5 | Redis Iris Context Retriever schemas + MCP tools (stretch) | Infra | ⬜ |
| C6 | LangCache for repeated queries (stretch) | Infra | ⬜ |

**Gate:** Day 1 Hour 7 checkpoint (Redis queryable from agent output).

---

### Sprint D — 3D War Room (Phase 3)
**Goal:** Demo wow factor — competitive landscape as a 3D city.

| # | Task | Owner track | Done |
|---|---|---|---|
| D1 | `WarRoom.tsx` — React Three Fiber canvas | Frontend | ⬜ |
| D2 | `CompetitorBuilding.tsx` — height=threat, color=sentiment, width=size | Frontend | ⬜ |
| D3 | Buildings animate in as `state.competitors` grows | Frontend | ⬜ |
| D4 | Click building → detail panel (SWOT, news, products) | Frontend | ⬜ |
| D5 | Target company at center; distance = market overlap | Frontend | ⬜ |
| D6 | Financial Analyst agent (stretch) | Agents | ⬜ |
| D7 | Vector search: "Which competitor is strongest in X?" | Infra | ⬜ |
| D8 | Demo dry run — Stripe + one hypothetical company | All | ⬜ |

**Gate:** Day 2 Hour 3 (buildings appear) and Hour 6 (full demo).

---

## Deferred (Post-MVP)

- Financial Analyst agent (unless pulled into Sprint D)
- Redis Iris full MCP integration
- Vector search + LangCache
- Multi-session delta detection ("what changed since yesterday")
- Weave leaderboard in demo UI
- Parallel per-competitor LangGraph `Send` fan-out (currently sequential)

---

## Quick Commands

```bash
# Tests
cd ccie && source .venv/bin/activate
WEAVE_DISABLED=1 ENV=test pytest backend/tests -v

# Backend
cd ccie/backend && WEAVE_DISABLED=1 uvicorn main:app --reload --port 8000

# Redis
cd ccie && docker compose up -d

# Health
curl http://localhost:8000/health
curl -H "Accept: application/json" http://localhost:8000/api/copilotkit/
```

---

## Changelog

| Date | Change |
|---|---|
| 2026-06-06 | Agents layer complete — orchestrator, News Scout, Product Tracker, Synthesis, Redis, CopilotKit endpoint, 24 tests green |
| 2026-06-06 | CopilotKit registry page verified — `ccie_agent` live at `:8000/api/copilotkit/` |
| 2026-06-06 | Created this progress tracker; next up: frontend scaffold (Sprint A) |
