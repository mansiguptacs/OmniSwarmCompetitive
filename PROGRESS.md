# CCIE — Progress Tracker

> Last updated: **2026-06-06** (night)  
> Reference: [`implementation_plan.md`](implementation_plan.md)

---

## Current Status

| Area | Status | Notes |
|---|---|---|
| **Agents layer (backend)** | ✅ B4 complete + Financial Analyst + Scoring v2 | Parallel swarms, LLM financial extraction, relative quadrant scoring, hardened hypothetical path |
| **Real tools + LLM** | ✅ Live | Tavily search + `OPENAI_API_KEY` for classify/discover/SWOT; company-agnostic discovery |
| **Observability (Weave)** | ✅ Enhanced | 7 trace scorers, per-competitor detail, memory metrics, coverage + SWOT completeness tracking |
| **Frontend (production)** | ⬜ Reserved | `ccie/frontend/` — owned by frontend teammate |
| **Playground UI (dev testing)** | ✅ Working | Multi-turn chat, real competitors per company, Observability activity feed |
| **Integration (chat UI)** | 🟡 Playground only | Production `ccie/frontend/` still owned by frontend teammate |
| **Redis (live persistence)** | ✅ Integrated | P2 memory module merged; agents use `MemoryService` with auto-index, vector search, LangCache |
| **3D War Room** | ⬜ Not started | `threat_level`, `market_size`, `market_overlap` ready in state for encoding |
| **MVP Phase** | **Phase 2 in progress** | Backend + playground + Weave E2E working; prod frontend + 3D still out |

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
- [x] `ccie/backend/main.py` — `LangGraphAGUIAgent` as `ccie_agent` at `/api/copilotkit/`
- [x] AG-UI SSE endpoint via `add_langgraph_fastapi_endpoint` (replaces legacy `add_fastapi_endpoint`)
- [x] `GET /health` endpoint
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
- [x] `ccie/backend/agents/financial_analyst.py` — revenue, funding, market cap, growth per competitor
- [x] `ccie/backend/agents/synthesis.py` — SWOT + landscape summary (includes financial context)
- [x] `ccie/backend/agents/helpers.py` — classify, discover, safe state emit
- [x] `ccie/backend/tools/financial_data.py` — Tavily financial search + LLM structured extraction (regex fallback) + mock data
- [x] Tests: `test_news_scout.py`, `test_financial.py`, product/synthesis in `test_integration.py`

### Orchestrator graph
- [x] `ccie/backend/agents/orchestrator.py` — classify → enrich/parse → discover → parallel analyze → synthesize
- [x] `ccie/backend/agents/graph.py` — branched real/hypothetical paths + LangGraph `Send` fan-out
- [x] `ccie/backend/agents/scoring.py` — `threat_level`, `market_size`, `market_overlap`, `market_quadrants` (v2: financial signals + relative quadrant placement)
- [x] State reset on new analysis (fixes stale competitors on same CopilotKit thread)
- [x] Real company path (`Analyze Stripe`, `Analyze Apple`, `Analyze Palo Alto Networks`)
- [x] Hypothetical path (long description → legal-tech competitors)
- [x] Tests: `backend/tests/test_orchestrator.py` (6 tests), `test_scoring.py`, `test_discovery.py`

### Redis memory (P2 module + agent integration)
- [x] `ccie/backend/memory/` — P2 memory infrastructure (redis_client, schemas, factory, service, etc.)
- [x] `MemoryService` — unified API over store, Iris adapter, vector search, LangCache
- [x] Vector search: `IrisVectorSearch` (Redis-persisted) / `StubVectorSearch` (tests)
- [x] LangCache: `RedisLangCache` (local TTL) / `StubLangCache` (tests) / `LangCacheCloudProvider` (stub)
- [x] Index hooks: `index_news_items`, `index_product_items`, `index_competitor_profile`, `index_synthesis_intel`
- [x] MCP tool prep: `mcp_lookup_company`, `mcp_lookup_competitor`, etc.
- [x] Multi-competitor key partitioning: `session_id:competitor:doc_id`
- [x] Bootstrap: `configure_memory_providers()` in lifespan selects stubs vs Redis backends
- [x] **Agent integration**: news_scout, product_tracker, synthesis all use `get_memory_service()`
- [x] Synthesis auto-indexes SWOT + landscape via `index_synthesis()` and `index_session_intel()`
- [x] Tests: `backend/tests/test_redis_client.py` + P2's 64 tests (127 total passing)
- [x] `/health` reports Redis `connected` + `latency_ms`

