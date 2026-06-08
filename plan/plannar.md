# P3 Frontend — 3D War Room (Planner)

Living planning doc for the **Person 3 (Frontend Wizard)** track of CCIE.
Updated continuously as work proceeds. See `implementation_plan.md` for the full project spec.

## Goal

Build the production frontend in `ccie/frontend/` (the existing `ccie/playground/` is only
a backend test harness). The centerpiece is a **3D isometric "war room" city**: the target
company sits at the center, competitors are buildings around it, and the scene updates in
real time from the live CopilotKit shared state (`CCIEState`).

### Visual target

Stylized isometric city skyline (reference: Silicon Valley isometric art the user shared).
- Orthographic isometric camera + orbit controls
- Ground plane with a road grid and greenery
- Competitor buildings arranged around a central target tower
- Buildings animate up from the ground as agents discover them

### Visual encoding (from implementation_plan.md)

| Visual property | Maps to | State field |
|---|---|---|
| Building height | Competitive threat | `competitor.threat_level` |
| Building color/glow | Sentiment | `competitor.sentiment` |
| Building width | Market presence | `competitor.market_size` |
| Distance from center | Market overlap | `competitor.market_overlap` |
| Particles | Active agent flow | `competitor.status === "analyzing"` |

## Tech

Next.js (App Router, TS) + CopilotKit (`useCoAgent`) + React Three Fiber + drei + three.

## Architecture

```
ccie/frontend/
├── app/
│   ├── layout.tsx              # CopilotKit provider
│   ├── page.tsx                # War room layout (3D + chat + panels)
│   ├── globals.css             # dark premium theme
│   └── api/copilotkit/route.ts # proxy to FastAPI backend
├── components/
│   ├── WarRoom.tsx             # R3F Canvas + scene
│   ├── CityGround.tsx          # ground plane + road grid + greenery
│   ├── CompetitorBuilding.tsx  # one building (encoding + animation + click)
│   ├── TargetTower.tsx         # central target company building
│   ├── DetailPanel.tsx         # selected competitor deep-dive (GenUI-ish)
│   ├── ActivityFeed.tsx        # live agent activity stream
│   └── PhaseBar.tsx            # phase + target header
├── lib/
│   └── visuals.ts              # state -> color/height/size/position helpers
└── types/ccie.ts               # CCIEState mirror of backend/state.py
```

## Step-by-step progress

- [x] 1. Planner created
- [x] 2. Scaffold `ccie/frontend` (package.json, tsconfig, next config, .gitignore)
- [x] 3. CopilotKit provider (`layout.tsx`) + API proxy (`api/copilotkit/route.ts`) + `globals.css`
- [x] 4. Types (`types/ccie.ts`) + visual-mapping helpers (`lib/visuals.ts`) + mock data (`lib/mock.ts`)
- [x] 5. 3D scene shell: iso ortho camera, lights, ground + road grid + trees (`WarRoom`, `CityGround`)
- [x] 6. `CompetitorBuilding` + `TargetTower` (threat→height, sentiment→color, size→width, animate-in, sparkles when analyzing, labels, click-to-select)
- [x] 7. Page composition: 3D + CopilotChat + `DetailPanel` + `ActivityFeed` + `PhaseBar`
- [x] 8. `npm run build` passes; dev server verified (HTTP 200) on :3001

### What's built (iteration 1)

A working isometric 3D war room:
- Orthographic iso camera + orbit/pan/zoom controls
- Dark city plate with a blue road grid and scattered low-poly trees
- Central target tower with a rotating beacon (gold = real, purple = hypothetical)
- Competitor buildings arranged radially (closer = more market overlap), rising with an
  ease-out animation, color = sentiment, height = threat, width = market size
- Cyan sparkle particles + emissive pulse on buildings currently `analyzing`
- Hover/selection ground rings; click a building → right-side `DetailPanel`
  (threat/size/overlap meters, products, news, SWOT)
- Top `PhaseBar` (phase progress + counts), bottom-left live `ActivityFeed`
- "Load demo city" button (uses `lib/mock.ts`) so the scene is demo-able without the backend

## How to run

Backend (optional for live data) — from `ccie/backend`:
`WEAVE_DISABLED=1 uvicorn main:app --reload --port 8000`

Frontend — from `ccie/frontend`:
`npm install` then `npm run dev` (defaults to :3000; use `--port 3001` if the playground holds 3000).
Open the printed URL; click **Load demo city** to preview the skyline immediately.

## Iteration 2 — UX flow + fixes (done)

Driven by user feedback + screenshot.

