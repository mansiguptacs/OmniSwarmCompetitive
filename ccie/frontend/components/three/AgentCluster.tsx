"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { AgentNode, AgentRole, Competitor } from "@/types/ccie";
import { sizeToWidth, threatToHeight } from "@/lib/visuals";
import { ConnectionLine } from "./ConnectionLine";

const ROLE_COLOR: Record<AgentRole, string> = {
  "News Scout": "#60a5fa",
  "Product Tracker": "#34d399",
  "Financial Analyst": "#f59e0b",
};

function AgentBuilding({
  pos,
  height,
  color,
  status,
}: {
  pos: [number, number];
  height: number;
  color: string;
  status: AgentNode["status"];
}) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame((state) => {
    if (!matRef.current) return;
    if (status === "running") {
      matRef.current.emissiveIntensity = 0.6 + Math.sin(state.clock.elapsedTime * 6) * 0.4;
    } else {
      matRef.current.emissiveIntensity = status === "done" ? 0.3 : 0.08;
    }
  });

  return (
    <mesh position={[pos[0], height / 2, pos[1]]} castShadow>
      <boxGeometry args={[0.9, height, 0.9]} />
      <meshStandardMaterial
        ref={matRef}
        color={color}
        emissive={color}
        emissiveIntensity={0.1}
        metalness={0.3}
        roughness={0.5}
        transparent
        opacity={status === "idle" ? 0.5 : 1}
      />
    </mesh>
  );
}

interface Props {
  competitor: Competitor;
  position: [number, number];
}

/** Renders our analysis agents (small buildings) around a competitor, each
 *  wired back to the competitor building with a live connection. */
export function AgentCluster({ competitor, position }: Props) {
  const agents = competitor.agents ?? [];
  if (agents.length === 0) return null;

  const w = sizeToWidth(competitor.market_size);
  const h = threatToHeight(competitor.threat_level);
  const [cx, cz] = position;
  const buildingPoint: [number, number, number] = [cx, h * 0.5, cz];

  // Fan the agent nodes out on the side facing away from the city center.
  const outward = Math.atan2(cz, cx);
  const ring = w / 2 + 2.2;

  return (
    <group>
      {agents.map((agent, i) => {
        const spread = (i - (agents.length - 1) / 2) * 0.7;
        const ang = outward + spread;
        const ax = cx + Math.cos(ang) * ring;
        const az = cz + Math.sin(ang) * ring;
        const color = ROLE_COLOR[agent.role];
        const ah = agent.status === "running" ? 2.4 : agent.status === "done" ? 2 : 1.3;
        const top: [number, number, number] = [ax, ah, az];

        return (
          <group key={agent.role}>
            <AgentBuilding pos={[ax, az]} height={ah} color={color} status={agent.status} />
            <ConnectionLine
              from={top}
              to={buildingPoint}
              color={color}
              active={agent.status === "running"}
            />
          </group>
        );
      })}
    </group>
  );
}
