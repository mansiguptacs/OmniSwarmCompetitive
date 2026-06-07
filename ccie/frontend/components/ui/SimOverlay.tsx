"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SimulationState, DecisionOption, CompanyPersona, AgentReaction } from "@/types/simulation";
import { advanceSimulation, startSimulation } from "@/lib/simApi";
import { currentBoard } from "@/lib/simVisuals";

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
    padding: "14px 24px",
    background: "rgba(10,14,23,0.95)",
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

/* ── Processing indicator ────────────────────────────────────── */

const ANALYSIS_STAGES = [
  { label: "Gathering market intelligence", icon: "📊", color: "#3b82f6", duration: 4000 },
  { label: "Sourcing real-time financial signals", icon: "📈", color: "#22d3ee", duration: 3000 },
  { label: "Modeling competitor strategic responses", icon: "🏛", color: "#a855f7", duration: 5000 },
  { label: "Mapping potential alliances and coalitions", icon: "🤝", color: "#f59e0b", duration: 4000 },
  { label: "Analyzing second-order market effects", icon: "⚡", color: "#ef4444", duration: 4000 },
  { label: "Synthesizing market impact assessment", icon: "⚖", color: "#22c55e", duration: 4000 },
  { label: "Scoring position, momentum, and risk", icon: "📐", color: "#3b82f6", duration: 3000 },
  { label: "Generating strategic options", icon: "🎯", color: "#f59e0b", duration: 3000 },
];

