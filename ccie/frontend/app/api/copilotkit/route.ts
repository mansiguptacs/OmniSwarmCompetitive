import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { LangGraphHttpAgent } from "@copilotkit/runtime/langgraph";
import { NextRequest } from "next/server";

const serviceAdapter = new ExperimentalEmptyAdapter();

const backendUrl =
  process.env.CCIE_BACKEND_URL ||
  process.env.COPILOTKIT_BACKEND_URL ||
  "http://127.0.0.1:8000/api/copilotkit/";

const runtime = new CopilotRuntime({
  agents: {
    ccie_agent: new LangGraphHttpAgent({ url: backendUrl }),
  },
});

export const POST = async (req: NextRequest) => {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter,
    endpoint: "/api/copilotkit",
  });

  return handleRequest(req);
};
