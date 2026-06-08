# CCIE — Backend ↔ Frontend Data Contract

> **Version:** 1.0 — 2026-06-06  
> **Audience:** P1 (Agent Architect) + P3 (Frontend Wizard)  
> **Protocol:** CopilotKit `useCoAgent` over AG-UI SSE

---

## Overview

The backend (LangGraph + FastAPI) streams `CCIEState` to the frontend (Next.js + CopilotKit) via `useCoAgent({ name: "ccie_agent" })`. The state updates incrementally as agents run — the frontend should treat every field as optional and render progressively.

---

## State Shape: `CCIEState`

| Field | Type | Streamed when | Description |
|---|---|---|---|
| `target_company` | `string` | After classify | Name of the company being analyzed (or working name for hypotheticals) |
| `target_description` | `string` | After classify/parse | Description or LLM-refined market context |
| `is_hypothetical` | `boolean` | After classify | `true` if user described a startup idea rather than naming a real company |
| `competitors` | `Competitor[]` | Progressive | Array of discovered competitors — grows as agents discover, enriches as they analyze |
| `landscape_summary` | `string` | After synthesis | 2-3 sentence executive summary of the competitive landscape |
| `market_quadrants` | `MarketQuadrants` | After synthesis | Competitors bucketed into leader/challenger/niche/visionary |
| `agent_activity` | `AgentActivity[]` | Progressive | Chronological log of agent actions for the activity feed |
| `phase` | `Phase` | Progressive | Current pipeline stage — drives loading UI |
| `session_id` | `string` | After classify | Unique session identifier (used by Redis persistence) |

### Phase Lifecycle

```
idle → classifying → discovering → analyzing → synthesizing → complete
```

The frontend should show a progress indicator using `phase`. Buildings start appearing during `discovering` and enrich during `analyzing`.

---

## Competitor Model

Each entry in `competitors[]` represents one competitor building in the 3D scene.

### 3D Visual Encoding

| Field | Range | 3D Property | Rendering |
|---|---|---|---|
| `threat_level` | `0.0 – 1.0` | **Building height** | `height = 2 + threat_level * 12` (taller = bigger threat) |
| `sentiment` | `-1.0 – 1.0` | **Building color** | Red (negative) → Blue (neutral) → Green (positive) |
| `market_size` | `0.0 – 1.0` | **Building width** | `width = 1.6 + market_size * 3` (wider = larger company) |
| `market_overlap` | `0.0 – 1.0` | **Distance from center** | `radius = 9 + (1 - overlap) * 13` (closer = more direct competitor) |
| `status` | enum | **Animation state** | `discovering` = translucent, `analyzing` = pulsing glow + sparkles, `complete` = solid |

### Scoring Semantics (v2)

The scoring engine uses **financial signals** when available:

- **`threat_level`** — composite of financial size (revenue/market cap), growth momentum, news volume, product count, and sentiment. A $50B company with 30% growth scores higher than a $200M company with 5% growth, even with identical news coverage.
- **`market_size`** — dominated by financial size signal (55% weight) when financials are available. Falls back to product/news signals otherwise.
- **`market_overlap`** — product similarity + news overlap + growth momentum.
- **`sentiment`** — averaged from individual news item sentiments.

### Quadrant Placement

`market_quadrants` uses **relative** (above/below average) placement:

```typescript
interface MarketQuadrants {
  leader: string[];      // high threat + high size (above avg on both)
  challenger: string[];  // high threat + low size
  visionary: string[];   // low threat + high size
  niche: string[];       // low threat + low size
}
```

With 3-5 competitors, expect a spread across quadrants rather than all in "leader."

### Full Competitor Schema

```typescript
interface Competitor {
  // Identity
  name: string;                    // "PayPal"
  description?: string;            // "Digital payments platform..."
  status?: CompetitorStatus;       // "discovering" | "analyzing" | "complete"

  // 3D encoding (all 0.0-1.0 except sentiment which is -1.0 to 1.0)
  threat_level?: number;           // default 0.5
  sentiment?: number;              // default 0.0
  market_size?: number;            // default 0.5
  market_overlap?: number;         // default 0.5

  // Intel (populated during analysis)
  news?: NewsItem[];               // latest news, up to ~5 per competitor
  products?: ProductItem[];        // products/features, up to ~5
  financials?: Financials;         // revenue, funding, growth — may be partial
  swot?: SWOT;                     // strengths/weaknesses/opportunities/threats
}
```

### NewsItem

```typescript
interface NewsItem {
  title: string;
  url?: string;
  summary?: string;
  sentiment?: number;    // -1.0 to 1.0
  published_at?: string; // ISO date string or "Jan 15, 2025" format
}
```

### ProductItem

```typescript
interface ProductItem {
  name: string;
  description?: string;
  pricing?: string;      // e.g. "Free tier + $25/mo pro"
}
```

### Financials

The backend extracts financials via LLM structured output (GPT-4o-mini) with regex fallback. Fields may be partially populated.

```typescript
interface Financials {
  revenue?: string;        // "$29.8B (2023)" or "$14.4 billion"
  funding_total?: string;  // "$8.7B" or "N/A (public)"
  valuation?: string;      // "$65B (2023)" or "N/A"
  market_cap?: string;     // "$72B" or "Private"
  growth_rate?: string;    // "25% YoY"
  employee_count?: string; // "10,000+" (when available)
  source?: string;         // URL of primary source
}
```

