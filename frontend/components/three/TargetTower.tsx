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
  const bodyRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (beaconRef.current) {
      beaconRef.current.rotation.y = t * 0.6;
      const mat = beaconRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.8 + Math.sin(t * 2) * 0.3;
    }
    if (bodyRef.current) {
      bodyRef.current.emissiveIntensity = 0.12 + Math.sin(t * 1.5) * 0.04;
    }
  });

  const accent = hypothetical ? "#9b59b6" : "#f39c12";

  return (
    <group position={[0, 0, 0]}>
      {/* Plaza pad */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]} receiveShadow>
        <planeGeometry args={[9, 9]} />
        <meshStandardMaterial color="#d4cbb8" roughness={0.85} />
      </mesh>

      {/* Crosswalk stripes */}
      {[-2, -1, 0, 1, 2].map((offset, i) => (
        <mesh key={`cw-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[offset * 0.9, 0.03, 4.8]}>
          <planeGeometry args={[0.5, 1.4]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
      ))}

      {/* Main tower — bold golden/purple */}
      <mesh position={[0, 10, 0]} castShadow>
        <boxGeometry args={[3.6, 20, 3.6]} />
        <meshStandardMaterial
          ref={bodyRef}
          color="#2c5f8a"
          emissive={accent}
          emissiveIntensity={0.08}
          metalness={0.4}
          roughness={0.3}
        />
      </mesh>

      {/* Accent bands on tower */}
      {[4, 8, 12, 16].map((y, i) => (
        <mesh key={`band-${i}`} position={[0, y, 1.81]}>
          <planeGeometry args={[3.6, 0.4]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.3} />
        </mesh>
      ))}

      {/* Stepped upper section */}
      <mesh position={[0, 17, 0]} castShadow>
        <boxGeometry args={[2.6, 8, 2.6]} />
        <meshStandardMaterial
          color="#3a6f9a"
          emissive={accent}
          emissiveIntensity={0.06}
          metalness={0.4}
          roughness={0.25}
        />
      </mesh>

      {/* Crown spire */}
      <mesh position={[0, 22, 0]} castShadow>
        <boxGeometry args={[1.4, 3, 1.4]} />
        <meshStandardMaterial color={accent} metalness={0.4} roughness={0.3} />
      </mesh>

      {/* Beacon */}
      <mesh ref={beaconRef} position={[0, 24, 0]}>
        <octahedronGeometry args={[0.9, 0]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1} />
      </mesh>

      {/* Glowing ground ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[4.5, 5.2, 64]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.6} transparent opacity={0.7} />
      </mesh>

      <Html position={[0, 26.5, 0]} center zIndexRange={[20, 0]}>
        <div style={{
          fontSize: 14,
          fontWeight: 800,
          color: "#ffffff",
          background: accent,
          padding: "5px 16px",
          borderRadius: 6,
          whiteSpace: "nowrap",
          boxShadow: "0 3px 12px rgba(0,0,0,0.25)",
          letterSpacing: "0.02em",
        }}>
          {name || "Target"} {hypothetical ? "(idea)" : ""}
        </div>
      </Html>
    </group>
  );
}
