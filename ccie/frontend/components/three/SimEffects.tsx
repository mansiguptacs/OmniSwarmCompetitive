"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import type { AgentReaction } from "@/types/simulation";
import { matchActorToName, unmappedReactions } from "@/lib/simMatch";
import { SimBuildingDecision } from "./SimBuildingDecision";
import { competitorPosition } from "@/lib/visuals";

/* ── Animated beam from competitor to center ─────────────────── */

function ReactionBeam({
  from,
  intensity,
  ally,
}: {
  from: [number, number];
  intensity: number;
  ally?: boolean;
}) {
  const color = ally
    ? "#a855f7"
    : intensity > 0.7
      ? "#ef4444"
      : intensity > 0.4
        ? "#f59e0b"
        : "#3b82f6";

  const points = useMemo(() => {
    const mid: [number, number, number] = [from[0] / 2, 8 + intensity * 10, from[1] / 2];
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(from[0], 2, from[1]),
      new THREE.Vector3(mid[0], mid[1], mid[2]),
      new THREE.Vector3(0, 4, 0),
    );
    return curve.getPoints(40).map((p) => [p.x, p.y, p.z] as [number, number, number]);
  }, [from, intensity]);

  return (
    <Line
      points={points}
      color={color}
      lineWidth={2}
      transparent
      opacity={0.5 + intensity * 0.35}
    />
  );
}

/* ── Pulsing ring at building base ───────────────────────────── */

function ReactionPulse({
  position,
  intensity,
}: {
  position: [number, number];
  intensity: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const color = intensity > 0.7 ? "#ef4444" : intensity > 0.4 ? "#f59e0b" : "#3b82f6";

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    const scale = 1 + Math.sin(t * 3) * 0.15;
    ref.current.scale.set(scale, scale, 1);
    (ref.current.material as THREE.MeshBasicMaterial).opacity =
      0.3 + Math.sin(t * 2.5) * 0.15;
  });

  return (
    <mesh
      ref={ref}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[position[0], 0.06, position[1]]}
    >
      <ringGeometry args={[3.5, 5, 32]} />
      <meshBasicMaterial color={color} transparent opacity={0.35} side={THREE.DoubleSide} />
    </mesh>
  );
}

/* ── Main SimEffects group (beams + pulses only; cards live on buildings) ── */

interface SimEffectsProps {
  reactions: AgentReaction[];
  positions: Map<string, [number, number]>;
  competitorNames: string[];
  mappedReactions: Map<string, AgentReaction>;
  buildingHeights: Map<string, number>;
}

function resolvePosition(
  actor: string,
  positions: Map<string, [number, number]>,
  competitorNames: string[],
): [number, number] | null {
  if (positions.has(actor)) return positions.get(actor)!;
  const matched = matchActorToName(actor, competitorNames);
  if (matched && positions.has(matched)) return positions.get(matched)!;
  return null;
}

function fallbackPosition(index: number): [number, number] {
  return competitorPosition(index + 20, 40, 0.5);
}

export function SimEffects({
  reactions,
  positions,
  competitorNames,
  mappedReactions,
  buildingHeights,
}: SimEffectsProps) {
  if (reactions.length === 0) return null;

  const orphans = unmappedReactions(reactions, mappedReactions);

  return (
    <group>
      {reactions.map((r) => {
        const pos = resolvePosition(r.actor, positions, competitorNames);
        if (!pos) return null;
        const hasAlly = (r.ally_with?.length ?? 0) > 0;

        return (
          <group key={`beam-${r.actor}`}>
            <ReactionBeam from={pos} intensity={r.intensity ?? 0.5} ally={hasAlly} />
            <ReactionPulse position={pos} intensity={r.intensity ?? 0.5} />
          </group>
        );
      })}

      {orphans.map((r, i) => {
        const pos = resolvePosition(r.actor, positions, competitorNames) ?? fallbackPosition(i);
        const matched = matchActorToName(r.actor, competitorNames);
        const height = matched ? (buildingHeights.get(matched) ?? 8) : 8;
        return (
          <group key={`orphan-${r.actor}`} position={[pos[0], 0, pos[1]]}>
            <ReactionPulse position={[0, 0]} intensity={r.intensity ?? 0.5} />
            <SimBuildingDecision
              reaction={r}
              buildingHeight={height}
              companyName={r.actor}
            />
          </group>
        );
      })}
    </group>
  );
}
