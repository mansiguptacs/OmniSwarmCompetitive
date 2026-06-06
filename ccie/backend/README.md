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

## Run API server

```bash
cd ccie/backend
WEAVE_DISABLED=1 uvicorn main:app --reload --port 8000
```

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
| `OPENAI_API_KEY` | — | OpenAI API key (optional in dev; mocks used) |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis connection |
| `ENV` | `dev` | `dev`/`test` use mock tools |
| `WEAVE_PROJECT` | `ccie-agents` | W&B Weave project |
| `WEAVE_DISABLED` | — | Set `1` to skip Weave init |
| `TAVILY_API_KEY` | — | Optional real web search |
