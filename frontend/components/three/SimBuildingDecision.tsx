"use client";

import { useState } from "react";
import { Html } from "@react-three/drei";
import type { AgentReaction } from "@/types/simulation";

const BRAND_COLORS: Record<string, string> = {
  microsoft: "#00A4EF", google: "#4285F4", alphabet: "#4285F4", apple: "#A2AAAD",
  amazon: "#FF9900", meta: "#0081FB", nvidia: "#76B900", stripe: "#635BFF",
  salesforce: "#00A1E0", adobe: "#FF0000", figma: "#F24E1E", canva: "#00C4CC",
  sketch: "#F7B500", invision: "#FF3366", framer: "#0055FF", marvel: "#1FB6FF",
  slack: "#4A154B", notion: "#2B2B2B", openai: "#10A37F", anthropic: "#D4A574",
  paypal: "#003087", klarna: "#FFB3C7", adyen: "#0ABF53", block: "#3E4348",
  square: "#3E4348", braintree: "#4B3263", shopify: "#96BF48",
  default_high: "#ef4444", default_med: "#f59e0b", default_low: "#3b82f6",
};

function getBrandColor(name: string, intensity: number): string {
  const key = name.toLowerCase().split(/\s+/)[0];
  if (BRAND_COLORS[key]) return BRAND_COLORS[key];
  if (intensity > 0.7) return BRAND_COLORS.default_high;
  if (intensity > 0.4) return BRAND_COLORS.default_med;
  return BRAND_COLORS.default_low;
}

function getThreatColor(intensity: number): string {
  if (intensity > 0.7) return "#ef4444";
  if (intensity > 0.4) return "#f59e0b";
  return "#22c55e";
}

interface Props {
  reaction: AgentReaction;
  buildingHeight: number;
  companyName: string;
}

export function SimBuildingDecision({ reaction, buildingHeight, companyName }: Props) {
  const [expanded, setExpanded] = useState(false);
  const impact = reaction.intensity ?? 0.5;
  const pct = Math.round(impact * 100);
  const brand = getBrandColor(companyName, impact);
  const threat = getThreatColor(impact);
  const level = impact > 0.7 ? "HIGH THREAT" : impact > 0.4 ? "MODERATE" : "LOW IMPACT";

  const action = reaction.action || "";
  const intent = reaction.intent || "";
  const rationale = reaction.rationale || "";
  const evidence = reaction.evidence ?? [];

  return (
    <Html
      position={[0, buildingHeight + 2.5, 0]}
      center
      zIndexRange={[50, 0]}
      style={{ pointerEvents: "auto" }}
    >
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          width: expanded ? 300 : 250,
          background: "rgba(8,12,22,0.96)",
          backdropFilter: "blur(12px)",
          borderRadius: 12,
          border: `2px solid ${brand}55`,
          padding: expanded ? "14px 16px" : "12px 14px",
          cursor: "pointer",
          animation: "fadeInUp 0.5s ease",
          boxShadow: `0 8px 32px rgba(0,0,0,0.45), 0 0 16px ${brand}18`,
          transition: "width 0.2s ease",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            background: `${brand}25`, border: `2px solid ${brand}60`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 900, color: brand,
          }}>
            {companyName.charAt(0)}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#f1f5f9" }}>{companyName}</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: threat, letterSpacing: "0.06em" }}>{level}</div>
          </div>
          <span style={{
            fontSize: 15, fontWeight: 900, color: threat,
            background: `${threat}18`, padding: "4px 10px", borderRadius: 6,
          }}>
            {pct}%
          </span>
        </div>

        {/* Action highlight box */}
        {action && (
          <div style={{
            background: `${brand}12`,
            border: `1px solid ${brand}30`,
            borderRadius: 8,
            padding: "8px 10px",
            marginBottom: 8,
          }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: brand, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>
              Action Taken
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", lineHeight: 1.45 }}>
              {expanded ? action : (action.length > 80 ? action.substring(0, 80) + "…" : action)}
            </div>
          </div>
        )}

        {/* Intent (if different from action) */}
        {intent && intent !== action && (
          <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.45, marginBottom: 6 }}>
            <span style={{ fontWeight: 700, color: "#64748b" }}>Intent: </span>
            {expanded ? intent : (intent.length > 60 ? intent.substring(0, 60) + "…" : intent)}
          </div>
        )}

        {/* Impact bar */}
        <div style={{ height: 4, borderRadius: 2, background: "rgba(148,163,184,0.08)", overflow: "hidden", marginBottom: expanded ? 8 : 0 }}>
          <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${brand}, ${threat})`, borderRadius: 2, transition: "width 0.8s ease" }} />
        </div>

        {/* Expanded: rationale */}
        {expanded && rationale && rationale !== action && rationale !== intent && (
          <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5, marginBottom: 8, borderLeft: `2px solid ${brand}30`, paddingLeft: 8 }}>
            {rationale.length > 150 ? rationale.substring(0, 150) + "…" : rationale}
          </div>
        )}

        {/* Expanded: evidence/news */}
        {expanded && evidence.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
              Market Intel
            </div>
            {evidence.slice(0, 3).map((ev, i) => (
              <div key={i} style={{
                fontSize: 10, color: "#94a3b8", lineHeight: 1.4, marginBottom: 3,
                display: "flex", gap: 5, alignItems: "flex-start",
              }}>
                <span style={{ color: "#3b82f6", fontWeight: 800, flexShrink: 0 }}>•</span>
                <span>
                  {ev.claim || ev.source_title || ""}
                  {ev.source_url && (
                    <span
                      style={{ color: "#3b82f6", marginLeft: 4, cursor: "pointer" }}
                      onClick={(e) => { e.stopPropagation(); window.open(ev.source_url!, "_blank"); }}
                    >↗</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Expanded: alliances */}
        {expanded && (reaction.ally_with?.length ?? 0) > 0 && (
          <div style={{ fontSize: 10, color: "#a855f7", fontWeight: 700, marginBottom: 4 }}>
            🤝 Alliance: {reaction.ally_with!.join(", ")}
          </div>
        )}

        {/* Counter-bid tag + expand hint */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
          {impact > 0.6 && (
            <span style={{ fontSize: 8, fontWeight: 800, color: threat, background: `${threat}15`, padding: "2px 6px", borderRadius: 3, letterSpacing: "0.05em" }}>
              COUNTER-BID
            </span>
          )}
          {!expanded && (
            <span style={{ fontSize: 9, color: "#475569", marginLeft: "auto" }}>Tap for details</span>
          )}
        </div>
      </div>
    </Html>
  );
}
