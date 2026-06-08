"use client";

import { useState, useRef, type FormEvent } from "react";
import type { Phase } from "@/types/ccie";

const PHASES: Phase[] = [
  "classifying",
  "discovering",
  "analyzing",
  "synthesizing",
  "complete",
];

const PHASE_LABELS: Record<string, string> = {
  idle: "Ready",
  classifying: "Classifying input",
  discovering: "Discovering competitors",
  analyzing: "Analyzing competitors",
  synthesizing: "Synthesizing landscape",
  complete: "Analysis complete",
};

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
  running,
  onAnalyze,
  onSimulate,
}: {
  phase?: Phase;
  target?: string;
  competitorCount: number;
  running?: boolean;
  onAnalyze?: (company: string) => void;
  onSimulate?: () => void;
}) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const activeIndex = PHASES.indexOf(phase);
  const isActive = running || (phase !== "idle" && phase !== "complete");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || !onAnalyze) return;
    onAnalyze(trimmed);
    setInput("");
  };

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      pointerEvents: "auto",
    }}>
      {/* Brand mark */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        background: "rgba(10,14,23,0.88)",
        backdropFilter: "blur(16px)",
        padding: "8px 14px",
        borderRadius: 12,
        border: "1px solid rgba(148,163,184,0.08)",
        flexShrink: 0,
      }}>
        <div style={{
          width: 26, height: 26, borderRadius: 7,
          background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </div>
        <span style={{
          fontSize: 13, fontWeight: 700, color: "#f1f5f9",
          letterSpacing: "-0.01em",
        }}>
          StrategyOS
        </span>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSubmit} style={{
        display: "flex", alignItems: "center", gap: 6,
        background: "rgba(10,14,23,0.88)",
        backdropFilter: "blur(16px)",
        padding: "6px 8px 6px 14px",
        borderRadius: 12,
        border: "1px solid rgba(148,163,184,0.08)",
        flex: 1,
        maxWidth: 420,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={target ? "Analyze another..." : "Enter company — e.g. Stripe, OpenAI"}
          disabled={isActive}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: "#e5e7eb",
            fontSize: 13,
            fontFamily: "inherit",
            minWidth: 0,
          }}
        />
        <button
          type="submit"
          disabled={!input.trim() || isActive}
          style={{
            height: 30,
            padding: "0 14px",
            borderRadius: 8,
            border: "none",
            background: !input.trim() || isActive ? "rgba(59,130,246,0.15)" : "#3b82f6",
            color: !input.trim() || isActive ? "#475569" : "#fff",
            fontSize: 12,
            fontWeight: 700,
            cursor: !input.trim() || isActive ? "not-allowed" : "pointer",
            transition: "all 0.2s",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {isActive && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ animation: "spin 1s linear infinite", flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeDasharray="50 20" strokeLinecap="round" />
            </svg>
          )}
          {isActive ? "Analyzing" : "Analyze"}
        </button>
      </form>

      {/* Status + actions */}
      {target && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "rgba(10,14,23,0.88)",
          backdropFilter: "blur(16px)",
          padding: "8px 14px",
          borderRadius: 12,
          border: "1px solid rgba(148,163,184,0.08)",
          flexShrink: 0,
        }}>
          {/* Phase progress dots */}
          <div style={{ display: "flex", gap: 3, marginRight: 4 }}>
            {PHASES.map((p, i) => (
              <div
                key={p}
                title={PHASE_LABELS[p]}
                style={{
                  width: phase === p ? 16 : 6, height: 6,
                  borderRadius: 3,
                  background: phase === "complete" || i <= activeIndex
                    ? PHASE_COLOR[p]
                    : "rgba(148,163,184,0.12)",
                  transition: "all 0.4s ease",
                }}
              />
            ))}
          </div>

          <span style={{ color: "#e5e7eb", fontSize: 12, fontWeight: 600 }}>{target}</span>
          {competitorCount > 0 && (
            <span style={{ fontSize: 11, color: "#64748b" }}>· {competitorCount}</span>
          )}

          <span
            style={{
              fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 4,
              color: "#0b1120",
              background: PHASE_COLOR[phase] ?? "#64748b",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            {PHASE_LABELS[phase] ?? phase}
          </span>

          {phase === "complete" && onSimulate && (
            <button
              onClick={onSimulate}
              style={{
                height: 28,
                padding: "0 12px",
                borderRadius: 7,
                border: "1px solid rgba(245,158,11,0.35)",
                background: "rgba(245,158,11,0.1)",
                color: "#f59e0b",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.2s",
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span style={{ fontSize: 12 }}>⚡</span>
              Simulate M&A
            </button>
          )}
        </div>
      )}
    </div>
  );
}
