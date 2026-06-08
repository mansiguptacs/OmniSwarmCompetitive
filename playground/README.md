# CCIE Playground

**Not the production frontend.** This is a minimal CopilotKit UI for the agents/backend team to manually test the LangGraph swarm.

The real app lives in `ccie/frontend/` (owned by the frontend teammate).

## What you can test here

- Chat with `ccie_agent` via CopilotKit
- Live shared state: phase, competitors, agent activity, landscape summary
- Demo prompts: `Analyze Stripe` or a hypothetical startup description

## Run

Terminal 1 — backend (from repo root):

```bash
cd ccie/backend
source ../.venv/bin/activate
WEAVE_DISABLED=1 uvicorn main:app --reload --port 8000
```

If you're **already inside `ccie/`**, use:

```bash
cd backend
source ../.venv/bin/activate
WEAVE_DISABLED=1 uvicorn main:app --reload --port 8000
```

Terminal 2 — playground:

```bash
cd ccie/playground
npm install
npm run dev
```

Open **http://localhost:3000**

## Config

| Variable | Default |
|---|---|
| `CCIE_BACKEND_URL` | `http://127.0.0.1:8000/api/copilotkit/` |
