"use client";

import { useState } from "react";
import type {
  AgentReaction,
  BoardState,
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

export function Timeline({ state }: { state: SimulationState }) {
  const max = state.max_iterations ?? 10;
  const current = state.current_index ?? 0;
  return (
    <div className="glass" style={{ padding: "10px 14px", pointerEvents: "auto", display: "flex", gap: 6, alignItems: "center" }}>
      <span style={{ fontSize: 12, color: "#9ca3af", marginRight: 6 }}>Turn</span>
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <div
          key={n}
          title={`Turn ${n}`}
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            display: "grid",
            placeItems: "center",
            fontSize: 11,
            fontWeight: 700,
            color: n <= current ? "#06121f" : "#64748b",
            background: n === current ? "#22d3ee" : n < current ? "#3b82f6" : "rgba(148,163,184,0.14)",
          }}
        >
          {n}
        </div>
      ))}
      <span style={{ fontSize: 12, color: "#9ca3af", marginLeft: 8 }}>
        {state.status === "complete" ? "complete" : `${current}/${max}`}
      </span>
    </div>
  );
}

export function PlayerStatus({ board, player }: { board: BoardState; player: string }) {
  const p = board.player ?? {};
  return (
    <div className="glass" style={{ ...card, width: 240 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: "#f5c451" }}>{player} (you)</div>
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
      {(iteration.reactions ?? []).map((r: AgentReaction, i) => (
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
        </div>
      ))}
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

  return (
    <div className="glass" style={{ ...card, width: 380, maxHeight: "60vh", overflowY: "auto" }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
        {complete ? "Simulation complete" : "Your move"}
      </div>

      {last?.referee_outcome && (
        <p style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.5, marginTop: 0 }}>
          {last.referee_outcome}
        </p>
      )}

      {complete ? (
        <div style={{ fontSize: 13, color: "#9ca3af" }}>
          You played {state.current_index} turns. Review the board and the reaction history.
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            {(decision?.options ?? []).map((opt) => (
              <button
                key={opt.id}
                onClick={() => onChoose(opt.id)}
                disabled={loading}
                style={{
                  textAlign: "left",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: "rgba(2,6,23,0.5)",
                  color: "var(--text)",
                  cursor: loading ? "default" : "pointer",
                }}
              >
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{opt.label}</div>
                {opt.expected_effect && (
                  <div style={{ fontSize: 11.5, color: "#22c55e", marginTop: 3 }}>↑ {opt.expected_effect}</div>
                )}
                {opt.risk && (
                  <div style={{ fontSize: 11.5, color: "#ef4444", marginTop: 2 }}>⚠ {opt.risk}</div>
                )}
              </button>
            ))}
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
