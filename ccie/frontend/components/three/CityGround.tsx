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
  const waterWidth = extent * 3.5;
  return (
    <group>
      {/* Main bay — north */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, extent + 25]} receiveShadow>
        <planeGeometry args={[waterWidth, 60]} />
        <meshStandardMaterial color="#2e86c1" roughness={0.3} metalness={0.15} transparent opacity={0.85} />
      </mesh>
      {/* East waterfront */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[extent + 20, -0.05, 10]} receiveShadow>
        <planeGeometry args={[50, waterWidth * 0.7]} />
        <meshStandardMaterial color="#3090cc" roughness={0.3} metalness={0.15} transparent opacity={0.8} />
      </mesh>
      {/* Sandy shoreline */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, extent + 0.5]}>
        <planeGeometry args={[waterWidth, 3]} />
        <meshStandardMaterial color="#c2b280" roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[extent + 0.5, -0.01, 10]}>
        <planeGeometry args={[2.5, waterWidth * 0.6]} />
        <meshStandardMaterial color="#c2b280" roughness={0.95} />
      </mesh>
    </group>
  );
}

/* ── Parks ────────────────────────────────────────────────────── */

function Parks({ gridRadius }: { gridRadius: number }) {
  const rand = mulberry32(999);
  const parkCount = Math.max(16, gridRadius * 3);
  const parks: { x: number; z: number; w: number; d: number }[] = [];

  for (let i = 0; i < parkCount; i++) {
    const gx = Math.floor((rand() - 0.5) * gridRadius * 2);
    const gz = Math.floor((rand() - 0.5) * gridRadius * 2);
    if (Math.abs(gx) <= 1 && Math.abs(gz) <= 1) continue;
    parks.push({
      x: gx * CELL + (rand() - 0.5) * 3,
      z: gz * CELL + (rand() - 0.5) * 3,
      w: 5 + rand() * 7,
      d: 5 + rand() * 7,
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

/* ── Small city artifacts (fountains, plazas, benches) ──────── */

function CityArtifacts({ gridRadius }: { gridRadius: number }) {
  const rand = mulberry32(555);
  const items = useMemo(() => {
    const out: { x: number; z: number; type: "fountain" | "plaza" | "bench" | "monument" }[] = [];
    for (let i = 0; i < 18; i++) {
      const gx = Math.floor((rand() - 0.5) * gridRadius * 2);
      const gz = Math.floor((rand() - 0.5) * gridRadius * 2);
      if (Math.abs(gx) <= 1 && Math.abs(gz) <= 1) continue;
      const types = ["fountain", "plaza", "bench", "monument"] as const;
      out.push({
        x: gx * CELL + (rand() - 0.5) * 4,
        z: gz * CELL + (rand() - 0.5) * 4,
        type: types[Math.floor(rand() * types.length)],
      });
    }
    return out;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridRadius]);

  return (
    <group>
      {items.map((item, i) => {
        if (item.type === "fountain") {
          return (
            <group key={i} position={[item.x, 0, item.z]}>
              <mesh position={[0, 0.15, 0]}>
                <cylinderGeometry args={[1.2, 1.4, 0.3, 16]} />
                <meshStandardMaterial color="#b0c4d8" roughness={0.3} metalness={0.2} />
              </mesh>
              <mesh position={[0, 0.6, 0]}>
                <cylinderGeometry args={[0.2, 0.3, 0.8, 8]} />
                <meshStandardMaterial color="#c8d8e8" roughness={0.4} metalness={0.3} />
              </mesh>
              <mesh position={[0, 1.1, 0]}>
                <sphereGeometry args={[0.25, 8, 8]} />
                <meshStandardMaterial color="#88bbdd" roughness={0.2} metalness={0.4} transparent opacity={0.7} />
              </mesh>
            </group>
          );
        }
        if (item.type === "plaza") {
          return (
            <group key={i}>
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[item.x, 0.025, item.z]}>
                <circleGeometry args={[2.5, 24]} />
                <meshStandardMaterial color="#d0c8b8" roughness={0.85} />
              </mesh>
              {[0, 1.57, 3.14, 4.71].map((angle, j) => (
                <mesh key={j} position={[item.x + Math.cos(angle) * 1.8, 0.25, item.z + Math.sin(angle) * 1.8]}>
                  <boxGeometry args={[0.8, 0.35, 0.3]} />
                  <meshStandardMaterial color="#8a7a6a" roughness={0.8} />
                </mesh>
              ))}
            </group>
          );
        }
        if (item.type === "monument") {
          return (
            <group key={i} position={[item.x, 0, item.z]}>
              <mesh position={[0, 0.4, 0]}>
                <boxGeometry args={[1.2, 0.8, 1.2]} />
                <meshStandardMaterial color="#c0b8a8" roughness={0.6} metalness={0.15} />
              </mesh>
              <mesh position={[0, 1.6, 0]} castShadow>
                <cylinderGeometry args={[0.15, 0.2, 2, 8]} />
                <meshStandardMaterial color="#d8d0c0" roughness={0.5} metalness={0.2} />
              </mesh>
              <mesh position={[0, 2.7, 0]}>
                <sphereGeometry args={[0.2, 8, 8]} />
                <meshStandardMaterial color="#d0c8b0" roughness={0.4} metalness={0.3} />
              </mesh>
            </group>
          );
        }
        return (
          <group key={i} position={[item.x, 0, item.z]}>
            <mesh position={[0, 0.2, 0]}>
              <boxGeometry args={[1.2, 0.35, 0.35]} />
              <meshStandardMaterial color="#7a8a70" roughness={0.8} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/* ── Main export ─────────────────────────────────────────────── */

export function CityGround({ active, competitorCount = 0, occupiedLots }: Props) {
  const gridRadius = Math.max(5, Math.ceil(Math.sqrt(Math.max(competitorCount, 4) + 1)) + 2);
  const groundSize = (gridRadius + 2) * CELL * 2 + 40;
  const occupied = occupiedLots ?? new Set<string>();

  return (
    <group>
      {/* Ground terrain — extended to prevent white edges */}
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
      <CityArtifacts gridRadius={gridRadius} />
      <BayWater extent={gridRadius * CELL} />
    </group>
  );
}
