"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  ContactShadows,
  OrbitControls,
  OrthographicCamera,
  Sky,
} from "@react-three/drei";
import type { Competitor } from "@/types/ccie";
import type { AgentReaction } from "@/types/simulation";
import { competitorPosition, threatToHeight } from "@/lib/visuals";
import { buildReactionMap } from "@/lib/simMatch";
import { CityGround } from "./CityGround";
import { CompetitorBuilding } from "./CompetitorBuilding";
import { TargetTower } from "./TargetTower";
import { Roads } from "./Roads";
import { AgentCluster } from "./AgentCluster";
import { SFLandmarks } from "./SFLandmarks";
import { SFCompanyLabels } from "./SFCompanyLabels";
import { SimEffects } from "./SimEffects";

const ZOOM_IDLE = 15;
const ZOOM_ACTIVE = 12;

function CameraZoomController({ active }: { active: boolean }) {
  const { camera } = useThree();
  const targetZoom = active ? ZOOM_ACTIVE : ZOOM_IDLE;
  const prevActive = useRef(active);
  const animating = useRef(false);

  useEffect(() => {
    if (prevActive.current !== active) {
      prevActive.current = active;
      animating.current = true;
    }
  }, [active]);

  useFrame((_, delta) => {
    if (!animating.current) return;
    const diff = targetZoom - camera.zoom;
    if (Math.abs(diff) < 0.05) {
      camera.zoom = targetZoom;
      camera.updateProjectionMatrix();
      animating.current = false;
    } else {
      camera.zoom += diff * Math.min(1, delta * 1.8);
      camera.updateProjectionMatrix();
    }
  });

  return null;
}

interface Props {
  target: string;
  hypothetical?: boolean;
  competitors: Competitor[];
  selected: string | null;
  onSelect: (name: string | null) => void;
  simReactions?: AgentReaction[];
  simMode?: boolean;
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

export function WarRoom({ target, hypothetical, competitors, selected, onSelect, simReactions, simMode }: Props) {
  const hasTarget = target.trim().length > 0;

  const threatRanks = useMemo(() => {
    const indexed = competitors.map((c, i) => ({ i, threat: c.threat_level ?? 0.5 }));
    indexed.sort((a, b) => b.threat - a.threat);
    const rank = new Array<number>(competitors.length);
    indexed.forEach((entry, spiralSlot) => { rank[entry.i] = spiralSlot; });
    return rank;
  }, [competitors]);

  const positions = useMemo<[number, number][]>(
    () =>
      competitors.map((c, i) =>
        competitorPosition(threatRanks[i], competitors.length, c.market_overlap),
      ),
    [competitors, threatRanks],
  );

  const occupiedLots = useMemo(() => buildOccupiedSet(positions), [positions]);
  const competitorNames = useMemo(() => competitors.map(c => c.name), [competitors]);

  const simPositionMap = useMemo(() => {
    const m = new Map<string, [number, number]>();
    competitors.forEach((c, i) => { if (positions[i]) m.set(c.name, positions[i]); });
    return m;
  }, [competitors, positions]);

  const simHeightMap = useMemo(() => {
    const m = new Map<string, number>();
    competitors.forEach((c) => m.set(c.name, threatToHeight(c.threat_level)));
    return m;
  }, [competitors]);

  const simIntensityMap = useMemo(() => {
    const m = new Map<string, number>();
    if (simReactions) {
      for (const r of simReactions) m.set(r.actor, r.intensity ?? 0.5);
    }
    return m;
  }, [simReactions]);

  const simReactionMap = useMemo(() => {
    if (!simReactions?.length) return new Map<string, AgentReaction>();
    return buildReactionMap(simReactions, competitorNames);
  }, [simReactions, competitorNames]);

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

      <fog attach="fog" args={["#e0ecf8", 140, 320]} />

      <OrthographicCamera makeDefault position={[60, 48, 60]} zoom={ZOOM_IDLE} near={-400} far={800} />
      <CameraZoomController active={hasTarget} />
      <OrbitControls
        enablePan
        enableDamping
        dampingFactor={0.08}
        minZoom={4}
        maxZoom={50}
        maxPolarAngle={Math.PI / 2.2}
        target={[0, 4, 0]}
        autoRotate
        autoRotateSpeed={0.3}
      />

      <ambientLight intensity={0.85} color="#fffaf0" />
      <hemisphereLight args={["#87ceeb", "#a0d468", 0.65]} />
      <directionalLight
        position={[50, 65, 40]}
        intensity={2.2}
        color="#fff5e0"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-120}
        shadow-camera-right={120}
        shadow-camera-top={120}
        shadow-camera-bottom={-120}
      />
      <directionalLight position={[-20, 30, -10]} intensity={0.45} color="#b3d4fc" />

      <Suspense fallback={null}>
        {/* City is always visible — skyline in idle, shrinks when data arrives */}
        <CityGround
          active={hasTarget}
          competitorCount={competitors.length}
          occupiedLots={occupiedLots}
        />

        <SFLandmarks />
        {!simMode && <SFCompanyLabels active={hasTarget} competitorNames={competitorNames} />}

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
              simIntensity={simReactionMap.get(c.name)?.intensity ?? simIntensityMap.get(c.name)}
              simReaction={simReactionMap.get(c.name)}
            />
          ))}

        {hasTarget &&
          competitors.map((c, i) =>
            c.agents?.length ? (
              <AgentCluster key={`${c.name}-agents`} competitor={c} position={positions[i]} />
            ) : null,
          )}

        {simReactions && simReactions.length > 0 && (
          <SimEffects
            reactions={simReactions}
            positions={simPositionMap}
            competitorNames={competitorNames}
            mappedReactions={simReactionMap}
            buildingHeights={simHeightMap}
          />
        )}

        <ContactShadows
          position={[0, 0.01, 0]}
          opacity={0.25}
          scale={180}
          blur={2.5}
          far={30}
          color="#4a5568"
        />
      </Suspense>
    </Canvas>
  );
}
