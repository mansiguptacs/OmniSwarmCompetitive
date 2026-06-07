"use client";

import { useState } from "react";
import type { Competitor, NewsItem, ProductItem } from "@/types/ccie";
import { sentimentColor, clamp01 } from "@/lib/visuals";

const JUNK = new Set(["untitled", "unknown", "", "n/a", "see source", "private"]);
const isReal = (v?: string) => !!v && !JUNK.has(v.trim().toLowerCase()) && v.trim().length > 2;

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

/* ── Metric bar ────────────────────────────────────────────────── */

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
              <MetricBar label="Sentiment" value={(competitor.sentiment ?? 0) * 0.5 + 0.5} color="#22c55e" />
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
            <div style={S.section}>
              <div style={S.sectionTitle}>Financial Profile</div>
              {(() => {
                const fields: [string, string | undefined, string][] = [
                  ["Revenue", fin.revenue, "#22c55e"],
                  ["Total Funding", fin.funding_total, "#3b82f6"],
                  ["Valuation", fin.valuation, "#a855f7"],
                  ["Market Cap", fin.market_cap, "#f59e0b"],
                  ["Growth Rate", fin.growth_rate, "#22d3ee"],
                  ["Employees", fin.employee_count, "#94a3b8"],
                ];
                const validFields = fields.filter(([, v]) => isReal(v));

                if (validFields.length === 0) {
                  return (
                    <div style={{ color: "#475569", fontSize: 13, padding: "20px 0" }}>
                      No financial data available for this competitor.
                    </div>
                  );
                }
                return (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px" }}>
                    {validFields.map(([label, value, color]) => (
                      <div key={label} style={{ padding: "10px 14px", background: "rgba(148,163,184,0.04)", borderRadius: 8, border: "1px solid rgba(148,163,184,0.06)" }}>
                        <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
                        <div style={{ fontSize: 18, color, fontWeight: 700, marginTop: 4 }}>{value}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
            {isReal(fin.source) && (
              <div style={S.section}>
                <div style={{ fontSize: 10, color: "#475569" }}>Source: {fin.source}</div>
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
                const config = {
                  strengths: { label: "Strengths", color: "#22c55e", bg: "rgba(34,197,94,0.06)" },
                  weaknesses: { label: "Weaknesses", color: "#ef4444", bg: "rgba(239,68,68,0.06)" },
                  opportunities: { label: "Opportunities", color: "#3b82f6", bg: "rgba(59,130,246,0.06)" },
                  threats: { label: "Threats", color: "#f59e0b", bg: "rgba(245,158,11,0.06)" },
                }[key];
                return (
                  <div key={key} style={{ background: config.bg, borderRadius: 8, padding: 12, border: `1px solid ${config.color}15` }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: config.color, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      {config.label}
                    </div>
                    {items.length === 0 ? (
                      <div style={{ fontSize: 11, color: "#475569" }}>No data</div>
                    ) : (
                      items.map((item, i) => (
                        <div key={i} style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5, marginBottom: 6, paddingLeft: 8, borderLeft: `2px solid ${config.color}30` }}>
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
            <div style={S.sectionTitle}>Product Portfolio</div>
            {allProducts.length === 0 ? (
              <div style={{ color: "#475569", fontSize: 13, padding: "20px 0" }}>
                No product data available for this competitor.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {allProducts.map((p, i) => (
                  <div key={i} style={{ padding: "12px 14px", background: "rgba(148,163,184,0.04)", borderRadius: 8, border: "1px solid rgba(148,163,184,0.06)" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0", marginBottom: 4 }}>{p.name}</div>
                    {isReal(p.description) && (
                      <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>{p.description}</div>
                    )}
                    {isReal(p.pricing) && (
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>Pricing: {p.pricing}</div>
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
            <div style={S.sectionTitle}>News & Market Signals</div>
            {allNews.length === 0 ? (
              <div style={{ color: "#475569", fontSize: 13, padding: "20px 0" }}>
                No news data available for this competitor.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {allNews.map((n, i) => (
                  <div key={i} style={{
                    padding: "12px 14px",
                    background: "rgba(148,163,184,0.03)",
                    borderRadius: 8,
                    borderLeft: `3px solid ${sentimentColor(n.sentiment)}`,
                  }}>
                    <a
                      href={n.url || undefined}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", textDecoration: "none", lineHeight: 1.4, display: "block" }}
                    >
                      {n.title}
                    </a>
                    {isReal(n.summary) && (
                      <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5, marginTop: 4 }}>
                        {n.summary}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 10, color: "#475569" }}>
                      {n.published_at && <span>{n.published_at}</span>}
                      <span style={{ color: sentimentColor(n.sentiment) }}>
                        Sentiment: {(n.sentiment ?? 0) > 0.1 ? "Positive" : (n.sentiment ?? 0) < -0.1 ? "Negative" : "Neutral"}
                      </span>
                    </div>
                  </div>
                ))}
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
    [["Revenue", fin.revenue], ["Funding", fin.funding_total], ["Employees", fin.employee_count], ["Growth", fin.growth_rate]] as [string, string | undefined][]
  ).filter(([, v]) => isReal(v));

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

      {/* Recommended Actions */}
      <div style={S.section}>
        <div style={S.sectionTitle}>Recommended Actions</div>
        {recs.slice(0, 3).map((r, i) => (
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

      {/* Strengths vs Vulnerabilities */}
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

      {/* Products preview */}
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

      {/* News preview */}
      {news.length > 0 && (
        <div style={S.section}>
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
                  {n.summary!.length > 120 ? n.summary!.slice(0, 120) + "..." : n.summary}
                </div>
              )}
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
