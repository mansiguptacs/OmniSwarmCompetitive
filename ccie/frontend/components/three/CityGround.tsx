"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const BLOCK = 9;
const STREET = 2.8;
const CELL = BLOCK + STREET;

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── Animated filler building ────────────────────────────────── */

const FILLER_COLORS = [
  "#ddd5c8", "#d8cfc2", "#dbd0c0",
  "#ccd5d8", "#c8d0d6", "#c5cdd4",
  "#d6d0c0", "#d2ccbc",
  "#d0d6cc", "#ccd4c8",
  "#dcd2c8", "#d5ccc0",
  "#c8ccd5", "#d0c8cc",
];

interface FillerDef {
  x: number;
  z: number;
  w: number;
  skylineH: number;
  shrunkH: number;
  d: number;
  color: string;
}

function AnimatedFiller({ def, shrink }: { def: FillerDef; shrink: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  const targetH = shrink ? def.shrunkH : def.skylineH;

  useFrame((_, delta) => {
    if (!ref.current) return;
    const cur = ref.current.scale.y;
    const diff = targetH / def.skylineH - cur;
    if (Math.abs(diff) > 0.001) {
      const next = cur + diff * Math.min(1, delta * 2.5);
      ref.current.scale.y = next;
      ref.current.position.y = (def.skylineH * next) / 2;
    }
  });

  return (
    <mesh
      ref={ref}
      position={[def.x, def.skylineH / 2, def.z]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[def.w, def.skylineH, def.d]} />
      <meshStandardMaterial color={def.color} roughness={0.85} metalness={0.02} />
    </mesh>
  );
}

function FillerBuildings({
  gridRadius,
  occupiedSet,
  shrink,
}: {
  gridRadius: number;
  occupiedSet: Set<string>;
  shrink: boolean;
}) {
  const buildings = useMemo<FillerDef[]>(() => {
    const rand = mulberry32(777);
    const out: FillerDef[] = [];

    for (let gx = -gridRadius; gx <= gridRadius; gx++) {
      for (let gz = -gridRadius; gz <= gridRadius; gz++) {
        if (gx === 0 && gz === 0) continue;

        const cx = gx * CELL;
        const cz = gz * CELL;
        const dist = Math.hypot(cx, cz);
        if (dist > (gridRadius + 0.5) * CELL) continue;

        const isOccupied = occupiedSet.has(`${gx},${gz}`);
        const count = 1 + Math.floor(rand() * 3);

        for (let b = 0; b < count; b++) {
          const w = 1.0 + rand() * 2.0;
          const d = 1.0 + rand() * 2.0;
          const distFactor = 1 - Math.min(dist / ((gridRadius + 1) * CELL), 1);
          const skylineH = 2.5 + rand() * 8.0 + distFactor * 6.0;
          const shrunkH = isOccupied ? 0.3 + rand() * 0.5 : 0.8 + rand() * 3.5;
          const ox = (rand() - 0.5) * (BLOCK - w - 0.4);
          const oz = (rand() - 0.5) * (BLOCK - d - 0.4);
          out.push({
            x: cx + ox,
            z: cz + oz,
            w,
            skylineH,
            shrunkH,
            d,
            color: FILLER_COLORS[Math.floor(rand() * FILLER_COLORS.length)],
          });
        }
      }
    }
    return out;
  }, [gridRadius, occupiedSet]);

  return (
    <group>
      {buildings.map((b, i) => (
        <AnimatedFiller key={i} def={b} shrink={shrink} />
      ))}
    </group>
  );
}

/* ── Street grid ─────────────────────────────────────────────── */

function StreetGrid({ gridRadius }: { gridRadius: number }) {
  const extent = (gridRadius + 0.5) * CELL + STREET;

  const streets = useMemo(() => {
    const lines: { x: number; z: number; w: number; d: number; main: boolean }[] = [];
    for (let i = -gridRadius; i <= gridRadius; i++) {
      const pos = i * CELL;
      lines.push({ x: pos, z: 0, w: STREET, d: extent * 2, main: i === 0 });
      lines.push({ x: 0, z: pos, w: extent * 2, d: STREET, main: i === 0 });
    }
    return lines;
  }, [gridRadius, extent]);

  return (
    <group>
      {streets.map((s, i) => (
        <group key={i}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[s.x, 0.015, s.z]} receiveShadow>
            <planeGeometry args={[s.w, s.d]} />
            <meshStandardMaterial color="#9e9688" roughness={0.92} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[s.x, 0.02, s.z]}>
            <planeGeometry args={[0.1, s.d * 0.92]} />
            <meshStandardMaterial color={s.main ? "#e8b830" : "#ffffff"} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ── SF Bay water ────────────────────────────────────────────── */

function BayWater({ extent }: { extent: number }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, extent + 15]} receiveShadow>
        <planeGeometry args={[extent * 3, 40]} />
        <meshStandardMaterial
          color="#2e86c1"
          roughness={0.3}
          metalness={0.15}
          transparent
          opacity={0.85}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, extent + 0.5]}>
        <planeGeometry args={[extent * 3, 3]} />
        <meshStandardMaterial color="#c2b280" roughness={0.95} />
      </mesh>
    </group>
  );
}

