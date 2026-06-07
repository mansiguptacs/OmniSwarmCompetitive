"use client";

import { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import {
  ContactShadows,
  OrbitControls,
  OrthographicCamera,
} from "@react-three/drei";
import type { Competitor } from "@/types/ccie";
import { competitorPosition } from "@/lib/visuals";
import { CityGround } from "./CityGround";
import { CompetitorBuilding } from "./CompetitorBuilding";
import { TargetTower } from "./TargetTower";
import { Roads } from "./Roads";
import { AgentCluster } from "./AgentCluster";

interface Props {
  target: string;
  hypothetical?: boolean;
  competitors: Competitor[];
  selected: string | null;
  onSelect: (name: string | null) => void;
}

export function WarRoom({ target, hypothetical, competitors, selected, onSelect }: Props) {
  const hasTarget = target.trim().length > 0;

  const positions = useMemo<[number, number][]>(
    () =>
      competitors.map((c, i) =>
        competitorPosition(i, competitors.length, c.market_overlap),
      ),
    [competitors],
  );

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true }}
      onPointerMissed={() => onSelect(null)}
    >
      <color attach="background" args={["#060912"]} />
      <fog attach="fog" args={["#060912", 60, 120]} />

      <OrthographicCamera makeDefault position={[34, 30, 34]} zoom={17} near={-300} far={600} />
      <OrbitControls
        enablePan
        enableDamping
        dampingFactor={0.08}
        minZoom={9}
        maxZoom={60}
        maxPolarAngle={Math.PI / 2.2}
        target={[0, 2, 0]}
      />

      <ambientLight intensity={0.55} />
      <hemisphereLight args={["#bcd3ff", "#0a0e17", 0.5]} />
      <directionalLight
        position={[24, 34, 12]}
        intensity={1.3}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
      />

      <Suspense fallback={null}>
        <CityGround active={hasTarget} />

        {hasTarget && positions.length > 0 && <Roads positions={positions} />}

        {hasTarget && <TargetTower name={target} hypothetical={hypothetical} />}

        {hasTarget &&
          competitors.map((c, i) => (
            <CompetitorBuilding
              key={c.name}
              competitor={c}
              position={positions[i]}
              selected={selected === c.name}
              onSelect={onSelect}
            />
          ))}

        {hasTarget &&
          competitors.map((c, i) =>
            c.agents?.length ? (
              <AgentCluster key={`${c.name}-agents`} competitor={c} position={positions[i]} />
            ) : null,
          )}

        <ContactShadows
          position={[0, 0.01, 0]}
          opacity={0.4}
          scale={80}
          blur={2.2}
          far={20}
        />
      </Suspense>
    </Canvas>
  );
}
