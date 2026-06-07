"use client";

import { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import {
  ContactShadows,
  OrbitControls,
  OrthographicCamera,
  Sky,
} from "@react-three/drei";
import type { Competitor } from "@/types/ccie";
import { competitorPosition } from "@/lib/visuals";
import { CityGround } from "./CityGround";
import { CompetitorBuilding } from "./CompetitorBuilding";
import { TargetTower } from "./TargetTower";
import { Roads } from "./Roads";
import { AgentCluster } from "./AgentCluster";
import { SFLandmarks } from "./SFLandmarks";

interface Props {
  target: string;
  hypothetical?: boolean;
  competitors: Competitor[];
  selected: string | null;
  onSelect: (name: string | null) => void;
}

const CELL = 9 + 2.8;

function buildOccupiedSet(positions: [number, number][]): Set<string> {
  const set = new Set<string>();
  set.add("0,0");
  for (const [x, z] of positions) {
    const gx = Math.round(x / CELL);
    const gz = Math.round(z / CELL);
    set.add(`${gx},${gz}`);
  }
  return set;
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

  const occupiedLots = useMemo(() => buildOccupiedSet(positions), [positions]);

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true }}
      onPointerMissed={() => onSelect(null)}
    >
      <color attach="background" args={["#e8f0fa"]} />

      <Sky
        sunPosition={[80, 60, 40]}
        inclination={0.52}
        azimuth={0.25}
        turbidity={3}
        rayleigh={0.4}
      />

      <fog attach="fog" args={["#e0ecf8", 120, 250]} />

      <OrthographicCamera makeDefault position={[40, 36, 40]} zoom={14} near={-300} far={600} />
      <OrbitControls
        enablePan
        enableDamping
        dampingFactor={0.08}
        minZoom={6}
        maxZoom={60}
        maxPolarAngle={Math.PI / 2.2}
        target={[0, 4, 0]}
      />

      <ambientLight intensity={0.85} color="#fffaf0" />
      <hemisphereLight args={["#87ceeb", "#a0d468", 0.65]} />
      <directionalLight
        position={[40, 55, 30]}
        intensity={2.2}
        color="#fff5e0"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
      />
      <directionalLight position={[-20, 30, -10]} intensity={0.45} color="#b3d4fc" />

      <Suspense fallback={null}>
        <CityGround
          active={hasTarget}
          competitorCount={competitors.length}
          occupiedLots={occupiedLots}
        />

        {hasTarget && <SFLandmarks />}

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
          opacity={0.25}
          scale={120}
          blur={2.5}
          far={25}
          color="#4a5568"
        />
      </Suspense>
    </Canvas>
  );
}
