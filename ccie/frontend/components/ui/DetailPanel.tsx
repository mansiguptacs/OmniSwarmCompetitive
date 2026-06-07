"use client";

import type { Competitor, NewsItem, ProductItem } from "@/types/ccie";
import { sentimentColor, clamp01 } from "@/lib/visuals";

const JUNK = new Set(["untitled", "unknown", "", "n/a", "see source", "private"]);
const isReal = (v?: string) => !!v && !JUNK.has(v.trim().toLowerCase()) && v.trim().length > 2;

function cleanNews(items?: NewsItem[]): NewsItem[] {
  return (items ?? []).filter((n) => isReal(n.title)).slice(0, 3);
}
function cleanProducts(items?: ProductItem[]): ProductItem[] {
  return (items ?? []).filter((p) => isReal(p.name)).slice(0, 4);
}

/* ── Executive insight generators ─────────────────────────────── */

function execBrief(c: Competitor): string {
  const t = c.threat_level ?? 0.5;
  const o = c.market_overlap ?? 0.5;
  const s = c.sentiment ?? 0;
  const name = c.name;

  if (t >= 0.75 && o >= 0.6)
    return `${name} is a direct, high-priority threat competing for the same customers. Immediate strategic attention required.`;
  if (t >= 0.75)
    return `${name} is a major market player with significant competitive strength, though customer overlap is moderate.`;
  if (t >= 0.5 && o >= 0.6)
    return `${name} operates in your core market with growing presence. Monitor closely for share erosion.`;
  if (t >= 0.5)
    return `${name} is a mid-tier competitor with moderate impact on your market position.`;
  if (s > 0.3)
    return `${name} is a smaller player but gaining positive momentum. Worth watching as an emerging challenger.`;
  return `${name} is a peripheral competitor with limited direct impact. Low priority but keep on radar.`;
}