- [x] **Bugfix:** giant yellow blobs were drei `<Html distanceFactor>` labels blowing up
  under the orthographic camera. Removed `distanceFactor` → labels now render at fixed size.
- [x] **Blank-on-load:** no buildings until a target company exists. Idle = green "greenland"
  ground with trees + center hint ("Empty land, ready to build").
- [x] **Target-on-input:** the entered company becomes the central tower; competitors rise
  around it (only when `target_company` is set in state).
- [x] **Roads:** new `components/three/Roads.tsx` — asphalt spokes with glowing center lines
  from the central plaza out to each competitor, plus a ring road (reference-style links).
- [x] **Camera:** wider framing (ortho zoom 17, pos [34,30,34]) so the whole city fits.
- [x] Ground switches green→city plate + road grid once a target exists.

### Important: live data needs the backend

The `fetch failed` console error = the chat agent (`ccie_agent`) can't reach the Python
backend. To drive the city by typing a company, run the backend:

```
cd ccie/backend && WEAVE_DISABLED=1 uvicorn main:app --reload --port 8000
```

Without it, use **Load demo city** (local mock) to preview the skyline. The target tower
appears as soon as the backend sets `state.target_company`; competitors fill in as they're
discovered.

## Iteration 3 — hardcoded "Analyse Stripe" demo + agent connections (done)

A fully local, animated end-to-end run so the whole UI can be tested without the backend.

- [x] `lib/mock.ts`: enriched hardcoded Stripe dataset (6 competitors w/ news, products, SWOT).
- [x] `lib/simulation.ts`: scripted runtime that drives the real `CCIEState` over ~11s:
  classify → discover (buildings spawn one-by-one) → analyze (per-competitor agents run) →
  synthesize → complete; appends live `agent_activity`; fills news/products/SWOT/sentiment
  as each agent finishes. Returns a cancel fn.
- [x] Agent types: `AgentRole`, `AgentNode`, `Competitor.agents?` (frontend-only viz field).
- [x] `components/three/ConnectionLine.tsx`: drei `Line` link + a data packet that streams
  along it while an agent is `running` (dashed/faint when idle/done).
- [x] `components/three/AgentCluster.tsx`: our 3 analysis agents as small buildings fanned
  out on the outward side of each competitor, each wired back to the competitor building.
  News Scout = blue, Product Tracker = green, Financial Analyst = amber; pulse while running.
- [x] `WarRoom` renders an `AgentCluster` per competitor that has agents.
- [x] `page.tsx`: header **▶ Analyse Stripe** button runs the simulation (and **↺ Reset**);
  live backend state still takes precedence when present.

How to test: open the app, click **▶ Analyse Stripe**, watch the sequence play out. Click any
building for its detail panel (news/products/SWOT/meters).

## Iteration 4 — remove hardcoded demo + integration readiness (done)

- [x] Deleted `lib/simulation.ts` and `lib/mock.ts`.
- [x] `app/page.tsx` now reads **only** live `useCoAgent` state (removed sim state, demo
  button, "Analyse Stripe"/Reset). Empty greenland until the backend sets `target_company`.
- [x] Frontend rebuilds clean; dev server verified (HTTP 200).
- [x] `AgentCluster`/`ConnectionLine` kept (data-driven, inert until backend emits agent data).

### Frontend ↔ Backend integration checklist

Frontend (verified ✅):
- [x] Production app at `ccie/frontend/`; `npm run build` passes; dev runs.
- [x] Reads live state via `useCoAgent({ name: "ccie_agent" })` only (no mock/sim).
- [x] Agent name `ccie_agent` matches backend `LangGraphAGUIAgent(name="ccie_agent")`.
- [x] Proxy `/api/copilotkit` → `LangGraphHttpAgent` → `CCIE_BACKEND_URL`
      (default `http://127.0.0.1:8000/api/copilotkit/`) matches backend mount.
- [x] State contract (`types/ccie.ts`) matches backend `CCIEState`/`Competitor`/`NewsItem`/
      `ProductItem`/`AgentActivity`. Extra backend fields (`competitor_name`, `session_id`)
      are ignored safely.

Backend (verified ✅):
- [x] Python venv at `ccie/.venv` (3.14.4); requirements installed (added missing
      `python-dotenv` + `langchain-community`).
- [x] `ccie/.env` complete: OpenAI, Tavily (`ENV=prod`, `USE_MOCK_TOOLS=0`), Redis **Cloud**
      URL, WANDB. (Gotcha hit: editor buffer was unsaved → on-disk file only had WANDB, so
      config fell back to defaults. Persisted to disk; now loads correctly.)
