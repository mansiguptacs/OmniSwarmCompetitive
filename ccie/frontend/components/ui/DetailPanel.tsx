"use client";

import type { Competitor } from "@/types/ccie";
import { sentimentColor, sentimentLabel } from "@/lib/visuals";

const MAX_PRODUCTS = 4;
const MAX_NEWS = 4;
const MAX_SWOT = 3;

function MoreHint({ count, noun }: { count: number; noun: string }) {
  if (count <= 0) return null;
  return (
    <div style={{ fontSize: 12, color: "#7c8aa0", marginTop: 2 }}>
      +{count} more {noun}
      {count === 1 ? "" : "s"}
    </div>
  );
}

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

export function DetailPanel({
  competitor,
  onClose,
}: {
  competitor: Competitor | null;
  onClose: () => void;
}) {
  if (!competitor) return null;

  const color = sentimentColor(competitor.sentiment);

  return (
    <div
      className="glass"
      style={{
        width: 360,
        maxHeight: "calc(100vh - 140px)",
        overflowY: "auto",
        padding: 18,
        pointerEvents: "auto",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20 }}>{competitor.name}</h2>
          <span
            className="label-chip"
            style={{ marginTop: 6, display: "inline-block", color: "#0b1120", background: color }}
          >
            {sentimentLabel(competitor.sentiment)} · {competitor.status ?? "discovering"}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "transparent",
            border: "1px solid var(--border)",
            color: "#9ca3af",
            borderRadius: 8,
            width: 28,
            height: 28,
            cursor: "pointer",
          }}
        >
          ×
        </button>
      </div>

      {competitor.description && (
        <p style={{ color: "#cbd5e1", fontSize: 13.5, lineHeight: 1.5, marginTop: 12 }}>
          {competitor.description}
        </p>
      )}

      <div style={{ marginTop: 14 }}>
        <Meter label="Threat level" value={competitor.threat_level ?? 0.5} color="#ef4444" />
        <Meter label="Market size" value={competitor.market_size ?? 0.5} color="#3b82f6" />
        <Meter label="Market overlap" value={competitor.market_overlap ?? 0.5} color="#22d3ee" />
      </div>

      {!!competitor.products?.length && (
        <Section title="Products">
          {competitor.products!.slice(0, MAX_PRODUCTS).map((p, i) => (
            <div key={i} style={{ fontSize: 13, marginBottom: 6 }}>
              <strong style={{ color: "#e5e7eb" }}>{p.name}</strong>
              {p.pricing && <span style={{ color: "#9ca3af" }}> · {p.pricing}</span>}
            </div>
          ))}
          <MoreHint count={competitor.products!.length - MAX_PRODUCTS} noun="product" />
        </Section>
      )}

      {!!competitor.news?.length && (
        <Section title="Latest news">
          {competitor.news!.slice(0, MAX_NEWS).map((n, i) => (
            <div key={i} style={{ fontSize: 13, marginBottom: 6, display: "flex", gap: 8 }}>
              <span
                style={{
                  width: 6,
                  height: 6,
                  marginTop: 6,
                  borderRadius: 999,
                  flexShrink: 0,
                  background: sentimentColor(n.sentiment),
                }}
              />
              <a
                href={n.url || undefined}
                target="_blank"
                rel="noreferrer"
                style={{ color: "#cbd5e1", textDecoration: "none" }}
              >
                {n.title}
              </a>
            </div>
          ))}
          <MoreHint count={competitor.news!.length - MAX_NEWS} noun="story" />
        </Section>
      )}

      {competitor.swot && Object.keys(competitor.swot).length > 0 && (
        <Section title="SWOT">
          {Object.entries(competitor.swot).map(([k, items]) => (
            <div key={k} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", color: "#7c8aa0", letterSpacing: "0.05em" }}>
                {k}
              </div>
              <ul style={{ margin: "4px 0 0", paddingLeft: 18, color: "#cbd5e1", fontSize: 12.5 }}>
                {(items as string[]).slice(0, MAX_SWOT).map((it, i) => (
                  <li key={i}>{it}</li>
                ))}
              </ul>
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#cbd5e1", marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}
