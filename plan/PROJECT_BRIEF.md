# CCIE / Acquisition War-Game — Judge Brief

> **Project:** CCIE (Continuous Competitive Intelligence Engine) → evolved into the **Acquisition War-Game Simulator**
> **One-liner:** Type a company (real or hypothetical) and a swarm of specialist AI agents builds a live competitive landscape — then lets a C-suite executive *war-game an acquisition* against autonomous CEO-agent "digital twins" of the real incumbents, with every decision grounded in real public data and fully auditable.
> **Live observability:** [`ccie-agents` on W&B Weave](https://wandb.ai/mohitmanoj-barade-san-jose-state-university/ccie-agents/weave)

---

## 1. Project Goal

### The problem
Competitive intelligence and M&A strategy today are **slow, static, and unaccountable**. An analyst spends days assembling a competitor deck that is stale the moment it ships, and a strategy exec deciding on an acquisition has no way to *simulate* how the market's giants will actually respond before committing capital. Existing AI tools make this worse by hallucinating numbers with zero traceability — fatal for business decisions where a wrong figure means a wrong bet.

### What we built
A two-layer system on a single agent substrate:

1. **CCIE (intelligence layer).** You type a company name — *real* ("Analyze Stripe") or *hypothetical* ("I'm building an AI legal-doc-review platform for mid-size law firms at $50–200/mo"). A LangGraph **swarm of specialist agents** (News Scout, Product Tracker, Financial Analyst, Synthesis) fans out, auto-discovers 3–5 competitors, analyzes each in parallel, and renders the landscape as an interactive **3D city** that updates in real time.

2. **Acquisition War-Game (simulation layer).** Each big building becomes an **autonomous CEO-agent** — a digital twin of a real incumbent (Apple, Amazon, Google, Microsoft, Nvidia…) built from public data with cited sources. The exec makes an acquisition move; the CEO-agents react *in character and to each other* (escalate, counter-bid, ally, apply legal/regulatory pressure); a **market referee** adjudicates the interactions into a new board state and offers the next set of choices. Over ~10 branching, path-dependent iterations the exec stress-tests strategies and gets an evidence-backed recommendation.

### Non-negotiable design principle
**Everything is grounded in real, current public data, and everything is auditable.** Every persona field and every reaction carries source citations; every agent decision is traced in Weave (the "why") and recorded in Redis (the "what"), joined by a `weave_trace_id` so any decision can be replayed and verified. We degrade gracefully when data is thin — we never invent facts.

---

## 2. Sponsor Tools — Core to the Architecture (not bolted on)

The stack was chosen so the sponsor tools are **load-bearing**: remove any one and the product materially breaks. The key architectural insight is that **CopilotKit's CoAgents are built on LangGraph**, which gives native shared state + generative UI, and **W&B Weave has first-class LangGraph tracing** — so observability and a real-time agent-native UI come essentially for free.

```
Browser ──AG-UI──► CopilotKit (useCoAgent + GenUI) ──► React Three Fiber 3D War Room
                          │ HTTP
                          ▼
                  FastAPI + CopilotKit SDK
                          │
                          ▼
              LangGraph Orchestrator  ──► Specialist agents / CEO-agents + Market Referee
                  │                              │
       auto-traced │                              │ read/write
                  ▼                              ▼
            W&B Weave                        Redis (Iris)
   (traces · scorers · evals ·          (agent memory · vector search ·
    guardrails · leaderboards ·          LangCache · decision ledger)
    monitors · playground)
```

### 2.1 W&B Weave — Intelligence Quality Assurance & the Audit Plane
This is the sponsor tool we lean on hardest, because the product's entire credibility rests on *trustworthy, verifiable* intelligence.

| Weave capability | How it's core to the architecture | Where it lives |
|---|---|---|
| **LangGraph auto-tracing** | Every orchestrator node, CEO-agent, referee call, LLM call, and tool call is captured as a trace tree — zero manual logging in the hot path. This *is* the "why" half of the replay/audit plane. | `observability/weave_config.py`, `@trace_node` on all nodes, `simulation/tracing.py` |
| **Custom scorers** | Freshness, relevance, accuracy, product-coverage, SWOT-completeness, intel-volume run on every agent output. Quality is a first-class, queryable property of every run. | `observability/scorers.py`, `weave_ops.py` (7 trace scorers) |
| **Guardrails** | Flag stale news (>90d), unsourced/implausible financials, suspicious precision — *before* bad intel reaches the exec. Directly enforces the "never hallucinate numbers" promise. | `observability/guardrails.py` |
| **Evaluations + versioned Datasets** | Reproducible scorecards over fixture/ground-truth datasets (`ccie-fixtures`, `ccie-ground-truth`, `ccie-discovery-prompt-ab`). | `observability/eval.py`, `weave_artifacts.py` |
| **Leaderboards (A/B)** | Prompt-variant and policy A/B as head-to-head `weave.Model` comparisons (`ccie-discovery-leaderboard`, `ccie-prompt-accuracy-leaderboard`). Drives systematic prompt improvement with receipts. | `weave_artifacts.py`, `scripts/seed_prompt_eval.py` |
| **LLM-as-a-judge + online Monitor** | A `persona_realism_judge` Scorer + `war-game-persona-realism` Monitor continuously score whether CEO-agents stay in character on live traces. | War-game evals |
| **Playground + versioned Prompts** | Prompt iteration directly in-browser; `ceo_agent_prompt` / `market_referee_prompt` stored as versioned objects. | Weave UI |

**Why it can't be swapped out:** the war-game's "click the player building → replay every agent's chain-of-thought" feature *is* Weave traces joined to the Redis ledger. Without Weave there is no audit plane, no quality gating, and no A/B improvement loop — the product becomes another untrustworthy AI demo.

### 2.2 Redis (Iris) — The Agents' Live Repository & Memory
| Redis capability | How it's core | Where it lives |
|---|---|---|
| **Agent Memory (cross-session)** | Re-analyzing a company shows *deltas* vs. last time; personas are cached so 10 iterations stay fast and consistent. | `memory/` (`MemoryService`) |
| **Vector Search (RediSearch HNSW over RedisJSON)** | Synthesis agent semantically searches "which competitors are pivoting to AI?" across all stored intel — keyword search can't find thematic patterns. | `IrisVectorSearch`, `VECTOR_BACKEND=redisvl` |
| **LangCache (semantic LLM cache)** | Caches overlapping questions across swarm agents → fewer tokens, lower latency, safe demo under rate limits. | `RedisLangCache`, `LANGCACHE_*` |
| **Decision Ledger** | Every reaction/adjudication/choice is written as a `LedgerEntry` keyed `session:company:iteration` with a `weave_trace_id`. This is the canonical "what" the replay reads. | `simulation/ledger.py`, `store.py` |

**Why it can't be swapped out:** Redis is the agents' structured source of truth and the half of the replay that supplies verifiable facts. It's also what makes the system *continuous* (memory/deltas) rather than one-shot.

### 2.3 CopilotKit — The Agent-Native Interface
| CopilotKit capability | How it's core | Where it lives |
|---|---|---|
| **CoAgents + shared state** | LangGraph state streams to React via `useCoAgent` — 3D buildings appear as agents discover competitors, bidirectionally, with no custom websocket plumbing. | `main.py` (AG-UI SSE), `playground/`, `frontend/` |
| **Generative UI** | Agents render SWOT tables, news timelines, financial cards inline as React components. | `frontend/components/sim/*` |
| **AG-UI protocol + human-in-the-loop** | Standard agent↔UI protocol; LangGraph `interrupt` powers the turn-based "pause for the exec's choice, then resume" war-game loop. | orchestrator graph + checkpointer |

**Why it can't be swapped out:** the real-time "watch the swarm think" UX and the human-in-the-loop war-game turns depend on CoAgent state sync. CrewAI/raw frameworks would need custom socket plumbing for the same effect.

### 2.4 Supporting stack
- **LangGraph** — orchestration substrate; native `Send` API parallel fan-out per competitor/CEO; `MemorySaver` checkpointer enables resumable multi-turn iterations.
- **OpenAI GPT-4o / 4o-mini** — classification, discovery, structured financial extraction, in-character CEO reasoning, referee adjudication, LLM-as-a-judge.
- **Tavily** — live web search (news, products, financial signals) with advanced search depth.
- **FastAPI** — thin (~10-line) bridge mounting the CopilotKit SDK.

---

## 3. Market Value

### Who pays for this
- **Corporate strategy / Corp-Dev & M&A teams** — war-game acquisitions before committing capital.
- **Competitive intelligence & product marketing** — continuously-refreshed, sourced competitor landscapes.
- **VCs / PE deal teams** — stress-test a thesis and model incumbent responses to a portfolio bet.
- **Founders** — the *hypothetical* mode is instant market-validation: "here's your real competitive landscape and where the gaps are."
- **Management consultancies** — accelerate the analyst-heavy first weeks of any competitive engagement.

### Why it's valuable (the wedge)
1. **Continuous, not static.** Redis memory turns a one-off deck into a living system with delta detection ("what changed since last quarter").
2. **Predictive, not just descriptive.** The war-game is the differentiator — nobody else lets you simulate *how Apple/Amazon/Google would actually react* to your move, in character, grounded in their real M&A history and firepower.
3. **Trustworthy by construction.** Weave guardrails + citations + replayable reasoning make the output defensible in a boardroom — the #1 blocker to enterprise adoption of AI intel tools.
4. **Two products, one engine.** Same agent substrate serves both established-company CI and pre-launch startup validation — two go-to-market motions from one build.

### Market context
Competitive intelligence and market-research tooling is a multi-billion-dollar category (Crayon, Klue, Kompyte, AlphaSense, CB Insights, PitchBook, etc.), and AI-agent platforms are among the fastest-growing software segments. Today's incumbents are largely **dashboards of collected data**; CCIE is an **agentic system that reasons and simulates**. The defensible moat is the combination — autonomous grounded simulation + an audit plane that makes the output trustworthy — which is hard to replicate without exactly this kind of traced, evaluated, memory-backed architecture.

*(Use specific market-size figures only if you can cite a source live; otherwise frame as "a large, established CI/market-research category" to stay credible with judges.)*

---

## 4. What Judges Can Question — and How to Answer

### A. Trust & accuracy ("Is this just hallucinating?")
- **Q: How do you know the intel is real, not made up?**
  Every claim is grounded in Tavily live search with source citations, and **Weave guardrails** actively flag stale news and unsourced/implausible financials before they surface. Show a `guardrails_passed = false` trace catching bad data.
- **Q: The CEO-agent reactions — aren't those fiction?**
  They're constrained by each company's real persona (strategy, M&A history, financial firepower, temperament) with cited sources, and scored by an **LLM-as-a-judge persona-realism Monitor**. We calibrate intensity (only existential threats warrant ~1.0). It's a *grounded projection*, explicitly not a fact claim — and every reaction links to its evidence.
- **Q: Show me the receipts for one decision.**
  Click the player building → replay → a reaction card → drill into the **Weave trace** (full prompt + reasoning) joined to the **Redis ledger** entry (structured decision + citations).

### B. Sponsor-tool depth ("Are you really using these, or checking a box?")
- **Weave:** open the live project — 22k+ traces, 7 Evaluations, Datasets, two Leaderboards, an LLM-judge Scorer, an online Monitor, versioned Prompts, and Playground usage. Walk the trace → score → guard → evaluate → compare → monitor loop. (See `DEMO_SCRIPT` if prepared.)
- **Redis:** show `/health` reporting Redis connected + latency, vector search returning indexed intel, and LangCache cutting repeat-query cost.
- **CopilotKit:** type a query and show buildings/cards appearing in real time as agents finish — that's `useCoAgent` state sync, no custom sockets.

### C. Architecture & scale
- **Q: Latency with many agents × 10 turns?**
  Parallel fan-out via LangGraph `Send`, persona + grounding caches in Redis, LangCache for overlapping queries, snapshot-plus-targeted-lookup data policy (don't re-scrape everything each turn).
- **Q: Combinatorial blow-up over 10 branching turns?**
  Bounded action space per turn, the referee summarizes the board to keep prompts tight, seeded randomness for reproducibility, full decision tree persisted for backtracking.
- **Q: What's actually built vs. planned?**
  Built & live: agent swarm (classify → discover → parallel analyze → synthesize), real Tavily+OpenAI path, Financial Analyst, scoring v2 with market quadrants, full Weave observability + auto-score, Redis memory/vector/LangCache, war-game persona/agent/referee/eval modules, 150+ tests green. In progress / reserved: production 3D frontend polish, live Redis delta detection across sessions.

### D. Quality & evaluation rigor
- **Q: How do you know your prompts are good?**
  We A/B them in Weave on ground-truth datasets. The `ccie-prompt-accuracy-leaderboard` shows the engineered structured prompt scoring **1.0 F1** vs **0.6** for a naive baseline — the naive prompt over-extracts (includes the subject company and partners). Decisions are made on the leaderboard, with traces.

### E. Business / differentiation
- **Q: How is this different from Klue/Crayon/AlphaSense?**
  Those are data dashboards. We're an agentic engine that *reasons and simulates*, adds predictive acquisition war-gaming, and is auditable by construction. Plus the hypothetical mode serves pre-launch founders — a segment the incumbents don't.
- **Q: What's the moat?**
  The integrated loop: grounded multi-agent simulation + memory-backed continuity + a Weave audit/eval plane. The trust layer is the hard part, and it's exactly what enterprises require.

### F. Likely "gotcha" questions — be ready
- *"Turn off the internet — does it still work?"* → Yes, degrades to cached/heuristic paths; we never fabricate. Tests run fully offline (`WEAVE_DISABLED=1 ENV=test`).
- *"Who's liable if the recommendation is wrong?"* → It's a decision-support war-game, not financial advice; every output is sourced and labeled as a projection.
- *"Can judges see the Weave project?"* → Yes — set project visibility to Open and share `…/ccie-agents/weave` (or invite as viewers).

---

## 5. 30-Second Pitch (for the demo open)
> "Competitive intelligence is stale the day it ships, and no exec can simulate how the market's giants will react to an acquisition before they bet on it. CCIE is a swarm of grounded AI agents that builds a live competitive landscape for any company — real or hypothetical — and then lets you *war-game an acquisition* against autonomous CEO-agent twins of the real incumbents. Every number is sourced, every guardrail catches hallucinations before they reach you, and every agent decision is replayable end-to-end in W&B Weave. It's competitive intelligence you can actually take into a boardroom."
