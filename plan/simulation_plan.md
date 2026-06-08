# Acquisition War-Game Simulator — Implementation Plan

> Post-baseline evolution of CCIE. We turn the static competitive map into a
> **forward-looking, multi-agent acquisition simulator** for a C-suite executive.
> Each big building is a real company run by an **autonomous CEO-agent** (a digital
> twin built from public data). The user war-games an acquisition across ~10
> branching iterations, each grounded in real, current information.

---

## 1. Product Vision (the "why")

A C-suite executive wants to acquire a smaller software startup. Before doing the
real deal, they **war-game it**: make the move, watch how the big-tech incumbents
react (as autonomous CEO-agents), and see what strategic choices open up. Each
choice reshapes the board for the next iteration — like chess, non-deterministic,
path-dependent. After ~10 iterations the exec has stress-tested multiple
strategies and knows, in advance, how the market is likely to respond.

**Sector focus:** core software / big tech (Apple, Amazon, Alphabet/Google, Meta,
Microsoft, Nvidia, etc.). The small building = the acquisition target startup; the
big buildings = the incumbents.

**Non-negotiable:** everything is grounded in **real public data**. Personas and
every iteration's reasoning are anchored to who the companies genuinely are. The
sim projects forward from real starting conditions — it does not invent facts.

---

## 2. The Core Metaphor → System Mapping

| Concept (product) | Backend representation | Frontend representation |
|---|---|---|
| Sector | `Sector` (roster of incumbents) | Skyline backdrop / sector label |
| Incumbent company | `CompanyPersona` + CEO-agent | Big building (own agent) |
| Acquisition target | `AcquisitionTarget` | Small building (highlighted) |
| The user (acquirer) | `PlayerProfile` | Player HUD / their tower |
| A turn | `SimulationIteration` | Board animation + decision panel |
| A reaction | `AgentReaction` | Building action (attack/ally/expand) |
| The choices offered | `DecisionPoint.options` | Choice cards + free-text input |
| Board state | `BoardState` (deltas) | Building heights/colors/links |
| Full game | `SimulationState` (history tree) | Iteration timeline (1..10) |
| Reasoning replay | Weave traces + Redis ledger | Click player building → replay view |

---

## 3. What We Reuse vs. Build New

**Reuse (baseline is a great substrate):**
- Real-data tools: `tools/web_search.py`, `tools/financial_data.py`,
  `tools/web_scrape.py`, and the enrichment agents (`news_scout`,
  `product_tracker`, `financial_analyst`).
- Competitor discovery (`llm/client.py`, `llm/discovery.py`).
- LangGraph + `MemorySaver` checkpointer (enables multi-turn iteration state).
- CopilotKit bidirectional state sync (`CCIEState`, `useCoAgent`).
- 3D city (`components/three/*`) and UI overlays.
- Observability (Weave traces, scorers, guardrails) for per-iteration evals.