### Observability (P4 module + integration)
- [x] `ccie/backend/observability/` — scorers, guardrails, eval CLI, fixtures (teammate P4)
- [x] `weave_config.py` — W&B Weave init (`WEAVE_DISABLED=1` to skip)
- [x] `main.py` — `init_weave()` + `wrap_graph_for_observability()`
- [x] `@trace_node` on all orchestrator nodes
- [x] Post-run hook in `landscape_synthesis_node` — auto-score + `Observability` activity feed
- [x] `GET /health` reports `weave` + `auto_score` status
- [x] Tests: `observability/tests/` (45 tests) + `backend/tests/test_scorers.py`
- [x] Live verified — traces at [ccie-agents Weave UI](https://wandb.ai/mohitmanoj-barade-san-jose-state-university/ccie-agents/weave)

### Weave metrics & logging (enhanced)
- [x] **Aggregate metrics** — avg_freshness, avg_relevance, avg_product_coverage, avg_swot_completeness, total_news_items, total_products
- [x] **Per-competitor detail** — name, news_count, product_count, has_swot, threat_level, sentiment in Weave payload
- [x] **Memory metrics** — Redis connected, latency_ms, docs_indexed reported in observability activity
- [x] **Trace scorers** — 7 Weave scorers: freshness, relevance, guardrails, competitor_count, product_coverage, swot_completeness, intel_volume
- [x] **Guardrails** — stale_news, financial_hallucination, per-competitor violation tracking
- [x] **Activity feed** — Quality, Coverage, Guardrails, Memory status entries visible in playground UI

### Discovery & LLM (2026-06-06)
- [x] `llm/discovery.py` — extract competitors from Tavily search when LLM unavailable
- [x] Removed hardcoded PayPal/Adyen/Square default for unknown companies
- [x] `OPENAI_API_KEY` — LLM classify, discover, SWOT, landscape summary (live verified)
- [x] `ccie/.env.example` — documents Tavily, OpenAI, W&B, `CCIE_AUTO_SCORE` vars

### News quality improvements
- [x] Tavily `search_depth: "advanced"` for news queries
- [x] Date extraction fallback — parses dates from title/content when `published_date` is empty
- [x] Supports ISO (`2025-06-01`), named month (`January 15, 2025`), abbreviated (`Jun 3, 2025`)
- [x] Tests: `test_date_extraction.py` (8 tests)

### Agentic improvements (v2 — 2026-06-06 night)
- [x] **LLM-powered financial extraction** — `FinancialResult` Pydantic schema, GPT-4o-mini structured output from Tavily snippets, regex fallback when LLM unavailable
- [x] **Scoring v2** — `_financial_signals()` parses revenue/market cap/growth into size + momentum signals; threat/size/overlap now differentiate based on financials
- [x] **Relative quadrant placement** — `compute_market_quadrants` uses avg threat/size to split competitors into leader/challenger/visionary/niche (no longer all "leader")
- [x] **Hypothetical path hardening** — `_refine_hypothetical_description()` uses LLM to extract market context from vague startup ideas; multi-query search (`_build_hypothetical_queries`) for broader competitor discovery
- [x] Tests: `test_scoring.py` (12 tests — parsing, signals, metrics differentiation, quadrant placement)

### End-to-end
- [x] `ccie/backend/tests/test_integration.py` — full Stripe run + Redis session check
- [x] **152 tests** — 150 passed, 3 skipped (`WEAVE_DISABLED=1 ENV=test USE_MOCK_TOOLS=1 pytest backend/tests observability/tests -v`)

### Real tools (B2 — 2026-06-06)
- [x] Tavily web search when `ENV=prod` + `TAVILY_API_KEY` — news + products (no scraping)
- [x] Tests: `test_tools_prod.py` (parser unit + optional live Tavily)

### LLM agent harness (B1 — 2026-06-06)
- [x] `ccie/backend/llm/schemas.py` — `ClassifyResult`, `DiscoveryResult`, `FinancialResult`, `SwotResult`
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
| pytest green | 150 passed, 3 skipped | ✅ Verified 2026-06-06 |
| Backend server | `uvicorn main:app --port 8000` | ✅ Running |
| Real tools (Tavily) | Any company → relevant competitors + news | ✅ Verified (Stripe, Apple, PAN) |
| OpenAI LLM path | classify + discover + SWOT via `gpt-4o-mini` | ✅ Verified 2026-06-06 |
| Weave tracing | `GET /health` → `weave: true`; traces in W&B dashboard | ✅ Verified 2026-06-06 |
| Auto-score on run | `Observability` entries in activity feed | ✅ Verified (`CCIE_AUTO_SCORE=1`) |
| Redis live | `GET /health` → `redis.connected: true`; session persisted | ✅ Verified 2026-06-06 |
| Vector search | Semantic search returns indexed docs post-analysis | ✅ Verified 2026-06-06 |
| Weave metrics | 7 trace scorers + per-competitor + memory metrics in dashboard | ✅ Verified 2026-06-06 |
| Chat UI shows agent output | User types "Analyze Stripe" → chat response | ✅ Playground verified |
| Shared state → UI | `useCoAgent` renders competitors + activity | ✅ Playground state panel |
| Multi-turn chat | Second analysis replaces (not merges) competitors | ✅ Fixed 2026-06-06 |
| 3D buildings on discovery | R3F scene updates from state | ⬜ Not yet |

---

## Backend & Agent Harness — Next Steps

> **Works today:** Tavily + OpenAI live path, parallel swarms, Weave tracing + auto-score, playground E2E, 87 tests green.  
> **In progress:** B3 live Redis (another teammate).  
> **Not yet:** production frontend, 3D War Room, Financial Analyst, CI pipeline.

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

**Gate:** classifier + discovery use LLM; tests still green with mocks. ✅

---

### B2 — Real tools (swap mocks for prod)
| # | Task | Files / notes | Done |
|---|---|---|---|
| B2.1 | Finish Tavily integration in `web_search.py` (`ENV=prod`, `TAVILY_API_KEY`) | `tools/web_search.py`, `USE_MOCK_TOOLS` override | ✅ |
| B2.2 | Product/news intel via Tavily search only (no httpx scrape) | `tools/web_search.py` | ✅ |
| B2.3 | News Scout uses search results directly | `agents/news_scout.py` | ✅ |
| B2.4 | Product Tracker uses `search_products()` | `agents/product_tracker.py` | ✅ |
| B2.5 | Bind `@tool` wrappers into LangGraph tool nodes (not just direct function calls) | Optional refactor for traceability | ⬜ |
| B2.6 | Tests: keep mock path default; add `INTEGRATION=1` tool smoke tests | `tests/test_tools_prod.py` | ✅ |

**Gate:** `ENV=prod` runs real search/scrape for Stripe demo. ✅ Run with `OPENAI_API_KEY` + `TAVILY_API_KEY`.

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
| B4.1 | Split real vs hypothetical graph branches (classify → enrich/parse → discover/infer) | `orchestrator.py`, `graph.py` — routing exists but both paths merge early | ✅ |
| B4.2 | Parallel fan-out per competitor via LangGraph `Send` API | Replace sequential loop in `analyze_competitors_node` | ✅ |
| B4.3 | Compute `threat_level`, `market_size`, `market_overlap` from analysis | Populate fields for 3D encoding | ✅ |
| B4.4 | Populate `market_quadrants` in landscape synthesis | leader/challenger/niche/visionary | ✅ |
| B4.5 | Synthesis: LLM-generated SWOT + executive summary (replace template) | `agents/synthesis.py` | ✅ |
| B4.6 | Add **Financial Analyst** agent subgraph | `agents/financial_analyst.py`, `tools/financial_data.py` | ✅ |

**Gate:** 3–5 competitors analyzed in parallel; state fields ready for 3D scene. ✅

---

### B5 — Observability (Weave)
| # | Task | Files / notes | Done |
|---|---|---|---|
| B5.1 | Enable Weave in dev (`WANDB_API_KEY`, remove `WEAVE_DISABLED`) | Traces live in W&B dashboard | ✅ |
| B5.2 | Decorate graph nodes with `@trace_node` | `orchestrator.py` — all orchestrator nodes | ✅ |
| B5.3 | Custom scorers: freshness, relevance, accuracy | `observability/scorers.py` + P2 hook in `landscape_synthesis_node` | ✅ |
| B5.4 | Guardrails for hallucinated financial figures / stale news | `observability/guardrails.py` via `CCIE_AUTO_SCORE=1` | ✅ |

**Gate:** trace visible for full Stripe run; scorers run on agent outputs. ✅ Verified 2026-06-06.

---

### B6 — CopilotKit / API harness
| # | Task | Files / notes | Done |
|---|---|---|---|
| B6.1 | Verify full agent run via CopilotKit HTTP (not just registry page) | AG-UI SSE at `POST /api/copilotkit/`; playground proxy verified | ✅ |
| B6.2 | Add `CopilotKitMiddleware` if needed for frontend tool calls | `main.py` / graph compile | ⬜ |
| B6.3 | Register CopilotKit Actions (e.g. `render_building`) for GenUI | `main.py` | ⬜ |
| B6.4 | `.env.example` with all backend env vars documented | repo root or `ccie/` | ✅ |

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
- [x] `app/api/copilotkit/route.ts` — `LangGraphHttpAgent` → `http://127.0.0.1:8000/api/copilotkit/`
- [x] E2E verified — "Analyze Stripe" streams agent run + live shared state

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
| C2 | Replace heuristic classifier/discovery with LLM structured output | Agents | ✅ |
| C3 | Enable real web search (`TAVILY_API_KEY`, `ENV=prod`) | Agents | ✅ |
| C4 | Weave scorers — freshness, relevance on agent outputs | Observability | ✅ |
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
| D6 | Financial Analyst agent (stretch) | Agents | ✅ |
| D7 | Vector search: "Which competitor is strongest in X?" | Infra | ⬜ |
| D8 | Demo dry run — Stripe + one hypothetical company | All | ⬜ |

**Gate:** Day 2 Hour 3 (buildings appear) and Hour 6 (full demo).

---

## Deferred (Post-MVP)

- Redis Iris full MCP integration
- Multi-session delta detection ("what changed since yesterday")
- Weave leaderboard in demo UI
- LangGraph `@tool` node binding (B2.5 — optional refactor)
- Fix duplicate observability entries (wrap + landscape hook both score on `ainvoke`)
- Improve news `published_at` extraction further (URL patterns, meta tags)

---

## Quick Commands

```bash
# Tests (backend + observability)
cd ccie && source .venv/bin/activate
WEAVE_DISABLED=1 ENV=test USE_MOCK_TOOLS=1 pytest backend/tests observability/tests -v

# Backend (loads ccie/.env — Tavily, OpenAI, Weave)
cd ccie/backend && source ../.venv/bin/activate
uvicorn main:app --reload --port 8000

# Playground
cd ccie/playground && npm run dev

# Redis (B3 — when ready)
cd ccie && docker compose up -d

# Health + Weave status
curl http://127.0.0.1:8000/health

# Manual traced run
cd ccie/backend
python -m observability.trace_runner --scenario stripe --score --apply-scorers
```

### Required `ccie/.env` for full demo

```bash
TAVILY_API_KEY=...
OPENAI_API_KEY=...
ENV=prod
USE_MOCK_TOOLS=0
WANDB_API_KEY=...
CCIE_AUTO_SCORE=1
# do NOT set WEAVE_DISABLED=1 when tracing
```

---

## Changelog

| Date | Change |
|---|---|
| 2026-06-06 | Agents layer complete — orchestrator, News Scout, Product Tracker, Synthesis, Redis, CopilotKit endpoint, 24 tests green |
| 2026-06-06 | CopilotKit registry page verified — `ccie_agent` live at `:8000/api/copilotkit/` |
| 2026-06-06 | Created this progress tracker |
| 2026-06-06 | Added `ccie/playground/` — dev-only CopilotKit UI for backend testing (`ccie/frontend/` reserved) |
| 2026-06-06 | B2 complete — Tavily search-only tools; live scrape removed |
| 2026-06-06 | B4 complete — parallel Send swarms, competitor scoring, market quadrants, LLM SWOT, branched graph |
| 2026-06-06 | Discovery fix — search-based competitor extraction; removed Stripe-only hardcoded defaults |
| 2026-06-06 | State reset on new analysis — fixes stale competitors in multi-turn playground chat |
| 2026-06-06 | OpenAI integration verified — classify/discover/SWOT via `gpt-4o-mini` |
| 2026-06-06 | Merged P4 observability module (Weave scorers, guardrails, eval CLI) from teammate |
| 2026-06-06 | B5 integrated — `@trace_node`, `wrap_graph_for_observability`, auto-score hook; Weave traces live |
| 2026-06-06 | 87 tests green (backend + observability); git reconciled with remote `main` |
| 2026-06-06 | Redis MemoryService integrated — agents use `get_memory_service()`, auto-index, vector search |
| 2026-06-06 | Weave metrics enhanced — 7 trace scorers, per-competitor detail, memory + coverage metrics |
| 2026-06-06 | Financial Analyst agent — revenue, funding, market cap, growth per competitor via Tavily |
| 2026-06-06 | News quality — Tavily advanced search depth, date extraction fallback from content/title |
| 2026-06-06 | Fix: Tavily sometimes returns strings instead of dicts — guard in web_search + financial_data |
| 2026-06-06 | Graceful Redis startup — `verify_redis_on_startup(strict=False)` so app starts without Docker |
| 2026-06-06 | 140 tests green (backend + observability + financial + date extraction) |
| 2026-06-06 | LLM-powered financial extraction — `FinancialResult` structured output, regex fallback |
| 2026-06-06 | Scoring v2 — financial signals (revenue/growth), relative quadrant placement |
| 2026-06-06 | Hypothetical path hardening — LLM description refinement + multi-query search |
| 2026-06-06 | 150 tests green (added `test_scoring.py` 12 tests + new financial tests) |
| 2026-06-06 | `DATA_CONTRACT.md` — formal backend↔frontend data contract for 3D War Room |
| 2026-06-06 | Frontend: typed `Financials` interface, financials section in `DetailPanel`, typed `MarketQuadrants` |
