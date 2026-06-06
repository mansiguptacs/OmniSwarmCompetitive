from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from ag_ui_langgraph import add_langgraph_fastapi_endpoint
from copilotkit import LangGraphAGUIAgent

from agents.graph import compile_graph
from observability.weave_config import init_weave

init_weave()

compiled_graph = compile_graph()
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
    return {"status": "ok", "agent": "ccie_agent"}
