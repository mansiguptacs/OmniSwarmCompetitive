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
}: {
  phase?: Phase;
  target?: string;
  competitorCount: number;
  running?: boolean;
  onAnalyze?: (company: string) => void;
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
    <div className="glass" style={{ padding: "12px 16px", pointerEvents: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: isActive || target ? 10 : 0 }}>
        <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em", flexShrink: 0 }}>
          CCIE
        </span>

        {/* Search bar */}
        <form onSubmit={handleSubmit} style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <div style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            background: "rgba(15,23,42,0.6)",
            border: "1px solid rgba(148,163,184,0.15)",
            borderRadius: 8,
            padding: "0 12px",
            height: 36,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginRight: 8 }}>
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={target ? "Analyze another company..." : "Enter company name — e.g. Stripe, OpenAI"}
              disabled={isActive}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "#e5e7eb",
                fontSize: 13,
                fontFamily: "inherit",
                height: "100%",
              }}
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isActive}
            style={{
              height: 36,
              padding: "0 16px",
              borderRadius: 8,
              border: "none",
              background: !input.trim() || isActive ? "rgba(59,130,246,0.2)" : "#3b82f6",
              color: !input.trim() || isActive ? "#64748b" : "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: !input.trim() || isActive ? "not-allowed" : "pointer",
              transition: "all 0.2s",
              flexShrink: 0,
            }}
          >
            Analyze
          </button>
        </form>

        {/* Status indicators */}
        {target && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <span
              className="label-chip"
              style={{
                color: "#0b1120",
                background: PHASE_COLOR[phase] ?? "#64748b",
                pointerEvents: "auto",
              }}
            >
              {PHASE_LABELS[phase] ?? phase}
            </span>
            <span style={{ color: "#9ca3af", fontSize: 12 }}>
              <strong style={{ color: "#e5e7eb" }}>{target}</strong>
              {competitorCount > 0 && <> · {competitorCount} found</>}
            </span>
          </div>
        )}
      </div>

      {/* Phase progress bar */}
      {(isActive || target) && (
        <div style={{ display: "flex", gap: 4 }}>
          {PHASES.map((p, i) => (
            <div
              key={p}
              title={PHASE_LABELS[p]}
              style={{
                flex: 1,
                height: 3,
                borderRadius: 999,
                background:
                  phase === "complete" || i <= activeIndex
                    ? PHASE_COLOR[p]
                    : "rgba(148,163,184,0.12)",
                transition: "background 0.4s ease",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
