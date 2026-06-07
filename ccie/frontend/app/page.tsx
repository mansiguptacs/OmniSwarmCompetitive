"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useCoAgent, useCopilotChat } from "@copilotkit/react-core";
import { TextMessage, Role } from "@copilotkit/runtime-client-gql";
import type { CCIEState, Competitor } from "@/types/ccie";
import { deriveAgents } from "@/lib/visuals";
import { PhaseBar } from "@/components/ui/PhaseBar";
import { ActivityFeed } from "@/components/ui/ActivityFeed";
import { DetailPanel } from "@/components/ui/DetailPanel";

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
  const { state, running } = useCoAgent<CCIEState>({ name: "ccie_agent" });
  const { appendMessage } = useCopilotChat();
  const [selected, setSelected] = useState<string | null>(null);
  const [detailMode, setDetailMode] = useState<"summary" | "detail">("summary");

  const effective: CCIEState = state ?? {};
  const competitors = effective.competitors ?? [];

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

  const handleAnalyze = useCallback(
    (company: string) => {
      const msg = new TextMessage({
        content: `Analyze ${company}`,
        role: Role.User,
      });
      appendMessage(msg);
    },
    [appendMessage],
  );

  const handleSelect = useCallback((name: string | null) => {
    setSelected(name);
    setDetailMode("summary");
  }, []);

  return (
    <main style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden" }}>
      {/* Full-page 3D scene */}
      <WarRoom
        target={effective.target_company || ""}
        hypothetical={effective.is_hypothetical}
        competitors={sceneCompetitors}
        selected={selected}
        onSelect={handleSelect}
      />

      {/* Top bar: search + phase */}
      <div style={{ position: "absolute", top: 16, left: 16, right: 16, pointerEvents: "none", zIndex: 20 }}>
        <PhaseBar
          phase={effective.phase}
          target={effective.target_company}
          competitorCount={competitors.length}
          running={running}
          onAnalyze={handleAnalyze}
        />
      </div>

      {/* Bottom agent activity strip */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, pointerEvents: "none", zIndex: 20 }}>
        <ActivityFeed activity={effective.agent_activity} phase={effective.phase} />
      </div>

      {/* Right detail panel */}
      <div style={{ position: "absolute", top: 92, right: 16, bottom: 140, pointerEvents: "none", zIndex: 100 }}>
        <DetailPanel
          competitor={selectedCompetitor}
          onClose={() => handleSelect(null)}
          mode={detailMode}
          onToggleMode={() => setDetailMode((m) => (m === "summary" ? "detail" : "summary"))}
        />
      </div>

      {/* Empty hint */}
      {!effective.target_company && !running && (
        <div
          style={{
            position: "absolute",
            top: "45%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            color: "#94a3b8",
            textAlign: "center",
            pointerEvents: "none",
            zIndex: 10,
          }}
        >
          <div style={{
            background: "rgba(15,23,42,0.75)",
            backdropFilter: "blur(8px)",
            padding: "20px 32px",
            borderRadius: 12,
            border: "1px solid rgba(148,163,184,0.15)",
          }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#e2e8f0", marginBottom: 6 }}>
              CCIE War Room
            </div>
            <div style={{ fontSize: 13, color: "#94a3b8" }}>
              Enter a company name above to transform this skyline into your competitive landscape.
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
