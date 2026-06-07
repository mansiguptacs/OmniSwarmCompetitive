"use client";

import { useState } from "react";
import type { SimulationState, DecisionOption } from "@/types/simulation";

interface SimHUDProps {
  state: SimulationState;
  loading: boolean;
  onChoose: (choice: string) => void;
  onClose: () => void;
}

export function SimHUD({ state, loading, onChoose, onClose }: SimHUDProps) {
  const [freeText, setFreeText] = useState("");
  const [expanded, setExpanded] = useState(false);

  const iter = state.iterations?.[state.iterations.length - 1];
  const isAwaiting = state.status === "awaiting_choice";
  const isComplete = state.status === "complete";
  const dp = iter?.decision_point;
  const options = dp?.options ?? [];
  const phaseNum = state.iterations?.length ?? 0;
  const maxPhases = state.max_iterations ?? 5;

  return (
    <div style={{
      position: "absolute", bottom: 0, left: 0, right: 0,
      zIndex: 150, pointerEvents: "auto",
    }}>
      {/* Decision cards — float above bar, over the city */}
      {isAwaiting && dp && expanded && (
        <div style={{
          display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap",
          padding: "0 24px 16px",
          animation: "fadeInUp 0.3s ease",
        }}>
          {options.map((opt: DecisionOption) => {
            const isRec = opt.id === dp.recommended_option_id;
            return (
              <button
                key={opt.id}
                onClick={() => { setFreeText(""); setExpanded(false); onChoose(opt.id); }}
                disabled={loading}
                style={{
                  maxWidth: 260, padding: "16px 18px", borderRadius: 14,
                  textAlign: "left", cursor: loading ? "wait" : "pointer",
                  transition: "all 0.2s", position: "relative",
                  border: isRec ? "2px solid rgba(245,158,11,0.55)" : "1.5px solid rgba(148,163,184,0.15)",
                  background: "rgba(8,12,22,0.96)",
                  backdropFilter: "blur(16px)",
                  boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
                }}
              >
                {isRec && (
                  <div style={{
                    position: "absolute", top: -8, right: 12,
                    fontSize: 8, fontWeight: 800, color: "#0b1120",
                    background: "#f59e0b", padding: "2px 8px", borderRadius: 4,
                  }}>RECOMMENDED</div>
                )}
                <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9", marginBottom: 6 }}>
                  {opt.label}
                </div>
                {opt.expected_effect && (
                  <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.45 }}>
                    {opt.expected_effect.substring(0, 100)}{opt.expected_effect.length > 100 ? "…" : ""}
                  </div>
                )}
              </button>
            );
          })}

          {dp.allow_free_text !== false && (
            <div style={{
              maxWidth: 260, padding: "16px 18px", borderRadius: 14,
              background: "rgba(8,12,22,0.96)", backdropFilter: "blur(16px)",
              border: "1.5px solid rgba(148,163,184,0.15)",
              display: "flex", flexDirection: "column", gap: 8,
              boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>Custom strategy</div>
              <input
                style={{
                  width: "100%", padding: "8px 10px", borderRadius: 6,
                  background: "rgba(15,23,42,0.6)", border: "1px solid rgba(148,163,184,0.15)",
                  color: "#e5e7eb", fontSize: 12, outline: "none", fontFamily: "inherit",
                }}
                placeholder="Type your own move..."
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && freeText.trim()) { onChoose(freeText.trim()); setFreeText(""); setExpanded(false); } }}
              />
              <button
                onClick={() => { if (freeText.trim()) { onChoose(freeText.trim()); setFreeText(""); setExpanded(false); } }}
                disabled={!freeText.trim()}
                style={{
                  padding: "8px 14px", borderRadius: 6, border: "none",
                  background: freeText.trim() ? "#3b82f6" : "rgba(148,163,184,0.08)",
                  color: freeText.trim() ? "#fff" : "#475569",
                  fontSize: 11, fontWeight: 700, cursor: freeText.trim() ? "pointer" : "default",
                }}
              >Submit</button>
            </div>
          )}
        </div>
      )}

      {/* Minimal control bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 14,
        padding: "10px 20px",
        background: "rgba(8,12,22,0.92)",
        backdropFilter: "blur(16px)",
        borderTop: "1px solid rgba(148,163,184,0.08)",
      }}>
        <button onClick={onClose} style={{
          background: "transparent", border: "none", color: "#64748b",
          cursor: "pointer", fontSize: 11, padding: "4px 8px",
          display: "flex", alignItems: "center", gap: 4,
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
          Exit Sim
        </button>

        <div style={{ width: 1, height: 20, background: "rgba(148,163,184,0.1)" }} />

        <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>
          Phase {phaseNum}/{maxPhases}
        </span>

        <div style={{ flex: 1 }} />

        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ animation: "spin 1s linear infinite" }}>
              <circle cx="12" cy="12" r="10" stroke="#f59e0b" strokeWidth="2.5" strokeDasharray="50 20" strokeLinecap="round" />
            </svg>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b" }}>Modeling responses...</span>
          </div>
        )}

        {isAwaiting && !loading && (
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              padding: "10px 22px", borderRadius: 10,
              border: "2px solid rgba(245,158,11,0.55)",
              background: expanded ? "rgba(245,158,11,0.18)" : "rgba(245,158,11,0.1)",
              color: "#f59e0b", fontSize: 13, fontWeight: 800,
              cursor: "pointer",
              animation: expanded ? undefined : "sim-glow-amber 3s infinite",
            }}
          >
            ⚡ {expanded ? "Hide Options" : "Choose Your Next Move"}
          </button>
        )}

        {isComplete && (
          <button onClick={onClose} style={{
            padding: "10px 18px", borderRadius: 10,
            border: "1px solid rgba(34,197,94,0.35)",
            background: "rgba(34,197,94,0.1)",
            color: "#22c55e", fontSize: 12, fontWeight: 700, cursor: "pointer",
          }}>
            ✓ Complete — Return to City
          </button>
        )}
      </div>

      {isComplete && state.final_recommendation && (
        <div style={{
          padding: "20px 32px 24px",
          background: "linear-gradient(135deg, rgba(8,12,22,0.98), rgba(34,197,94,0.06))",
          borderTop: "2px solid rgba(34,197,94,0.3)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
              background: "linear-gradient(135deg, #22c55e, #16a34a)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 20px rgba(34,197,94,0.3)",
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 900, color: "#22c55e", letterSpacing: "0.04em" }}>
                STRATEGIC RECOMMENDATION
              </div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                Based on {phaseNum} phases of competitive simulation
              </div>
            </div>
          </div>
          <div style={{
            fontSize: 15, color: "#f1f5f9", lineHeight: 1.65, fontWeight: 500,
            padding: "14px 18px", borderRadius: 10,
            background: "rgba(34,197,94,0.06)",
            border: "1px solid rgba(34,197,94,0.15)",
          }}>
            {state.final_recommendation.substring(0, 500)}{state.final_recommendation.length > 500 ? "…" : ""}
          </div>
        </div>
      )}
    </div>
  );
}
