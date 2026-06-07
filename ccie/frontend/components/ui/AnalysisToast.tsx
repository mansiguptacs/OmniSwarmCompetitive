"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AgentActivity, Competitor, Phase } from "@/types/ccie";

const AGENT_META: Record<string, { icon: string; color: string; label: string }> = {
  "News Scout": { icon: "N", color: "#60a5fa", label: "News" },
  "Product Tracker": { icon: "P", color: "#34d399", label: "Products" },
  "Financial Analyst": { icon: "F", color: "#f59e0b", label: "Financials" },
  Synthesis: { icon: "S", color: "#c084fc", label: "SWOT" },
  Orchestrator: { icon: "O", color: "#a78bfa", label: "Orchestrator" },
};

const PHASE_INFO: Partial<Record<Phase, { label: string; detail: string; color: string; icon: string }>> = {
  classifying: { label: "Classifying Input", detail: "Analyzing company type, industry, and market segment...", color: "#a855f7", icon: "🔎" },
  discovering: { label: "Discovering Competitors", detail: "Searching market landscape to identify key competitors...", color: "#3b82f6", icon: "🌐" },
  synthesizing: { label: "Synthesizing Intelligence", detail: "Building competitive landscape, SWOT analysis, and threat scoring...", color: "#f59e0b", icon: "⚡" },
};

const AGENT_ORDER = ["News Scout", "Product Tracker", "Financial Analyst", "Synthesis"];

const DISMISS_DELAY = 2500;