/* ── Parks ────────────────────────────────────────────────────── */

function Parks({ gridRadius }: { gridRadius: number }) {
  const rand = mulberry32(999);
  const parks: { x: number; z: number; w: number; d: number }[] = [];

  for (let i = 0; i < 12; i++) {
    const gx = Math.floor((rand() - 0.5) * gridRadius * 2);
    const gz = Math.floor((rand() - 0.5) * gridRadius * 2);
    if (Math.abs(gx) <= 1 && Math.abs(gz) <= 1) continue;
    parks.push({
      x: gx * CELL + (rand() - 0.5) * 3,
      z: gz * CELL + (rand() - 0.5) * 3,
      w: 5 + rand() * 6,
      d: 5 + rand() * 6,
    });
  }

  return (
    <group>
      {parks.map((p, i) => (
        <group key={i}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[p.x, 0.02, p.z]}>
            <planeGeometry args={[p.w, p.d]} />
            <meshStandardMaterial color="#6aaa5e" roughness={0.95} />
          </mesh>
          {Array.from({ length: 4 + Math.floor(rand() * 5) }).map((_, j) => {
            const tx = p.x + (rand() - 0.5) * p.w * 0.7;
            const tz = p.z + (rand() - 0.5) * p.d * 0.7;
            const s = 0.5 + rand() * 0.6;
            return (
              <group key={j} position={[tx, 0, tz]} scale={s}>
                <mesh position={[0, 0.5, 0]} castShadow>
                  <cylinderGeometry args={[0.08, 0.12, 1, 6]} />
                  <meshStandardMaterial color="#8b6b4a" />
                </mesh>
                <mesh position={[0, 1.2, 0]} castShadow>
                  <sphereGeometry args={[0.55, 8, 8]} />
                  <meshStandardMaterial color="#3d8c4f" roughness={0.9} />
                </mesh>
              </group>
            );
          })}
        </group>
      ))}
    </group>
  );
}

/* ── Main export ─────────────────────────────────────────────── */

interface Props {
  active: boolean;
  competitorCount?: number;
  occupiedLots?: Set<string>;
}

export function CityGround({ active, competitorCount = 0, occupiedLots }: Props) {
  const gridRadius = Math.max(3, Math.ceil(Math.sqrt(Math.max(competitorCount, 4) + 1)) + 1);
  const groundSize = (gridRadius + 1) * CELL * 2 + 20;
  const occupied = occupiedLots ?? new Set<string>();

  return (
    <group>
      {/* Ground terrain — always sandy city ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[groundSize, groundSize]} />
        <meshStandardMaterial color="#e8e2d6" roughness={0.95} metalness={0} />
      </mesh>

      <StreetGrid gridRadius={gridRadius} />
      <FillerBuildings
        gridRadius={gridRadius}
        occupiedSet={occupied}
        shrink={active}
      />
      <Parks gridRadius={gridRadius} />
      <BayWater extent={gridRadius * CELL} />
    </group>
  );
}