function AnalysisProgress({ personas, phase }: { personas: CompanyPersona[]; phase: number }) {
  const [stageIdx, setStageIdx] = useState(0);
  const [activeAgent, setActiveAgent] = useState(0);

  useEffect(() => { setStageIdx(0); setActiveAgent(0); }, [phase]);

  useEffect(() => {
    const stage = ANALYSIS_STAGES[stageIdx];
    if (!stage) return;
    const t = setTimeout(() => {
      if (stageIdx < ANALYSIS_STAGES.length - 1) setStageIdx((i) => i + 1);
    }, stage.duration);
    return () => clearTimeout(t);
  }, [stageIdx]);

  useEffect(() => {
    if (!personas.length) return;
    const iv = setInterval(() => setActiveAgent((i) => (i + 1) % personas.length), 2500);
    return () => clearInterval(iv);
  }, [personas.length]);

  const stage = ANALYSIS_STAGES[Math.min(stageIdx, ANALYSIS_STAGES.length - 1)];

  return (
    <div style={{ ...S.card, width: 440, maxHeight: "80vh", overflow: "auto" }}>
      {/* Header */}
      <div style={{ padding: "24px 28px 18px", borderBottom: "1px solid rgba(148,163,184,0.06)" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#3b82f6", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
          Analyzing Phase {phase}
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#e2e8f0", display: "flex", alignItems: "center", gap: 10 }} key={stageIdx}>
          <span style={{ fontSize: 22 }}>{stage.icon}</span>
          <span style={{ animation: "fadeInUp 0.3s ease" }}>{stage.label}</span>
        </div>
        <div style={{ display: "flex", gap: 3, marginTop: 16 }}>
          {ANALYSIS_STAGES.map((s, i) => (
            <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= stageIdx ? s.color : "rgba(148,163,184,0.08)", transition: "background 0.4s" }} />
          ))}
        </div>
      </div>

      {/* Competitor strategy modeling */}
      <div style={{ padding: "18px 28px" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
          Competitor Strategy Modeling
        </div>
        {personas.map((p, i) => {
          const isActive = i === activeAgent && stageIdx >= 2;
          const isDone = stageIdx >= 5;
          return (
            <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, background: isActive ? "rgba(148,163,184,0.05)" : "transparent", transition: "all 0.3s", marginBottom: 4 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, fontWeight: 800,
                color: isDone ? "#0b1120" : isActive ? "#e2e8f0" : "#64748b",
                background: isDone ? "#22c55e" : isActive ? "rgba(59,130,246,0.15)" : "rgba(148,163,184,0.06)",
                border: isActive && !isDone ? "1.5px solid #3b82f6" : "1px solid rgba(148,163,184,0.06)",
                animation: isActive && !isDone ? "pulse-glow 2s infinite" : undefined,
                transition: "all 0.3s",
              }}>
                {isDone ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                ) : p.name.charAt(0)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: isActive || isDone ? "#e2e8f0" : "#64748b" }}>{p.name}</div>
                <div style={{ fontSize: 11, color: "#475569" }}>
                  {TEMPERAMENT_LABELS[p.temperament ?? ""] ?? "Strategic Analyst"}
                  {" · "}
                  {isDone ? "Analysis complete" : isActive ? "Evaluating strategic implications..." : "Queued"}
                </div>
              </div>
              {isActive && !isDone && <div style={{ width: 7, height: 7, borderRadius: 999, background: "#3b82f6", animation: "pulse-glow 1.5s infinite" }} />}
            </div>
          );
        })}
      </div>

      {/* Pipeline status */}
      <div style={{ padding: "14px 28px 22px", borderTop: "1px solid rgba(148,163,184,0.04)" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Analysis Pipeline</div>
        {[
          stageIdx >= 1 && "Scanning press releases and regulatory filings...",
          stageIdx >= 2 && personas[activeAgent] && `${personas[activeAgent].name} leadership modeling strategic response...`,
          stageIdx >= 4 && "Cross-referencing potential coalition dynamics...",
          stageIdx >= 5 && "Synthesizing market impact assessment...",
          stageIdx >= 6 && "Computing position, momentum, and risk metrics...",
        ].filter(Boolean).slice(-3).map((msg, i) => (
          <div key={`${stageIdx}-${i}`} style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6, marginBottom: 3, animation: "fadeInUp 0.3s ease", opacity: i === 0 ? 0.5 : i === 1 ? 0.7 : 1 }}>
            <span style={{ color: "#3b82f6", marginRight: 6, fontSize: 8, verticalAlign: "middle" }}>●</span>{msg}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── KPI Card ────────────────────────────────────────────────── */

function KPICard({ label, value, subtext, color }: { label: string; value: string | number; subtext?: string; color: string }) {
  return (
    <div style={{ flex: 1, padding: "18px 16px", background: `${color}06`, borderRadius: 12, border: `1px solid ${color}15`, textAlign: "center" }}>
      <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", marginTop: 6 }}>{label}</div>
      {subtext && <div style={{ fontSize: 10, color: "#475569", marginTop: 3 }}>{subtext}</div>}
    </div>
  );
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

/* ── Reaction summary row ────────────────────────────────────── */

function ResponseRow({ r, expanded, onToggle }: { r: AgentReaction; expanded: boolean; onToggle: () => void }) {
  const impact = r.intensity ?? 0.5;
  const color = impact > 0.7 ? "#ef4444" : impact > 0.4 ? "#f59e0b" : "#3b82f6";
  const impactLabel = impact > 0.7 ? "High Impact" : impact > 0.4 ? "Moderate" : "Low Impact";

  return (
    <div style={{ borderBottom: "1px solid rgba(148,163,184,0.04)" }}>
      <button onClick={onToggle} style={{
        width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 0",
        background: "transparent", border: "none", cursor: "pointer", textAlign: "left",
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, fontWeight: 800, color, background: `${color}10`, border: `1px solid ${color}20`,
        }}>
          {r.actor.charAt(0)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>{r.actor}</div>
          <div style={{ fontSize: 12, color: "#94a3b8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {r.action?.substring(0, 80) ?? r.intent ?? "Strategic response pending"}
            {(r.action?.length ?? 0) > 80 ? "..." : ""}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color }}>{impactLabel}</div>
          <div style={{ fontSize: 10, color: "#475569" }}>{Math.round(impact * 100)}% severity</div>
        </div>
        <span style={{ color: "#475569", fontSize: 12, marginLeft: 4, transition: "transform 0.2s", transform: expanded ? "rotate(180deg)" : "rotate(0)" }}>▾</span>
      </button>
      {expanded && (
        <div style={{ padding: "0 0 16px 48px", animation: "fadeInUp 0.2s ease" }}>
          {r.action && <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6, marginBottom: 8 }}>{r.action}</div>}
          {r.rationale && <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5, fontStyle: "italic", padding: "8px 12px", background: "rgba(148,163,184,0.03)", borderRadius: 8, borderLeft: `3px solid ${color}` }}>{r.rationale}</div>}
          {r.ally_with && r.ally_with.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 11, color: "#94a3b8" }}>
              Potential alliance: <strong style={{ color: "#e2e8f0" }}>{r.ally_with.join(", ")}</strong>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Tab button ──────────────────────────────────────────────── */

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer",
      fontSize: 12, fontWeight: 700, transition: "all 0.2s",
      background: active ? "rgba(59,130,246,0.12)" : "transparent",
      color: active ? "#60a5fa" : "#64748b",
    }}>
      {label}
    </button>
  );
}

