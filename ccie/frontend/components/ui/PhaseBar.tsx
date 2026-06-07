"use client";

import type { Phase } from "@/types/ccie";

const PHASES: Phase[] = [
  "classifying",
  "discovering",
  "analyzing",
  "synthesizing",
  "complete",
];

const PHASE_COLOR: Record<string, string> = {
  idle: "#64748b",
  classifying: "#a855f7",
  discovering: "#3b82f6",
  analyzing: "#22d3ee",
  synthesizing: "#f59e0b",
  complete: "#22c55e",
};

export function PhaseBar({
  phase = "idle",
  target,
  competitorCount,
}: {
  phase?: Phase;
  target?: string;
  competitorCount: number;
}) {
  const activeIndex = PHASES.indexOf(phase);

  return (
    <div className="glass" style={{ padding: "12px 16px", pointerEvents: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
        <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em" }}>
          CCIE War Room
        </span>
        <span
          className="label-chip"
          style={{ color: "#0b1120", background: PHASE_COLOR[phase] ?? "#64748b" }}
        >
          {phase}
        </span>
        {target && (
          <span style={{ color: "#9ca3af", fontSize: 13 }}>
            · target <strong style={{ color: "#e5e7eb" }}>{target}</strong>
          </span>
        )}
        <span style={{ marginLeft: "auto", color: "#9ca3af", fontSize: 13 }}>
          {competitorCount} competitor{competitorCount === 1 ? "" : "s"}
        </span>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {PHASES.map((p, i) => (
          <div
            key={p}
            title={p}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 999,
              background:
                phase === "complete" || i <= activeIndex
                  ? PHASE_COLOR[p]
                  : "rgba(148,163,184,0.18)",
              transition: "background 0.4s ease",
            }}
          />
        ))}
      </div>
    </div>
  );
}
