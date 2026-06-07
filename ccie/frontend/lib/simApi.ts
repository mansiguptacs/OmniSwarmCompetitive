import type { SimulationState } from "@/types/simulation";

export interface StartParams {
  target: string;
  player: string;
  sector?: string;
  max_iterations?: number;
  max_incumbents?: number;
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

export async function getSimulation(sessionId: string): Promise<SimulationState> {
  const res = await fetch(`/api/sim/state/${encodeURIComponent(sessionId)}`);
  return asJson<SimulationState>(res);
}