/* ── Main Component ──────────────────────────────────────────── */

interface SimOverlayProps {
  targetCompany: string;
  competitors: string[];
  onClose: () => void;
}

export function SimOverlay({ targetCompany, competitors, onClose }: SimOverlayProps) {
  const [state, setState] = useState<SimulationState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingPhase, setPendingPhase] = useState(0);
  const [tab, setTab] = useState<"brief" | "responses" | "intelligence">("brief");
  const [expandedReaction, setExpandedReaction] = useState<number | null>(null);

  const [acquisitionTarget, setAcquisitionTarget] = useState(competitors[0] ?? "");
  const [customTarget, setCustomTarget] = useState("");
  const [depth, setDepth] = useState(5);
  const [pendingPersonas, setPendingPersonas] = useState<CompanyPersona[]>([]);

  const setupMode = !state && !loading;
  const board = useMemo(() => currentBoard(state), [state]);
  const lastIteration = state?.iterations?.[state.iterations.length - 1] ?? null;
  const isAwaitingChoice = state?.status === "awaiting_choice";
  const isComplete = state?.status === "complete";
  const personas = state?.personas ?? pendingPersonas;

  useEffect(() => { setTab("brief"); setExpandedReaction(null); }, [state?.current_index]);

  const handleStart = useCallback(async () => {
    const target = (acquisitionTarget || customTarget).trim();
    if (!target) return;
    setLoading(true);
    setError(null);
    setPendingPhase(1);
    setPendingPersonas(competitors.slice(0, 6).map((c) => ({ name: c })));
    try {
      const next = await startSimulation({ target, player: targetCompany, max_iterations: depth, max_incumbents: Math.min(competitors.length, 6) });
      setState(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to initiate analysis");
    } finally {
      setLoading(false);
      setPendingPhase(0);
    }
  }, [acquisitionTarget, customTarget, targetCompany, depth, competitors]);

  const handleChoose = useCallback(async (choice: string) => {
    if (!state?.session_id) return;
    setLoading(true);
    setError(null);
    setPendingPhase((state.current_index ?? 0) + 1);
    try {
      const next = await advanceSimulation(state.session_id, choice);
      setState(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to advance analysis");
    } finally {
      setLoading(false);
      setPendingPhase(0);
    }
  }, [state?.session_id, state?.current_index]);

  const score = lastIteration?.score;
  const reactions = lastIteration?.reactions ?? [];
  const evidence = lastIteration?.grounding?.evidence ?? [];

  const highImpactCount = reactions.filter((r) => (r.intensity ?? 0) > 0.6).length;
  const allianceCount = reactions.reduce((n, r) => n + (r.ally_with?.length ?? 0), 0);

  return (
    <div style={S.overlay}>
      {/* ── Top bar ──────────────────────────────────── */}
      <div style={S.topBar}>
        <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: 13, padding: 0 }}>
          ← Back to Intelligence
        </button>
        <span style={{ color: "#334155" }}>|</span>
        <span style={{ fontWeight: 700, fontSize: 15, color: "#e5e7eb", letterSpacing: "-0.01em" }}>M&A Scenario Analysis</span>
        {(state || loading) && <StatusBadge status={loading ? "running" : state?.status} />}
        {state && (
          <div style={{ marginLeft: "auto" }}>
            <PhaseProgress current={state.iterations?.length ?? 0} total={state.max_iterations ?? depth} />
          </div>
        )}
      </div>

      {/* ── Content ──────────────────────────────────── */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "24px 16px" }}>

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

        {/* ── Processing ─────────────────────────────── */}
        {loading && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>
            <AnalysisProgress personas={personas} phase={pendingPhase} />
          </div>
        )}

        {/* ── Results dashboard ──────────────────────── */}
        {state && !loading && (
          <div style={{ width: "100%", maxWidth: 720, overflowY: "auto", maxHeight: "calc(100vh - 100px)", display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Executive brief */}
            {lastIteration?.referee_outcome && (
              <div style={{ ...S.card, padding: "24px 28px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                    background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.15)",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
                  }}>
                    📋
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#3b82f6", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
                      Executive Brief — Phase {lastIteration.index ?? 1}
                    </div>
                    <p style={{ margin: 0, fontSize: 15, color: "#e2e8f0", lineHeight: 1.65, fontWeight: 500 }}>
                      {lastIteration.referee_outcome}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* KPI metrics */}
            {score && (
              <div style={{ display: "flex", gap: 12 }}>
                <KPICard label="Market Position" value={Math.round((score.position ?? 0.5) * 100)} color="#3b82f6" subtext="Index score" />
                <KPICard label="Deal Momentum" value={Math.round((score.momentum ?? 0.5) * 100)} color="#22c55e" subtext={score.delta != null ? `${score.delta > 0 ? "+" : ""}${score.delta.toFixed(1)} vs prior` : undefined} />
                <KPICard label="Execution Risk" value={Math.round((score.risk ?? 0.5) * 100)} color="#ef4444" subtext="Risk index" />
                <KPICard label="Responses" value={reactions.length} color="#a855f7" subtext={highImpactCount > 0 ? `${highImpactCount} high impact` : "All manageable"} />
              </div>
            )}

            {/* Tabs */}
            <div style={{ display: "flex", gap: 4, background: "rgba(15,23,42,0.6)", borderRadius: 10, padding: 4 }}>
              <TabBtn label={`Strategic Responses (${reactions.length})`} active={tab === "responses"} onClick={() => { setTab("responses"); setExpandedReaction(null); }} />
              <TabBtn label="Market Intelligence" active={tab === "intelligence"} onClick={() => setTab("intelligence")} />
              <TabBtn label="Participants" active={tab === "brief"} onClick={() => setTab("brief")} />
            </div>

            {/* Tab content */}
            <div style={S.card}>

              {tab === "responses" && (
                <div style={{ padding: "6px 24px" }}>
                  {reactions.length === 0 ? (
                    <div style={{ padding: "32px 0", textAlign: "center", color: "#64748b", fontSize: 13 }}>No strategic responses recorded yet.</div>
                  ) : reactions.map((r, i) => (
                    <ResponseRow key={i} r={r} expanded={expandedReaction === i} onToggle={() => setExpandedReaction(expandedReaction === i ? null : i)} />
                  ))}
                  {allianceCount > 0 && (
                    <div style={{ padding: "12px 0", fontSize: 12, color: "#f59e0b", fontWeight: 600, borderTop: "1px solid rgba(148,163,184,0.04)" }}>
                      ⚠ {allianceCount} potential counter-alliance{allianceCount > 1 ? "s" : ""} detected across responses
                    </div>
                  )}
                </div>
              )}

              {tab === "intelligence" && (
                <div style={{ padding: "20px 24px" }}>
                  {evidence.length === 0 ? (
                    <div style={{ padding: "32px 0", textAlign: "center", color: "#64748b", fontSize: 13 }}>No market intelligence signals available for this phase.</div>
                  ) : (
                    <>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
                        Real-Time Market Signals ({evidence.length})
                      </div>
                      {evidence.map((ev, i) => (
                        <div key={i} style={{ padding: "10px 0", borderBottom: i < evidence.length - 1 ? "1px solid rgba(148,163,184,0.04)" : "none" }}>
                          <a href={ev.source_url || undefined} target="_blank" rel="noreferrer" style={{ color: "#e2e8f0", textDecoration: "none", fontSize: 13, lineHeight: 1.5, display: "block", fontWeight: 500 }}>
                            {ev.claim || ev.source_title}
                          </a>
                          {ev.source_url && (
                            <div style={{ fontSize: 11, color: "#3b82f6", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {ev.source_title ?? new URL(ev.source_url).hostname}
                              <span style={{ marginLeft: 4 }}>↗</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </>
                  )}
                  {lastIteration?.grounding?.summary && (
                    <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 8, background: "rgba(59,130,246,0.04)", border: "1px solid rgba(59,130,246,0.08)" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#3b82f6", textTransform: "uppercase", marginBottom: 6 }}>Intelligence Summary</div>
                      <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>{lastIteration.grounding.summary}</div>
                    </div>
                  )}
                </div>
              )}

              {tab === "brief" && (
                <div style={{ padding: "20px 24px" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Market Participants ({personas.length})</div>
                  {personas.map((p, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: i < personas.length - 1 ? "1px solid rgba(148,163,184,0.04)" : "none" }}>
                      <div style={{ width: 36, height: 36, borderRadius: 9, background: "rgba(148,163,184,0.06)", color: "#94a3b8", fontSize: 14, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {p.name.charAt(0)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>
                          {TEMPERAMENT_LABELS[p.temperament ?? ""] ?? "Strategic Analyst"}
                          {p.financial_firepower && <> · {p.financial_firepower}</>}
                        </div>
                      </div>
                      {board?.companies?.find((c) => c.name === p.name)?.threat != null && (
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: (board!.companies!.find((c) => c.name === p.name)!.threat ?? 0) > 0.6 ? "#ef4444" : "#f59e0b" }}>
                            {Math.round((board!.companies!.find((c) => c.name === p.name)!.threat ?? 0) * 100)}%
                          </div>
                          <div style={{ fontSize: 9, color: "#475569" }}>Threat Level</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Decision panel */}
            {isAwaitingChoice && lastIteration?.decision_point && (
              <div style={{ ...S.card, border: "1px solid rgba(245,158,11,0.2)" }}>
                <div style={{ padding: "24px 28px" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
                    Strategic Decision Point — Phase {(lastIteration.decision_point.iteration_index ?? 0) + 1}
                  </div>
                  {lastIteration.decision_point.situation_summary && (
                    <p style={{ margin: "0 0 20px", fontSize: 14, color: "#cbd5e1", lineHeight: 1.65 }}>
                      {lastIteration.decision_point.situation_summary}
                    </p>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {(lastIteration.decision_point.options ?? []).map((opt: DecisionOption) => {
                      const isRec = opt.id === lastIteration.decision_point?.recommended_option_id;
                      return (
                        <button key={opt.id} onClick={() => handleChoose(opt.id)} disabled={loading} style={{
                          padding: "16px 18px", borderRadius: 10, textAlign: "left", cursor: "pointer", transition: "all 0.2s",
                          border: isRec ? "1.5px solid rgba(245,158,11,0.35)" : "1px solid rgba(148,163,184,0.1)",
                          background: isRec ? "rgba(245,158,11,0.06)" : "rgba(148,163,184,0.02)",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                            <span style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>{opt.label}</span>
                            {isRec && (
                              <span style={{ fontSize: 9, fontWeight: 700, color: "#f59e0b", background: "rgba(245,158,11,0.1)", padding: "2px 8px", borderRadius: 4, letterSpacing: "0.05em" }}>
                                ANALYST RECOMMENDATION
                              </span>
                            )}
                          </div>
                          {opt.expected_effect && <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.5 }}>{opt.expected_effect}</div>}
                          {opt.risk && <div style={{ fontSize: 12, color: "#ef4444", marginTop: 6, fontWeight: 500 }}>Risk factor: {opt.risk}</div>}
                        </button>
                      );
                    })}
                  </div>
                  {lastIteration.decision_point.recommendation_rationale && (
                    <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 8, background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.08)", fontSize: 13, color: "#f59e0b", lineHeight: 1.55 }}>
                      <strong>Analyst rationale:</strong> {lastIteration.decision_point.recommendation_rationale}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Final recommendation */}
            {isComplete && state?.final_recommendation && (
              <div style={{ ...S.card, border: "1px solid rgba(34,197,94,0.2)" }}>
                <div style={{ padding: "24px 28px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 9, background: "rgba(34,197,94,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>✅</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#22c55e", textTransform: "uppercase", letterSpacing: "0.1em" }}>Final Strategic Recommendation</div>
                  </div>
                  <p style={{ margin: 0, fontSize: 15, color: "#e2e8f0", lineHeight: 1.7, fontWeight: 500 }}>
                    {state.final_recommendation}
                  </p>
                </div>
              </div>
            )}

            {isComplete && (
              <button onClick={onClose} style={{
                width: "100%", padding: "14px 0", borderRadius: 10,
                border: "1px solid rgba(59,130,246,0.25)", background: "rgba(59,130,246,0.08)",
                color: "#60a5fa", fontSize: 14, fontWeight: 700, cursor: "pointer",
              }}>
                Return to Competitive Intelligence
              </button>
            )}

            {error && <div style={{ padding: 12, borderRadius: 8, background: "rgba(239,68,68,0.08)", color: "#ef4444", fontSize: 13 }}>{error}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
