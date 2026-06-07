"use client";

import { useState } from "react";
import type {
  AgentReaction,
  BoardState,
  CompanyPersona,
  GroundingPacket,
  IterationScore,
  SimulationIteration,
  SimulationState,
} from "@/types/simulation";

const card: React.CSSProperties = { padding: 16, pointerEvents: "auto" };

function Meter({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#9ca3af" }}>
        <span>{label}</span>
        <span style={{ color: "#e5e7eb" }}>{pct}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: "rgba(148,163,184,0.18)", marginTop: 4 }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: color }} />
      </div>
    </div>
  );
}

export function SetupForm({
  onStart,
  loading,
}: {
  onStart: (target: string, player: string, maxIterations: number) => void;
  loading: boolean;
}) {
  const [player, setPlayer] = useState("Microsoft");
  const [target, setTarget] = useState("Perplexity AI");
  const [iterations, setIterations] = useState(10);

  const input: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    marginTop: 6,
    marginBottom: 14,
    background: "rgba(2,6,23,0.6)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    color: "var(--text)",
    fontSize: 14,
  };

  return (
    <div className="glass" style={{ ...card, width: 380 }}>
      <h2 style={{ margin: "0 0 4px", fontSize: 20 }}>Acquisition War-Game</h2>
      <p style={{ margin: "0 0 16px", color: "#9ca3af", fontSize: 13 }}>
        Test an acquisition against autonomous big-tech CEO agents — on real data.
      </p>

      <label style={{ fontSize: 12, color: "#9ca3af" }}>Your company (acquirer)</label>
      <input style={input} value={player} onChange={(e) => setPlayer(e.target.value)} placeholder="e.g. Microsoft" />

      <label style={{ fontSize: 12, color: "#9ca3af" }}>Acquisition target (startup)</label>
      <input style={input} value={target} onChange={(e) => setTarget(e.target.value)} placeholder="e.g. Perplexity AI" />

      <label style={{ fontSize: 12, color: "#9ca3af" }}>Iterations</label>
      <select style={input} value={iterations} onChange={(e) => setIterations(Number(e.target.value))}>
        <option value={3}>3 (quick)</option>
        <option value={5}>5</option>
        <option value={10}>10 (full)</option>
      </select>

      <button
        onClick={() => onStart(target.trim(), player.trim(), iterations)}
        disabled={loading || !target.trim() || !player.trim()}
        style={{
          width: "100%",
          padding: "12px 16px",
          borderRadius: 10,
          border: "none",
          background: loading ? "#1e293b" : "#3b82f6",
          color: "#fff",
          fontWeight: 700,
          fontSize: 15,
          cursor: loading ? "default" : "pointer",
        }}
      >
        {loading ? "Building the board…" : "Start simulation"}
      </button>
    </div>
  );
}

export function Timeline({
  state,
  onBranchFrom,
}: {
  state: SimulationState;
  onBranchFrom?: (turn: number) => void;
}) {
  const max = state.max_iterations ?? 10;
  const current = state.current_index ?? 0;
  return (
    <div className="glass" style={{ padding: "10px 14px", pointerEvents: "auto", display: "flex", gap: 6, alignItems: "center" }}>
      <span style={{ fontSize: 12, color: "#9ca3af", marginRight: 6 }}>Turn</span>
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => {
        const branchable = onBranchFrom && n >= 1 && n < current;
        return (
          <div
            key={n}
            title={branchable ? `Branch from turn ${n} (try a different choice)` : `Turn ${n}`}
            onClick={branchable ? () => onBranchFrom!(n) : undefined}
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              display: "grid",
              placeItems: "center",
              fontSize: 11,
              fontWeight: 700,
              cursor: branchable ? "pointer" : "default",
              color: n <= current ? "#06121f" : "#64748b",
              background: n === current ? "#22d3ee" : n < current ? "#3b82f6" : "rgba(148,163,184,0.14)",
            }}
          >
            {n}
          </div>
        );
      })}
      <span style={{ fontSize: 12, color: "#9ca3af", marginLeft: 8 }}>
        {state.status === "complete" ? "complete" : `${current}/${max}`}
      </span>
      {state.parent_session_id && (
        <span style={{ fontSize: 11, color: "#a78bfa", marginLeft: 8 }}>
          ⑂ branch from #{state.branched_from_index}
        </span>
      )}
    </div>
  );
}