- [x] Test suite green: `91 passed, 3 skipped`.
- [x] Redis Cloud reachable (`connected: true`, ~84ms via /health).
- [x] Server boots: `uvicorn main:app --port 8000` → Weave logged in, startup complete.
      `/health` = `{status: ok, agent: ccie_agent, weave: true, redis.connected: true}`.
- [x] Live end-to-end `Analyze Stripe` (real OpenAI + Tavily): phase `complete`, classified
      real, 5 competitors (PayPal/Square/Braintree/Adyen/Shopify Payments) each with 5 news +
      5 products, landscape summary generated.
- Minor: `TavilySearchResults` deprecation warning (works; future move to `langchain-tavily`).
- Note: `CCIE_AUTO_SCORE` unset → observability auto-scoring off (optional).
- [ ] `ccie/.env` keys (auto-loaded by `config.py`): `TAVILY_API_KEY` for web search,
      `OPENAI_API_KEY` for classify/discovery/SWOT/summary. Currently only `WANDB_API_KEY` set.
      Without keys: run with `USE_MOCK_TOOLS=1` (heuristic/mock) to integrate plumbing first.
- [ ] Start server: `cd ccie/backend && WEAVE_DISABLED=1 uvicorn main:app --reload --port 8000`.
- [ ] (Optional) Redis for memory/cache/vector — not running now; backend boots **degraded**
      (non-strict startup), basic flow still works.

Wiring notes:
- [ ] Port: `playground` holds 3000; this frontend runs on **3001**. Either stop the playground
      and run frontend on 3000, or keep 3001.
- [x] CORS: backend allows only `:3000`, but the browser talks to the **Next.js proxy route**
      (server→backend fetch), so browser CORS doesn't apply. (Optional: add `:3001` to backend
      CORS as a safety net for any direct calls.)

Known gap (decision needed):
- [ ] **Agent-level viz**: `AgentCluster` needs a per-competitor `agents` field (role + status)
      from the backend. Backend `Competitor` has no `agents` yet → agent buildings stay hidden
      with live data. Options: (a) add `agents` to backend `Competitor` state, or (b) drop the
      agent-building layer for v1.

## Iteration 5 — live frontend↔backend integration (done)

Goal: typing "Analyse <company>" drives the city like the hardcoded demo, from real agents.

- [x] Confirmed backend streams state incrementally via `safe_emit_state`:
  classify → discover (emits each competitor one-by-one) → analyze fan-out
  (News Scout sets `analyzing` + news; Synthesis sets `complete` + SWOT/metrics) → synthesize.
- [x] Frontend derives per-competitor agents from `competitor.status` (`lib/visuals.deriveAgents`)
  since backend has no `agents` field: discovering → none, analyzing → running, complete → done.
  → agent buildings + connection packets light up live, matching the demo.
- [x] `page.tsx` passes `sceneCompetitors` (status-derived agents) to `WarRoom`.
- [x] Type-check (`tsc --noEmit`) + lints clean.
- [x] Both servers up & connected: backend `:8000` (`/health` ok, redis connected, weave on),
  frontend `:3001`; observed `POST /api/copilotkit 200` round-trips backend↔frontend.

Live behavior when you type "Analyse Stripe":
- target tower spawns → competitor buildings spawn one-by-one on roads
- each competitor: agents attach + run (cyan packets) while `analyzing`, turn solid on `complete`
- detail panel: real news / products / SWOT; activity feed + phase bar stream live

Cosmetic note: agent viz shows News Scout / Product Tracker / Financial Analyst; backend
actually runs News Scout / Product Tracker / Synthesis (3rd label is decorative for now).

## Next iterations (backlog)

- [ ] Landscape vs competitor view toggle + market quadrant overlay
- [ ] Connection/trend lines between related competitors
- [ ] Replace procedural boxes with windowed/tiered building meshes (more "city" detail)
- [ ] Smooth camera fly-to selected building on click
- [ ] CopilotKit GenUI: render `CompetitorCard`/`SWOTTable` inline in chat
- [ ] Surface Observability (P4) guardrail warnings in the activity feed
- [ ] Move/replace the `playground` once frontend is the canonical UI

## Notes / decisions

- Frontend talks to backend through the same `/api/copilotkit` proxy pattern as the playground.
- Agent name is `ccie_agent` (matches backend + playground).
- Day 1 can run with mock state if backend isn't up; the components read `CCIEState` directly.

## Open questions

- Use real GLTF building models later, or keep procedural boxes for the hackathon? (Default: procedural now, models as stretch.)
