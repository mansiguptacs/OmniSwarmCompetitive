"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SimulationState, DecisionOption, CompanyPersona, AgentReaction } from "@/types/simulation";
import type { SimProgressEvent } from "@/lib/simApi";
import { startSimulationStream, advanceSimulationStream } from "@/lib/simApi";
import { currentBoard } from "@/lib/simVisuals";

/* ── Injected keyframes (once) ───────────────────────────────── */

const STYLE_ID = "sim-overlay-keyframes";
if (typeof document !== "undefined" && !document.getElementById(STYLE_ID)) {
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes sim-count-up { from { opacity: 0; transform: translateY(12px) scale(0.8); } to { opacity: 1; transform: translateY(0) scale(1); } }
    @keyframes sim-slide-in { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes sim-card-enter { from { opacity: 0; transform: scale(0.95) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
    @keyframes sim-glow-amber { 0%, 100% { box-shadow: 0 0 8px rgba(245,158,11,0.15); } 50% { box-shadow: 0 0 24px rgba(245,158,11,0.35); } }
    @keyframes sim-border-sweep {
      0% { border-image: linear-gradient(0deg, #f59e0b, transparent, transparent) 1; }
      25% { border-image: linear-gradient(90deg, #f59e0b, transparent, transparent) 1; }
      50% { border-image: linear-gradient(180deg, #f59e0b, transparent, transparent) 1; }
      75% { border-image: linear-gradient(270deg, #f59e0b, transparent, transparent) 1; }
      100% { border-image: linear-gradient(360deg, #f59e0b, transparent, transparent) 1; }
    }
    @keyframes sim-radar-sweep { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes sim-flash { 0% { opacity: 1; } 100% { opacity: 0; } }
    .sim-option-card:hover { transform: translateY(-2px) !important; box-shadow: 0 8px 24px rgba(245,158,11,0.2) !important; border-color: rgba(245,158,11,0.5) !important; }
    .sim-response-row:hover { background: rgba(148,163,184,0.05) !important; }
  `;
  document.head.appendChild(style);
}

/* ── Animated counter hook ───────────────────────────────────── */

function useAnimatedValue(target: number, duration = 800) {
  const [display, setDisplay] = useState(target);
  const prev = useRef(target);
  useEffect(() => {
    const from = prev.current;
    prev.current = target;
    if (from === target) return;
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (target - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return display;
}

/* ── Styles ──────────────────────────────────────────────────── */

const S: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 200,
    background: "rgba(0,0,0,0.55)",
    backdropFilter: "blur(6px)",
    animation: "fadeInUp 0.3s ease",
    display: "flex",
    flexDirection: "column",
  },
  topBar: {
    padding: "0 24px",
    height: 56,
    background: "rgba(10,14,23,0.97)",
    backdropFilter: "blur(16px)",
    borderBottom: "1px solid rgba(148,163,184,0.08)",
    display: "flex",
    alignItems: "center",
    gap: 14,
    zIndex: 210,
  },
  card: {
    background: "rgba(15,23,42,0.96)",
    border: "1px solid rgba(148,163,184,0.1)",
    backdropFilter: "blur(16px)",
    borderRadius: 14,
    boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
    overflow: "hidden",
  },
  input: {
    width: "100%",
    padding: "12px 14px",
    marginTop: 6,
    marginBottom: 14,
    background: "rgba(15,23,42,0.6)",
    border: "1px solid rgba(148,163,184,0.15)",
    borderRadius: 8,
    color: "#e5e7eb",
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
  },
};

const TEMPERAMENT_LABELS: Record<string, string> = {
  aggressive: "Aggressive Acquirer",
  litigious: "Regulatory / Legal Focus",
  partner_first: "Partnership-Oriented",
  wait_and_see: "Observant Strategist",
  acquisitive: "Active Acquirer",
};

/* ── Live streaming progress ─────────────────────────────────── */

type AgentStatus = "queued" | "analyzing" | "responded" | "revised";

interface LiveAgentState {
  name: string;
  status: AgentStatus;
  action?: string;
  intent?: string;
  intensity?: number;
}

const STAGE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  grounding: { label: "Gathering market intelligence", icon: "📊", color: "#3b82f6" },
  first_pass: { label: "Initial strategic analysis", icon: "🏛", color: "#a855f7" },
  second_pass: { label: "Cross-referencing competitor responses", icon: "🤝", color: "#f59e0b" },
  referee: { label: "Synthesizing market impact", icon: "⚖", color: "#22c55e" },
  scoring: { label: "Computing position and risk metrics", icon: "📐", color: "#3b82f6" },
};

function AnalysisProgress({ agents, currentStage, phase }: {
  agents: LiveAgentState[];
  currentStage: string;
  phase: number;
}) {
  const stageInfo = STAGE_LABELS[currentStage] ?? { label: "Processing...", icon: "⏳", color: "#64748b" };
  const doneCount = agents.filter((a) => a.status === "responded" || a.status === "revised").length;
  const totalCount = agents.length;

  const stageKeys = Object.keys(STAGE_LABELS);
  const stageIdx = stageKeys.indexOf(currentStage);

  return (
    <div style={{ ...S.card, width: 480, maxHeight: "80vh", overflow: "auto" }}>
      {/* Header */}
      <div style={{ padding: "24px 28px 18px", borderBottom: "1px solid rgba(148,163,184,0.06)" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#3b82f6", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
          Analyzing Phase {phase}
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#e2e8f0", display: "flex", alignItems: "center", gap: 10 }} key={currentStage}>
          <span style={{ fontSize: 22 }}>{stageInfo.icon}</span>
          <span style={{ animation: "fadeInUp 0.3s ease" }}>{stageInfo.label}</span>
        </div>
        <div style={{ display: "flex", gap: 3, marginTop: 16 }}>
          {stageKeys.map((key, i) => (
            <div key={key} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= stageIdx ? STAGE_LABELS[key].color : "rgba(148,163,184,0.08)", transition: "background 0.4s" }} />
          ))}
        </div>
        {totalCount > 0 && (
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 10 }}>
            {doneCount} of {totalCount} competitor analyses complete
          </div>
        )}
      </div>

      {/* Per-agent live status */}
      <div style={{ padding: "18px 28px" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
          Competitor Strategy Modeling
        </div>
        {agents.map((agent) => {
          const isActive = agent.status === "analyzing";
          const isDone = agent.status === "responded" || agent.status === "revised";
          const impact = agent.intensity ?? 0;
          const impactColor = impact > 0.7 ? "#ef4444" : impact > 0.4 ? "#f59e0b" : "#3b82f6";

          return (
            <div key={agent.name} style={{
              display: "flex", alignItems: "flex-start", gap: 12,
              padding: "12px 14px", borderRadius: 10, marginBottom: 6,
              background: isDone ? "rgba(34,197,94,0.03)" : isActive ? "rgba(59,130,246,0.04)" : "transparent",
              border: isDone ? "1px solid rgba(34,197,94,0.1)" : isActive ? "1px solid rgba(59,130,246,0.1)" : "1px solid transparent",
              transition: "all 0.3s",
              animation: isDone ? "fadeInUp 0.3s ease" : undefined,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, fontWeight: 800,
                color: isDone ? "#0b1120" : isActive ? "#e2e8f0" : "#64748b",
                background: isDone ? "#22c55e" : isActive ? "rgba(59,130,246,0.15)" : "rgba(148,163,184,0.06)",
                border: isActive ? "1.5px solid #3b82f6" : "1px solid rgba(148,163,184,0.06)",
                animation: isActive ? "pulse-glow 2s infinite" : undefined,
                transition: "all 0.3s",
              }}>
                {isDone ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                ) : agent.name.charAt(0)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: isDone || isActive ? "#e2e8f0" : "#64748b" }}>{agent.name}</span>
                  {isDone && agent.intensity != null && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: impactColor, background: `${impactColor}12`, padding: "1px 7px", borderRadius: 4 }}>
                      {Math.round(impact * 100)}% impact
                    </span>
                  )}
                </div>
                {isDone && agent.action ? (
                  <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5, marginTop: 3 }}>
                    {agent.action.length > 120 ? agent.action.substring(0, 120) + "..." : agent.action}
                  </div>
                ) : isDone && agent.intent ? (
                  <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5, marginTop: 3 }}>{agent.intent}</div>
                ) : isActive ? (
                  <div style={{ fontSize: 12, color: "#475569", marginTop: 3 }}>Evaluating strategic implications...</div>
                ) : (
                  <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>Queued for analysis</div>
                )}
              </div>
              {isActive && <div style={{ width: 7, height: 7, borderRadius: 999, background: "#3b82f6", animation: "pulse-glow 1.5s infinite", marginTop: 8, flexShrink: 0 }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Gauge KPI Card ──────────────────────────────────────────── */

function riskLevel(v: number): { label: string; color: string } {
  if (v >= 75) return { label: "Critical", color: "#ef4444" };
  if (v >= 50) return { label: "Elevated", color: "#f59e0b" };
  if (v >= 25) return { label: "Moderate", color: "#3b82f6" };
  return { label: "Favorable", color: "#22c55e" };
}

function GaugeKPI({ label, value, icon, invert, delta }: {
  label: string; value: number; icon: string; invert?: boolean; delta?: number;
}) {
  const pct = Math.min(100, Math.max(0, Math.round(value)));
  const animated = useAnimatedValue(pct);
  const { label: lvl, color } = invert
    ? riskLevel(pct)
    : riskLevel(100 - pct);

  const circumference = 2 * Math.PI * 32;
  const dashOffset = circumference - (circumference * pct) / 100;

  return (
    <div style={{
      flex: 1, padding: "18px 14px 16px", background: "rgba(15,23,42,0.96)",
      borderRadius: 14, border: `1px solid ${color}18`,
      display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
      position: "relative", overflow: "hidden",
      animation: "sim-card-enter 0.5s ease",
    }}>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: `${pct * 0.6}%`, background: `${color}06`, transition: "height 1s ease" }} />
      {/* Arc gauge */}
      <div style={{ position: "relative", width: 72, height: 72 }}>
        <svg width="72" height="72" viewBox="0 0 72 72" style={{ position: "absolute", transform: "rotate(-90deg)" }}>
          <circle cx="36" cy="36" r="32" fill="none" stroke="rgba(148,163,184,0.06)" strokeWidth="4" />
          <circle cx="36" cy="36" r="32" fill="none" stroke={color} strokeWidth="4"
            strokeDasharray={circumference} strokeDashoffset={dashOffset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 1s ease" }}
          />
        </svg>
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: 14, marginBottom: 2 }}>{icon}</span>
          <span style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1, animation: "sim-count-up 0.6s ease" }}>{animated}</span>
        </div>
      </div>
      <div style={{ fontSize: 9, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.08em", position: "relative" }}>{lvl}</div>
      <div style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", textAlign: "center", position: "relative" }}>{label}</div>
      {delta != null && (
        <div style={{ fontSize: 10, fontWeight: 700, color: delta > 0 ? "#22c55e" : delta < 0 ? "#ef4444" : "#64748b", position: "relative" }}>
          {delta > 0 ? "▲" : delta < 0 ? "▼" : "–"} {Math.abs(delta).toFixed(1)}
        </div>
      )}
    </div>
  );
}

/* ── Verdict Badge ───────────────────────────────────────────── */

function verdictFromScores(position: number, risk: number, momentum: number): { label: string; color: string; bg: string } {
  if (risk > 70) return { label: "High Risk — Proceed with Caution", color: "#ef4444", bg: "rgba(239,68,68,0.08)" };
  if (position > 65 && momentum > 50) return { label: "Strong Position — Favorable Outlook", color: "#22c55e", bg: "rgba(34,197,94,0.08)" };
  if (momentum > 60) return { label: "Building Momentum — Monitor Closely", color: "#3b82f6", bg: "rgba(59,130,246,0.08)" };
  return { label: "Mixed Signals — Further Analysis Advised", color: "#f59e0b", bg: "rgba(245,158,11,0.08)" };
}

/* ── Status Badge ────────────────────────────────────────────── */

function StatusBadge({ status }: { status?: string }) {
  const cfg = {
    setup: { label: "Configuration", color: "#64748b", bg: "rgba(100,116,139,0.12)" },
    running: { label: "Analyzing", color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
    awaiting_choice: { label: "Decision Required", color: "#f59e0b", bg: "rgba(245,158,11,0.15)" },
    complete: { label: "Analysis Complete", color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  }[status ?? "setup"] ?? { label: status, color: "#64748b", bg: "rgba(100,116,139,0.12)" };

  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "4px 12px", borderRadius: 4, background: cfg.bg, color: cfg.color, textTransform: "uppercase", letterSpacing: "0.05em" }}>
      {cfg.label}
    </span>
  );
}

/* ── Phase Progress ──────────────────────────────────────────── */

function PhaseProgress({ current, total }: { current: number; total: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Phase {current}/{total}</span>
      <div style={{ display: "flex", gap: 3 }}>
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} style={{ width: i < current ? 14 : 8, height: 5, borderRadius: 3, background: i < current ? "#22c55e" : "rgba(148,163,184,0.12)", transition: "all 0.3s" }} />
        ))}
      </div>
    </div>
  );
}

/* ── Competitive Response Row (visual) ───────────────────────── */

function CompetitiveResponseRow({ r, rank, expanded, onToggle, delay = 0 }: {
  r: AgentReaction; rank: number; expanded: boolean; onToggle: () => void; delay?: number;
}) {
  const impact = r.intensity ?? 0.5;
  const barPct = Math.round(impact * 100);
  const barColor = impact > 0.7 ? "#ef4444" : impact > 0.4 ? "#f59e0b" : "#3b82f6";
  const threatLabel = impact > 0.7 ? "HIGH" : impact > 0.4 ? "MED" : "LOW";
  const hasAlliances = (r.ally_with?.length ?? 0) > 0;

  return (
    <div className="sim-response-row" style={{
      background: expanded ? "rgba(148,163,184,0.04)" : "transparent",
      borderRadius: 10, transition: "background 0.2s",
      borderBottom: "1px solid rgba(148,163,184,0.04)",
      animation: `sim-slide-in 0.4s ease ${delay}ms both`,
    }}>
      <button onClick={onToggle} style={{
        width: "100%", display: "grid", gridTemplateColumns: "28px 1fr 120px 60px 20px",
        alignItems: "center", gap: 12, padding: "16px 14px",
        background: "transparent", border: "none", cursor: "pointer", textAlign: "left",
      }}>
        {/* Rank */}
        <div style={{
          width: 28, height: 28, borderRadius: 7,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 800, color: barColor,
          background: `${barColor}10`, border: `1px solid ${barColor}20`,
        }}>
          {rank}
        </div>

        {/* Company + intent */}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>{r.actor}</span>
            {hasAlliances && (
              <span style={{ fontSize: 9, fontWeight: 700, color: "#a855f7", background: "rgba(168,85,247,0.1)", padding: "1px 6px", borderRadius: 3 }}>
                ALLIANCE
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
            {r.intent ?? r.action?.substring(0, 70) ?? "Strategic response"}
          </div>
        </div>

        {/* Impact bar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ height: 6, borderRadius: 3, background: "rgba(148,163,184,0.06)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${barPct}%`, background: barColor, borderRadius: 3, transition: "width 0.5s ease" }} />
          </div>
          <div style={{ fontSize: 9, color: "#64748b", textAlign: "right" }}>{barPct}% severity</div>
        </div>

        {/* Threat level badge */}
        <div style={{
          fontSize: 9, fontWeight: 800, color: barColor,
          background: `${barColor}12`, padding: "4px 8px", borderRadius: 4,
          textAlign: "center", letterSpacing: "0.08em",
        }}>
          {threatLabel}
        </div>

        <span style={{ color: "#475569", fontSize: 12, transition: "transform 0.2s", transform: expanded ? "rotate(180deg)" : "rotate(0)" }}>▾</span>
      </button>

      {expanded && (
        <div style={{ padding: "0 14px 18px 54px", animation: "fadeInUp 0.2s ease" }}>
          {r.action && (
            <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.65, marginBottom: 10 }}>
              <span style={{ fontWeight: 700, color: "#e2e8f0" }}>Action: </span>{r.action}
            </div>
          )}
          {r.rationale && (
            <div style={{
              fontSize: 12, color: "#94a3b8", lineHeight: 1.55, padding: "10px 14px",
              background: "rgba(148,163,184,0.03)", borderRadius: 8,
              borderLeft: `3px solid ${barColor}40`,
            }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Rationale</span>
              {r.rationale}
            </div>
          )}
          {hasAlliances && (
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, color: "#a855f7", fontWeight: 600 }}>Potential Allies:</span>
              {r.ally_with!.map((a) => (
                <span key={a} style={{ fontSize: 11, color: "#e2e8f0", background: "rgba(168,85,247,0.08)", padding: "2px 8px", borderRadius: 4, border: "1px solid rgba(168,85,247,0.15)" }}>{a}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Tab button ──────────────────────────────────────────────── */

function TabBtn({ label, count, active, onClick, icon }: {
  label: string; count?: number; active: boolean; onClick: () => void; icon: string;
}) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: "10px 14px", borderRadius: 10, border: "none", cursor: "pointer",
      fontSize: 12, fontWeight: 700, transition: "all 0.2s",
      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
      background: active ? "rgba(59,130,246,0.12)" : "transparent",
      color: active ? "#60a5fa" : "#64748b",
      borderBottom: active ? "2px solid #3b82f6" : "2px solid transparent",
    }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      {label}
      {count != null && (
        <span style={{
          fontSize: 10, fontWeight: 800, minWidth: 18, padding: "1px 5px", borderRadius: 4, textAlign: "center",
          background: active ? "rgba(59,130,246,0.2)" : "rgba(148,163,184,0.08)",
          color: active ? "#93c5fd" : "#475569",
        }}>{count}</span>
      )}
    </button>
  );
}

/* ── Participant Card ────────────────────────────────────────── */

function ParticipantCard({ p, threat, reaction }: {
  p: CompanyPersona; threat?: number; reaction?: AgentReaction;
}) {
  const t = threat ?? 0;
  const tColor = t > 0.6 ? "#ef4444" : t > 0.3 ? "#f59e0b" : "#3b82f6";

  return (
    <div style={{
      padding: "16px 18px", borderRadius: 12,
      background: "rgba(148,163,184,0.02)", border: "1px solid rgba(148,163,184,0.06)",
      transition: "border-color 0.2s",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: `${tColor}10`, border: `1.5px solid ${tColor}25`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, fontWeight: 800, color: tColor,
        }}>{p.name.charAt(0)}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>{p.name}</div>
          <div style={{ fontSize: 11, color: "#64748b" }}>
            {TEMPERAMENT_LABELS[p.temperament ?? ""] ?? "Strategic Analyst"}
          </div>
        </div>
        {threat != null && (
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: tColor }}>{Math.round(t * 100)}%</div>
            <div style={{ fontSize: 9, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em" }}>Threat</div>
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: reaction ? 10 : 0 }}>
        {p.financial_firepower && (
          <span style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", background: "rgba(148,163,184,0.06)", padding: "3px 8px", borderRadius: 4 }}>
            {p.financial_firepower}
          </span>
        )}
        {p.leadership_style && (
          <span style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", background: "rgba(148,163,184,0.06)", padding: "3px 8px", borderRadius: 4 }}>
            {p.leadership_style}
          </span>
        )}
      </div>
      {reaction && (
        <div style={{
          padding: "8px 10px", borderRadius: 6, background: "rgba(148,163,184,0.03)",
          borderLeft: `3px solid ${tColor}40`, fontSize: 12, color: "#94a3b8", lineHeight: 1.5,
        }}>
          <span style={{ fontWeight: 600, color: "#cbd5e1" }}>Latest move: </span>
          {reaction.action?.substring(0, 100) ?? reaction.intent ?? "Evaluating position"}
          {(reaction.action?.length ?? 0) > 100 ? "..." : ""}
        </div>
      )}
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────────── */

interface SimOverlayProps {
  targetCompany: string;
  competitors: string[];
  onClose: () => void;
  onStateChange?: (state: SimulationState | null) => void;
  onLoadingChange?: (loading: boolean) => void;
  onChooseReady?: (chooseFn: (choice: string) => void) => void;
}

export function SimOverlay({ targetCompany, competitors, onClose, onStateChange, onLoadingChange, onChooseReady }: SimOverlayProps) {
  const [state, setState] = useState<SimulationState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingPhase, setPendingPhase] = useState(0);
  const [tab, setTab] = useState<"responses" | "intelligence" | "participants">("responses");
  const [expandedReaction, setExpandedReaction] = useState<number | null>(null);
  const [freeTextAction, setFreeTextAction] = useState("");

  const [acquisitionTarget, setAcquisitionTarget] = useState(competitors[0] ?? "");
  const [customTarget, setCustomTarget] = useState("");
  const [depth, setDepth] = useState(5);

  const [liveAgents, setLiveAgents] = useState<LiveAgentState[]>([]);
  const [liveStage, setLiveStage] = useState("grounding");

  const setupMode = !state && !loading;
  const board = useMemo(() => currentBoard(state), [state]);
  const lastIteration = state?.iterations?.[state.iterations.length - 1] ?? null;
  const isAwaitingChoice = state?.status === "awaiting_choice";
  const isComplete = state?.status === "complete";
  const personas = state?.personas ?? [];

  useEffect(() => { setTab("responses"); setExpandedReaction(null); }, [state?.current_index]);
  useEffect(() => { onStateChange?.(state); }, [state, onStateChange]);
  useEffect(() => { onLoadingChange?.(loading); }, [loading, onLoadingChange]);

  const handleEvent = useCallback((evt: SimProgressEvent) => {
    if (evt.kind === "personas") {
      const data = evt.data as CompanyPersona[];
      setLiveAgents(data.map((p) => ({ name: p.name, status: "queued" as AgentStatus })));
    } else if (evt.kind === "stage") {
      setLiveStage(evt.name ?? "grounding");
      if (evt.name === "second_pass") {
        setLiveAgents((prev) => prev.map((a) => ({ ...a, status: "queued" as AgentStatus, action: undefined, intent: undefined, intensity: undefined })));
      }
    } else if (evt.kind === "analyzing") {
      setLiveStage("first_pass");
      setLiveAgents((prev) => prev.map((a) =>
        a.name === evt.name ? { ...a, status: "analyzing" as AgentStatus } : a,
      ));
    } else if (evt.kind === "reaction") {
      const reaction = evt.data as AgentReaction;
      setLiveAgents((prev) => prev.map((a) =>
        a.name === evt.name
          ? { ...a, status: "responded" as AgentStatus, action: reaction?.action, intent: reaction?.intent, intensity: reaction?.intensity }
          : a,
      ));
    } else if (evt.kind === "revising") {
      setLiveStage("second_pass");
      setLiveAgents((prev) => prev.map((a) =>
        a.name === evt.name ? { ...a, status: "analyzing" as AgentStatus } : a,
      ));
    } else if (evt.kind === "revised") {
      const reaction = evt.data as AgentReaction;
      setLiveAgents((prev) => prev.map((a) =>
        a.name === evt.name
          ? { ...a, status: "revised" as AgentStatus, action: reaction?.action, intent: reaction?.intent, intensity: reaction?.intensity }
          : a,
      ));
    } else if (evt.kind === "grounding_done") {
      setLiveStage("first_pass");
    }
  }, []);

  const handleStart = useCallback(async () => {
    const target = (acquisitionTarget || customTarget).trim();
    if (!target) return;
    setLoading(true);
    setError(null);
    setPendingPhase(1);
    setLiveStage("grounding");

    const exclude = new Set([targetCompany, target].map((s) => s.toLowerCase().trim()));
    const incumbents = competitors.filter((c) => !exclude.has(c.toLowerCase().trim()));
    const cap = Math.min(incumbents.length, 8);

    setLiveAgents(incumbents.slice(0, cap).map((c) => ({ name: c, status: "queued" as AgentStatus })));
    try {
      const next = await startSimulationStream(
        {
          target,
          player: targetCompany,
          max_iterations: depth,
          max_incumbents: cap,
          incumbents: incumbents.slice(0, cap),
        },
        handleEvent,
      );
      setState(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to initiate analysis");
    } finally {
      setLoading(false);
      setPendingPhase(0);
    }
  }, [acquisitionTarget, customTarget, targetCompany, depth, competitors, handleEvent]);

  const handleChoose = useCallback(async (choice: string) => {
    if (!state?.session_id) return;
    setLoading(true);
    setError(null);
    setPendingPhase((state.current_index ?? 0) + 1);
    setLiveStage("grounding");
    setLiveAgents((state.personas ?? []).map((p) => ({ name: p.name, status: "queued" as AgentStatus })));
    try {
      const next = await advanceSimulationStream(
        state.session_id, choice,
        handleEvent,
      );
      setState(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to advance analysis");
    } finally {
      setLoading(false);
      setPendingPhase(0);
    }
  }, [state?.session_id, state?.current_index, state?.personas, handleEvent]);

  useEffect(() => { onChooseReady?.(handleChoose); }, [handleChoose, onChooseReady]);

  const score = lastIteration?.score;
  const reactions = lastIteration?.reactions ?? [];
  const evidence = lastIteration?.grounding?.evidence ?? [];

  const highImpactCount = reactions.filter((r) => (r.intensity ?? 0) > 0.6).length;
  const allianceCount = reactions.reduce((n, r) => n + (r.ally_with?.length ?? 0), 0);

  const cityMode = !!state && !loading;

  if (cityMode) return null;

  return (
    <div style={S.overlay}>
      {/* ── Command Center bar ─────────────────────── */}
      <div style={S.topBar}>
        <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer", fontSize: 12, padding: "4px 0", display: "flex", alignItems: "center", gap: 4 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
          Exit
        </button>
        <div style={{ width: 1, height: 24, background: "rgba(148,163,184,0.1)" }} />
        {/* Radar icon */}
        <div style={{ position: "relative", width: 28, height: 28, flexShrink: 0 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 999, border: "2px solid rgba(245,158,11,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{ width: 6, height: 6, borderRadius: 999, background: loading ? "#f59e0b" : "#22c55e", animation: loading ? "pulse-glow 1s infinite" : undefined }} />
          </div>
          {loading && (
            <div style={{
              position: "absolute", inset: -2,
              border: "2px solid transparent", borderTopColor: "#f59e0b",
              borderRadius: 999, animation: "sim-radar-sweep 1.5s linear infinite",
            }} />
          )}
        </div>
        <span style={{ fontWeight: 700, fontSize: 15, color: "#f1f5f9", letterSpacing: "-0.01em" }}>Strategy Command Center</span>
        {(state || loading) && <StatusBadge status={loading ? "running" : state?.status} />}
        {state && (
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
            {/* Phase shield */}
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "6px 14px", borderRadius: 8,
              background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)",
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 7,
                background: "linear-gradient(135deg, #f59e0b, #ef4444)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 900, color: "#0b1120",
              }}>
                {state.iterations?.length ?? 0}
              </div>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.08em" }}>Phase</div>
                <div style={{ fontSize: 10, color: "#64748b" }}>of {state.max_iterations ?? depth}</div>
              </div>
            </div>
            <PhaseProgress current={state.iterations?.length ?? 0} total={state.max_iterations ?? depth} />
          </div>
        )}
      </div>

      {/* ── Content ──────────────────────────────────── */}
      <div style={{ flex: 1, overflow: "auto", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "24px 16px" }}>

        {/* ── Setup ──────────────────────────────────── */}
        {setupMode && (
          <div style={{ ...S.card, width: 480, marginTop: 40 }}>
            <div style={{ padding: "28px 32px 20px", borderBottom: "1px solid rgba(148,163,184,0.06)" }}>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.02em" }}>
                M&A Scenario Analysis
              </h2>
              <p style={{ margin: "10px 0 0", color: "#94a3b8", fontSize: 14, lineHeight: 1.6 }}>
                Model what happens when <strong style={{ color: "#e5e7eb" }}>{targetCompany}</strong> acquires
                a competitor. AI-driven strategic models will simulate competitor responses across multiple phases.
              </p>
            </div>

            <div style={{ padding: "20px 32px", borderBottom: "1px solid rgba(148,163,184,0.06)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Acquiring Entity</div>
              <input style={{ ...S.input, background: "rgba(59,130,246,0.06)", borderColor: "rgba(59,130,246,0.15)", marginBottom: 0 }} value={targetCompany} disabled />
            </div>

            <div style={{ padding: "20px 32px", borderBottom: "1px solid rgba(148,163,184,0.06)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Target Company</div>
              {competitors.length > 0 ? (
                <select style={S.input} value={acquisitionTarget} onChange={(e) => { setAcquisitionTarget(e.target.value); setCustomTarget(""); }}>
                  {competitors.map((c) => <option key={c} value={c}>{c}</option>)}
                  <option value="">Specify custom target...</option>
                </select>
              ) : (
                <input style={S.input} value={customTarget} onChange={(e) => setCustomTarget(e.target.value)} placeholder="e.g. Perplexity AI" />
              )}
              {!acquisitionTarget && competitors.length > 0 && (
                <input style={{ ...S.input, marginTop: 0 }} value={customTarget} onChange={(e) => setCustomTarget(e.target.value)} placeholder="Enter company name..." />
              )}
            </div>

            <div style={{ padding: "20px 32px", borderBottom: "1px solid rgba(148,163,184,0.06)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Analysis Depth</div>
              <div style={{ display: "flex", gap: 8 }}>
                {([
                  { n: 3, label: "Express", desc: "Quick read" },
                  { n: 5, label: "Standard", desc: "Recommended" },
                  { n: 10, label: "Comprehensive", desc: "Deep dive" },
                ] as const).map(({ n, label, desc }) => (
                  <button key={n} onClick={() => setDepth(n)} style={{
                    flex: 1, padding: "10px 8px", borderRadius: 10, textAlign: "center",
                    border: depth === n ? "1.5px solid #f59e0b" : "1px solid rgba(148,163,184,0.1)",
                    background: depth === n ? "rgba(245,158,11,0.08)" : "transparent",
                    color: depth === n ? "#f59e0b" : "#64748b",
                    cursor: "pointer", transition: "all 0.2s",
                  }}>
                    <div style={{ fontSize: 16, fontWeight: 800 }}>{n}</div>
                    <div style={{ fontSize: 10, fontWeight: 600, marginTop: 2 }}>{label}</div>
                    <div style={{ fontSize: 9, color: "#475569", marginTop: 1 }}>{desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ padding: "20px 32px 24px" }}>
              <button onClick={handleStart} disabled={!(acquisitionTarget || customTarget).trim()} style={{
                width: "100%", padding: "14px 0", borderRadius: 10, border: "none",
                background: "#f59e0b", color: "#0b1120",
                fontSize: 15, fontWeight: 700, cursor: "pointer", transition: "all 0.2s",
              }}>
                Begin Scenario Analysis
              </button>
              <button onClick={onClose} style={{ width: "100%", padding: "10px 0", borderRadius: 8, border: "none", background: "transparent", color: "#64748b", fontSize: 13, cursor: "pointer", marginTop: 6 }}>
                Cancel
              </button>
              {error && <div style={{ marginTop: 10, padding: 12, borderRadius: 8, background: "rgba(239,68,68,0.08)", color: "#ef4444", fontSize: 13 }}>{error}</div>}
            </div>
          </div>
        )}

        {/* ── Processing (live streaming data) ──────── */}
        {loading && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>
            <AnalysisProgress agents={liveAgents} currentStage={liveStage} phase={pendingPhase} />
          </div>
        )}

        {/* ── Results dashboard — two-column ─────────── */}
        {state && !loading && (() => {
          const posVal = Math.round((score?.position ?? 0.5) * 100);
          const momVal = Math.round((score?.momentum ?? 0.5) * 100);
          const riskVal = Math.round((score?.risk ?? 0.5) * 100);
          const verdict = score ? verdictFromScores(posVal, riskVal, momVal) : null;
          const sortedReactions = [...reactions].sort((a, b) => (b.intensity ?? 0) - (a.intensity ?? 0));
          const briefSentences = (lastIteration?.referee_outcome ?? "").split(/(?<=[.!?])\s+/).filter(Boolean);
          const headline = briefSentences[0] ?? "";
          const keyPoints = briefSentences.slice(1, 4);
          const avgIntensity = reactions.length > 0 ? reactions.reduce((s, r) => s + (r.intensity ?? 0), 0) / reactions.length : 0;
          const pressurePct = Math.round(avgIntensity * 100);
          const pressureColor = pressurePct > 60 ? "#ef4444" : pressurePct > 35 ? "#f59e0b" : "#22c55e";
          const pressureLabel = pressurePct > 60 ? "HEAVY RESISTANCE" : pressurePct > 35 ? "MODERATE PUSHBACK" : "LIGHT OPPOSITION";
          const highCount = reactions.filter((r) => (r.intensity ?? 0) > 0.7).length;
          const medCount = reactions.filter((r) => { const v = r.intensity ?? 0; return v > 0.4 && v <= 0.7; }).length;
          const lowCount = reactions.filter((r) => (r.intensity ?? 0) <= 0.4).length;

          return (
          <div style={{ width: "100%", display: "flex", gap: 16, alignItems: "flex-start", paddingBottom: 32 }}>

            {/* Phase transition flash */}
            <div key={`flash-${lastIteration?.index}`} style={{
              position: "fixed", inset: 0, pointerEvents: "none", zIndex: 300,
              background: "radial-gradient(circle at 50% 30%, rgba(59,130,246,0.15), transparent 70%)",
              animation: "sim-flash 1.2s ease forwards",
            }} />

            {/* ═══════ LEFT COLUMN — summary + scores ═══════ */}
            <div style={{ width: 340, flexShrink: 0, display: "flex", flexDirection: "column", gap: 12, position: "sticky", top: 0 }}>

              {/* Executive Summary */}
              {lastIteration?.referee_outcome && (
                <div style={{ ...S.card, overflow: "visible", animation: "sim-card-enter 0.5s ease" }}>
                  <div style={{
                    padding: "26px 22px 18px",
                    background: "linear-gradient(135deg, rgba(59,130,246,0.06), rgba(168,85,247,0.03))",
                    borderBottom: "1px solid rgba(148,163,184,0.06)",
                    position: "relative",
                  }}>
                    <div style={{
                      position: "absolute", top: -12, left: 20,
                      background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                      color: "#fff", fontSize: 10, fontWeight: 800,
                      padding: "4px 12px", borderRadius: 6,
                      boxShadow: "0 4px 12px rgba(59,130,246,0.3)", letterSpacing: "0.06em",
                    }}>
                      PHASE {lastIteration.index ?? 1}
                    </div>
                    {verdict && (
                      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4, marginBottom: 10 }}>
                        <span style={{
                          fontSize: 9, fontWeight: 800, padding: "4px 10px", borderRadius: 5,
                          background: verdict.bg, color: verdict.color, border: `1px solid ${verdict.color}25`,
                        }}>{verdict.label}</span>
                      </div>
                    )}
                    <p style={{ margin: 0, fontSize: 14, color: "#f1f5f9", lineHeight: 1.6, fontWeight: 600 }}>{headline}</p>
                  </div>
                  {keyPoints.length > 0 && (
                    <div style={{ padding: "12px 22px 14px" }}>
                      {keyPoints.map((pt, i) => (
                        <div key={i} style={{
                          display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6,
                          animation: `sim-slide-in 0.4s ease ${(i + 1) * 150}ms both`,
                        }}>
                          <div style={{
                            width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                            background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.15)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 9, fontWeight: 800, color: "#3b82f6",
                          }}>{i + 1}</div>
                          <p style={{ margin: 0, fontSize: 12, color: "#cbd5e1", lineHeight: 1.55 }}>{pt}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Scorecard gauges — 2x2 grid */}
              {score && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <GaugeKPI label="Position" value={posVal} icon="📊" />
                  <GaugeKPI label="Momentum" value={momVal} icon="🚀" delta={score.delta ?? undefined} />
                  <GaugeKPI label="Risk" value={riskVal} icon="⚠️" invert />
                  <div style={{
                    padding: "14px 10px", background: "rgba(15,23,42,0.96)",
                    borderRadius: 14, border: "1px solid rgba(168,85,247,0.18)",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                    animation: "sim-card-enter 0.5s ease 0.3s both",
                  }}>
                    <div style={{ position: "relative", width: 64, height: 64 }}>
                      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontSize: 12, marginBottom: 1 }}>🏛</span>
                        <span style={{ fontSize: 20, fontWeight: 800, color: "#a855f7", lineHeight: 1 }}>{reactions.length}</span>
                      </div>
                      <svg width="64" height="64" viewBox="0 0 64 64" style={{ transform: "rotate(-90deg)" }}>
                        <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(148,163,184,0.06)" strokeWidth="3" />
                        {reactions.map((r, i) => {
                          const seg = (2 * Math.PI * 28) / Math.max(reactions.length, 1);
                          const c = (r.intensity ?? 0) > 0.7 ? "#ef4444" : (r.intensity ?? 0) > 0.4 ? "#f59e0b" : "#3b82f6";
                          return <circle key={i} cx="32" cy="32" r="28" fill="none" stroke={c} strokeWidth="3"
                            strokeDasharray={`${seg * 0.85} ${2 * Math.PI * 28 - seg * 0.85}`}
                            strokeDashoffset={-(i * seg)} strokeLinecap="round" style={{ opacity: 0.8 }} />;
                        })}
                      </svg>
                    </div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: highImpactCount > 0 ? "#ef4444" : "#22c55e", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      {highImpactCount > 0 ? `${highImpactCount} High` : "Manageable"}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8" }}>Responses</div>
                  </div>
                </div>
              )}

              {/* Pressure meter */}
              {reactions.length > 0 && (
                <div style={{ ...S.card, padding: "14px 18px", animation: "sim-card-enter 0.5s ease 0.2s both" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 16 }}>{pressurePct > 60 ? "🔥" : pressurePct > 35 ? "⚡" : "✓"}</span>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 800, color: pressureColor, textTransform: "uppercase", letterSpacing: "0.06em" }}>{pressureLabel}</div>
                        <div style={{ fontSize: 9, color: "#64748b" }}>Pressure index</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: pressureColor }}>{pressurePct}%</div>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: "rgba(148,163,184,0.06)", overflow: "hidden", display: "flex" }}>
                    {lowCount > 0 && <div style={{ height: "100%", width: `${(lowCount / reactions.length) * 100}%`, background: "#3b82f6", transition: "width 1s" }} />}
                    {medCount > 0 && <div style={{ height: "100%", width: `${(medCount / reactions.length) * 100}%`, background: "#f59e0b", transition: "width 1s" }} />}
                    {highCount > 0 && <div style={{ height: "100%", width: `${(highCount / reactions.length) * 100}%`, background: "#ef4444", transition: "width 1s" }} />}
                  </div>
                  <div style={{ display: "flex", gap: 10, marginTop: 8, justifyContent: "center" }}>
                    {[
                      { l: "Low", n: lowCount, c: "#3b82f6" },
                      { l: "Med", n: medCount, c: "#f59e0b" },
                      { l: "High", n: highCount, c: "#ef4444" },
                    ].filter(({ n }) => n > 0).map(({ l, n, c }) => (
                      <div key={l} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: c }} />
                        <span style={{ fontSize: 10, fontWeight: 700, color: c }}>{n}</span>
                        <span style={{ fontSize: 9, color: "#64748b" }}>{l}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Final recommendation (left column) */}
              {isComplete && state?.final_recommendation && (
                <div style={{ ...S.card, border: "1px solid rgba(34,197,94,0.25)", background: "linear-gradient(135deg, rgba(15,23,42,0.98), rgba(34,197,94,0.03))" }}>
                  <div style={{ padding: "18px 22px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <span style={{ fontSize: 20 }}>✅</span>
                      <div style={{ fontSize: 9, fontWeight: 700, color: "#22c55e", textTransform: "uppercase", letterSpacing: "0.08em" }}>Final Recommendation</div>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: "#e2e8f0", lineHeight: 1.7 }}>{state.final_recommendation}</p>
                  </div>
                </div>
              )}
              {isComplete && (
                <button onClick={onClose} style={{
                  width: "100%", padding: "12px 0", borderRadius: 10,
                  border: "1px solid rgba(59,130,246,0.25)", background: "rgba(59,130,246,0.08)",
                  color: "#60a5fa", fontSize: 13, fontWeight: 700, cursor: "pointer",
                }}>
                  Return to Intelligence
                </button>
              )}
            </div>

            {/* ═══════ RIGHT COLUMN — tabs + decisions ═══════ */}
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>

              {/* Tabs */}
              <div style={{ display: "flex", gap: 2, background: "rgba(15,23,42,0.7)", borderRadius: 12, padding: 4 }}>
                <TabBtn icon="⚔" label="Responses" count={reactions.length} active={tab === "responses"} onClick={() => { setTab("responses"); setExpandedReaction(null); }} />
                <TabBtn icon="📡" label="Intelligence" count={evidence.length} active={tab === "intelligence"} onClick={() => setTab("intelligence")} />
                <TabBtn icon="🏢" label="Participants" count={personas.length} active={tab === "participants"} onClick={() => setTab("participants")} />
              </div>

              {/* Tab content */}
              <div style={{ ...S.card, flex: 1 }}>
                {tab === "responses" && (
                  <div style={{ padding: "8px 18px" }}>
                    {sortedReactions.length === 0 ? (
                      <div style={{ padding: "40px 0", textAlign: "center", color: "#64748b", fontSize: 13 }}>No strategic responses recorded yet.</div>
                    ) : (
                      <>
                        <div style={{ display: "grid", gridTemplateColumns: "28px 1fr 120px 60px 20px", padding: "12px 14px 6px", gap: 12 }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: "#334155", textTransform: "uppercase" }}>#</div>
                          <div style={{ fontSize: 9, fontWeight: 700, color: "#334155", textTransform: "uppercase" }}>Competitor</div>
                          <div style={{ fontSize: 9, fontWeight: 700, color: "#334155", textTransform: "uppercase" }}>Impact</div>
                          <div style={{ fontSize: 9, fontWeight: 700, color: "#334155", textTransform: "uppercase" }}>Level</div>
                          <div />
                        </div>
                        {sortedReactions.map((r, i) => (
                          <CompetitiveResponseRow key={i} r={r} rank={i + 1} expanded={expandedReaction === i} onToggle={() => setExpandedReaction(expandedReaction === i ? null : i)} delay={i * 100} />
                        ))}
                      </>
                    )}
                  </div>
                )}

                {tab === "intelligence" && (
                  <div style={{ padding: "20px 24px" }}>
                    {evidence.length === 0 ? (
                      <div style={{ padding: "40px 0", textAlign: "center", color: "#64748b", fontSize: 13 }}>No market intelligence signals available.</div>
                    ) : (
                      <>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>
                          Real-Time Market Signals
                        </div>
                        {evidence.map((ev, i) => (
                          <div key={i} style={{ padding: "12px 14px", marginBottom: 6, borderRadius: 8, background: "rgba(148,163,184,0.02)", border: "1px solid rgba(148,163,184,0.05)" }}>
                            <a href={ev.source_url || undefined} target="_blank" rel="noreferrer" style={{ color: "#e2e8f0", textDecoration: "none", fontSize: 13, lineHeight: 1.5, display: "block", fontWeight: 600 }}>
                              {ev.claim || ev.source_title}
                            </a>
                            {ev.source_url && (
                              <div style={{ fontSize: 10, color: "#3b82f6", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                                <span style={{ background: "rgba(59,130,246,0.08)", padding: "1px 6px", borderRadius: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {ev.source_title ?? (() => { try { return new URL(ev.source_url!).hostname; } catch { return ev.source_url; } })()}
                                </span>
                                <span>↗</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </>
                    )}
                    {lastIteration?.grounding?.summary && (
                      <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 8, background: "rgba(59,130,246,0.04)", border: "1px solid rgba(59,130,246,0.08)" }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: "#3b82f6", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Summary</div>
                        <div style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.6 }}>{lastIteration.grounding.summary}</div>
                      </div>
                    )}
                  </div>
                )}

                {tab === "participants" && (
                  <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Market Participants</div>
                    {personas.map((p, i) => {
                      const threat = board?.companies?.find((c) => c.name === p.name)?.threat;
                      const reaction = reactions.find((r) => r.actor === p.name);
                      return <ParticipantCard key={i} p={p} threat={threat} reaction={reaction} />;
                    })}
                  </div>
                )}
              </div>

              {/* Decision panel */}
              {isAwaitingChoice && lastIteration?.decision_point && (() => {
                const dp = lastIteration.decision_point;
                const phaseNum = (dp.iteration_index ?? 0) + 1;
                const options = dp.options ?? [];
                const allowFree = dp.allow_free_text !== false;
                return (
                <div style={{
                  ...S.card, border: "2px solid rgba(245,158,11,0.4)",
                  background: "linear-gradient(135deg, rgba(15,23,42,0.98), rgba(245,158,11,0.04))",
                  boxShadow: "0 0 30px rgba(245,158,11,0.08), 0 8px 32px rgba(0,0,0,0.35)",
                  animation: "sim-glow-amber 3s infinite",
                }}>
                  <div style={{
                    padding: "14px 22px", display: "flex", alignItems: "center", gap: 12,
                    background: "linear-gradient(90deg, rgba(245,158,11,0.12), rgba(245,158,11,0.04))",
                    borderBottom: "1px solid rgba(245,158,11,0.15)",
                  }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0, boxShadow: "0 4px 16px rgba(245,158,11,0.3)" }}>⚡</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "#f59e0b" }}>Your Decision is Required</div>
                      <div style={{ fontSize: 12, color: "#94a3b8" }}>Phase {phaseNum} — Select a strategy</div>
                    </div>
                    <div style={{ fontSize: 9, fontWeight: 800, color: "#f59e0b", background: "rgba(245,158,11,0.15)", padding: "5px 12px", borderRadius: 5, letterSpacing: "0.08em", textTransform: "uppercase", animation: "pulse-glow 2s infinite", flexShrink: 0 }}>ACTION NEEDED</div>
                  </div>

                  <div style={{ padding: "18px 22px" }}>
                    {dp.situation_summary && (
                      <p style={{ margin: "0 0 16px", fontSize: 13, color: "#cbd5e1", lineHeight: 1.65, padding: "10px 14px", borderRadius: 8, background: "rgba(148,163,184,0.03)", borderLeft: "3px solid rgba(245,158,11,0.3)" }}>
                        {dp.situation_summary}
                      </p>
                    )}
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {options.map((opt: DecisionOption, idx: number) => {
                        const isRec = opt.id === dp.recommended_option_id;
                        return (
                          <button key={opt.id} className="sim-option-card" onClick={() => { setFreeTextAction(""); handleChoose(opt.id); }} disabled={loading} style={{
                            padding: "16px 18px", borderRadius: 12, textAlign: "left",
                            cursor: loading ? "wait" : "pointer",
                            transition: "all 0.25s ease", position: "relative", overflow: "hidden",
                            border: isRec ? "2px solid rgba(245,158,11,0.45)" : "1.5px solid rgba(148,163,184,0.1)",
                            background: isRec ? "linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.02))" : "linear-gradient(135deg, rgba(148,163,184,0.03), rgba(148,163,184,0.01))",
                            animation: `sim-card-enter 0.4s ease ${idx * 120}ms both`,
                          }}>
                            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: isRec ? "#f59e0b" : "rgba(59,130,246,0.3)", borderRadius: "12px 0 0 12px" }} />
                            {isRec && (
                              <div style={{ position: "absolute", top: 8, right: 10, fontSize: 8, fontWeight: 800, color: "#0b1120", background: "linear-gradient(90deg, #f59e0b, #fbbf24)", padding: "3px 10px", borderRadius: 5, letterSpacing: "0.06em" }}>RECOMMENDED</div>
                            )}
                            <div style={{ paddingLeft: 8 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, paddingRight: isRec ? 90 : 0 }}>
                                <span style={{ fontSize: 14 }}>{isRec ? "★" : "◆"}</span>
                                <span style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>{opt.label}</span>
                              </div>
                              {opt.expected_effect && <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>{opt.expected_effect}</div>}
                              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                                {opt.risk && <span style={{ fontSize: 9, fontWeight: 700, color: "#ef4444", background: "rgba(239,68,68,0.08)", padding: "3px 8px", borderRadius: 4, border: "1px solid rgba(239,68,68,0.12)" }}>⚠ {opt.risk}</span>}
                                <span style={{ fontSize: 9, fontWeight: 700, color: isRec ? "#f59e0b" : "#3b82f6", background: isRec ? "rgba(245,158,11,0.08)" : "rgba(59,130,246,0.08)", padding: "3px 8px", borderRadius: 4 }}>→ Select</span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {allowFree && (
                      <div style={{ marginTop: 14 }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ flex: 1, height: 1, background: "rgba(148,163,184,0.1)" }} />
                          Or define your own
                          <span style={{ flex: 1, height: 1, background: "rgba(148,163,184,0.1)" }} />
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <input style={{ ...S.input, flex: 1, margin: 0, padding: "10px 14px", border: freeTextAction.trim() ? "1.5px solid rgba(59,130,246,0.3)" : "1px solid rgba(148,163,184,0.12)" }}
                            placeholder="e.g. Launch a joint venture..."
                            value={freeTextAction} onChange={(e) => setFreeTextAction(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter" && freeTextAction.trim()) handleChoose(freeTextAction.trim()); }}
                          />
                          <button onClick={() => { if (freeTextAction.trim()) handleChoose(freeTextAction.trim()); }} disabled={!freeTextAction.trim() || loading} style={{
                            padding: "10px 16px", borderRadius: 8, border: "none",
                            background: freeTextAction.trim() ? "#3b82f6" : "rgba(148,163,184,0.08)",
                            color: freeTextAction.trim() ? "#fff" : "#475569",
                            fontSize: 12, fontWeight: 700, cursor: freeTextAction.trim() ? "pointer" : "default",
                          }}>Submit →</button>
                        </div>
                      </div>
                    )}

                    {dp.recommendation_rationale && (
                      <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.1)" }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", marginBottom: 4 }}>Analyst Rationale</div>
                        <div style={{ fontSize: 12, color: "#fbbf24", lineHeight: 1.55 }}>{dp.recommendation_rationale}</div>
                      </div>
                    )}
                  </div>
                </div>
                );
              })()}

              {error && <div style={{ padding: 12, borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", color: "#ef4444", fontSize: 12 }}>{error}</div>}
            </div>
          </div>
          );
        })()}
      </div>
    </div>
  );
}