export function PlayerStatus({
  board,
  player,
  score,
}: {
  board: BoardState;
  player: string;
  score?: IterationScore | null;
}) {
  const p = board.player ?? {};
  const composite = score?.composite ?? 0;
  const delta = score?.delta ?? 0;
  const deltaColor = delta > 0.001 ? "#22c55e" : delta < -0.001 ? "#ef4444" : "#9ca3af";
  const deltaSign = delta > 0 ? "+" : "";
  return (
    <div className="glass" style={{ ...card, width: 240 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#f5c451" }}>{player} (you)</span>
        {score && (
          <span style={{ fontSize: 12, color: deltaColor }}>
            {deltaSign}
            {delta.toFixed(2)}
          </span>
        )}
      </div>
      {score && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#9ca3af" }}>
            <span>Strategic score</span>
            <span style={{ color: "#e5e7eb", fontWeight: 700 }}>{Math.round(composite * 100)}</span>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: "rgba(148,163,184,0.18)", marginTop: 4 }}>
            <div style={{ width: `${Math.round(composite * 100)}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#3b82f6,#22d3ee)" }} />
          </div>
        </div>
      )}
      <Meter label="Position" value={p.position ?? 0.5} color="#22c55e" />
      <Meter label="Momentum" value={((p.momentum ?? 0) + 1) / 2} color="#3b82f6" />
      <Meter label="Risk" value={p.risk ?? 0} color="#ef4444" />
    </div>
  );
}

function IntensityBar({ value }: { value: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div style={{ height: 4, borderRadius: 999, background: "rgba(148,163,184,0.18)", marginTop: 4, width: 80 }}>
      <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: "#f59e0b" }} />
    </div>
  );
}

export function ReactionsFeed({ iteration }: { iteration: SimulationIteration }) {
  return (
    <div className="glass" style={{ ...card, width: 340, maxHeight: "42vh", overflowY: "auto" }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Turn {iteration.index} — CEO reactions</div>
      {iteration.move && (
        <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 10 }}>Move: {iteration.move}</div>
      )}
      {(iteration.reactions ?? []).map((r: AgentReaction, i) => {
        const src = (r.evidence ?? []).find((e) => e.source_url);
        return (
          <div key={i} style={{ marginBottom: 12, borderTop: i ? "1px solid var(--border)" : "none", paddingTop: i ? 10 : 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: 13 }}>{r.actor}</strong>
              <IntensityBar value={r.intensity ?? 0.5} />
            </div>
            <div style={{ fontSize: 12.5, color: "#cbd5e1", marginTop: 4 }}>{r.action}</div>
            {r.ally_with && r.ally_with.length > 0 && (
              <div style={{ fontSize: 11.5, color: "#a78bfa", marginTop: 3 }}>
                🤝 allies with {r.ally_with.join(", ")}
              </div>
            )}
            {src && (
              <a
                href={src.source_url}
                target="_blank"
                rel="noreferrer"
                title={src.claim}
                style={{ fontSize: 11, color: "#22d3ee", marginTop: 3, display: "block", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                ↳ {src.source_title || src.claim || "source"}
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function CompanyInspector({
  name,
  state,
  onClose,
}: {
  name: string;
  state: SimulationState;
  onClose: () => void;
}) {
  const persona: CompanyPersona | undefined = state.personas?.find((p) => p.name === name);
  const last = state.iterations?.[state.iterations.length - 1];
  const reaction = last?.reactions?.find((r) => r.actor === name);
  const pos = last?.board?.companies?.find((c) => c.name === name);

  const chip: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color: "#cbd5e1",
    background: "rgba(15,23,42,0.85)",
    border: "1px solid var(--border)",
    padding: "2px 8px",
    borderRadius: 999,
  };
  const h: React.CSSProperties = { fontSize: 11, color: "#9ca3af", margin: "10px 0 3px", fontWeight: 600 };

  return (
    <div className="glass" style={{ ...card, width: 340, maxHeight: "70vh", overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>{name}</span>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: 14 }}>✕</button>
      </div>
      {persona?.temperament && <span style={{ ...chip, marginTop: 6, display: "inline-block" }}>{persona.temperament.replace(/_/g, " ")}</span>}

      {!persona && (
        <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 10 }}>No persona data for this company.</div>
      )}

      {persona?.strategy_thesis && (
        <>
          <div style={h}>Strategy</div>
          <div style={{ fontSize: 12.5, color: "#cbd5e1", lineHeight: 1.45 }}>{persona.strategy_thesis}</div>
        </>
      )}
      {persona?.financial_firepower && (
        <>
          <div style={h}>Firepower</div>
          <div style={{ fontSize: 12.5, color: "#cbd5e1", lineHeight: 1.45 }}>{persona.financial_firepower}</div>
        </>
      )}

      {pos && (
        <>
          <div style={h}>Board standing (this turn)</div>
          <Meter label="Market position" value={pos.market_position ?? 0.5} color="#22c55e" />
          <Meter label="Threat" value={pos.threat ?? 0.5} color="#f59e0b" />
          <Meter label="Pressure" value={pos.pressure ?? 0} color="#ef4444" />
          {pos.alliances && pos.alliances.length > 0 && (
            <div style={{ fontSize: 11.5, color: "#a78bfa", marginTop: 4 }}>🤝 allied with {pos.alliances.join(", ")}</div>
          )}
        </>
      )}

      {reaction && (
        <>
          <div style={h}>This turn&apos;s move</div>
          <div style={{ fontSize: 12.5, color: "#e5e7eb", fontWeight: 600 }}>{reaction.action}</div>
          {reaction.rationale && (
            <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 3, lineHeight: 1.45 }}>{reaction.rationale}</div>
          )}
        </>
      )}

      {persona?.sources && persona.sources.length > 0 && (
        <>
          <div style={h}>Sources</div>
          {persona.sources.slice(0, 4).map((e, i) =>
            e.source_url ? (
              <a
                key={i}
                href={e.source_url}
                target="_blank"
                rel="noreferrer"
                title={e.claim}
                style={{ display: "block", fontSize: 11.5, color: "#22d3ee", textDecoration: "none", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                ↳ {e.source_title || e.claim}
              </a>
            ) : null,
          )}
        </>
      )}
    </div>
  );
}

export function LiveSignals({ grounding }: { grounding?: GroundingPacket | null }) {
  const [open, setOpen] = useState(true);
  if (!grounding) return null;
  const evidence = grounding.evidence ?? [];
  return (
    <div className="glass" style={{ ...card, width: 340 }}>
      <div
        onClick={() => setOpen((v) => !v)}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
      >
        <div style={{ fontSize: 13, fontWeight: 700 }}>
          📡 Live signals{" "}
          {grounding.stale ? (
            <span style={{ fontSize: 10, color: "#f59e0b", fontWeight: 600 }}>(sparse data)</span>
          ) : (
            <span style={{ fontSize: 10, color: "#22c55e", fontWeight: 600 }}>(real data)</span>
          )}
        </div>
        <span style={{ color: "#64748b", fontSize: 12 }}>{open ? "−" : "+"}</span>
      </div>
      {open && (
        <div style={{ marginTop: 8 }}>
          {evidence.length === 0 && (
            <div style={{ fontSize: 12, color: "#9ca3af" }}>
              No fresh signals found for this move — agents reasoned from their persona data.
            </div>
          )}
          {evidence.slice(0, 5).map((e, i) => (
            <a
              key={i}
              href={e.source_url || undefined}
              target="_blank"
              rel="noreferrer"
              title={e.claim}
              style={{
                display: "block",
                fontSize: 12,
                color: e.source_url ? "#cbd5e1" : "#9ca3af",
                textDecoration: "none",
                marginBottom: 6,
                paddingLeft: 10,
                borderLeft: "2px solid var(--border)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {e.source_title || e.claim}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export function DecisionPanel({
  state,
  onChoose,
  loading,
}: {
  state: SimulationState;
  onChoose: (choice: string) => void;
  loading: boolean;
}) {
  const [freeText, setFreeText] = useState("");
  const last = state.iterations?.[state.iterations.length - 1];
  const decision = last?.decision_point;
  const complete = state.status === "complete";
  const recommendedId = decision?.recommended_option_id;

  return (
    <div className="glass" style={{ ...card, width: 380, maxHeight: "64vh", overflowY: "auto" }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
        {complete ? "Simulation complete" : "Your move"}
      </div>

      {last?.referee_outcome && (
        <p style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.5, marginTop: 0 }}>
          {last.referee_outcome}
        </p>
      )}

      {complete ? (
        <div>
          {state.final_recommendation ? (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#22d3ee", margin: "4px 0 6px" }}>
                ★ Strategy recommendation
              </div>
              <p style={{ fontSize: 13, color: "#e5e7eb", lineHeight: 1.55, marginTop: 0 }}>
                {state.final_recommendation}
              </p>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: "#9ca3af" }}>
              You played {state.current_index} turns. Review the board and reaction history.
            </div>
          )}
          <div style={{ fontSize: 11.5, color: "#a78bfa", marginTop: 10 }}>
            Tip: click an earlier turn in the timeline to branch and try a different path.
          </div>
        </div>
      ) : (
        <>
          {decision?.recommendation_rationale && recommendedId && (
            <div style={{ fontSize: 11.5, color: "#22d3ee", margin: "2px 0 8px", lineHeight: 1.4 }}>
              ★ Recommended: {decision.options?.find((o) => o.id === recommendedId)?.label}. {decision.recommendation_rationale}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
            {(decision?.options ?? []).map((opt) => {
              const recommended = opt.id === recommendedId;
              return (
                <button
                  key={opt.id}
                  onClick={() => onChoose(opt.id)}
                  disabled={loading}
                  style={{
                    textAlign: "left",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: recommended ? "1px solid #22d3ee" : "1px solid var(--border)",
                    background: recommended ? "rgba(34,211,238,0.08)" : "rgba(2,6,23,0.5)",
                    color: "var(--text)",
                    cursor: loading ? "default" : "pointer",
                  }}
                >
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>
                    {recommended && <span style={{ color: "#22d3ee" }}>★ </span>}
                    {opt.label}
                  </div>
                  {opt.expected_effect && (
                    <div style={{ fontSize: 11.5, color: "#22c55e", marginTop: 3 }}>↑ {opt.expected_effect}</div>
                  )}
                  {opt.risk && (
                    <div style={{ fontSize: 11.5, color: "#ef4444", marginTop: 2 }}>⚠ {opt.risk}</div>
                  )}
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 12 }}>
            <input
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && freeText.trim() && !loading) {
                  onChoose(freeText.trim());
                  setFreeText("");
                }
              }}
              placeholder="…or type your own move and press Enter"
              disabled={loading}
              style={{
                width: "100%",
                padding: "10px 12px",
                background: "rgba(2,6,23,0.6)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                color: "var(--text)",
                fontSize: 13,
              }}
            />
          </div>
        </>
      )}

      {loading && (
        <div style={{ fontSize: 12, color: "#22d3ee", marginTop: 12 }}>
          Agents are reasoning over real data…
        </div>
      )}
    </div>
  );
}

export function BranchPanel({
  state,
  fromTurn,
  onBranch,
  onCancel,
  loading,
}: {
  state: SimulationState;
  fromTurn: number;
  onBranch: (choice: string) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [freeText, setFreeText] = useState("");
  const iteration = state.iterations?.find((it) => it.index === fromTurn);
  const decision = iteration?.decision_point;
  const chosen = iteration?.chosen_option;

  return (
    <div className="glass" style={{ ...card, width: 380, maxHeight: "64vh", overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#a78bfa" }}>⑂ Branch from turn {fromTurn}</span>
        <button
          onClick={onCancel}
          style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: 13 }}
        >
          ✕
        </button>
      </div>
      <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 0 }}>
        Explore a different path from this turn. Your original run is kept intact.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
        {(decision?.options ?? []).map((opt) => {
          const wasChosen = opt.id === chosen;
          return (
            <button
              key={opt.id}
              onClick={() => onBranch(opt.id)}
              disabled={loading || wasChosen}
              title={wasChosen ? "This is the path you already took" : undefined}
              style={{
                textAlign: "left",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: wasChosen ? "rgba(148,163,184,0.10)" : "rgba(2,6,23,0.5)",
                color: wasChosen ? "#64748b" : "var(--text)",
                cursor: loading || wasChosen ? "default" : "pointer",
              }}
            >
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>
                {opt.label} {wasChosen && <span style={{ fontSize: 11 }}>(taken)</span>}
              </div>
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: 12 }}>
        <input
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && freeText.trim() && !loading) {
              onBranch(freeText.trim());
              setFreeText("");
            }
          }}
          placeholder="…or type a different move and press Enter"
          disabled={loading}
          style={{
            width: "100%",
            padding: "10px 12px",
            background: "rgba(2,6,23,0.6)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            color: "var(--text)",
            fontSize: 13,
          }}
        />
      </div>
      {loading && (
        <div style={{ fontSize: 12, color: "#a78bfa", marginTop: 12 }}>Forking the timeline…</div>
      )}
    </div>
  );
}
