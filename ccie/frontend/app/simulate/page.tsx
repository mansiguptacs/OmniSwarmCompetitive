"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { SimulationState } from "@/types/simulation";
import { advanceSimulation, startSimulation } from "@/lib/simApi";
import { currentBoard } from "@/lib/simVisuals";
import {
  DecisionPanel,
  PlayerStatus,
  ReactionsFeed,
  SetupForm,
  Timeline,
} from "@/components/sim/panels";

const SimBoard = dynamic(() => import("@/components/sim/SimBoard").then((m) => m.SimBoard), {
  ssr: false,
  loading: () => <SceneLoading />,
});

function SceneLoading() {
  return (
    <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#64748b" }}>
      Building the board…
    </div>
  );
}

export default function SimulatePage() {
  const [state, setState] = useState<SimulationState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const handleStart = useCallback(async (target: string, player: string, maxIterations: number) => {
    setLoading(true);
    setError(null);
    try {
      const next = await startSimulation({ target, player, max_iterations: maxIterations, max_incumbents: 5 });
      setState(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChoose = useCallback(
    async (choice: string) => {
      if (!state?.session_id) return;
      setLoading(true);
      setError(null);
      try {
        const next = await advanceSimulation(state.session_id, choice);
        setState(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to advance");
      } finally {
        setLoading(false);
      }
    },
    [state?.session_id],
  );

  const board = useMemo(() => currentBoard(state), [state]);
  const lastIteration = state?.iterations?.[state.iterations.length - 1] ?? null;

  return (
    <main style={{ position: "relative", height: "100vh", width: "100vw", overflow: "hidden" }}>
      <SimBoard state={state} selected={selected} onSelect={setSelected} />

      {/* Top bar */}
      <div style={{ position: "absolute", top: 16, left: 16, right: 16, display: "flex", justifyContent: "space-between", gap: 12, pointerEvents: "none" }}>
        <div className="glass" style={{ padding: "8px 14px", pointerEvents: "auto" }}>
          <Link href="/" style={{ textDecoration: "none", color: "#9ca3af", fontSize: 13 }}>
            ← Competitive Intelligence
          </Link>
          <span style={{ margin: "0 10px", color: "#334155" }}>|</span>
          <span style={{ fontWeight: 700, fontSize: 14 }}>War-Game Simulator</span>
        </div>
        {state && <Timeline state={state} />}
      </div>

      {/* Setup (pre-game) */}
      {!state && (
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}>
          <SetupForm onStart={handleStart} loading={loading} />
          {error && (
            <div className="glass" style={{ marginTop: 12, padding: 12, color: "#ef4444", fontSize: 13, pointerEvents: "auto" }}>
              {error}
            </div>
          )}
        </div>
      )}

      {/* In-game overlays */}
      {state && (
        <>
          <div style={{ position: "absolute", top: 78, left: 16 }}>
            {board && <PlayerStatus board={board} player={state.player?.company || "You"} />}
          </div>

          <div style={{ position: "absolute", bottom: 16, left: 16 }}>
            {lastIteration && <ReactionsFeed iteration={lastIteration} />}
          </div>

          <div style={{ position: "absolute", top: 78, right: 16 }}>
            <DecisionPanel state={state} onChoose={handleChoose} loading={loading} />
          </div>

          {error && (
            <div className="glass" style={{ position: "absolute", bottom: 16, right: 16, padding: 12, color: "#ef4444", fontSize: 13, pointerEvents: "auto", maxWidth: 360 }}>
              {error}
            </div>
          )}
        </>
      )}
    </main>
  );
}
