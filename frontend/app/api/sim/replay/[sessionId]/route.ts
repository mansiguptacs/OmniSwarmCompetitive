import { NextRequest, NextResponse } from "next/server";

const BASE = process.env.CCIE_SIM_URL || "http://127.0.0.1:8000";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const res = await fetch(`${BASE}/api/sim/replay/${encodeURIComponent(sessionId)}`);
  const data = await res.json().catch(() => ({ detail: "Invalid backend response" }));
  return NextResponse.json(data, { status: res.status });
}
