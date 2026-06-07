"use client";

import { useEffect, useState } from "react";
import type { EvalsReport, ReplayBundle, ReplayReaction, ReplayTurn } from "@/types/simulation";
import { getEvals, getReplay } from "@/lib/simApi";

function QualityBar({ label, value, threshold }: { label: string; value: number; threshold?: number }) {
  const pct = Math.round((value ?? 0) * 100);
  const ok = threshold == null || value >= threshold;
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8" }}>
        <span>{label}</span>
        <span style={{ color: ok ? "#22c55e" : "#f59e0b" }}>{pct}%</span>
      </div>
      <div style={{ height: 5, background: "rgba(148,163,184,0.18)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: ok ? "#22c55e" : "#f59e0b" }} />
      </div>
    </div>
  );
}

function QualityPanel({ report }: { report: EvalsReport }) {
  const a = report.aggregate;
  const t = report.thresholds || {};
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "12px 14px",
        marginBottom: 18,
        background: "rgba(2,6,23,0.4)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#e5e7eb" }}>Run quality (real-data evals)</div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: 999,
            background: report.passed ? "rgba(34,197,94,0.15)" : "rgba(245,158,11,0.15)",
            color: report.passed ? "#22c55e" : "#f59e0b",
          }}
        >
          {report.passed ? "✓ passes thresholds" : "⚠ below threshold"}
        </span>
      </div>
      <QualityBar label="Grounding coverage" value={a.grounding_coverage} threshold={t.grounding_coverage} />
      <QualityBar label="Persona consistency" value={a.persona_consistency} threshold={t.persona_consistency} />
      <QualityBar label="Plausibility" value={a.plausibility} threshold={t.plausibility} />
      <QualityBar label="Composite" value={a.composite} threshold={t.composite} />
      {report.flag_count > 0 && (
        <details style={{ marginTop: 6 }}>
          <summary style={{ fontSize: 11, color: "#f59e0b", cursor: "pointer" }}>
            {report.flag_count} quality flag{report.flag_count === 1 ? "" : "s"}
          </summary>
          <ul style={{ margin: "6px 0 0", paddingLeft: 16, fontSize: 11, color: "#94a3b8" }}>
            {report.flags.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function ScoreChip({ composite, delta }: { composite?: number; delta?: number }) {
  if (composite == null) return null;
  const d = delta ?? 0;
  const color = d > 0.001 ? "#22c55e" : d < -0.001 ? "#ef4444" : "#9ca3af";
  return (
    <span style={{ fontSize: 12, color: "#cbd5e1" }}>
      score <strong style={{ color: "#e5e7eb" }}>{Math.round(composite * 100)}</strong>{" "}
      <span style={{ color }}>
        ({d > 0 ? "+" : ""}
        {d.toFixed(2)})
      </span>
    </span>
  );
}

function WeaveLink({ url }: { url?: string }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      style={{ fontSize: 11, color: "#f59e0b", textDecoration: "none" }}
      title="Open the full reasoning trace in W&B Weave"
    >
      🍩 Weave trace ↗
    </a>
  );
}

function ThoughtCard({ r }: { r: ReplayReaction }) {
  const [open, setOpen] = useState(false);
  const src = (r.evidence ?? []).filter((e) => e.source_url);
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "10px 12px",
        background: "rgba(2,6,23,0.45)",
      }}
    >
      <div
        onClick={() => setOpen((v) => !v)}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
      >
        <strong style={{ fontSize: 13 }}>{r.actor}</strong>
        <span style={{ fontSize: 11, color: "#9ca3af" }}>
          intensity {Math.round((r.intensity ?? 0) * 100)}% {open ? "▴" : "▾"}
        </span>
      </div>
      <div style={{ fontSize: 12.5, color: "#e5e7eb", marginTop: 4 }}>{r.action}</div>
      {r.ally_with && r.ally_with.length > 0 && (
        <div style={{ fontSize: 11.5, color: "#a78bfa", marginTop: 3 }}>🤝 {r.ally_with.join(", ")}</div>
      )}
      {open && (
        <div style={{ marginTop: 8, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
          {r.intent && (
            <div style={{ fontSize: 11.5, color: "#9ca3af", marginBottom: 4 }}>
              <span style={{ color: "#64748b" }}>Intent:</span> {r.intent}
            </div>
          )}
          {r.rationale && (
            <div style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.5 }}>{r.rationale}</div>
          )}
          {src.length > 0 && (
            <div style={{ marginTop: 6 }}>
              {src.slice(0, 3).map((e, i) => (
                <a
                  key={i}
                  href={e.source_url}
                  target="_blank"
                  rel="noreferrer"
                  title={e.claim}
                  style={{ display: "block", fontSize: 11, color: "#22d3ee", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  ↳ {e.source_title || e.claim}
                </a>
              ))}
            </div>
          )}
          <div style={{ marginTop: 6 }}>
            <WeaveLink url={r.weave_url} />
          </div>
        </div>
      )}
    </div>
  );
}

function TurnBlock({ turn }: { turn: ReplayTurn }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: "#3b82f6",
            color: "#06121f",
            display: "grid",
            placeItems: "center",
            fontWeight: 800,
            fontSize: 13,
          }}
        >
          {turn.index}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>{turn.move || "—"}</div>
          <ScoreChip composite={turn.score?.composite} delta={turn.score?.delta} />
        </div>
      </div>

      {turn.referee_outcome && (
        <div
          style={{
            fontSize: 12.5,
            color: "#cbd5e1",
            lineHeight: 1.5,
            background: "rgba(168,139,250,0.08)",
            border: "1px solid rgba(168,139,250,0.25)",
            borderRadius: 10,
            padding: "8px 10px",
            marginBottom: 10,
          }}
        >
          <span style={{ color: "#a78bfa", fontWeight: 700 }}>⚖ Referee: </span>
          {turn.referee_outcome} <WeaveLink url={turn.weave_url} />
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {(turn.reactions ?? []).map((r, i) => (
          <ThoughtCard key={i} r={r} />
        ))}
      </div>
    </div>
  );
}

