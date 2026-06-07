"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { SimulationState } from "@/types/simulation";
import {
  advanceSimulation,
  forkSimulation,
  getSimulation,
  startSimulation,
} from "@/lib/simApi";
import { currentBoard } from "@/lib/simVisuals";
import {
  BranchPanel,
  CompanyInspector,
  DecisionPanel,
  LiveSignals,
  PlayerStatus,
  ReactionsFeed,
  SetupForm,
  Timeline,
} from "@/components/sim/panels";
import { ReplayModal } from "@/components/sim/ReplayModal";

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

const SESSION_KEY = "ccie_sim_session";

function rememberSession(sessionId: string | undefined) {
  if (typeof window === "undefined" || !sessionId) return;
  try {
    localStorage.setItem(SESSION_KEY, sessionId);
  } catch {}
  const url = new URL(window.location.href);
  url.searchParams.set("s", sessionId);
  window.history.replaceState(null, "", url.toString());
}

function forgetSession() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {}
  const url = new URL(window.location.href);
  url.searchParams.delete("s");
  window.history.replaceState(null, "", url.toString());
}

export default function SimulatePage() {
  const [state, setState] = useState<SimulationState | null>(null);
  const [loading, setLoading] = useState(false);
  const [resuming, setResuming] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [branchFrom, setBranchFrom] = useState<number | null>(null);
  const [showReplay, setShowReplay] = useState(false);

  // Resume an in-progress session from the URL (?s=) or localStorage on load.
  useEffect(() => {
    let cancelled = false;
    const fromUrl = new URLSearchParams(window.location.search).get("s");
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(SESSION_KEY);
    } catch {}
    const sessionId = fromUrl || stored;
    if (!sessionId) {
      setResuming(false);
      return;
    }
    (async () => {
      try {
        const resumed = await getSimulation(sessionId);
        if (!cancelled) {
          setState(resumed);
          rememberSession(resumed.session_id);
        }
      } catch {
        if (!cancelled) forgetSession();
      } finally {
        if (!cancelled) setResuming(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleStart = useCallback(async (target: string, player: string, maxIterations: number) => {
    setLoading(true);
    setError(null);
    try {
      const next = await startSimulation({ target, player, max_iterations: maxIterations, max_incumbents: 5 });
      setState(next);
      rememberSession(next.session_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleNewGame = useCallback(() => {
    forgetSession();
    setState(null);
    setSelected(null);
    setBranchFrom(null);
    setError(null);
  }, []);

  const handleChoose = useCallback(
    async (choice: string) => {
      if (!state?.session_id) return;
      setLoading(true);
      setError(null);
      try {
        const next = await advanceSimulation(state.session_id, choice);
        setState(next);
        rememberSession(next.session_id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to advance");
      } finally {
        setLoading(false);
      }
    },
    [state?.session_id],
  );

  const handleBranch = useCallback(
    async (choice: string) => {
      if (!state?.session_id || branchFrom == null) return;
      setLoading(true);
      setError(null);
      try {
        const next = await forkSimulation(state.session_id, branchFrom, choice);
        setState(next);
        rememberSession(next.session_id);
        setBranchFrom(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to branch");
      } finally {
        setLoading(false);
      }
    },
    [state?.session_id, branchFrom],
  );

  const board = useMemo(() => currentBoard(state), [state]);
  const lastIteration = state?.iterations?.[state.iterations.length - 1] ?? null;

  return (
    <main style={{ position: "relative", height: "100vh", width: "100vw", overflow: "hidden" }}>
      <SimBoard
        state={state}
        selected={selected}
        onSelect={setSelected}
        onPlayerClick={state ? () => setShowReplay(true) : undefined}
      />

      {/* Top bar */}
      <div style={{ position: "absolute", top: 16, left: 16, right: 16, display: "flex", justifyContent: "space-between", gap: 12, pointerEvents: "none" }}>
        <div className="glass" style={{ padding: "8px 14px", pointerEvents: "auto" }}>
          <Link href="/" style={{ textDecoration: "none", color: "#9ca3af", fontSize: 13 }}>
            ← Competitive Intelligence
          </Link>
          <span style={{ margin: "0 10px", color: "#334155" }}>|</span>
          <span style={{ fontWeight: 700, fontSize: 14 }}>War-Game Simulator</span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {state && <Timeline state={state} onBranchFrom={(t) => setBranchFrom(t)} />}
          {state && (
            <button
              onClick={() => setShowReplay(true)}
              className="glass"
              style={{ padding: "8px 14px", pointerEvents: "auto", color: "#f5c451", fontSize: 13, cursor: "pointer", fontWeight: 700 }}
            >
              ▷ Replay
            </button>
          )}
          {state && (
            <button
              onClick={handleNewGame}
              className="glass"
              style={{ padding: "8px 14px", pointerEvents: "auto", color: "#cbd5e1", fontSize: 13, cursor: "pointer", fontWeight: 600 }}
            >
              New game
            </button>
          )}
        </div>
      </div>

      {/* Resuming an existing session */}
      {!state && resuming && (
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", color: "#64748b", fontSize: 14 }}>
          Resuming your session…
        </div>
      )}

      {/* Setup (pre-game) */}
      {!state && !resuming && (
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
          <div style={{ position: "absolute", top: 78, left: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            {board && (
              <PlayerStatus
                board={board}
                player={state.player?.company || "You"}
                score={lastIteration?.score}
              />
            )}
            {lastIteration?.grounding && <LiveSignals grounding={lastIteration.grounding} />}
          </div>

          <div style={{ position: "absolute", bottom: 16, left: 16 }}>
            {lastIteration && <ReactionsFeed iteration={lastIteration} />}
          </div>

          <div style={{ position: "absolute", top: 78, right: 16 }}>
            {branchFrom != null ? (
              <BranchPanel
                state={state}
                fromTurn={branchFrom}
                onBranch={handleBranch}
                onCancel={() => setBranchFrom(null)}
                loading={loading}
              />
            ) : (
              <DecisionPanel state={state} onChoose={handleChoose} loading={loading} />
            )}
          </div>

          {selected && (
            <div style={{ position: "absolute", bottom: 16, right: 16 }}>
              <CompanyInspector name={selected} state={state} onClose={() => setSelected(null)} />
            </div>
          )}

          {error && (
            <div className="glass" style={{ position: "absolute", bottom: 16, right: 16, padding: 12, color: "#ef4444", fontSize: 13, pointerEvents: "auto", maxWidth: 360, marginBottom: selected ? 0 : 0 }}>
              {error}
            </div>
          )}
        </>
      )}

      {showReplay && state?.session_id && (
        <ReplayModal sessionId={state.session_id} onClose={() => setShowReplay(false)} />
      )}
    </main>
  );
}
