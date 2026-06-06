# CCIE — Progress Tracker

> Last updated: **2026-06-06**  
> Reference: [`implementation_plan.md`](implementation_plan.md)

---

## Current Status

| Area | Status | Notes |
|---|---|---|
| **Agents layer (backend)** | ✅ B1 complete | LLM harness + heuristics; classifier/discovery via `llm/client.py` |
| **Frontend (production)** | ⬜ Reserved | `ccie/frontend/` — owned by frontend teammate |
| **Playground UI (dev testing)** | ✅ Scaffolded | `ccie/playground/` — minimal CopilotKit test harness |
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
- [x] **35 tests** — 34 passed, 1 skipped (`WEAVE_DISABLED=1 ENV=test pytest backend/tests -v`)

### LLM agent harness (B1 — 2026-06-06)
- [x] `ccie/backend/llm/schemas.py` — `ClassifyResult`, `DiscoveryResult`, `SwotResult`
- [x] `ccie/backend/llm/factory.py` — `get_llm()`, override injection for tests
- [x] `ccie/backend/llm/heuristic.py` — fallback classify/discover logic
- [x] `ccie/backend/llm/client.py` — async `classify_company`, `discover_competitors_for_target`
- [x] Orchestrator uses LLM client; heuristic fallback when no API key / `ENV=test`
- [x] Per-competitor state emit during discovery
- [x] Mock competitor search results for discovery queries
- [x] Tests: `test_llm_client.py`, `test_orchestrator_discovery.py`

### Docs
- [x] `ccie/backend/README.md` — setup, run, env vars

---

## Verified Milestones

| Checkpoint | Target | Status |
|---|---|---|
| Agent registry live | `localhost:8000/api/copilotkit/` shows `ccie_agent` | ✅ Verified 2026-06-06 |
| pytest green | 34 passed, 1 skipped | ✅ Verified 2026-06-06 |
| Backend server | `uvicorn main:app --port 8000` | ✅ Running |
| Chat UI shows agent output | User types "Stripe" → chat response | ⬜ Not yet |
| Shared state → UI | `useCoAgent` renders competitors | ⬜ Not yet |
| 3D buildings on discovery | R3F scene updates from state | ⬜ Not yet |

---

## Backend & Agent Harness — Next Steps

> **Current harness:** mock tools + heuristic classifier/discovery + template SWOT.  
> **Works today:** full graph invoke via pytest, CopilotKit endpoint, fakeredis.  
> **Does not yet use:** OpenAI LLM, real scrape, live Redis, Weave scorers, parallel swarms.

### B1 — Agent harness foundation (do first)
Wire a proper LLM + structured-output layer so agents stop relying on hardcoded maps.

| # | Task | Files / notes | Done |
|---|---|---|---|
| B1.1 | Add `backend/llm/factory.py` — `get_llm()` returns ChatOpenAI or mock in test | Inject via config; use existing `mock_llm` fixture | ✅ |
| B1.2 | Add Pydantic response schemas for classifier, discovery, SWOT | e.g. `ClassifyResult`, `DiscoveryResult`, `SwotResult` | ✅ |
| B1.3 | Replace `classify_input()` heuristic with LLM structured call + fallback | `llm/client.py`, `llm/heuristic.py` | ✅ |
| B1.4 | Replace `discover_competitors()` static map with LLM + `web_search` | `llm/client.py`, `tools/web_search.py` | ✅ |
| B1.5 | Emit competitor one-by-one during discovery (state emit per competitor) | `orchestrator.py` | ✅ |
| B1.6 | Tests: mock LLM paths + one opt-in live LLM test (`INTEGRATION=1`) | `tests/test_llm_client.py` | ✅ |

**Gate:** classifier + discovery use LLM; tests still green with mocks.

---

### B2 — Real tools (swap mocks for prod)
| # | Task | Files / notes | Done |
|---|---|---|---|
| B2.1 | Finish Tavily integration in `web_search.py` (`ENV=prod`, `TAVILY_API_KEY`) | Already stubbed | ⬜ |
| B2.2 | Implement real `web_scrape.py` — httpx + BeautifulSoup for pricing/features pages | Add `beautifulsoup4` to requirements | ⬜ |
| B2.3 | News Scout: LLM parses raw search results → `list[NewsItem]` + sentiment | `agents/news_scout.py` | ⬜ |
| B2.4 | Product Tracker: LLM structures scraped HTML → `list[ProductItem]` | `agents/product_tracker.py` | ⬜ |
| B2.5 | Bind `@tool` wrappers into LangGraph tool nodes (not just direct function calls) | Optional refactor for traceability | ⬜ |
| B2.6 | Tests: keep mock path default; add `INTEGRATION=1` tool smoke tests | `tests/test_tools.py` | ⬜ |