function stripCompanyName(status: string, name: string): string {
  return status
    .replace(new RegExp(`\\bfor\\s+${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, "gi"), "")
    .replace(new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, "gi"), "")
    .replace(/^\s*—\s*/, "")
    .replace(/\s*—\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function AnalysisToast({
  competitors,
  activity,
  phase,
}: {
  competitors: Competitor[];
  activity?: AgentActivity[];
  phase?: Phase;
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const analyzing = useMemo(
    () => competitors.filter((c) => c.status === "analyzing"),
    [competitors],
  );

  const justCompleted = useMemo(
    () =>
      competitors.filter(
        (c) => c.status === "complete" && !dismissed.has(c.name),
      ),
    [competitors, dismissed],
  );

  useEffect(() => {
    if (justCompleted.length === 0) return;
    timerRef.current = setTimeout(() => {
      setDismissed((prev) => {
        const next = new Set(prev);
        justCompleted.forEach((c) => next.add(c.name));
        return next;
      });
    }, DISMISS_DELAY);
    return () => clearTimeout(timerRef.current);
  }, [justCompleted]);

  const prevTargetCount = useRef(0);
  useEffect(() => {
    if (competitors.length > 0 && prevTargetCount.current === 0) {
      setDismissed(new Set());
    }
    prevTargetCount.current = competitors.length;
  }, [competitors.length]);

  const visible = useMemo(() => {
    const names = new Set<string>();
    analyzing.forEach((c) => names.add(c.name));
    justCompleted.forEach((c) => names.add(c.name));
    return competitors.filter((c) => names.has(c.name));
  }, [analyzing, justCompleted, competitors]);

  const totalDone = competitors.filter((c) => c.status === "complete").length;
  const totalCount = competitors.length;
  const msgs = activity ?? [];

  const phaseInfo = phase ? PHASE_INFO[phase] : undefined;
  const showPhaseToast = !!phaseInfo && (visible.length === 0 || phase === "synthesizing");
  const latestActivity = msgs[msgs.length - 1];

  if (totalCount === 0 && !showPhaseToast) return null;

  const MAX_SHOWN = 6;
  const shown = visible.slice(0, MAX_SHOWN);
  const overflow = visible.length - MAX_SHOWN;

  const SLOT_POSITIONS = [
    { top: "15%", left: "8%" },
    { top: "12%", right: "8%" },
    { top: "40%", left: "5%" },
    { top: "38%", right: "5%" },
    { top: "62%", left: "10%" },
    { top: "60%", right: "10%" },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 80, pointerEvents: "none" }}>

      {/* Phase-level toast — shown during classifying, discovering, synthesizing */}
      {showPhaseToast && phaseInfo && (
        <div style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 340,
          background: "rgba(15,23,42,0.94)",
          backdropFilter: "blur(16px)",
          border: `1px solid ${phaseInfo.color}30`,
          borderRadius: 14,
          padding: "20px 24px",
          animation: "fadeInUp 0.4s ease",
          boxShadow: `0 12px 40px rgba(0,0,0,0.4), 0 0 20px ${phaseInfo.color}10`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: `${phaseInfo.color}15`,
              border: `1.5px solid ${phaseInfo.color}40`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18,
              animation: "pulse-glow 2s infinite",
            }}>
              {phaseInfo.icon}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>
                {phaseInfo.label}
              </div>
              <div style={{ fontSize: 11, color: phaseInfo.color, fontWeight: 600 }}>
                Processing...
              </div>
            </div>
          </div>
          <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.55, marginBottom: latestActivity ? 10 : 0 }}>
            {phaseInfo.detail}
          </div>
          {latestActivity && (
            <div style={{
              fontSize: 11, color: "#64748b", lineHeight: 1.4,
              padding: "8px 10px", borderRadius: 8,
              background: "rgba(148,163,184,0.04)",
              borderLeft: `3px solid ${phaseInfo.color}40`,
              animation: "fadeInUp 0.2s ease",
            }}>
              <span style={{ color: AGENT_META[latestActivity.agent]?.color ?? "#94a3b8", fontWeight: 600, marginRight: 4, fontSize: 10 }}>
                {AGENT_META[latestActivity.agent]?.label ?? latestActivity.agent}
              </span>
              {latestActivity.status}
            </div>
          )}
          {/* Animated progress dots */}
          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 14 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{
                width: 6, height: 6, borderRadius: 999,
                background: phaseInfo.color,
                opacity: 0.4,
                animation: `pulse-glow 1.5s infinite ${i * 0.3}s`,
              }} />
            ))}
          </div>
        </div>
      )}

      {/* Progress counter — top center */}
      {totalCount > 0 && (totalDone > 0 || analyzing.length > 0) && (
        <div
          style={{
            position: "absolute",
            top: 80,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 18px",
            background: "rgba(15,23,42,0.92)",
            backdropFilter: "blur(12px)",
            borderRadius: 8,
            border: "1px solid rgba(148,163,184,0.1)",
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: "#e2e8f0", fontWeight: 700 }}>
              Analyzing Competitors
            </div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
              {totalDone}/{totalCount} complete
            </div>
          </div>
          <div style={{ width: 60, height: 4, borderRadius: 2, background: "rgba(148,163,184,0.15)" }}>
            <div
              style={{
                height: "100%",
                borderRadius: 2,
                background: totalDone === totalCount ? "#22c55e" : "#3b82f6",
                width: `${totalCount > 0 ? (totalDone / totalCount) * 100 : 0}%`,
                transition: "width 0.5s ease",
              }}
            />
          </div>
        </div>
      )}

      {/* Per-company cards scattered across the viewport */}
      {shown.map((c, idx) => {
        const done = c.status === "complete";
        const companyMsgs = msgs.filter((m) => m.status.includes(c.name));

        const agentProgress = AGENT_ORDER.map((agentKey) => {
          const agentMsgs = companyMsgs.filter((m) => m.agent === agentKey);
          const last = agentMsgs[agentMsgs.length - 1];
          const isDone = last?.status.toLowerCase().includes("complete") ||
                         last?.status.toLowerCase().includes("done");
          return { key: agentKey, last, isDone, hasStarted: agentMsgs.length > 0 };
        });

        const activeAgent = agentProgress.find((a) => a.hasStarted && !a.isDone);
        const latestMsg = activeAgent?.last ?? companyMsgs[companyMsgs.length - 1];

        const slot = SLOT_POSITIONS[idx % SLOT_POSITIONS.length];

        return (
          <div
            key={c.name}
            style={{
              position: "absolute",
              ...slot,
              width: 280,
              background: done
                ? "rgba(34,197,94,0.08)"
                : "rgba(15,23,42,0.94)",
              backdropFilter: "blur(12px)",
              border: done
                ? "1px solid rgba(34,197,94,0.25)"
                : "1px solid rgba(148,163,184,0.1)",
              borderRadius: 10,
              padding: "12px 14px",
              animation: "fadeInUp 0.4s ease",
              transition: "all 0.3s",
              pointerEvents: "auto",
              boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              {done ? (
                <div style={{
                  width: 24, height: 24, borderRadius: 6,
                  background: "#22c55e",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              ) : (
                <div style={{
                  width: 24, height: 24, borderRadius: 6,
                  background: "rgba(59,130,246,0.15)",
                  border: "1.5px solid #3b82f6",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  animation: "pulse-glow 2s infinite",
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: 999,
                    background: "#3b82f6",
                  }} />
                </div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: done ? "#4ade80" : "#e2e8f0" }}>
                  {c.name}
                </div>
              </div>
            </div>

            {/* Agent step indicators */}
            {!done && (
              <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
                {agentProgress.map(({ key, isDone, hasStarted }) => {
                  const meta = AGENT_META[key];
                  return (
                    <div
                      key={key}
                      style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 3,
                      }}
                    >
                      <div style={{
                        width: "100%",
                        height: 3,
                        borderRadius: 2,
                        background: isDone
                          ? meta.color
                          : hasStarted
                            ? `${meta.color}60`
                            : "rgba(148,163,184,0.1)",
                        transition: "background 0.3s",
                        animation: hasStarted && !isDone ? "pulse-glow 2s infinite" : undefined,
                      }} />
                      <div style={{
                        fontSize: 8,
                        fontWeight: 600,
                        color: isDone ? meta.color : hasStarted ? "#94a3b8" : "#334155",
                        textTransform: "uppercase",
                        letterSpacing: "0.03em",
                      }}>
                        {meta.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Live agent log — last 3 messages for this company */}
            {!done && companyMsgs.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {companyMsgs.slice(-3).map((m, mi) => {
                  const isLatest = mi === Math.min(companyMsgs.length, 3) - 1;
                  return (
                    <div key={`${m.ts}-${mi}`} style={{
                      fontSize: 10,
                      color: isLatest ? "#cbd5e1" : "#64748b",
                      lineHeight: 1.4,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      animation: isLatest ? "fadeInUp 0.2s ease" : undefined,
                      opacity: isLatest ? 1 : 0.6,
                    }}>
                      <span style={{
                        color: AGENT_META[m.agent]?.color ?? "#64748b",
                        fontWeight: 600,
                        marginRight: 4,
                        fontSize: 9,
                      }}>
                        {AGENT_META[m.agent]?.label ?? m.agent}
                      </span>
                      {stripCompanyName(m.status, c.name)}
                    </div>
                  );
                })}
              </div>
            )}

            {done && (
              <div style={{ fontSize: 11, color: "#4ade80", fontWeight: 500 }}>
                All agents complete — building raised
              </div>
            )}
          </div>
        );
      })}

      {overflow > 0 && (
        <div style={{
          position: "absolute",
          bottom: 160,
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 11,
          color: "#64748b",
          padding: "6px 16px",
          background: "rgba(15,23,42,0.85)",
          borderRadius: 8,
          border: "1px solid rgba(148,163,184,0.08)",
          textAlign: "center",
          backdropFilter: "blur(8px)",
        }}>
          +{overflow} more processing...
        </div>
      )}
    </div>
  );
}
