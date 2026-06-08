import type { EvalsReport, ReplayBundle, SimulationState, AgentReaction, CompanyPersona } from "@/types/simulation";

export interface StartParams {
  target: string;
  player: string;
  sector?: string;
  max_iterations?: number;
  max_incumbents?: number;
  incumbents?: string[];
}

/** Progress events emitted by SSE streaming endpoints. */
export interface SimProgressEvent {
  kind: string;
  name: string | null;
  data: unknown;
}

async function asJson<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (data as { detail?: string }).detail || `Request failed (${res.status})`;
    throw new Error(detail);
  }
  return data as T;
}

export async function startSimulation(params: StartParams): Promise<SimulationState> {
  const res = await fetch("/api/sim/start", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(params),
  });
  return asJson<SimulationState>(res);
}

export async function advanceSimulation(
  sessionId: string,
  choice: string,
): Promise<SimulationState> {
  const res = await fetch("/api/sim/advance", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, choice }),
  });
  return asJson<SimulationState>(res);
}

/**
 * SSE base URL — call the FastAPI backend directly (bypasses the
 * Next.js proxy which buffers streaming responses).
 */
const SSE_BASE = typeof window !== "undefined"
  ? (process.env.NEXT_PUBLIC_CCIE_SIM_URL || "http://127.0.0.1:8000")
  : "http://127.0.0.1:8000";

/**
 * Consume an SSE stream from the backend, calling `onEvent` for each
 * progress event and returning the final `SimulationState` on completion.
 */
async function consumeSSE(
  path: string,
  body: object,
  onEvent: (evt: SimProgressEvent) => void,
): Promise<SimulationState> {
  const res = await fetch(`${SSE_BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed (${res.status})`);
  }
  if (!res.body) throw new Error("No response body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalState: SimulationState | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (!json) continue;
      try {
        const event = JSON.parse(json) as SimProgressEvent;
        if (event.kind === "error") {
          throw new Error(String(event.data));
        }
        if (event.kind === "complete") {
          finalState = event.data as SimulationState;
        }
        onEvent(event);
      } catch (e) {
        if (e instanceof Error && e.message !== json) throw e;
      }
    }
  }

  if (!finalState) throw new Error("Stream ended without a completion event");
  return finalState;
}

export async function startSimulationStream(
  params: StartParams,
  onEvent: (evt: SimProgressEvent) => void,
): Promise<SimulationState> {
  return consumeSSE("/api/sim/start/stream", params, onEvent);
}

export async function advanceSimulationStream(
  sessionId: string,
  choice: string,
  onEvent: (evt: SimProgressEvent) => void,
): Promise<SimulationState> {
  return consumeSSE("/api/sim/advance/stream", { session_id: sessionId, choice }, onEvent);
}

export async function forkSimulation(
  sessionId: string,
  fromIndex: number,
  choice: string,
): Promise<SimulationState> {
  const res = await fetch("/api/sim/fork", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, from_index: fromIndex, choice }),
  });
  return asJson<SimulationState>(res);
}

export async function getSimulation(sessionId: string): Promise<SimulationState> {
  const res = await fetch(`/api/sim/state/${encodeURIComponent(sessionId)}`);
  return asJson<SimulationState>(res);
}

export async function getReplay(sessionId: string): Promise<ReplayBundle> {
  const res = await fetch(`/api/sim/replay/${encodeURIComponent(sessionId)}`);
  return asJson<ReplayBundle>(res);
}

export async function getEvals(sessionId: string): Promise<EvalsReport> {
  const res = await fetch(`/api/sim/evals/${encodeURIComponent(sessionId)}`);
  return asJson<EvalsReport>(res);
}
