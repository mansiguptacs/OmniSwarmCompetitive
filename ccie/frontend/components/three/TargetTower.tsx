"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";

interface Props {
  name: string;
  hypothetical?: boolean;
}

export function TargetTower({ name, hypothetical }: Props) {
  const beaconRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (beaconRef.current) {
      const t = state.clock.elapsedTime;
      beaconRef.current.rotation.y = t * 0.6;
      const mat = beaconRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.8 + Math.sin(t * 2) * 0.3;
    }
  });

  const accent = hypothetical ? "#a855f7" : "#f5d142";

  return (
    <group position={[0, 0, 0]}>
      {/* Plaza */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
        <circleGeometry args={[5, 48]} />
        <meshStandardMaterial color="#13203a" roughness={0.8} />
      </mesh>

      {/* Main tower */}
      <mesh position={[0, 8, 0]} castShadow>
        <boxGeometry args={[3, 16, 3]} />
        <meshStandardMaterial
          color="#e2e8f0"
          emissive={accent}
          emissiveIntensity={0.18}
          metalness={0.6}
          roughness={0.25}
        />
      </mesh>

      {/* Crown */}
      <mesh position={[0, 16.6, 0]} castShadow>
        <boxGeometry args={[2, 1.4, 2]} />
        <meshStandardMaterial color="#f8fafc" metalness={0.7} roughness={0.2} />
      </mesh>

      {/* Beacon */}
      <mesh ref={beaconRef} position={[0, 18, 0]}>
        <octahedronGeometry args={[0.8, 0]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1} />
      </mesh>

      <Html position={[0, 20, 0]} center zIndexRange={[20, 0]}>
        <div
          className="label-chip"
          style={{
            color: "#0b1120",
            background: accent,
            fontSize: 12,
            padding: "4px 12px",
          }}
        >
          {name || "Target"} {hypothetical ? "(hypothetical)" : ""}
        </div>
      </Html>
    </group>
  );
}
