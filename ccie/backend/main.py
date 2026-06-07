import logging
import warnings
from contextlib import asynccontextmanager

warnings.filterwarnings("ignore", message="Pydantic serializer warnings")

from ag_ui_langgraph import add_langgraph_fastapi_endpoint
from copilotkit import LangGraphAGUIAgent
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from agents.graph import compile_graph
from memory.bootstrap import configure_memory_providers
from memory.health import check_redis_connection, format_health_status, verify_redis_on_startup
from observability.post_run_hook import wrap_graph_for_observability
from observability.weave_config import init_weave

logger = logging.getLogger(__name__)

_weave_active = init_weave()


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_memory_providers()
    try:
        await verify_redis_on_startup(strict=False)
    except RuntimeError as exc:
        logger.error("%s", exc)
    yield


compiled_graph = wrap_graph_for_observability(compile_graph())
agent = LangGraphAGUIAgent(
    name="ccie_agent",
    description="Continuous Competitive Intelligence Engine — discovers and analyzes competitors.",
    graph=compiled_graph,
)

app = FastAPI(title="CCIE Backend", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
add_langgraph_fastapi_endpoint(app, agent, "/api/copilotkit/")


@app.get("/health")
async def health():
    from observability.settings import get_observability_settings

    obs = get_observability_settings()
    redis_result = await check_redis_connection()
    redis_status = format_health_status(redis_result)
    overall = "ok" if redis_status["connected"] else "degraded"
    return {
        "status": overall,
        "agent": "ccie_agent",
        "weave": _weave_active,
        "auto_score": obs.auto_score_enabled,
        "redis": redis_status,
    }
