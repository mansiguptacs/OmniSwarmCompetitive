import { NextRequest, NextResponse } from "next/server";

const BASE = process.env.CCIE_SIM_URL || "http://127.0.0.1:8000";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const res = await fetch(`${BASE}/api/sim/advance`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({ detail: "Invalid backend response" }));
  return NextResponse.json(data, { status: res.status });
}
