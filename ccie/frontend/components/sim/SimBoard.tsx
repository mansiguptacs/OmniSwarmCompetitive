"use client";

import { Suspense, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  ContactShadows,
  Html,
  Line,
  OrbitControls,
  OrthographicCamera,
} from "@react-three/drei";
import * as THREE from "three";
import type { CompanyBoardPosition, SimulationState } from "@/types/simulation";
import {
  alliancePairs,
  companyPositions,
  currentBoard,
  positionHeight,
  pressureColor,
  threatWidth,
} from "@/lib/simVisuals";

const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);

function Ground() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 0]}>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color="#0a1020" metalness={0.2} roughness={0.9} />
      </mesh>
      <gridHelper args={[120, 40, "#1e293b", "#141c2e"]} position={[0, 0.02, 0]} />
    </group>
  );
}

function IncumbentBuilding({
  company,
  position,
  selected,
  onSelect,
}: {
  company: CompanyBoardPosition;
  position: [number, number];
  selected: boolean;
  onSelect: (name: string) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const progress = useRef(0);
  const [hovered, setHovered] = useState(false);

  const height = positionHeight(company.market_position);
  const width = threatWidth(company.threat);
  const color = pressureColor(company.pressure);

  useFrame((state, delta) => {
    progress.current = Math.min(1, progress.current + delta * 1.6);
    const p = easeOutCubic(progress.current);
    if (meshRef.current) {
      meshRef.current.scale.set(1, Math.max(0.001, p), 1);
      meshRef.current.position.y = (height * p) / 2;
    }
    if (matRef.current) {
      matRef.current.emissiveIntensity = selected ? 0.6 : hovered ? 0.4 : 0.14;
    }
  });

  return (
    <group
      position={[position[0], 0, position[1]]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(company.name);
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
          emissiveIntensity={0.14}
          metalness={0.4}
          roughness={0.4}
        />
      </mesh>
      {(selected || hovered) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
          <ringGeometry args={[width * 0.8, width, 40]} />
          <meshBasicMaterial color={selected ? "#22d3ee" : "#64748b"} transparent opacity={0.9} />
        </mesh>
      )}
      <Html position={[0, height + 1.2, 0]} center zIndexRange={[10, 0]}>
        <div className="label-chip">{company.name}</div>
      </Html>
    </group>
  );
}

function PlayerTower({ name, onClick }: { name: string; onClick?: () => void }) {
  const beaconRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  useFrame((state) => {
    if (beaconRef.current) {
      beaconRef.current.rotation.y = state.clock.elapsedTime * 0.8;
    }
  });
  const height = 16;
  return (
    <group
      position={[0, 0, 0]}
      onClick={
        onClick
          ? (e) => {
              e.stopPropagation();
              onClick();
            }
          : undefined
      }
      onPointerOver={(e) => {
        if (!onClick) return;
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "auto";
      }}
    >
      <mesh castShadow receiveShadow position={[0, height / 2, 0]}>
        <boxGeometry args={[3.4, height, 3.4]} />
        <meshStandardMaterial color="#f5c451" emissive="#b8860b" emissiveIntensity={hovered ? 0.75 : 0.4} metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh ref={beaconRef} position={[0, height + 1.3, 0]}>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#fff6cf" emissive="#f5c451" emissiveIntensity={1.2} />
      </mesh>
      <Html position={[0, height + 3.2, 0]} center zIndexRange={[20, 0]}>
        <div className="label-chip" style={{ background: "#f5c451", color: "#1a1205" }}>
          {name} (you){onClick ? " · replay" : ""}
        </div>
      </Html>
    </group>
  );
}

function TargetBuilding({ name }: { name: string }) {
  return (
    <group position={[6, 0, 6]}>
      <mesh castShadow receiveShadow position={[0, 2, 0]}>
        <boxGeometry args={[2, 4, 2]} />
        <meshStandardMaterial color="#22d3ee" emissive="#0891b2" emissiveIntensity={0.5} metalness={0.4} roughness={0.4} />
      </mesh>
      <Html position={[0, 5.4, 0]} center zIndexRange={[15, 0]}>
        <div className="label-chip" style={{ background: "#0e7490", color: "#e0f2fe" }}>
          🎯 {name}
        </div>
      </Html>
    </group>
  );
}

function AllianceLines({
  pairs,
  positions,
}: {
  pairs: [string, string][];
  positions: Record<string, [number, number]>;
}) {
  return (
    <>
      {pairs.map(([a, b], i) => {
        const pa = positions[a];
        const pb = positions[b];
        if (!pa || !pb) return null;
        return (
          <Line
            key={`${a}-${b}-${i}`}
            points={[
              [pa[0], 1.5, pa[1]],
              [pb[0], 1.5, pb[1]],
            ]}
            color="#a78bfa"
            lineWidth={2}
            dashed
            dashSize={1.2}
            gapSize={0.6}
          />
        );
      })}
    </>
  );
}

export function SimBoard({
  state,
  selected,
  onSelect,
  onPlayerClick,
}: {
  state: SimulationState | null;
  selected: string | null;
  onSelect: (name: string | null) => void;
  onPlayerClick?: () => void;
}) {
  const board = currentBoard(state);
  const positions = useMemo(() => companyPositions(board), [board]);
  const pairs = useMemo(() => alliancePairs(board), [board]);
  const companies = board?.companies ?? [];
  const playerName = state?.player?.company || "Acquirer";
  const targetName = state?.target?.name || "";

  return (
    <Canvas shadows dpr={[1, 2]} gl={{ antialias: true }} onPointerMissed={() => onSelect(null)}>
      <color attach="background" args={["#060912"]} />
      <fog attach="fog" args={["#060912", 70, 140]} />
      <OrthographicCamera makeDefault position={[40, 34, 40]} zoom={15} near={-400} far={800} />
      <OrbitControls
        enablePan
        enableDamping
        dampingFactor={0.08}
        minZoom={8}
        maxZoom={60}
        maxPolarAngle={Math.PI / 2.2}
        target={[0, 3, 0]}
      />
      <ambientLight intensity={0.55} />
      <hemisphereLight args={["#bcd3ff", "#0a0e17", 0.5]} />
      <directionalLight
        position={[28, 40, 16]}
        intensity={1.3}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
      />

      <Suspense fallback={null}>
        <Ground />
        <PlayerTower name={playerName} onClick={onPlayerClick} />
        {targetName && <TargetBuilding name={targetName} />}
        <AllianceLines pairs={pairs} positions={positions} />
        {companies.map((c) => (
          <IncumbentBuilding
            key={c.name}
            company={c}
            position={positions[c.name] ?? [0, 0]}
            selected={selected === c.name}
            onSelect={onSelect}
          />
        ))}
        <ContactShadows position={[0, 0.01, 0]} opacity={0.4} scale={90} blur={2.2} far={20} />
      </Suspense>
    </Canvas>
  );
}
