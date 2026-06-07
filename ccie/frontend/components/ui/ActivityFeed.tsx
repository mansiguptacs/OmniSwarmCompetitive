"use client";

import { useMemo } from "react";
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

  const recentGlobal = useMemo(() => {
    return [...activity].reverse().slice(0, 6);
  }, [activity]);

  if (!hasAny && !isRunning) return null;

  return (
    <div style={{
      background: "rgba(10,14,23,0.88)",
      backdropFilter: "blur(16px)",
      borderTop: "1px solid rgba(148,163,184,0.1)",
      padding: "12px 20px 14px",
      pointerEvents: "auto",
    }}>
      {/* Agent lanes */}
      <div style={{
        display: "flex",
        gap: 6,
        marginBottom: recentGlobal.length > 0 ? 10 : 0,
      }}>
        {AGENTS.map(({ key, icon, color }) => {
          const hasData = agentHasActivity(activity, key);
          const done = isAgentDone(activity, key);
          const last = lastMessageFor(activity, key);
          const isActive = hasData && !done && isRunning;

          return (
            <div
              key={key}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                opacity: hasData ? 1 : 0.35,
                transition: "opacity 0.4s",
              }}
            >
              {/* Agent icon */}
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                fontWeight: 800,
                color: done ? "#0b1120" : color,
                background: done
                  ? color
                  : isActive
                    ? `${color}25`
                    : "rgba(148,163,184,0.08)",
                border: `1.5px solid ${isActive ? color : "rgba(148,163,184,0.1)"}`,
                position: "relative",
                animation: isActive ? "pulse-glow 2s infinite" : undefined,
              }}>
                {done ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  icon
                )}
              </div>

              {/* Agent label */}
              <div style={{
                fontSize: 9,
                fontWeight: 600,
                color: hasData ? "#94a3b8" : "#475569",
                textAlign: "center",
                lineHeight: 1.2,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}>
                {key}
              </div>

              {/* Status message */}
              {last && (
                <div style={{
                  fontSize: 10,
                  color: "#64748b",
                  textAlign: "center",
                  lineHeight: 1.3,
                  maxWidth: 140,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical" as any,
                  animation: "fadeInUp 0.3s ease",
                }}>
                  {last.status}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Live thinking ticker */}
      {recentGlobal.length > 0 && (
        <div style={{
          borderTop: "1px solid rgba(148,163,184,0.06)",
          paddingTop: 8,
          display: "flex",
          flexDirection: "column",
          gap: 3,
          maxHeight: 60,
          overflowY: "auto",
        }}>
          {recentGlobal.slice(0, 3).map((entry, i) => {
            const agent = AGENTS.find((a) => a.key === entry.agent);
            return (
              <div
                key={`${entry.ts}-${i}`}
                style={{
                  display: "flex",
                  gap: 6,
                  alignItems: "center",
                  fontSize: 11,
                  animation: i === 0 ? "fadeInUp 0.3s ease" : undefined,
                  opacity: i === 0 ? 1 : 0.6,
                }}
              >
                <span style={{
                  width: 5,
                  height: 5,
                  borderRadius: 999,
                  background: agent?.color ?? "#64748b",
                  flexShrink: 0,
                }} />
                <span style={{ color: agent?.color ?? "#94a3b8", fontWeight: 600, flexShrink: 0 }}>
                  {entry.agent}
                </span>
                <span style={{ color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {entry.status}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
