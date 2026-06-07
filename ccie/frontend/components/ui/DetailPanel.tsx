"use client";

import { useState } from "react";
import type { Competitor, NewsItem, ProductItem } from "@/types/ccie";
import { sentimentColor, clamp01 } from "@/lib/visuals";

const JUNK = new Set(["untitled", "", "n/a", "see source"]);
const isReal = (v?: string) => !!v && !JUNK.has(v.trim().toLowerCase()) && v.trim().length > 2;
const hasValue = (v?: string) => !!v && v.trim().length > 0 && v.trim().toLowerCase() !== "";

function sourceDomain(url?: string): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return "";
  }
}

function cleanNews(items?: NewsItem[], limit = 3): NewsItem[] {
  return (items ?? []).filter((n) => isReal(n.title)).slice(0, limit);
}
function cleanProducts(items?: ProductItem[], limit = 4): ProductItem[] {
  return (items ?? []).filter((p) => isReal(p.name)).slice(0, limit);
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

  return recs.slice(0, 5);
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
    maxHeight: "calc(100vh - 240px)",
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
  slideOut: {
    width: "min(50vw, 680px)",
    height: "100%",
    overflowY: "auto",
    padding: 0,
    pointerEvents: "auto",
    position: "relative",
    zIndex: 50,
    borderRadius: "12px 0 0 12px",
    background: "rgba(15,23,42,0.98)",
    border: "1px solid rgba(148,163,184,0.1)",
    backdropFilter: "blur(16px)",
    boxShadow: "-8px 0 40px rgba(0,0,0,0.5)",
    animation: "slideInRight 0.3s ease",
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

/* ── Reusable visualizations ──────────────────────────────────── */

function MetricBar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.round(clamp01(value) * 100);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
        <span style={{ color: "#94a3b8" }}>{label}</span>
        <span style={{ color, fontWeight: 700 }}>{pct}%</span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: "rgba(148,163,184,0.1)" }}>
        <div style={{ height: "100%", borderRadius: 2, background: color, width: `${pct}%`, transition: "width 0.4s" }} />
      </div>
    </div>
  );
}

function SentimentBadge({ value }: { value?: number }) {
  const s = value ?? 0;
  const label = s > 0.2 ? "Bullish" : s < -0.2 ? "Bearish" : "Neutral";
  const color = s > 0.2 ? "#22c55e" : s < -0.2 ? "#ef4444" : "#64748b";
  const arrow = s > 0.2 ? "▲" : s < -0.2 ? "▼" : "●";
  return (
    <span style={{
      fontSize: 10,
      fontWeight: 700,
      color,
      background: `${color}18`,
      padding: "2px 8px",
      borderRadius: 4,
      whiteSpace: "nowrap",
    }}>
      {arrow} {label}
    </span>
  );
}

