"use client";

import type { SimulationIteration } from "@/types/simulation";

interface Props {
  iteration: SimulationIteration;
  phaseNum: number;
  maxPhases: number;
  targetCompany: string;
  onClose?: () => void;
}

export function SimPhaseBanner({ iteration, phaseNum, maxPhases, targetCompany }: Props) {
  const score = iteration.score;
  const reactions = iteration.reactions ?? [];
  const posVal = Math.round((score?.position ?? 0.5) * 100);
  const riskVal = Math.round((score?.risk ?? 0.5) * 100);
  const highThreat = reactions.filter((r) => (r.intensity ?? 0) > 0.6).length;

  const outcome = iteration.referee_outcome ?? "";
  const headline = outcome.split(/(?<=[.!?])\s+/)[0] ?? "Phase analysis complete.";
  const bullets = outcome.split(/(?<=[.!?])\s+/).slice(1, 3).filter(Boolean);

  const move = iteration.move ?? iteration.grounding?.move;

  return (
    <div style={{
      position: "absolute",
      top: 88,
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 140,
      pointerEvents: "none",
      width: "min(680px, calc(100vw - 48px))",
      animation: "fadeInUp 0.4s ease",
    }}>
      <div style={{
        background: "rgba(8,12,22,0.94)",
        backdropFilter: "blur(16px)",
        borderRadius: 16,
        border: "1px solid rgba(59,130,246,0.25)",
        boxShadow: "0 12px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset",
        overflow: "hidden",
      }}>
        {/* Phase header */}
        <div style={{
          padding: "12px 20px",
          background: "linear-gradient(90deg, rgba(59,130,246,0.15), rgba(168,85,247,0.08))",
          borderBottom: "1px solid rgba(148,163,184,0.08)",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}>
          <div style={{
            background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
            color: "#fff", fontSize: 11, fontWeight: 900,
            padding: "5px 12px", borderRadius: 6, letterSpacing: "0.06em",
          }}>
            PHASE {phaseNum}/{maxPhases}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Market Response
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", marginTop: 2 }}>
              {headline}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
            <StatPill label="Position" val={posVal} color={posVal > 60 ? "#22c55e" : "#f59e0b"} />
            <StatPill label="Risk" val={riskVal} color={riskVal > 60 ? "#ef4444" : "#22c55e"} />
            <StatPill label="Threats" val={highThreat} color="#ef4444" suffix="" />
          </div>
        </div>

        {/* Your move + key points */}
        <div style={{ padding: "14px 20px", display: "flex", gap: 16 }}>
          {move && (
            <div style={{
              flex: "0 0 auto", maxWidth: 200,
              padding: "10px 14px", borderRadius: 10,
              background: "rgba(245,158,11,0.08)",
              border: "1px solid rgba(245,158,11,0.2)",
            }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
                Your Move
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#fde68a", lineHeight: 1.4 }}>
                {move.length > 100 ? move.substring(0, 100) + "…" : move}
              </div>
            </div>
          )}

          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
              {reactions.length} competitors responded — see cards on buildings
            </div>
            {bullets.map((pt, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: "#3b82f6", flexShrink: 0 }}>{i + 1}.</span>
                <span style={{ fontSize: 11, color: "#cbd5e1", lineHeight: 1.45 }}>{pt}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatPill({ label, val, color, suffix = "%" }: { label: string; val: number; color: string; suffix?: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 16, fontWeight: 900, color, lineHeight: 1 }}>{val}{suffix}</div>
      <div style={{ fontSize: 8, fontWeight: 700, color: "#64748b", marginTop: 2 }}>{label}</div>
    </div>
  );
}
