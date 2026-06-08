"use client";

import { useCoAgent } from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";
import type { CCIEState } from "@/types/ccie";

function PhaseBadge({ phase }: { phase?: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        background: "#1e3a5f",
        color: "#93c5fd",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
      }}
    >
      {phase || "idle"}
    </span>
  );
}

function AgentStatePanel() {
  const { state } = useCoAgent<CCIEState>({ name: "ccie_agent" });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          padding: 16,
          background: "#111827",
          border: "1px solid #1f2937",
          borderRadius: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 16 }}>Analysis Status</h2>
          <PhaseBadge phase={state?.phase} />
        </div>
        {state?.target_company && (
          <p style={{ margin: "0 0 8px", color: "#9ca3af" }}>
            Target: <strong style={{ color: "#e5e7eb" }}>{state.target_company}</strong>
          </p>
        )}
        {state?.is_hypothetical && state?.target_description && (
          <p style={{ margin: "0 0 8px", color: "#9ca3af", fontSize: 13 }}>
            Hypothetical: {state.target_description.slice(0, 120)}
            {state.target_description.length > 120 ? "…" : ""}
          </p>
        )}
        {state?.landscape_summary && (
          <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.5 }}>
            {state.landscape_summary}
          </p>
        )}
      </div>

      <div
        style={{
          padding: 16,
          background: "#111827",
          border: "1px solid #1f2937",
          borderRadius: 12,
        }}
      >
        <h2 style={{ margin: "0 0 12px", fontSize: 16 }}>
          Competitors ({state?.competitors?.length || 0})
        </h2>
        {!state?.competitors?.length && (
          <p style={{ margin: 0, color: "#6b7280", fontSize: 14 }}>
            Send a message to start analysis…
          </p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {state?.competitors?.map((competitor) => (
            <div
              key={competitor.name}
              style={{
                padding: 12,
                borderRadius: 8,
                background: "#0f172a",
                border: "1px solid #1f2937",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 6,
                }}
              >
                <strong>{competitor.name}</strong>
                <span style={{ fontSize: 12, color: "#9ca3af" }}>
                  {competitor.status || "discovering"}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "#9ca3af" }}>
                News: {competitor.news?.length || 0} · Products:{" "}
                {competitor.products?.length || 0} · Sentiment:{" "}
                {competitor.sentiment?.toFixed(2) ?? "—"}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          padding: 16,
          background: "#111827",
          border: "1px solid #1f2937",
          borderRadius: 12,
        }}
      >
        <h2 style={{ margin: "0 0 12px", fontSize: 16 }}>Agent Activity</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 220, overflowY: "auto" }}>
          {(state?.agent_activity || []).slice(-8).reverse().map((entry, index) => (
            <div key={`${entry.ts}-${index}`} style={{ fontSize: 13 }}>
              <span style={{ color: "#60a5fa" }}>{entry.agent}</span>
              <span style={{ color: "#6b7280" }}> — </span>
              <span style={{ color: "#d1d5db" }}>{entry.status}</span>
            </div>
          ))}
          {!state?.agent_activity?.length && (
            <p style={{ margin: 0, color: "#6b7280", fontSize: 14 }}>No activity yet</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: "1fr 380px",
      }}
    >
      <section
        style={{
          display: "flex",
          flexDirection: "column",
          borderRight: "1px solid #1f2937",
          minHeight: "100vh",
        }}
      >
        <header
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #1f2937",
          }}
        >
          <h1 style={{ margin: 0, fontSize: 22 }}>CCIE War Room</h1>
          <p style={{ margin: "6px 0 0", color: "#9ca3af", fontSize: 14 }}>
            Try: <code>Analyze Stripe</code> or describe a hypothetical startup
          </p>
        </header>
        <div style={{ flex: 1, minHeight: 0 }}>
          <CopilotChat
            labels={{
              title: "Competitive Intelligence Agent",
              initial: "Name a company or describe a startup idea to analyze competitors.",
            }}
            className="h-full"
          />
        </div>
      </section>

      <aside
        style={{
          padding: 20,
          overflowY: "auto",
          background: "#0a0e17",
        }}
      >
        <AgentStatePanel />
      </aside>
    </main>
  );
}