**Rendering guidance:** Display as key-value pairs in the detail panel. Skip fields that are empty, "Unknown", or "N/A".

### SWOT

```typescript
interface SWOT {
  strengths?: string[];
  weaknesses?: string[];
  opportunities?: string[];
  threats?: string[];
}
```

**Note:** The backend also generates an `executive_summary` field in the SWOT result but does not include it in the `swot` dict on the competitor. It is used for the `landscape_summary` instead.

---

## AgentActivity

```typescript
interface AgentActivity {
  agent: string;   // "Orchestrator", "News Scout", "Product Tracker", "Financial Analyst", "Synthesis", "Observability"
  status: string;  // Human-readable status message
  ts: number;      // Unix timestamp (seconds)
}
```

Activity entries arrive in chronological order. The `Observability` agent adds quality metrics after synthesis completes (freshness, coverage, guardrails, memory status).

---

## Agent Nodes (Frontend-derived)

The backend does **not** stream an `agents` field per competitor. The frontend derives agent visualization from `competitor.status`:

| Status | Agent nodes |
|---|---|
| `discovering` | No agents shown |
| `analyzing` | 3 agents shown: News Scout (blue), Product Tracker (green), Financial Analyst (amber) — all "running" |
| `complete` | 3 agents shown — all "done" |

This matches the existing `deriveAgents()` function in `lib/visuals.ts`.

---

## Progressive Rendering Timeline

```
User types "Analyze Stripe"
  ↓
phase: "classifying"      → target_company set, empty scene
  ↓
phase: "discovering"      → competitors[] grows (1 by 1), buildings appear translucent
  ↓
phase: "analyzing"        → per-competitor: news, products, financials populate
                            buildings pulse, agent nodes animate, sparkles show
  ↓
phase: "synthesizing"     → SWOT, scored metrics arrive
                            buildings reach final height/width/color
  ↓
phase: "complete"         → landscape_summary, market_quadrants available
                            all buildings solid, activity feed shows quality metrics
```

---

## Gaps / Integration Items

| # | Item | Owner | Status |
|---|---|---|---|
| 1 | **Financials in DetailPanel** — render revenue/funding/growth when available | Frontend | Not yet |
| 2 | **Quadrant overlay** — visual indicator (labels/grid) showing leader/challenger/niche/visionary zones | Frontend | Not yet |
| 3 | **Landscape summary** — display the 2-3 sentence summary somewhere in the UI | Frontend | Not yet |
| 4 | **Financial Analyst agent color** — already mapped as amber (`#f59e0b`) in `AgentCluster.tsx` | Frontend | ✅ Done |
| 5 | **Hypothetical badge** — show indicator when `is_hypothetical` is true | Frontend | `TargetTower` receives `hypothetical` prop |
| 6 | **Quality metrics** — Observability entries in activity feed (freshness, coverage, guardrails) | Backend | ✅ Streaming |

---

## Example Payload

After a complete analysis of "Stripe", the state looks like:

```json
{
  "target_company": "Stripe",
  "target_description": "Stripe is a technology company that builds economic infrastructure...",
  "is_hypothetical": false,
  "phase": "complete",
  "session_id": "abc-123",
  "landscape_summary": "Stripe faces strong competition from PayPal and Adyen in the digital payments space...",
  "market_quadrants": {
    "leader": ["PayPal"],
    "challenger": ["Adyen"],
    "visionary": ["Square"],
    "niche": ["Braintree"]
  },
  "competitors": [
    {
      "name": "PayPal",
      "description": "Competitor to Stripe",
      "threat_level": 0.85,
      "sentiment": 0.3,
      "market_size": 0.9,
      "market_overlap": 0.75,
      "status": "complete",
      "news": [
        {
          "title": "PayPal launches stablecoin payments",
          "url": "https://...",
          "summary": "PayPal announced...",
          "sentiment": 0.6,
          "published_at": "2025-06-01"
        }
      ],
      "products": [
        { "name": "PayPal Checkout", "description": "Online payment processing", "pricing": "2.9% + $0.30" }
      ],
      "financials": {
        "revenue": "$29.8B (2023)",
        "market_cap": "$72B",
        "growth_rate": "8% YoY",
        "source": "https://..."
      },
      "swot": {
        "strengths": ["Massive consumer base", "Strong brand recognition"],
        "weaknesses": ["Legacy infrastructure", "Higher fees than Stripe"],
        "opportunities": ["Crypto/stablecoin integration"],
        "threats": ["Stripe's developer-first approach gaining market share"]
      }
    }
  ],
  "agent_activity": [
    { "agent": "Orchestrator", "status": "Classifying company input...", "ts": 1717700000 },
    { "agent": "Orchestrator", "status": "Discovered competitor: PayPal", "ts": 1717700002 },
    { "agent": "News Scout", "status": "Found 5 articles for PayPal", "ts": 1717700005 },
    { "agent": "Observability", "status": "Quality — freshness 85%, relevance 78%", "ts": 1717700020 }
  ]
}
```
