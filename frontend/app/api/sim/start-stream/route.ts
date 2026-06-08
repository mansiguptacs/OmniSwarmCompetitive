import { NextRequest } from "next/server";

const BASE = process.env.CCIE_SIM_URL || "http://127.0.0.1:8000";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const upstream = await fetch(`${BASE}/api/sim/start/stream`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "Backend error");
    return new Response(text, { status: upstream.status });
  }

  return new Response(upstream.body, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    },
  });
}
