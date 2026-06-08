"use client";

import type { AgentActivity, Phase } from "@/types/ccie";

const AGENTS = [
  { key: "Orchestrator", icon: "O", color: "#a78bfa" },
  { key: "News Scout", icon: "N", color: "#60a5fa" },
  { key: "Product Tracker", icon: "P", color: "#34d399" },
  { key: "Financial Analyst", icon: "F", color: "#f59e0b" },
  { key: "Synthesis", icon: "S", color: "#c084fc" },
  { key: "Observability", icon: "W", color: "#f472b6" },
] as const;

function lastMessageFor(activity: AgentActivity[], agentKey: string): AgentActivity | undefined {
  for (let i = activity.length - 1; i >= 0; i--) {
    if (activity[i].agent === agentKey) return activity[i];
  }
  return undefined;
}

function agentHasActivity(activity: AgentActivity[], agentKey: string): boolean {
  return activity.some((a) => a.agent === agentKey);
}

function isAgentDone(activity: AgentActivity[], agentKey: string): boolean {
  const last = lastMessageFor(activity, agentKey);
  if (!last) return false;
  const s = last.status.toLowerCase();
  return s.includes("complete") || s.includes("done") || s.includes("finished");
}

export function ActivityFeed({
  activity = [],
  phase,
}: {
  activity?: AgentActivity[];
  phase?: Phase;
}) {
  const hasAny = activity.length > 0;
  const isRunning = phase && phase !== "idle" && phase !== "complete";

  if (!hasAny && !isRunning) return null;

  return (
    <div style={{
      background: "rgba(10,14,23,0.85)",
      backdropFilter: "blur(12px)",
      borderTop: "1px solid rgba(148,163,184,0.08)",
      padding: "8px 20px",
      pointerEvents: "auto",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    }}>
      {AGENTS.map(({ key, icon, color }) => {
        const hasData = agentHasActivity(activity, key);
        const done = isAgentDone(activity, key);
        const isActive = hasData && !done && isRunning;

        return (
          <div key={key} title={key} style={{
            display: "flex", alignItems: "center", gap: 5,
            opacity: hasData ? 1 : 0.3,
            transition: "opacity 0.4s",
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 7,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 800,
              color: done ? "#0b1120" : color,
              background: done ? color : isActive ? `${color}20` : "rgba(148,163,184,0.06)",
              border: `1.5px solid ${isActive ? color : "rgba(148,163,184,0.08)"}`,
              animation: isActive ? "pulse-glow 2s infinite" : undefined,
              transition: "all 0.3s",
            }}>
              {done ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
              ) : icon}
            </div>
            <span style={{
              fontSize: 9, fontWeight: 600, color: hasData ? "#94a3b8" : "#475569",
              textTransform: "uppercase", letterSpacing: "0.04em",
            }}>{key.split(" ")[0]}</span>
          </div>
        );
      })}
    </div>
  );
}
