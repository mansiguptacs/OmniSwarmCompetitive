# CCIE Frontend — 3D Competitive War Room

The production Next.js frontend (Person 3 track). Renders the live `CCIEState` from the
LangGraph agent swarm as an interactive **3D isometric city**: the target company is the
central tower, competitors are buildings around it, and the skyline updates in real time.

Stack: Next.js (App Router) + CopilotKit (`useCoAgent`) + React Three Fiber + drei + three.

## Visual encoding

| Visual | Maps to | State field |
|---|---|---|
| Building height | Competitive threat | `competitor.threat_level` |
| Building color | Sentiment (red→blue→green) | `competitor.sentiment` |
| Building width | Market presence | `competitor.market_size` |
| Distance from center | Market overlap | `competitor.market_overlap` |
| Sparkles + pulse | Active analysis | `competitor.status === "analyzing"` |

## Run

```bash
cd ccie/frontend
npm install
npm run dev            # http://localhost:3000
# if the playground is on 3000:
npx next dev --port 3001
```

The frontend renders only live agent state, so start the backend first.

### With live agents

Start the backend first (from `ccie/backend`):

```bash
WEAVE_DISABLED=1 uvicorn main:app --reload --port 8000
```

Then chat `Analyze Stripe` — buildings appear as agents discover competitors.

## Config

| Variable | Default |
|---|---|
| `CCIE_BACKEND_URL` | `http://127.0.0.1:8000/api/copilotkit/` |

## Structure

```
app/            layout (CopilotKit provider), page (war room), api proxy, globals
components/three War Room canvas, ground, competitor buildings, target tower
components/ui   PhaseBar, ActivityFeed, DetailPanel
lib/            visuals (state→geometry/color helpers)
types/          CCIEState mirror of backend/state.py
```