export function ReplayModal({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const [bundle, setBundle] = useState<ReplayBundle | null>(null);
  const [evals, setEvals] = useState<EvalsReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const b = await getReplay(sessionId);
        if (!cancelled) setBundle(b);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load replay");
      }
      try {
        const ev = await getEvals(sessionId);
        if (!cancelled) setEvals(ev);
      } catch {
        // Evals are best-effort; the replay still renders without them.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(2,6,12,0.78)",
        backdropFilter: "blur(4px)",
        zIndex: 1000,
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass"
        style={{ width: "min(880px, 94vw)", maxHeight: "90vh", overflowY: "auto", padding: 22 }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20 }}>Reasoning Replay</h2>
            <p style={{ margin: "4px 0 0", color: "#9ca3af", fontSize: 13 }}>
              {bundle?.player?.company || "You"} acquiring {bundle?.target?.name || "the target"} —
              every agent&apos;s chain of thought, turn by turn.
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: 20 }}>✕</button>
        </div>

        {error && <div style={{ color: "#ef4444", fontSize: 13 }}>{error}</div>}
        {!bundle && !error && <div style={{ color: "#64748b", fontSize: 14 }}>Loading the audit trail…</div>}

        {bundle && (
          <>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16, fontSize: 11 }}>
              <span className="label-chip">{bundle.turns?.length ?? 0} turns</span>
              <span className="label-chip">source: {bundle.ledger_source === "redis" ? "Redis ledger" : "state"}</span>
              <span className="label-chip">{bundle.ledger?.length ?? 0} ledger entries</span>
              {bundle.parent_session_id && (
                <span className="label-chip">⑂ branch from #{bundle.branched_from_index}</span>
              )}
            </div>

            {evals && <QualityPanel report={evals} />}

            {bundle.final_recommendation && (
              <div
                style={{
                  border: "1px solid rgba(34,211,238,0.35)",
                  background: "rgba(34,211,238,0.07)",
                  borderRadius: 12,
                  padding: "12px 14px",
                  marginBottom: 20,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: "#22d3ee", marginBottom: 4 }}>★ Strategy recommendation</div>
                <div style={{ fontSize: 13, color: "#e5e7eb", lineHeight: 1.55 }}>{bundle.final_recommendation}</div>
              </div>
            )}

            {(bundle.turns ?? []).map((t) => (
              <TurnBlock key={t.index} turn={t} />
            ))}

            <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
              Structured decisions come from the agents&apos; Redis ledger; 🍩 Weave links open the full reasoning trace (when tracing is enabled).
            </div>
          </>
        )}
      </div>
    </div>
  );
}
