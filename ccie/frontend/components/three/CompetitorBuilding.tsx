"use client";

import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, Sparkles } from "@react-three/drei";
import * as THREE from "three";
import type { Competitor } from "@/types/ccie";
import { sentimentColor, sizeToWidth, threatToHeight } from "@/lib/visuals";

const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);

interface Props {
  competitor: Competitor;
  position: [number, number];
  selected: boolean;
  onSelect: (name: string) => void;
}

export function CompetitorBuilding({ competitor, position, selected, onSelect }: Props) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const progress = useRef(0);
  const [hovered, setHovered] = useState(false);

  const height = threatToHeight(competitor.threat_level);
  const width = sizeToWidth(competitor.market_size);
  const color = sentimentColor(competitor.sentiment);
  const analyzing = competitor.status === "analyzing";
  const discovering = competitor.status === "discovering";

  useFrame((state, delta) => {
    // Animate the building rising from the ground.
    progress.current = Math.min(1, progress.current + delta * 1.3);
    const p = easeOutCubic(progress.current);
    if (meshRef.current) {
      meshRef.current.scale.set(1, Math.max(0.001, p), 1);
      meshRef.current.position.y = (height * p) / 2;
    }
    // Glow: pulse while analyzing, steady highlight when selected/hovered.
    if (matRef.current) {
      const base = selected ? 0.55 : hovered ? 0.4 : 0.1;
      const pulse = analyzing
        ? 0.35 + Math.sin(state.clock.elapsedTime * 4) * 0.25
        : 0;
      matRef.current.emissiveIntensity = base + pulse;
      matRef.current.opacity = discovering ? 0.55 : 1;
    }
  });

  return (
    <group
      position={[position[0], 0, position[1]]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(competitor.name);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "auto";
      }}
    >
      <mesh ref={meshRef} castShadow receiveShadow>
        <boxGeometry args={[width, height, width]} />
        <meshStandardMaterial
          ref={matRef}
          color={color}
          emissive={color}
          emissiveIntensity={0.1}
          metalness={0.35}
          roughness={0.45}
          transparent
        />
      </mesh>

      {/* Selection ring on the ground */}
      {(selected || hovered) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
          <ringGeometry args={[width * 0.75, width * 0.95, 40]} />
          <meshBasicMaterial color={selected ? "#22d3ee" : "#64748b"} transparent opacity={0.9} />
        </mesh>
      )}

      {analyzing && (
        <Sparkles
          count={18}
          scale={[width * 1.4, height * 1.3, width * 1.4]}
          position={[0, height * 0.6, 0]}
          size={3}
          speed={0.6}
          color="#67e8f9"
        />
      )}

      <Html position={[0, height + 1.1, 0]} center zIndexRange={[10, 0]}>
        <div className="label-chip">{competitor.name}</div>
      </Html>
    </group>
  );
}