function riskLevel(c: Competitor): { score: number; label: string; color: string; bg: string } {
  const raw = ((c.threat_level ?? 0.5) * 0.4 + (c.market_overlap ?? 0.5) * 0.35 + clamp01(1 - (c.sentiment ?? 0)) * 0.25);
  const score = Math.round(clamp01(raw) * 10);
  if (score >= 8) return { score, label: "Critical", color: "#ef4444", bg: "rgba(239,68,68,0.15)" };
  if (score >= 6) return { score, label: "High", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" };
  if (score >= 4) return { score, label: "Moderate", color: "#3b82f6", bg: "rgba(59,130,246,0.12)" };
  return { score, label: "Low", color: "#22c55e", bg: "rgba(34,197,94,0.12)" };
}

function recommendations(c: Competitor): string[] {
  const recs: string[] = [];
  const swot = c.swot ?? {};
  const weaknesses = (swot.weaknesses ?? []) as string[];
  const threats = (swot.threats ?? []) as string[];
  const strengths = (swot.strengths ?? []) as string[];
  const t = c.threat_level ?? 0.5;
  const o = c.market_overlap ?? 0.5;

  if (t >= 0.7 && o >= 0.6)
    recs.push("Accelerate differentiation in overlapping product areas to defend market share");
  if (weaknesses.length > 0)
    recs.push(`Exploit their weakness: ${weaknesses[0].toLowerCase()}`);
  if (t >= 0.5 && strengths.length > 0)
    recs.push(`Counter their strength in ${strengths[0].toLowerCase().slice(0, 80)}`);
  if (o >= 0.5)
    recs.push("Strengthen customer retention programs in overlapping segments");
  if ((c.sentiment ?? 0) < -0.15)
    recs.push("Capitalize on their negative market sentiment with targeted messaging");
  if ((c.sentiment ?? 0) > 0.3 && t >= 0.5)
    recs.push("Track their momentum — consider pre-emptive feature launches");
  if (threats.length > 0 && recs.length < 3)
    recs.push(`Monitor market threat: ${threats[0].toLowerCase().slice(0, 80)}`);

  if (recs.length === 0)
    recs.push("Continue monitoring; no immediate action required");

  return recs.slice(0, 3);
}

function keyConcern(c: Competitor): string {
  const t = c.threat_level ?? 0.5;
  const o = c.market_overlap ?? 0.5;
  const s = c.sentiment ?? 0;
  const strengths = ((c.swot ?? {}).strengths ?? []) as string[];
  const fin = c.financials ?? {};

  if (t >= 0.7 && isReal(fin.growth_rate))
    return `Growing at ${fin.growth_rate} with ${Math.round(o * 100)}% customer overlap`;
  if (t >= 0.7 && strengths.length > 0)
    return strengths[0];
  if (o >= 0.7)
    return `${Math.round(o * 100)}% of their customers overlap with yours — direct revenue risk`;
  if (s > 0.4)
    return "Strong positive market momentum — emerging threat trajectory";
  if (s < -0.2)
    return "Facing headwinds — potential window to capture their dissatisfied customers";
  if (isReal(fin.revenue))
    return `Revenue at ${fin.revenue} — ${t >= 0.5 ? "well-funded competitor" : "niche player"}`;
  return "Limited data — increase monitoring coverage";
}

/* ── Styles ────────────────────────────────────────────────────── */

const S: Record<string, React.CSSProperties> = {
  panel: {
    width: 380,
    maxHeight: "calc(100vh - 120px)",
    overflowY: "auto",
    padding: 0,
    pointerEvents: "auto",
    position: "relative",
    zIndex: 50,
    borderRadius: 12,
    background: "rgba(15,23,42,0.96)",
    border: "1px solid rgba(148,163,184,0.1)",
    backdropFilter: "blur(16px)",
    boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
  },
  section: {
    padding: "14px 20px",
    borderBottom: "1px solid rgba(148,163,184,0.06)",
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: "#475569",
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    marginBottom: 10,
  },
};

/* ── Main Panel ────────────────────────────────────────────────── */

export function DetailPanel({
  competitor,
  onClose,
}: {
  competitor: Competitor | null;
  onClose: () => void;
}) {
  if (!competitor) return null;

  const risk = riskLevel(competitor);
  const news = cleanNews(competitor.news);
  const products = cleanProducts(competitor.products);
  const fin = competitor.financials ?? {};
  const recs = recommendations(competitor);
  const concern = keyConcern(competitor);

  const finHighlights = (
    [["Revenue", fin.revenue], ["Funding", fin.funding_total], ["Employees", fin.employee_count], ["Growth", fin.growth_rate]] as [string, string | undefined][]
  ).filter(([, v]) => isReal(v));

  return (
    <div style={S.panel}>
      {/* ── Header + Risk Score ──────────────────── */}
      <div style={{ padding: "18px 20px 16px", borderBottom: "1px solid rgba(148,163,184,0.08)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#f1f5f9" }}>
              {competitor.name}
            </h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              background: risk.bg,
              border: `1px solid ${risk.color}40`,
              borderRadius: 8,
              padding: "4px 12px",
              textAlign: "center",
            }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: risk.color, lineHeight: 1 }}>{risk.score}</div>
              <div style={{ fontSize: 9, color: risk.color, fontWeight: 600, marginTop: 2 }}>{risk.label} Risk</div>
            </div>
            <button
              onClick={onClose}
              style={{ background: "transparent", border: "none", color: "#475569", cursor: "pointer", fontSize: 18, padding: 0 }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Executive brief */}
        <p style={{ margin: "12px 0 0", fontSize: 13, color: "#cbd5e1", lineHeight: 1.55 }}>
          {execBrief(competitor)}
        </p>
      </div>

      {/* ── Key Concern ──────────────────────────── */}
      <div style={{ ...S.section, background: "rgba(239,68,68,0.04)" }}>
        <div style={S.sectionTitle}>Key Concern</div>
        <div style={{ fontSize: 13, color: "#e2e8f0", lineHeight: 1.5, fontWeight: 500 }}>
          {concern}
        </div>
      </div>

      {/* ── Recommended Actions ──────────────────── */}
      <div style={S.section}>
        <div style={S.sectionTitle}>Recommended Actions</div>
        {recs.map((r, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "start" }}>
            <span style={{
              width: 20, height: 20, borderRadius: 6,
              background: "rgba(59,130,246,0.12)", color: "#3b82f6",
              fontSize: 11, fontWeight: 800,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, marginTop: 1,
            }}>
              {i + 1}
            </span>
            <span style={{ fontSize: 12.5, color: "#cbd5e1", lineHeight: 1.5 }}>{r}</span>
          </div>
        ))}
      </div>

      {/* ── Financial Snapshot ────────────────────── */}
      {finHighlights.length > 0 && (
        <div style={S.section}>
          <div style={S.sectionTitle}>Financial Snapshot</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 16px" }}>
            {finHighlights.map(([label, value]) => (
              <div key={label} style={{ padding: "5px 0" }}>
                <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600 }}>{label}</div>
                <div style={{ fontSize: 15, color: "#e2e8f0", fontWeight: 700, marginTop: 1 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Strengths vs Vulnerabilities ──────────── */}
      {(() => {
        const swot = competitor.swot ?? {};
        const str = ((swot.strengths ?? []) as string[]).slice(0, 2);
        const wk = ((swot.weaknesses ?? []) as string[]).slice(0, 2);
        if (str.length === 0 && wk.length === 0) return null;
        return (
          <div style={S.section}>
            <div style={S.sectionTitle}>Competitive Analysis</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
              {str.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#ef4444", marginBottom: 6 }}>THEIR EDGE</div>
                  {str.map((s, i) => (
                    <div key={i} style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5, marginBottom: 4, paddingLeft: 8, borderLeft: "2px solid rgba(239,68,68,0.3)" }}>
                      {s}
                    </div>
                  ))}
                </div>
              )}
              {wk.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#22c55e", marginBottom: 6 }}>OUR OPPORTUNITY</div>
                  {wk.map((w, i) => (
                    <div key={i} style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5, marginBottom: 4, paddingLeft: 8, borderLeft: "2px solid rgba(34,197,94,0.3)" }}>
                      {w}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Products to Watch ─────────────────────── */}
      {products.length > 0 && (
        <div style={S.section}>
          <div style={S.sectionTitle}>Products to Watch</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {products.map((p, i) => (
              <span key={i} style={{
                fontSize: 11, padding: "4px 10px", borderRadius: 6,
                background: "rgba(148,163,184,0.08)", color: "#94a3b8",
                border: "1px solid rgba(148,163,184,0.1)",
              }}>
                {p.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Signal Watch ──────────────────────────── */}
      {news.length > 0 && (
        <div style={{ ...S.section, borderBottom: "none" }}>
          <div style={S.sectionTitle}>Signal Watch</div>
          {news.map((n, i) => (
            <div key={i} style={{ marginBottom: 10, paddingLeft: 10, borderLeft: `3px solid ${sentimentColor(n.sentiment)}` }}>
              <a
                href={n.url || undefined}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0", textDecoration: "none", lineHeight: 1.4, display: "block" }}
              >
                {n.title}
              </a>
              {isReal(n.summary) && (
                <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.4, marginTop: 2 }}>
                  {n.summary!.length > 120 ? n.summary!.slice(0, 120) + "…" : n.summary}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
