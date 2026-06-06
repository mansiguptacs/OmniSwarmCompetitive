from fastapi import FastAPI
from copilotkit import CopilotKitRemoteEndpoint, LangGraphAGUIAgent
from copilotkit.integrations.fastapi import add_fastapi_endpoint

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
sdk = CopilotKitRemoteEndpoint(agents=[agent])
add_fastapi_endpoint(app, sdk, "/api/copilotkit")


@app.get("/health")
async def health():
    return {"status": "ok", "agent": "ccie_agent"}