**Build new:**
- **Persona builder** → CEO/company digital twin from public data.
- **Simulation engine** → turn-based loop with per-CEO autonomous agents.
- **Market referee** → adjudicates interacting reactions into a new board state.
- **Decision-point generator** → produces the choices each round.
- **Human-in-the-loop loop** → pause for user choice (or free-text), then continue.
- **Board/decision UI** → iterations, choices, animated reactions, timeline.
- **Outcome scoring + strategy recommendation** + branch/backtrack tree.
- **Reasoning replay / decision ledger** → post-game audit view of every agent's
  chain-of-thought and decisions, sourced from **Weave** (traces) + **Redis**
  (the agents' own data repository).

---

## 4. Key Technical Decisions (to confirm during Phase 0)

1. **Agent autonomy model:** *Hybrid* — each incumbent is an independent LLM
   CEO-agent that reasons in-character and proposes a move; a separate **market
   referee** step adjudicates how those moves interact into outcomes. (Avoids one
   monolithic prompt; keeps personas distinct; keeps interactions realistic.)
2. **Real-data freshness:** *Snapshot + targeted live lookups*. Build personas and
   a board snapshot upfront; each iteration fires **targeted** live queries only
   for signals relevant to the current move (keeps it real-time without re-scraping
   everything every turn).
3. **Iteration control:** LangGraph **interrupt / human-in-the-loop** between
   iterations, persisted via the existing checkpointer; CopilotKit drives the
   multi-turn UX. Each iteration is one resumable graph segment.
4. **Branching/reproducibility:** Persist the full **decision tree** (every
   iteration's state + chosen option) so the user can backtrack and try alternate
   branches. Seed randomness for reproducibility.
5. **Player identity:** The exec plays as a defined acquirer (`PlayerProfile`).
   Confirm whether they *are* one of the incumbents or a neutral acquirer — affects
   how rival CEO-agents target them.
6. **Two-tier data plane (source of truth for replay):**
   - **Redis = the agents' live repository.** Every agent stores/fetches its
     working data here — persona, per-iteration reactions, decisions, board state,
     and grounding evidence — keyed by `session:company:iteration`. This is the
     canonical record the replay reads structured facts from.
   - **Weave (W&B) = the reasoning/trace layer.** Every agent + referee call is a
     traced op, so Weave holds the full chain-of-thought, prompts, tool calls, and
     model outputs. The replay links each decision to its Weave trace for the
     "why," while Redis supplies the structured "what."
   - The replay view **joins** the two: Redis ledger entries carry `weave_trace_id`
     pointers so the UI can show the structured decision *and* drill into the
     reasoning that produced it.

---

## 5. Data Model Sketch (new schemas)

```
Sector
  name, incumbents: [company_name], notes

CompanyPersona            # the CEO digital twin (grounded in public data)
  name
  strategy_thesis         # long-term bets, positioning
  ethos / culture         # how they operate & decide
  m_and_a_history         # real past acquisitions / track record
  financial_firepower     # cash, margins, what they can afford
  temperament             # aggressive / litigious / partner-first / wait-and-see
  recent_moves            # latest real signals (news/launches/layoffs)
  leadership_style
  sources[]               # citations (URLs) — grounding evidence

AcquisitionTarget
  name, description, why_attractive, price_estimate, capabilities, sources[]

PlayerProfile
  company, resources, objective (what a "win" looks like)

AgentReaction             # one CEO-agent's response in an iteration
  actor (company), intent, action, rationale (cites real data), intensity
  weave_trace_id          # pointer into Weave for the full chain-of-thought
  redis_key               # where this entry lives in the agent's repository

LedgerEntry               # one auditable record in the decision ledger (Redis)
  session_id, iteration_index, actor (company | referee | player)
  kind (reaction | adjudication | choice | grounding)
  summary, structured_payload, evidence[] (sources)
  weave_trace_id          # join key into the Weave reasoning trace
  ts

BoardState                # quantified state after referee adjudication
  per-company: market_position, threat, sentiment, alliances[], pressure
  player: position, momentum, risk

DecisionPoint
  iteration_index
  situation_summary
  options: [{ id, label, expected_effect, risk }]
  allow_free_text: true

SimulationIteration
  index, move (player action), reactions[], referee_outcome,
  board_delta, decision_point, chosen_option

SimulationState
  sector, target, player, personas[], iterations[] (history tree),
  current_index, status (running | awaiting_choice | complete),
  final_recommendation
```

These extend the shared state (parallel to `CCIEState`) so the frontend can render
the board and decision panel live.

---

## 6. Phase-by-Phase Plan

Each phase lists: **Goal**, **Backend**, **Frontend**, **Real-data**, and **Done when**.

### Phase 0 — Foundations, scope, sector roster
- **Goal:** Lock decisions in §4, define schemas, set up the sector.
- **Backend:** Add new schemas (§5). Define the big-tech sector roster (curated
  list of incumbents to keep the demo focused and reliable). Add a parallel
  `SimulationState` to the shared state contract; stub a new graph alongside the
  existing one (don't break the baseline).
- **Frontend:** Add types mirroring the new schemas; feature-flag a "Simulation"
  mode so the baseline map keeps working.
- **Real-data:** Decide source set (search, financials, filings, news) and a
  citation convention so every persona/claim is traceable.
- **Done when:** schemas compile, sim mode toggles, baseline still works.

### Phase 1 — Company Persona Builder (CEO digital twins)
- **Goal:** Turn a real company into a structured CEO/company persona from public
  data. This is the heart of "the agent thinks like that company."
- **Backend:** A `persona_builder` step that, per incumbent: runs targeted real
  searches (strategy, financials, M&A history, recent moves, leadership), then an
  LLM distills a `CompanyPersona` with **source citations**. Cache personas in
  Redis (keyed by company) so iterations are fast and consistent.
- **Frontend:** "Inspect company" panel showing the persona (strategy, ethos,
  firepower, temperament) with sources — builds user trust in the grounding.
- **Real-data:** Heavy real-data phase — every persona field cites where it came
  from. Guardrail: drop/flag fields lacking evidence.
- **Done when:** for the big-tech roster we get distinct, accurate, cited personas
  (e.g., Amazon vs. Apple read clearly differently).

### Phase 2 — Single-Iteration Simulation Core (one turn, end-to-end)
- **Goal:** Given a board + a player move, produce **one** iteration: reactions →
  referee outcome → board delta → a decision point. Prove the loop with N=1.
- **Backend:** `run_iteration` node that fans out to each CEO-agent (reuse the
  fan-out pattern from `fan_out_competitors`), collects `AgentReaction`s, then a
  `market_referee` LLM step adjudicates into a `BoardState` delta and writes a
  `DecisionPoint`. Each CEO-agent prompt = persona + current board + the move.
- **Frontend:** Render the move, animate one round of reactions on the board, show
  the resulting choices in a decision panel (no loop yet).
- **Real-data:** Targeted live lookups for signals the move implicates (e.g., if
  the move touches payments, pull fresh payments-market signals).
- **Done when:** one acquisition move yields distinct, in-character, cited
  reactions and a coherent set of next-step choices.

### Phase 3 — Multi-Agent Interaction & Market Referee
- **Goal:** Make reactions **interact** (CEO-agents respond to the move *and to
  each other*), producing emergent, believable dynamics.
- **Backend:** Two-pass reaction (initial reaction → see others' moves → adjust),
  then referee resolves conflicts (price wars, counter-bids, alliances, talent
  raids, regulatory pressure) into consistent outcomes + quantified deltas.
  Enforce persona-consistency and real-data citations via guardrails.
- **Frontend:** Visualize interactions — alliance links, attack arrows, pressure
  on the target, building changes reflecting deltas.
- **Real-data:** Cross-checks so adjudicated outcomes stay plausible vs. real
  company capabilities (a small player can't out-spend a giant).
- **Done when:** reactions visibly account for each other and the board state moves
  in believable, explainable ways.

### Phase 4 — Decision Loop & Human-in-the-Loop (10 iterations)
- **Goal:** Full chess loop: choice → next iteration → … up to 10, path-dependent.
- **Backend:** Wrap the iteration in a LangGraph **interrupt**: after emitting a
  `DecisionPoint`, pause; on user choice (or free-text), resume with that as the
  next move. Persist each iteration to the `SimulationState` history tree via the
  checkpointer. Stop at 10 or on user "end game."
- **Frontend:** Decision panel with **choice cards + free-text**; selecting drives
  the next turn. Iteration **timeline (1..10)** with the ability to revisit prior
  turns.
- **Real-data:** Per-iteration grounding refresh keyed to the chosen move.
- **Done when:** a user can play 10 connected, branching turns, each reacting to
  their last decision.

### Phase 5 — Frontend Board Experience (polish the "war room")
- **Goal:** Make the 3D city read as a living strategic board.
- **Frontend:** Repurpose `WarRoom`/`CompetitorBuilding`/`Roads`/`ConnectionLine`/
  `AgentCluster` for: highlighted acquisition target, incumbent CEO buildings,
  alliance/attack edges, per-iteration animated transitions, player HUD, decision
  panel, iteration timeline, and an "explain this reaction" hover (shows the
  agent's cited rationale).
- **Real-data:** Surface citations inline so every visible effect is traceable.
- **Done when:** the board clearly tells the story of each turn at a glance.

### Phase 6 — Real-Time Grounding Layer
- **Goal:** Guarantee "everything on real data" holds across iterations.
- **Backend:** A `grounding` service that, per iteration, fetches the freshest
  signals relevant to the move/companies, caches them (Redis) with TTL, and feeds
  them into agent + referee prompts. Attach evidence to every reaction/outcome.
- **Real-data:** Define freshness/TTL policy; fallbacks when live data is sparse
  (degrade gracefully, never hallucinate).
- **Done when:** any iteration can show "what real info drove this," and stale data
  is refreshed automatically.

### Phase 7 — Outcome Scoring, Strategy Recommendation, Branching
- **Goal:** Make the sim *useful* — quantify outcomes and recommend the best path.
- **Backend:** Per-iteration scoring (player position, risk, momentum, market
  share deltas). Maintain the **branch tree** so users can backtrack and compare
  paths. A final `recommendation` synthesizing which strategy/path performed best
  and why (cited).
- **Frontend:** Per-turn impact readout (deltas), a "recommended move" hint, a
  branch/compare view, and a final strategy report.
- **Done when:** after a playthrough the exec gets a clear, evidence-backed
  recommendation and can compare alternate branches.

### Phase 8 — Reasoning Replay & Decision Ledger (click-to-audit)
- **Goal:** After the game, clicking the **player's building** opens a beautiful
  replay of the entire run — every agent's chain-of-thought, the decisions each CEO
  made, the referee's adjudications, and what happened each turn. This is the
  "show your work" payoff that makes the whole simulation trustworthy.
- **Data plane (per §4.6):**
  - **Redis = agents' repository (the "what").** Throughout Phases 2–7, every
    agent/referee/choice writes a `LedgerEntry` to Redis (structured decision +
    evidence + `weave_trace_id`). This phase formalizes the schema and a
    `ledger` read API that returns the full, ordered run for a session.
  - **Weave = reasoning trace (the "why").** Agent/referee ops are already traced;
    we ensure each emits a stable `weave_trace_id` and expose a read path (Weave
    API/links) so the UI can fetch/deep-link the chain-of-thought behind any entry.
- **Backend:** `ledger_service` (write during iterations, read for replay) over
  Redis; a `replay` endpoint that assembles per-iteration, per-agent timelines and
  joins Redis entries to their Weave traces.
- **Frontend:** Click player building → **Replay UI**: a turn-by-turn timeline;
  per-agent "thought cards" (decision + rationale + cited evidence) expandable into
  the full Weave chain-of-thought; the referee's adjudication per turn; board-state
  evolution; and the final recommendation. Polished, narrative, scannable.
- **Real-data:** Every replay card shows its evidence/citations; Weave links prove
  the reasoning is real, not reconstructed after the fact.
- **Done when:** clicking the player building reliably reconstructs the complete,
  accurate run from Redis + Weave, with drill-down into any agent's reasoning.

### Phase 9 — Observability, Evals, Guardrails, Hardening
- **Goal:** Trustworthy, demo-ready, measurable.
- **Backend:** Weave traces per iteration/agent; scorers for
  grounding/persona-consistency/plausibility; guardrails against ungrounded claims;
  performance (parallelize agents, cache personas/grounding); reproducibility seed.
- **Frontend:** Loading/empty/error states across the loop; resilience to partial
  data.
- **Done when:** evals pass thresholds, traces are clean, and a full 10-iteration
  game runs reliably end-to-end on real data.

---

## 7. Suggested Build Order / Milestones

1. **M1 (Phases 0–1):** Personas — distinct, cited CEO twins for the big-tech roster.
2. **M2 (Phases 2–3):** One rich, interactive iteration end-to-end.
3. **M3 (Phase 4):** Full 10-iteration human-in-the-loop game.
4. **M4 (Phases 5–7):** Board UX + grounding + scoring/recommendation.
5. **M5 (Phase 8):** Click-to-audit reasoning replay (Redis ledger + Weave traces).
6. **M6 (Phase 9):** Evals, guardrails, polish, demo.

> Note: the Redis decision ledger is **written incrementally** starting in Phase 2
> (every agent persists its decisions + `weave_trace_id` as it runs); Phase 8 then
> formalizes the schema and builds the read/replay experience on top of it.

Vertical-slice first: get **sector → pick target → one real iteration** working
before scaling to 10, so we validate quality early.

---

## 8. Risks & Mitigations

- **Hallucinated dynamics** → guardrails + mandatory citations + plausibility
  scorer; degrade gracefully when data is thin.
- **Combinatorial blow-up over 10 turns** → bounded action space per turn,
  referee summarizes board to keep prompts tight, cache aggressively.
- **Latency (many agents × many turns)** → parallel agent fan-out, persona/grounding
  caches, snapshot-plus-targeted-lookup data policy.
- **Persona drift / sameness** → per-company evidence, persona-consistency eval,
  temperature/style controls.
- **Scope creep** → strict vertical slice + milestones; baseline stays intact
  behind a feature flag.

---

## 9. Open Questions (confirm before Phase 0)

1. Is the player one of the incumbents, or a neutral acquirer?
2. Fixed curated big-tech roster, or dynamically discovered per sector?
3. Are the 10 iterations fixed-length, or can the user end early / extend?
4. Should we support backtracking/branch comparison in v1, or linear first?
5. What defines a "win" for the exec (the objective the recommendation optimizes)?
6. Replay depth: show **summarized** reasoning per decision, or full **raw**
   chain-of-thought from Weave (with drill-down)?
7. Weave access: fetch traces **live** from the W&B API at replay time, or mirror
   the key reasoning into Redis so replay works without a Weave round-trip?
