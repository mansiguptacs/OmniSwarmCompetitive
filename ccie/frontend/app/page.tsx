"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useCoAgent, useCopilotChat } from "@copilotkit/react-core";
import { TextMessage, Role } from "@copilotkit/runtime-client-gql";
import type { CCIEState, Competitor } from "@/types/ccie";
import { deriveAgents } from "@/lib/visuals";
import { PhaseBar } from "@/components/ui/PhaseBar";
import { ActivityFeed } from "@/components/ui/ActivityFeed";
import { DetailPanel } from "@/components/ui/DetailPanel";
import { AnalysisToast } from "@/components/ui/AnalysisToast";
import { SimOverlay } from "@/components/ui/SimOverlay";
import { SimHUD } from "@/components/ui/SimHUD";
import { SimPhaseBanner } from "@/components/ui/SimPhaseBanner";
import type { SimulationState, AgentReaction, SimulationIteration } from "@/types/simulation";

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
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#0b1120",
        gap: 16,
      }}
    >
      <div style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        animation: "pulse-glow 2s infinite",
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      </div>
      <div style={{ color: "#64748b", fontSize: 13, fontWeight: 500 }}>
        Constructing landscape...
      </div>
    </div>
  );
}

export default function HomePage() {
  const { state, running } = useCoAgent<CCIEState>({ name: "ccie_agent" });
  const { appendMessage } = useCopilotChat();
  const [selected, setSelected] = useState<string | null>(null);
  const [detailMode, setDetailMode] = useState<"summary" | "detail">("summary");
  const [showSim, setShowSim] = useState(false);
  const [simState, setSimState] = useState<SimulationState | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const simChooseRef = useRef<(choice: string) => void>(() => {});

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

  const simReactions = useMemo<AgentReaction[]>(() => {
    if (!simState?.iterations?.length) return [];
    const last = simState.iterations[simState.iterations.length - 1];
    return last.reactions ?? [];
  }, [simState]);

  const simLastIteration = useMemo<SimulationIteration | null>(() => {
    if (!simState?.iterations?.length) return null;
    return simState.iterations[simState.iterations.length - 1];
  }, [simState]);

  const simActive = showSim && !!simState && !simLoading && (simState.iterations?.length ?? 0) > 0;

  return (
    <main style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden" }}>
      {/* Full-page 3D scene */}
      <WarRoom
        target={effective.target_company || ""}
        hypothetical={effective.is_hypothetical}
        competitors={sceneCompetitors}
        selected={selected}
        onSelect={handleSelect}
        simReactions={simReactions}
        simMode={simActive}
      />

      {/* Top bar: search + phase */}
      <div style={{ position: "absolute", top: 16, left: 16, right: 16, pointerEvents: "none", zIndex: 20 }}>
        <PhaseBar
          phase={effective.phase}
          target={effective.target_company}
          competitorCount={competitors.length}
          running={running}
          onAnalyze={handleAnalyze}
          onSimulate={() => setShowSim(true)}
        />
      </div>

      {/* Per-company analysis toasts — hidden during sim */}
      {!simActive && (
        <AnalysisToast competitors={competitors} activity={effective.agent_activity} phase={effective.phase} />
      )}

      {/* Bottom agent activity strip — hidden during sim */}
      {!simActive && (
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, pointerEvents: "none", zIndex: 20 }}>
          <ActivityFeed activity={effective.agent_activity} phase={effective.phase} />
        </div>
      )}

      {/* Right detail panel */}
      <div style={{ position: "absolute", top: 92, right: 16, bottom: 140, pointerEvents: "none", zIndex: 100 }}>
        <DetailPanel
          competitor={selectedCompetitor}
          onClose={() => handleSelect(null)}
          mode={detailMode}
          onToggleMode={() => setDetailMode((m) => (m === "summary" ? "detail" : "summary"))}
        />
      </div>

      {/* M&A War-Game Simulation */}
      {showSim && effective.target_company && (
        <SimOverlay
          targetCompany={effective.target_company}
          competitors={competitors.map((c) => c.name)}
          onClose={() => { setShowSim(false); setSimState(null); }}
          onStateChange={setSimState}
          onLoadingChange={setSimLoading}
          onChooseReady={(fn) => { simChooseRef.current = fn; }}
        />
      )}

      {/* Phase results banner — floats over city, not at bottom */}
      {simActive && simLastIteration && (
        <SimPhaseBanner
          iteration={simLastIteration}
          phaseNum={simState!.iterations!.length}
          maxPhases={simState!.max_iterations ?? 5}
          targetCompany={effective.target_company || ""}
        />
      )}

      {/* Slim HUD — controls only (decisions expand upward) */}
      {showSim && simState && (simState.status === "awaiting_choice" || simState.status === "complete" || (simState.iterations?.length ?? 0) > 0) && (
        <SimHUD
          state={simState}
          loading={simLoading}
          onChoose={(choice) => simChooseRef.current(choice)}
          onClose={() => { setShowSim(false); setSimState(null); }}
        />
      )}

      {/* Landing — bottom strip, city stays fully visible */}
      {!effective.target_company && !running && (
        <div style={{
          position: "absolute",
          bottom: 0, left: 0, right: 0,
          pointerEvents: "none",
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          animation: "fadeInUp 0.6s ease",
        }}>
          {/* Gradient fade so city bleeds into the strip naturally */}
          <div style={{
            width: "100%", height: 80,
            background: "linear-gradient(to bottom, transparent, rgba(8,12,21,0.85))",
          }} />
          <div style={{
            width: "100%",
            background: "rgba(8,12,21,0.85)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            padding: "0 32px 36px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}>
            <h1 style={{
              margin: "0 0 6px",
              fontSize: 28,
              fontWeight: 800,
              color: "#f1f5f9",
              letterSpacing: "-0.03em",
              lineHeight: 1.2,
              textAlign: "center",
            }}>
              <span style={{ background: "linear-gradient(90deg, #3b82f6, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                StrategyOS
              </span>
            </h1>

            <p style={{
              margin: "0 0 20px",
              fontSize: 14,
              color: "#94a3b8",
              lineHeight: 1.6,
              textAlign: "center",
              maxWidth: 460,
            }}>
              Enter a company name above to map its competitive landscape in real time.
            </p>

            <div style={{ display: "flex", gap: 32, justifyContent: "center" }}>
              {[
                { icon: "🔍", label: "Discover", desc: "Identify competitors" },
                { icon: "📊", label: "Analyze", desc: "Deep intelligence" },
                { icon: "📈", label: "Simulate", desc: "M&A scenarios" },
              ].map((item) => (
                <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 16 }}>{item.icon}</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>{item.label}</div>
                    <div style={{ fontSize: 10, color: "#64748b" }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: 999, background: "#22c55e", animation: "pulse-glow 2s infinite" }} />
              <span style={{ fontSize: 11, color: "#64748b" }}>AI agents ready</span>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
