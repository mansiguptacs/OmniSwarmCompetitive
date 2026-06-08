# CCIE Memory & Infrastructure — Person 2 Status

> **Owner:** Person 2 (Memory & Infra Engineer)  
> **Last updated:** 2026-06-06  
> **Tests:** 64/64 passing (`WEAVE_DISABLED=1 ENV=test pytest backend/tests -v`)

This document summarizes everything built in `backend/memory/`, what is still open, and how other teammates (Person 1 — Agents, Person 3 — Frontend) integrate.

---

## Quick Start

```bash
# Redis
cd ccie && docker compose up -d

# Diagnostics (works without copilotkit in base conda)
python scripts/redis_diagnostics.py

# Backend (use project venv)
cd ccie && source .venv/bin/activate
cd backend && WEAVE_DISABLED=1 uvicorn main:app --reload --port 8000

# Health
curl http://localhost:8000/health
```

---

## Module Map

| File | Purpose |
|---|---|
| `redis_client.py` | Low-level Redis JSON storage (news, competitors, company, products) |
| `factory.py` | DI singletons: `get_redis_memory()`, `get_memory_service()` |
| `schemas.py` | `CompanyRecord`, `CompetitorRecord`, `VectorDocument`, `IRIS_SCHEMA_REGISTRY` |
| `types.py` | Lightweight types (`RedisHealthResult`, `SearchResult`) |
| `interfaces.py` | Protocols: `MemoryStore`, `VectorSearchProvider`, `CacheProvider`, `IrisContextRetriever` |
| `service.py` | Central `MemoryService` facade |
| `health.py` | Redis ping, startup validation, `/health` support |
| `iris.py` | Redis Iris Context Retriever adapter (schema registration stub) |
| `iris_vector.py` | `IrisVectorSearch` — Redis-persisted vector index + document lifecycle |
| `vector.py` | `StubVectorSearch` for tests + provider factory |
| `cache.py` | `StubLangCache` for tests + provider factory |
| `redis_langcache.py` | `RedisLangCache` (local Redis TTL) + `LangCacheCloudProvider` (cloud stub) |
| `partitioning.py` | Multi-competitor key namespaces (`session_id` + `entity_id`) |
| `indexing.py` | Index hooks for vector search (news, products, SWOT, batch) |
| `bootstrap.py` | Wires vector + cache providers at FastAPI startup |
| `mcp_tools.py` | MCP-ready lookup tools + `MCP_TOOL_REGISTRY` |

---

## Completed Work

### Redis infrastructure
- [x] `docker-compose.yml` — Redis 7 with persistent volume
- [x] `RedisMemory` — namespaced JSON keys per session/competitor
- [x] `ping()` + connection latency on Redis client
- [x] `memory/health.py` — startup validation (strict in prod, warn in dev)
- [x] `/health` endpoint returns Redis `connected` + `latency_ms`
- [x] `scripts/redis_diagnostics.py` — standalone CLI (no copilotkit dep)

### Shared state & API (Person 2 owned parts)
- [x] `state.py` — `CCIEState` contract (agents ↔ frontend)
- [x] `main.py` — FastAPI + CopilotKit `ccie_agent` + lifespan bootstrap

### Memory abstraction
- [x] `MemoryService` — unified API over store, Iris, vector, cache
- [x] Factory pattern with injectable providers for tests
- [x] `AUTO_INDEX_INTEL` — auto vector-index on `save_news` / `save_products` / etc.

### Redis Iris preparation
- [x] `IRIS_SCHEMA_REGISTRY` — Company, Competitor, NewsItem, Product, VectorDocument
- [x] `RedisIrisAdapter` — query methods delegate to Redis JSON keys today
- [x] `register_schemas()` stub with TODO for Iris SDK

### MCP tool preparation
- [x] `mcp_lookup_company`, `mcp_lookup_competitor`, `mcp_lookup_news`, `mcp_lookup_products`
- [x] `MCP_TOOL_REGISTRY` metadata for future MCP server registration

### Vector search
- [x] `VectorSearchProvider` interface with full document lifecycle
- [x] `index_document()` / `update_document()` / `delete_document()` / `semantic_search()`
- [x] `IrisVectorSearch` — Redis-persisted, partitioned by session + competitor
- [x] `StubVectorSearch` — in-memory for `ENV=test`
- [x] Startup wiring via `configure_memory_providers()`

### LangCache
- [x] `CacheProvider` interface
- [x] `RedisLangCache` — Redis SET with TTL (local dev default)
- [x] `StubLangCache` — in-memory for tests
- [x] `LangCacheCloudProvider` — ready when cloud creds + `pip install langcache`
- [x] `MemoryService.get_or_cache_response()` for overlapping LLM queries

### Multi-competitor partitioning
- [x] Vector keys: `ccie:vector:{session_id}:{competitor}:{doc_id}`
- [x] Cache namespaces: `{session_id}:{competitor}` via `llm_cache_namespace()`

### Index hooks (Person 1 integration surface)
- [x] `index_news_items`, `index_product_items`, `index_competitor_profile`, `index_synthesis_intel`
- [x] `index_session_intel` — batch index after orchestrator phase
- [x] `MemoryService.index_synthesis()` / `index_session_intel()` public methods

---

## Environment Variables