**Gate:** `ENV=prod` runs real search/scrape for Stripe demo.

---

### B3 — Redis & session harness
| # | Task | Files / notes | Done |
|---|---|---|---|
| B3.1 | Run `docker compose up -d` and verify live Redis read/write | Manual + optional integration test | ⬜ |
| B3.2 | Persist full session snapshot (`CompanyRecord` + competitors) on graph complete | `memory/redis_client.py` | ⬜ |
| B3.3 | Load prior session by `session_id` / thread_id for re-analysis | Cross-session delta prep | ⬜ |
| B3.4 | Graceful degrade when Redis down (log + continue, already partial) | Harden error paths | ⬜ |
| B3.5 | Redis Iris Context Retriever schemas → auto MCP tools | Post-MVP stretch | ⬜ |

**Gate:** Day 1 Hour 7 — agent output stored in Redis and reloadable.

---

### B4 — Orchestrator & swarm improvements
| # | Task | Files / notes | Done |
|---|---|---|---|
| B4.1 | Split real vs hypothetical graph branches (classify → enrich/parse → discover/infer) | `orchestrator.py`, `graph.py` — routing exists but both paths merge early | ⬜ |
| B4.2 | Parallel fan-out per competitor via LangGraph `Send` API | Replace sequential loop in `analyze_competitors_node` | ⬜ |
| B4.3 | Compute `threat_level`, `market_size`, `market_overlap` from analysis | Populate fields for 3D encoding | ⬜ |
| B4.4 | Populate `market_quadrants` in landscape synthesis | leader/challenger/niche/visionary | ⬜ |
| B4.5 | Synthesis: LLM-generated SWOT + executive summary (replace template) | `agents/synthesis.py` | ⬜ |
| B4.6 | Add **Financial Analyst** agent subgraph | `agents/financial_analyst.py`, `tools/financial_data.py` | ⬜ |

**Gate:** 3–5 competitors analyzed in parallel; state fields ready for 3D scene.

---

### B5 — Observability (Weave)
| # | Task | Files / notes | Done |
|---|---|---|---|
| B5.1 | Enable Weave in dev (`WANDB_API_KEY`, remove `WEAVE_DISABLED`) | Verify traces in W&B dashboard | ⬜ |
| B5.2 | Decorate graph nodes with `@weave.op()` | `orchestrator.py`, specialist agents | ⬜ |
| B5.3 | Custom scorers: freshness, relevance, accuracy | `observability/scorers.py` | ⬜ |
| B5.4 | Guardrails for hallucinated financial figures / stale news | Weave guardrails | ⬜ |

**Gate:** trace visible for full Stripe run; scorers run on agent outputs.

---

### B6 — CopilotKit / API harness
| # | Task | Files / notes | Done |
|---|---|---|---|
| B6.1 | Verify full agent run via CopilotKit HTTP (not just registry page) | POST to `/api/copilotkit/agent/ccie_agent` | ⬜ |
| B6.2 | Add `CopilotKitMiddleware` if needed for frontend tool calls | `main.py` / graph compile | ⬜ |
| B6.3 | Register CopilotKit Actions (e.g. `render_building`) for GenUI | `main.py` | ⬜ |
| B6.4 | `.env.example` with all backend env vars documented | repo root or `ccie/` | ⬜ |

**Gate:** agent executable end-to-end through CopilotKit protocol without pytest.

---

### B7 — Backend test harness expansion
| # | Task | Files / notes | Done |
|---|---|---|---|
| B7.1 | Live Redis integration test (`INTEGRATION=1`, docker required) | `tests/test_redis_integration.py` | ⬜ |
| B7.2 | CopilotKit endpoint smoke test (streaming response) | `tests/test_copilotkit_api.py` | ⬜ |
| B7.3 | Hypothetical + real company golden-path fixtures | Stripe + legal-tech startup | ⬜ |
| B7.4 | CI script — `pytest` + lint on push | `.github/workflows/` | ⬜ |

---

## Frontend Next Steps (separate track)

### Playground UI (backend/agent testing — not production frontend)
- [x] `ccie/playground/` — minimal Next.js + CopilotKit chat + `useCoAgent` state panel
- [ ] `npm install && npm run dev` — verify chat with backend on `:8000`

### Sprint A — Production frontend (frontend teammate)
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
| 2026-06-06 | Created this progress tracker |
| 2026-06-06 | Added `ccie/playground/` — dev-only CopilotKit UI for backend testing (`ccie/frontend/` reserved) |
