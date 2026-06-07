"use client";

import { useRef, useState, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, Sparkles } from "@react-three/drei";
import * as THREE from "three";
import type { Competitor } from "@/types/ccie";
import type { AgentReaction } from "@/types/simulation";
import { sizeToWidth, threatToHeight, clamp01 } from "@/lib/visuals";
import { SimBuildingDecision } from "./SimBuildingDecision";

const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);

function seededHash(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function buildingColor(threat: number, hash: number): string {
  const t = clamp01(threat);
  const palettes = [
    ["#6b5b7b", "#7a6888", "#5e5070", "#846e94", "#705e80"],
    ["#4a7a8a", "#588898", "#3e6e7e", "#5088a0", "#467686"],
    ["#7a7858", "#888660", "#6e6c50", "#929068", "#686646"],
    ["#5a7a6a", "#688878", "#4e6e5e", "#6a8c78", "#567264"],
  ];

  let group: string[];
  if (t >= 0.75) group = palettes[0];
  else if (t >= 0.55) group = palettes[1];
  else if (t >= 0.35) group = palettes[2];
  else group = palettes[3];

  return group[hash % group.length];
}

function windowColor(threat: number): string {
  const t = clamp01(threat);
  if (t >= 0.75) return "#d8d0e0";
  if (t >= 0.55) return "#c8dce4";
  if (t >= 0.35) return "#dcdcc8";
  return "#c8dcd0";
}

function targetScale(status?: string): number {
  if (status === "complete") return 1;
  if (status === "analyzing") return 0.35;
  return 0.08;
}

interface Props {
  competitor: Competitor;
  position: [number, number];
  selected: boolean;
  onSelect: (name: string) => void;
  simIntensity?: number;
  simReaction?: AgentReaction;
}

export function CompetitorBuilding({ competitor, position, selected, onSelect, simIntensity, simReaction }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const currentScale = useRef(0.001);
  const [hovered, setHovered] = useState(false);

  const height = threatToHeight(competitor.threat_level);
  const width = sizeToWidth(competitor.market_size);
  const analyzing = competitor.status === "analyzing";
  const discovering = competitor.status === "discovering";
  const complete = competitor.status === "complete";

  const hash = seededHash(competitor.name);
  const variant = hash % 5;
  const color = buildingColor(competitor.threat_level ?? 0.5, hash);
  const winColor = windowColor(competitor.threat_level ?? 0.5);

  const goal = targetScale(competitor.status);
  const lerpSpeed = complete ? 1.8 : analyzing ? 2.5 : 3.0;

  const windowRows = useMemo(() => {
    const rows: number[] = [];
    const count = Math.floor(height / 1.8);
    for (let i = 1; i < count; i++) rows.push(i * 1.8);
    return rows;
  }, [height]);

  useFrame((state, delta) => {
    const diff = goal - currentScale.current;
    if (Math.abs(diff) > 0.001) {
      currentScale.current += diff * Math.min(1, delta * lerpSpeed);
    } else {
      currentScale.current = goal;
    }

    const s = easeOutCubic(clamp01(currentScale.current));
    const simBoost = simIntensity ? 1 + simIntensity * 0.15 : 1;

    if (groupRef.current) {
      groupRef.current.scale.set(1, Math.max(0.001, s) * simBoost, 1);
    }
    if (matRef.current) {
      const base = selected ? 0.15 : hovered ? 0.08 : 0.03;
      const pulse = analyzing ? 0.08 + Math.sin(state.clock.elapsedTime * 4) * 0.06 : 0;
      const riseGlow = complete && s < 0.95 ? 0.15 * (1 - s) : 0;
      const simGlow = simIntensity
        ? 0.12 + Math.sin(state.clock.elapsedTime * 2.5) * simIntensity * 0.15
        : 0;
      matRef.current.emissiveIntensity = base + pulse + riseGlow + simGlow;
      matRef.current.opacity = discovering ? 0.45 : 1;
    }
  });

  const topY = variant === 1 ? height * 0.85
    : variant === 3 ? height * 0.92
    : variant === 4 ? height * 0.8
    : height;

  return (
    <group
      position={[position[0], 0, position[1]]}
      onClick={(e) => { e.stopPropagation(); onSelect(competitor.name); }}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = "auto"; }}
    >
      <group ref={groupRef}>
        {variant === 0 && (
          <>
            <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[width, height, width]} />
              <meshStandardMaterial ref={matRef} color={color} emissive={color} emissiveIntensity={0.03} metalness={0.15} roughness={0.55} transparent />
            </mesh>
            <mesh position={[0, height + 0.08, 0]}>
              <boxGeometry args={[width + 0.12, 0.14, width + 0.12]} />
              <meshStandardMaterial color="#ecf0f1" roughness={0.6} />
            </mesh>
          </>
        )}

        {variant === 1 && (
          <>
            <mesh position={[0, height * 0.35, 0]} castShadow receiveShadow>
              <boxGeometry args={[width * 1.1, height * 0.7, width * 1.1]} />
              <meshStandardMaterial ref={matRef} color={color} emissive={color} emissiveIntensity={0.03} metalness={0.15} roughness={0.55} transparent />
            </mesh>
            <mesh position={[0, height * 0.7 + height * 0.15, 0]} castShadow>
              <boxGeometry args={[width * 0.7, height * 0.3, width * 0.7]} />
              <meshStandardMaterial color={color} metalness={0.2} roughness={0.45} transparent opacity={discovering ? 0.45 : 1} />
            </mesh>
            <mesh position={[0, height * 0.85 + 0.08, 0]}>
              <boxGeometry args={[width * 0.7 + 0.1, 0.14, width * 0.7 + 0.1]} />
              <meshStandardMaterial color="#ecf0f1" roughness={0.6} />
            </mesh>
          </>
        )}

        {variant === 2 && (
          <>
            <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[width * 0.45, width * 0.48, height, 16]} />
              <meshStandardMaterial ref={matRef} color={color} emissive={color} emissiveIntensity={0.03} metalness={0.2} roughness={0.45} transparent />
            </mesh>
            <mesh position={[0, height + 0.1, 0]}>
              <cylinderGeometry args={[width * 0.5, width * 0.5, 0.2, 16]} />
              <meshStandardMaterial color="#ecf0f1" roughness={0.6} />
            </mesh>
          </>
        )}

        {variant === 3 && (
          <>
            <mesh position={[0, height * 0.4, 0]} castShadow receiveShadow>
              <boxGeometry args={[width, height * 0.8, width]} />
              <meshStandardMaterial ref={matRef} color={color} emissive={color} emissiveIntensity={0.03} metalness={0.15} roughness={0.55} transparent />
            </mesh>
            <mesh position={[0, height * 0.8 + height * 0.12, 0]} castShadow>
              <coneGeometry args={[width * 0.55, height * 0.24, 4]} />
              <meshStandardMaterial color={color} metalness={0.3} roughness={0.4} transparent opacity={discovering ? 0.45 : 1} />
            </mesh>
          </>
        )}

        {variant === 4 && (
          <>
            <mesh position={[0, height * 0.3, 0]} castShadow receiveShadow>
              <boxGeometry args={[width * 1.15, height * 0.6, width]} />
              <meshStandardMaterial ref={matRef} color={color} emissive={color} emissiveIntensity={0.03} metalness={0.15} roughness={0.55} transparent />
            </mesh>
            <mesh position={[-width * 0.25, height * 0.6 + height * 0.2, 0]} castShadow>
              <boxGeometry args={[width * 0.45, height * 0.4, width * 0.6]} />
              <meshStandardMaterial color={color} metalness={0.2} roughness={0.5} transparent opacity={discovering ? 0.45 : 1} />
            </mesh>
            <mesh position={[width * 0.25, height * 0.6 + height * 0.15, 0]} castShadow>
              <boxGeometry args={[width * 0.45, height * 0.3, width * 0.6]} />
              <meshStandardMaterial color={color} metalness={0.2} roughness={0.5} transparent opacity={discovering ? 0.45 : 1} />
            </mesh>
            <mesh position={[0, height * 0.6 + 0.08, 0]}>
              <boxGeometry args={[width * 1.15 + 0.1, 0.14, width + 0.1]} />
              <meshStandardMaterial color="#ecf0f1" roughness={0.6} />
            </mesh>
          </>
        )}

        {/* Window bands */}
        {windowRows.map((y, i) => {
          const maxY = variant === 1 ? height * 0.68 : variant === 3 ? height * 0.78 : variant === 4 ? height * 0.58 : height;
          if (y > maxY) return null;
          const bw = variant === 2 ? width * 0.35 : width * 0.88;
          const op = discovering ? 0.2 : 0.8;
          const hw = width / 2 + 0.02;
          return (
            <group key={`win-${i}`}>
              <mesh position={[0, y, hw]}>
                <planeGeometry args={[bw, 0.25]} />
                <meshStandardMaterial color={winColor} transparent opacity={op} />
              </mesh>
              <mesh position={[0, y, -hw]} rotation={[0, Math.PI, 0]}>
                <planeGeometry args={[bw, 0.25]} />
                <meshStandardMaterial color={winColor} transparent opacity={op} />
              </mesh>
              <mesh position={[-hw, y, 0]} rotation={[0, -Math.PI / 2, 0]}>
                <planeGeometry args={[bw, 0.25]} />
                <meshStandardMaterial color={winColor} transparent opacity={op} />
              </mesh>
              <mesh position={[hw, y, 0]} rotation={[0, Math.PI / 2, 0]}>
                <planeGeometry args={[bw, 0.25]} />
                <meshStandardMaterial color={winColor} transparent opacity={op} />
              </mesh>
            </group>
          );
        })}
      </group>

      {/* Selection ring */}
      {(selected || hovered) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
          <ringGeometry args={[width * 0.7, width * 0.92, 40]} />
          <meshBasicMaterial color={selected ? "#f1c40f" : "#bdc3c7"} transparent opacity={0.9} />
        </mesh>
      )}

      {/* Construction sparkles while analyzing */}
      {analyzing && (
        <Sparkles
          count={20}
          scale={[width * 1.5, height * 0.5, width * 1.5]}
          position={[0, height * 0.2, 0]}
          size={3}
          speed={0.8}
          color="#f1c40f"
        />
      )}

      {/* Completion burst — visible briefly as building rises */}
      {complete && currentScale.current < 0.9 && (
        <Sparkles
          count={30}
          scale={[width * 2, height * 1.2, width * 2]}
          position={[0, height * 0.5, 0]}
          size={4}
          speed={1.5}
          color="#22c55e"
        />
      )}

      {/* Simulation decision card replaces label during M&A sim */}
      {simReaction ? (
        <SimBuildingDecision
          reaction={simReaction}
          buildingHeight={topY}
          companyName={competitor.name}
        />
      ) : (
        <Html
          position={[0, topY + 1.5, 0]}
          center
          zIndexRange={[1, 0]}
          style={{ pointerEvents: "auto" }}
        >
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            fontSize: 11,
            fontWeight: 700,
            color: "#2c3e50",
            background: complete
              ? "rgba(255,255,255,0.95)"
              : "rgba(255,255,255,0.7)",
            padding: "3px 10px",
            borderRadius: 4,
            whiteSpace: "nowrap",
            boxShadow: complete
              ? "0 2px 8px rgba(0,0,0,0.2)"
              : "0 1px 4px rgba(0,0,0,0.1)",
            borderLeft: `3px solid ${complete ? color : "#94a3b8"}`,
            opacity: discovering ? 0.6 : 1,
            transition: "all 0.3s",
          }}>
            <span style={{
              width: 18,
              height: 18,
              borderRadius: 4,
              background: complete ? color : "#94a3b8",
              color: "#fff",
              fontSize: 10,
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}>
              {competitor.name.charAt(0)}
            </span>
            {competitor.name}
            {analyzing && (
              <span style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: "#f59e0b",
                animation: "pulse-glow 1.5s infinite",
                flexShrink: 0,
              }} />
            )}
          </div>
        </Html>
      )}
    </group>
  );
}
