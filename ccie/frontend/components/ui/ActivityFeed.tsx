"use client";

import type { AgentActivity } from "@/types/ccie";

const AGENT_COLOR: Record<string, string> = {
  "News Scout": "#60a5fa",
  "Product Tracker": "#34d399",
  "Financial Analyst": "#f59e0b",
  Synthesis: "#c084fc",
  Observability: "#f472b6",
};

export function ActivityFeed({ activity = [] }: { activity?: AgentActivity[] }) {
  const items = [...activity].slice(-12).reverse();

  return (
    <div className="glass" style={{ padding: 14, pointerEvents: "auto", width: 320 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: "#cbd5e1" }}>
        Agent Activity
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 220, overflowY: "auto" }}>
        {items.length === 0 && (
          <p style={{ margin: 0, color: "#6b7280", fontSize: 13 }}>Waiting for agents…</p>
        )}
        {items.map((entry, i) => (
          <div key={`${entry.ts}-${i}`} style={{ display: "flex", gap: 8, fontSize: 12.5 }}>
            <span
              style={{
                width: 7,
                height: 7,
                marginTop: 5,
                borderRadius: 999,
                flexShrink: 0,
                background: AGENT_COLOR[entry.agent] ?? "#94a3b8",
                boxShadow: `0 0 8px ${AGENT_COLOR[entry.agent] ?? "#94a3b8"}`,
              }}
            />
            <span style={{ color: "#cbd5e1" }}>
              <strong style={{ color: AGENT_COLOR[entry.agent] ?? "#cbd5e1" }}>
                {entry.agent}
              </strong>{" "}
              {entry.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