function FinancialTicker({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  return (
    <div style={{
      padding: "10px 14px",
      background: "rgba(148,163,184,0.04)",
      borderRadius: 8,
      border: "1px solid rgba(148,163,184,0.06)",
      display: "flex",
      alignItems: "center",
      gap: 10,
    }}>
      <div style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        background: `${color}15`,
        color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 15,
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
        <div style={{ fontSize: 16, color: "#e2e8f0", fontWeight: 700, marginTop: 2 }}>{value}</div>
      </div>
    </div>
  );
}

function SentimentMiniChart({ news }: { news: NewsItem[] }) {
  if (news.length < 2) return null;
  const values = news.map((n) => n.sentiment ?? 0);
  const min = Math.min(...values, -0.5);
  const max = Math.max(...values, 0.5);
  const range = max - min || 1;
  const w = 200;
  const h = 40;

  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x},${y}`;
    })
    .join(" ");

  const zeroY = h - ((0 - min) / range) * h;

  return (
    <div style={{ marginTop: 8, marginBottom: 4 }}>
      <div style={{ fontSize: 10, color: "#475569", marginBottom: 4 }}>Sentiment Trend</div>
      <svg width={w} height={h} style={{ display: "block" }}>
        <line x1="0" y1={zeroY} x2={w} y2={zeroY} stroke="#334155" strokeWidth="1" strokeDasharray="3,3" />
        <polyline
          fill="none"
          stroke="#3b82f6"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
        {values.map((v, i) => {
          const x = (i / (values.length - 1)) * w;
          const y = h - ((v - min) / range) * h;
          return (
            <circle key={i} cx={x} cy={y} r="3" fill={v > 0.1 ? "#22c55e" : v < -0.1 ? "#ef4444" : "#64748b"} />
          );
        })}
      </svg>
    </div>
  );
}

/* ── Tab component ─────────────────────────────────────────────── */

const TABS = ["Overview", "Financials", "SWOT", "Products", "News"] as const;
type TabKey = typeof TABS[number];

function TabBar({ active, onChange }: { active: TabKey; onChange: (t: TabKey) => void }) {
  return (
    <div style={{ display: "flex", gap: 0, borderBottom: "1px solid rgba(148,163,184,0.08)", padding: "0 20px" }}>
      {TABS.map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          style={{
            background: "transparent",
            border: "none",
            borderBottom: active === tab ? "2px solid #3b82f6" : "2px solid transparent",
            color: active === tab ? "#e5e7eb" : "#64748b",
            fontSize: 12,
            fontWeight: 600,
            padding: "10px 14px",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

/* ── Detail Slide-Out Content ──────────────────────────────────── */

function DetailSlideOut({
  competitor,
  onClose,
  onBack,
}: {
  competitor: Competitor;
  onClose: () => void;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<TabKey>("Overview");
  const risk = riskLevel(competitor);
  const fin = competitor.financials ?? {};
  const swot = competitor.swot ?? {};
  const allNews = cleanNews(competitor.news, 20);
  const allProducts = cleanProducts(competitor.products, 20);
  const recs = recommendations(competitor);

  return (
    <div style={S.slideOut}>
      {/* Header */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(148,163,184,0.08)", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onBack} style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer", fontSize: 13, padding: "4px 0" }}>
          ← Back
        </button>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#f1f5f9", flex: 1 }}>
          {competitor.name}
        </h2>
        <div style={{
          background: risk.bg,
          border: `1px solid ${risk.color}40`,
          borderRadius: 8,
          padding: "4px 12px",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: risk.color, lineHeight: 1 }}>{risk.score}</div>
          <div style={{ fontSize: 9, color: risk.color, fontWeight: 600, marginTop: 1 }}>{risk.label}</div>
        </div>
        <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#475569", cursor: "pointer", fontSize: 18, padding: 0 }}>×</button>
      </div>

      <TabBar active={tab} onChange={setTab} />

      <div style={{ padding: 0 }}>
        {/* ── Overview Tab ──────────────────────────── */}
        {tab === "Overview" && (
          <>
            <div style={S.section}>
              <div style={S.sectionTitle}>Executive Brief</div>
              <p style={{ margin: 0, fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>
                {execBrief(competitor)}
              </p>
            </div>

            <div style={{ ...S.section, background: "rgba(239,68,68,0.04)" }}>
              <div style={S.sectionTitle}>Key Concern</div>
              <div style={{ fontSize: 13, color: "#e2e8f0", lineHeight: 1.5, fontWeight: 500 }}>
                {keyConcern(competitor)}
              </div>
            </div>

            <div style={S.section}>
              <div style={S.sectionTitle}>Competitive Metrics</div>
              <MetricBar label="Threat Level" value={competitor.threat_level ?? 0.5} color="#ef4444" />
              <MetricBar label="Market Overlap" value={competitor.market_overlap ?? 0.5} color="#f59e0b" />
              <MetricBar label="Market Sentiment" value={(competitor.sentiment ?? 0) * 0.5 + 0.5} color="#22c55e" />
              {competitor.market_size !== undefined && (
                <MetricBar label="Market Size" value={competitor.market_size} color="#3b82f6" />
              )}
            </div>

            <div style={S.section}>
              <div style={S.sectionTitle}>Recommended Actions</div>
              {recs.map((r, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "start" }}>
                  <span style={{
                    width: 22, height: 22, borderRadius: 6,
                    background: "rgba(59,130,246,0.12)", color: "#3b82f6",
                    fontSize: 11, fontWeight: 800,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, marginTop: 1,
                  }}>
                    {i + 1}
                  </span>
                  <span style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.55 }}>{r}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Financials Tab ───────────────────────── */}
        {tab === "Financials" && (
          <>
            {/* Ticker-style key metrics */}
            <div style={S.section}>
              <div style={S.sectionTitle}>Financial Overview</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <FinancialTicker label="Revenue" value={hasValue(fin.revenue) ? fin.revenue! : "Not disclosed"} icon="$" color="#22c55e" />
                <FinancialTicker label="Funding" value={hasValue(fin.funding_total) ? fin.funding_total! : "Not disclosed"} icon="F" color="#3b82f6" />
                <FinancialTicker label="Valuation" value={hasValue(fin.valuation) ? fin.valuation! : "Not disclosed"} icon="V" color="#a855f7" />
                <FinancialTicker label="Market Cap" value={hasValue(fin.market_cap) ? fin.market_cap! : "Not disclosed"} icon="M" color="#f59e0b" />
              </div>
            </div>

            {/* Growth & scale */}
            <div style={S.section}>
              <div style={S.sectionTitle}>Growth & Scale</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <FinancialTicker label="Growth Rate" value={hasValue(fin.growth_rate) ? fin.growth_rate! : "Not disclosed"} icon="↗" color="#22d3ee" />
                <FinancialTicker label="Employees" value={hasValue(fin.employee_count) ? fin.employee_count! : "Not disclosed"} icon="👤" color="#94a3b8" />
              </div>
            </div>

            {/* Market position gauge */}
            <div style={S.section}>
              <div style={S.sectionTitle}>Market Position Gauge</div>
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                {/* Threat gauge */}
                <div style={{ flex: 1, textAlign: "center" }}>
                  <svg width="100" height="60" viewBox="0 0 100 60">
                    <path d="M10 55 A40 40 0 0 1 90 55" fill="none" stroke="#1e293b" strokeWidth="8" strokeLinecap="round" />
                    <path
                      d="M10 55 A40 40 0 0 1 90 55"
                      fill="none"
                      stroke={risk.color}
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${(competitor.threat_level ?? 0.5) * 126} 126`}
                    />
                    <text x="50" y="50" textAnchor="middle" fill="#e2e8f0" fontSize="14" fontWeight="800">
                      {Math.round((competitor.threat_level ?? 0.5) * 100)}
                    </text>
                  </svg>
                  <div style={{ fontSize: 10, color: "#64748b", marginTop: -4 }}>Threat Score</div>
                </div>
                {/* Overlap gauge */}
                <div style={{ flex: 1, textAlign: "center" }}>
                  <svg width="100" height="60" viewBox="0 0 100 60">
                    <path d="M10 55 A40 40 0 0 1 90 55" fill="none" stroke="#1e293b" strokeWidth="8" strokeLinecap="round" />
                    <path
                      d="M10 55 A40 40 0 0 1 90 55"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${(competitor.market_overlap ?? 0.5) * 126} 126`}
                    />
                    <text x="50" y="50" textAnchor="middle" fill="#e2e8f0" fontSize="14" fontWeight="800">
                      {Math.round((competitor.market_overlap ?? 0.5) * 100)}
                    </text>
                  </svg>
                  <div style={{ fontSize: 10, color: "#64748b", marginTop: -4 }}>Market Overlap</div>
                </div>
                {/* Sentiment gauge */}
                <div style={{ flex: 1, textAlign: "center" }}>
                  <svg width="100" height="60" viewBox="0 0 100 60">
                    <path d="M10 55 A40 40 0 0 1 90 55" fill="none" stroke="#1e293b" strokeWidth="8" strokeLinecap="round" />
                    <path
                      d="M10 55 A40 40 0 0 1 90 55"
                      fill="none"
                      stroke={sentimentColor(competitor.sentiment)}
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${((competitor.sentiment ?? 0) * 0.5 + 0.5) * 126} 126`}
                    />
                    <text x="50" y="50" textAnchor="middle" fill="#e2e8f0" fontSize="14" fontWeight="800">
                      {(competitor.sentiment ?? 0) > 0 ? "+" : ""}{((competitor.sentiment ?? 0) * 100).toFixed(0)}
                    </text>
                  </svg>
                  <div style={{ fontSize: 10, color: "#64748b", marginTop: -4 }}>Sentiment</div>
                </div>
              </div>
            </div>

            {/* Source */}
            {hasValue(fin.source) && (
              <div style={{ ...S.section, borderBottom: "none" }}>
                <div style={{ fontSize: 10, color: "#475569" }}>
                  Source: <a href={fin.source} target="_blank" rel="noreferrer" style={{ color: "#3b82f6", textDecoration: "none" }}>
                    {sourceDomain(fin.source) || fin.source}
                  </a>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── SWOT Tab ─────────────────────────────── */}
        {tab === "SWOT" && (
          <div style={S.section}>
            <div style={S.sectionTitle}>SWOT Analysis</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {(["strengths", "weaknesses", "opportunities", "threats"] as const).map((key) => {
                const items = (swot[key] ?? []) as string[];
                const cfg = {
                  strengths: { label: "Strengths", color: "#22c55e", bg: "rgba(34,197,94,0.06)", icon: "✦" },
                  weaknesses: { label: "Weaknesses", color: "#ef4444", bg: "rgba(239,68,68,0.06)", icon: "⚠" },
                  opportunities: { label: "Opportunities", color: "#3b82f6", bg: "rgba(59,130,246,0.06)", icon: "◎" },
                  threats: { label: "Threats", color: "#f59e0b", bg: "rgba(245,158,11,0.06)", icon: "⚡" },
                }[key];
                return (
                  <div key={key} style={{ background: cfg.bg, borderRadius: 8, padding: 12, border: `1px solid ${cfg.color}15` }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: cfg.color, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      {cfg.icon} {cfg.label}
                    </div>
                    {items.length === 0 ? (
                      <div style={{ fontSize: 11, color: "#475569", fontStyle: "italic" }}>Insufficient data</div>
                    ) : (
                      items.map((item, i) => (
                        <div key={i} style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5, marginBottom: 6, paddingLeft: 8, borderLeft: `2px solid ${cfg.color}30` }}>
                          {item}
                        </div>
                      ))
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Products Tab ─────────────────────────── */}
        {tab === "Products" && (
          <div style={S.section}>
            <div style={S.sectionTitle}>Product Portfolio ({allProducts.length} identified)</div>
            {allProducts.length === 0 ? (
              <div style={{ color: "#475569", fontSize: 13, padding: "20px 0", textAlign: "center" }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>📦</div>
                No product data collected yet. Re-run analysis for deeper coverage.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {allProducts.map((p, i) => (
                  <div key={i} style={{
                    padding: "12px 14px",
                    background: "rgba(148,163,184,0.04)",
                    borderRadius: 8,
                    border: "1px solid rgba(148,163,184,0.06)",
                    borderLeft: "3px solid #3b82f6",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0", flex: 1 }}>{p.name}</div>
                      {isReal(p.pricing) && (
                        <span style={{
                          fontSize: 10,
                          fontWeight: 600,
                          color: "#22c55e",
                          background: "rgba(34,197,94,0.1)",
                          padding: "2px 8px",
                          borderRadius: 4,
                        }}>
                          {p.pricing}
                        </span>
                      )}
                    </div>
                    {isReal(p.description) && (
                      <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5, marginTop: 4 }}>{p.description}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── News Tab ─────────────────────────────── */}
        {tab === "News" && (
          <div style={S.section}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={S.sectionTitle}>Market Signals ({allNews.length} articles)</div>
              <SentimentBadge value={competitor.sentiment} />
            </div>

            <SentimentMiniChart news={allNews} />

            {allNews.length === 0 ? (
              <div style={{ color: "#475569", fontSize: 13, padding: "20px 0", textAlign: "center" }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>📰</div>
                No news signals collected yet. Re-run analysis for broader coverage.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                {allNews.map((n, i) => {
                  const domain = sourceDomain(n.url);
                  return (
                    <div key={i} style={{
                      padding: "12px 14px",
                      background: "rgba(148,163,184,0.03)",
                      borderRadius: 8,
                      borderLeft: `3px solid ${sentimentColor(n.sentiment)}`,
                    }}>
                      <div style={{ display: "flex", alignItems: "start", gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <a
                            href={n.url || undefined}
                            target="_blank"
                            rel="noreferrer"
                            style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", textDecoration: "none", lineHeight: 1.4, display: "block" }}
                          >
                            {n.title}
                            {n.url && <span style={{ fontSize: 10, color: "#3b82f6", marginLeft: 4 }}>↗</span>}
                          </a>
                          {isReal(n.summary) && (
                            <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5, marginTop: 4 }}>
                              {n.summary}
                            </div>
                          )}
                        </div>
                        <SentimentBadge value={n.sentiment} />
                      </div>
                      <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 10, color: "#475569" }}>
                        {n.published_at && <span>📅 {n.published_at}</span>}
                        {domain && (
                          <a href={n.url} target="_blank" rel="noreferrer" style={{ color: "#3b82f6", textDecoration: "none" }}>
                            🔗 {domain}
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main Panel (entry point) ──────────────────────────────────── */

export function DetailPanel({
  competitor,
  onClose,
  mode = "summary",
  onToggleMode,
}: {
  competitor: Competitor | null;
  onClose: () => void;
  mode?: "summary" | "detail";
  onToggleMode?: () => void;
}) {
  if (!competitor) return null;

  if (mode === "detail") {
    return (
      <DetailSlideOut
        competitor={competitor}
        onClose={onClose}
        onBack={() => onToggleMode?.()}
      />
    );
  }

  return <SummaryCard competitor={competitor} onClose={onClose} onViewDetails={onToggleMode} />;
}

/* ── Summary Card (compact view) ───────────────────────────────── */

function SummaryCard({
  competitor,
  onClose,
  onViewDetails,
}: {
  competitor: Competitor;
  onClose: () => void;
  onViewDetails?: () => void;
}) {
  const risk = riskLevel(competitor);
  const news = cleanNews(competitor.news);
  const products = cleanProducts(competitor.products);
  const fin = competitor.financials ?? {};
  const recs = recommendations(competitor);
  const concern = keyConcern(competitor);

  const finHighlights = (
    [["Revenue", fin.revenue], ["Funding", fin.funding_total], ["Market Cap", fin.market_cap], ["Growth", fin.growth_rate]] as [string, string | undefined][]
  ).filter(([, v]) => hasValue(v));

  return (
    <div style={S.panel}>
      {/* Header + Risk Score */}
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
        <p style={{ margin: "12px 0 0", fontSize: 13, color: "#cbd5e1", lineHeight: 1.55 }}>
          {execBrief(competitor)}
        </p>
      </div>

      {/* Key Concern */}
      <div style={{ ...S.section, background: "rgba(239,68,68,0.04)" }}>
        <div style={S.sectionTitle}>Key Concern</div>
        <div style={{ fontSize: 13, color: "#e2e8f0", lineHeight: 1.5, fontWeight: 500 }}>
          {concern}
        </div>
      </div>

      {/* Quick Metrics */}
      <div style={S.section}>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1, textAlign: "center", padding: "8px 0", background: "rgba(239,68,68,0.06)", borderRadius: 6 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#ef4444" }}>{Math.round((competitor.threat_level ?? 0.5) * 100)}</div>
            <div style={{ fontSize: 9, color: "#64748b", fontWeight: 600, marginTop: 1 }}>Threat</div>
          </div>
          <div style={{ flex: 1, textAlign: "center", padding: "8px 0", background: "rgba(245,158,11,0.06)", borderRadius: 6 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#f59e0b" }}>{Math.round((competitor.market_overlap ?? 0.5) * 100)}</div>
            <div style={{ fontSize: 9, color: "#64748b", fontWeight: 600, marginTop: 1 }}>Overlap</div>
          </div>
          <div style={{ flex: 1, textAlign: "center", padding: "8px 0", background: `${sentimentColor(competitor.sentiment)}10`, borderRadius: 6 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: sentimentColor(competitor.sentiment) }}>
              {(competitor.sentiment ?? 0) > 0 ? "+" : ""}{((competitor.sentiment ?? 0) * 100).toFixed(0)}
            </div>
            <div style={{ fontSize: 9, color: "#64748b", fontWeight: 600, marginTop: 1 }}>Sentiment</div>
          </div>
        </div>
      </div>

      {/* Recommended Actions */}
      <div style={S.section}>
        <div style={S.sectionTitle}>Recommended Actions</div>
        {recs.slice(0, 2).map((r, i) => (
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

      {/* Financial Snapshot */}
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

      {/* News snapshot */}
      {news.length > 0 && (
        <div style={S.section}>
          <div style={S.sectionTitle}>Latest Signals</div>
          {news.slice(0, 2).map((n, i) => (
            <div key={i} style={{ marginBottom: 8, display: "flex", gap: 6, alignItems: "start" }}>
              <span style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: sentimentColor(n.sentiment),
                marginTop: 5,
                flexShrink: 0,
              }} />
              <a
                href={n.url || undefined}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 12, color: "#cbd5e1", textDecoration: "none", lineHeight: 1.4 }}
              >
                {n.title}
                {n.url && <span style={{ color: "#3b82f6", marginLeft: 3, fontSize: 9 }}>↗</span>}
              </a>
            </div>
          ))}
        </div>
      )}

      {/* View Full Analysis button */}
      <div style={{ padding: "12px 20px 16px" }}>
        <button
          onClick={onViewDetails}
          style={{
            width: "100%",
            padding: "10px 0",
            borderRadius: 8,
            border: "1px solid rgba(59,130,246,0.3)",
            background: "rgba(59,130,246,0.1)",
            color: "#60a5fa",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          View Full Analysis →
        </button>
      </div>
    </div>
  );
}