```bash
# Core
REDIS_URL=redis://localhost:6379/0
ENV=dev                          # test → stubs; dev/prod → Redis providers

# Vector search
VECTOR_BACKEND=redis             # redis | stub
VECTOR_INDEX_NAME=ccie_intel
VECTOR_DEFAULT_LIMIT=10
VECTOR_EMBEDDING_MODEL=           # empty = token overlap (local)

# LangCache
LANGCACHE_BACKEND=redis           # redis | stub | cloud
LANGCACHE_ENABLED=1
LANGCACHE_DEFAULT_NAMESPACE=ccie
LANGCACHE_TTL_SECONDS=3600

# LangCache cloud (stretch — all three required)
LANGCACHE_HOST=
LANGCACHE_CACHE_ID=
LANGCACHE_API_KEY=

# Auto-index on MemoryService save_* calls
AUTO_INDEX_INTEL=1
```

**Note:** `config.py` auto-loads `ccie/.env` via `python-dotenv`. A `.env` with only `REDIS_URL` + `OPENAI_API_KEY` runs in **local Redis mode**. Cloud features need the specific vars above.

---

## Remaining Work (Person 2)

### High value (MVP-adjacent)
| # | Task | Notes |
|---|---|---|
| 1 | Demo data seeding script | Pre-load Stripe competitors for safe demo |
| 2 | Live end-to-end smoke test | Orchestrator + Redis + vector docs after restart |
| 3 | Person 1 handoff doc / examples | Index hook call sites in agents |

### Stretch / sponsor (optional)
| # | Task | What's needed |
|---|---|---|
| 4 | Iris cloud embeddings | Wire `_score_content()` in `iris_vector.py` to real Iris embedding API + new env vars |
| 5 | LangCache cloud | `LANGCACHE_BACKEND=cloud` + host/cache_id/api_key + `pip install langcache` |
| 6 | Context Retriever SDK | Replace stub in `iris.py` with `redis-context-retriever` / Context Surfaces SDK |
| 7 | Running MCP server | Expose `MCP_TOOL_REGISTRY` as live MCP endpoint |
| 8 | Redis Stack in docker-compose | RediSearch for local embedding index (current image is `redis:7-alpine`) |
| 9 | Cross-session delta detection | "What changed since yesterday" — post-MVP |
| 10 | Memory query REST API | Optional HTTP layer beyond CopilotKit |

---

## Team Dependencies

### What Person 1 needs from you (ready now)
- `get_redis_memory()` — agents already use this for JSON persistence ✅
- `get_memory_service()` — richer API; **not yet called by agents**
- `index_synthesis()` / `semantic_search()` / `get_or_cache_response()` — **ready, awaiting Person 1 wiring**

### What Person 3 needs from you (ready now)
- `CCIEState` schema in `state.py` ✅
- CopilotKit endpoint at `/api/copilotkit` (agent name: `ccie_agent`) ✅
- `/health` for sanity checks ✅

### What you need from others
| From | Need | Blocking you? |
|---|---|---|
| Person 1 | Call `get_memory_service()` + index hooks in agents | No — unlocks vector/LangCache in live demo |
| Person 1 | `semantic_search()` in Synthesis agent | No |
| Person 3 | Nothing | No |
| Redis Cloud sponsor | Iris / LangCache / Context Retriever credentials | Only for stretch items 4–6 |

---

## Person 1 Integration (copy-paste)

```python
from memory.factory import get_memory_service
from memory.indexing import llm_cache_namespace

service = get_memory_service()

# After synthesis
await service.index_synthesis(
    session_id,
    competitor_name,
    swot=competitor.swot,
    landscape_summary=state.get("landscape_summary", ""),
)

# Semantic query (Synthesis)
hits = await service.semantic_search(
    "Which competitor is strongest in POS?",
    session_id=session_id,
    filters={"entity_type": "summary"},
)

# LangCache for overlapping LLM calls
ns = llm_cache_namespace(session_id, "Stripe")
answer = await service.get_or_cache_response(
    "What does Stripe do?",
    lambda: llm.ainvoke(prompt),
    namespace=ns,
)
```

**No LangGraph structure changes required** — add calls inside existing agent functions.

---

## Startup Provider Selection

`configure_memory_providers()` runs in `main.py` lifespan:

| ENV | Vector | Cache |
|---|---|---|
| `test` | `StubVectorSearch` | `StubLangCache` |
| `dev` / `prod` (default) | `IrisVectorSearch` | `RedisLangCache` |
| `LANGCACHE_BACKEND=cloud` + creds | — | `LangCacheCloudProvider` |

---

## Migration Paths (when sponsor creds arrive)

### LangCache cloud (easiest)
```bash
export LANGCACHE_BACKEND=cloud
export LANGCACHE_HOST=https://...
export LANGCACHE_CACHE_ID=...
export LANGCACHE_API_KEY=...
pip install langcache
# restart backend
```

### Iris vector embeddings
1. Add Iris embedding env vars to `config.py`
2. Replace `_score_content()` in `iris_vector.py`
3. No changes to `MemoryService` or agents

### Context Retriever SDK
1. `pip install redis-context-retriever`
2. Replace `RedisIrisAdapter.register_schemas()` stub in `iris.py`
3. MCP tools auto-generated from `IRIS_SCHEMA_REGISTRY`

---

## Changelog

| Date | Change |
|---|---|
| 2026-06-06 | Initial Redis client, factory, schemas |
| 2026-06-06 | MemoryService, health, MCP prep, Iris adapter scaffolding |
| 2026-06-06 | Vector + LangCache abstractions, 43 tests |
| 2026-06-06 | IrisVectorSearch, RedisLangCache, indexing hooks, bootstrap, partitioning, 64 tests |
