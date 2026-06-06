from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from ag_ui_langgraph import add_langgraph_fastapi_endpoint
from copilotkit import LangGraphAGUIAgent

from agents.graph import compile_graph
from observability.post_run_hook import wrap_graph_for_observability
from observability.weave_config import init_weave

_weave_active = init_weave()

compiled_graph = wrap_graph_for_observability(compile_graph())
agent = LangGraphAGUIAgent(
    name="ccie_agent",
    description="Continuous Competitive Intelligence Engine — discovers and analyzes competitors.",
    graph=compiled_graph,
)

app = FastAPI(title="CCIE Backend")
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
    return {
        "status": "ok",
        "agent": "ccie_agent",
        "weave": _weave_active,
        "auto_score": obs.auto_score_enabled,
    }
