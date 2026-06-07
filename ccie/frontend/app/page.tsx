"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useCoAgent } from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";
import type { CCIEState, Competitor } from "@/types/ccie";
import { deriveAgents } from "@/lib/visuals";
import { PhaseBar } from "@/components/ui/PhaseBar";
import { ActivityFeed } from "@/components/ui/ActivityFeed";
import { DetailPanel } from "@/components/ui/DetailPanel";

// R3F must run client-side only.
const WarRoom = dynamic(
  () => import("@/components/three/WarRoom").then((m) => m.WarRoom),
  { ssr: false, loading: () => <SceneLoading /> },
);

function SceneLoading() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "grid",
        placeItems: "center",
        color: "#64748b",
        fontSize: 14,
      }}
    >
      Building the city…
    </div>
  );
}

export default function HomePage() {
  const { state } = useCoAgent<CCIEState>({ name: "ccie_agent" });
  const [selected, setSelected] = useState<string | null>(null);

  const effective: CCIEState = state ?? {};
  const competitors = effective.competitors ?? [];

  // Backend streams competitor.status but no explicit agent list — derive the
  // analysis agents from status so the agent buildings/links animate live.
  const sceneCompetitors = useMemo<Competitor[]>(
    () =>
      competitors.map((c) => ({
        ...c,
        agents: c.agents ?? deriveAgents(c.status),
      })),
    [competitors],
  );

  const selectedCompetitor = useMemo<Competitor | null>(
    () => competitors.find((c) => c.name === selected) ?? null,
    [competitors, selected],
  );

  return (
    <main style={{ display: "grid", gridTemplateColumns: "360px 1fr", height: "100vh" }}>
      {/* Chat column */}
      <section
        style={{
          display: "flex",
          flexDirection: "column",
          borderRight: "1px solid var(--border)",
          background: "var(--bg-soft)",
          minHeight: 0,
        }}
      >
        <header style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)" }}>
          <h1 style={{ margin: 0, fontSize: 18 }}>Competitive Intelligence</h1>
          <p style={{ margin: "6px 0 0", color: "#9ca3af", fontSize: 13 }}>
            Try <code>Analyze Stripe</code> or describe a startup idea.
          </p>
        </header>
        <div style={{ flex: 1, minHeight: 0 }}>
          <CopilotChat
            labels={{
              title: "CCIE Agent",
              initial: "Name a company or describe a startup idea to map its competitors.",
            }}
            className="h-full"
          />
        </div>
      </section>

      {/* 3D war room + overlays */}
      <section style={{ position: "relative", minWidth: 0 }}>
        <WarRoom
          target={effective.target_company || ""}
          hypothetical={effective.is_hypothetical}
          competitors={sceneCompetitors}
          selected={selected}
          onSelect={setSelected}
        />

        {/* Top phase bar */}
        <div style={{ position: "absolute", top: 16, left: 16, right: 16, pointerEvents: "none" }}>
          <PhaseBar
            phase={effective.phase}
            target={effective.target_company}
            competitorCount={competitors.length}
          />
        </div>

        {/* Bottom-left activity feed */}
        <div style={{ position: "absolute", bottom: 16, left: 16, pointerEvents: "none" }}>
          <ActivityFeed activity={effective.agent_activity} />
        </div>

        {/* Right detail panel */}
        <div style={{ position: "absolute", top: 92, right: 16, pointerEvents: "none", zIndex: 100 }}>
          <DetailPanel competitor={selectedCompetitor} onClose={() => setSelected(null)} />
        </div>

        {/* Empty hint */}
        {!effective.target_company && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              color: "#94a3b8",
              textAlign: "center",
              pointerEvents: "none",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 600, color: "#cbd5e1" }}>
              Empty land, ready to build.
            </div>
            <div style={{ fontSize: 13, marginTop: 6 }}>
              Name a company in the chat — it becomes the central tower, and competitors
              rise around it.
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
