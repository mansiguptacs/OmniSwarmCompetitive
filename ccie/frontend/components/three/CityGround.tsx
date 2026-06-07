"use client";

import { useMemo } from "react";
import { Grid } from "@react-three/drei";

/** Deterministic pseudo-random so SSR/CSR trees match. */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Tree {
  x: number;
  z: number;
  s: number;
}

function Trees({ count, minR }: { count: number; minR: number }) {
  const trees = useMemo<Tree[]>(() => {
    const rand = mulberry32(42);
    const out: Tree[] = [];
    let guard = 0;
    while (out.length < count && guard < count * 8) {
      guard++;
      const x = (rand() - 0.5) * 62;
      const z = (rand() - 0.5) * 62;
      const r = Math.hypot(x, z);
      if (r < minR || r > 32) continue;
      out.push({ x, z, s: 0.5 + rand() * 0.9 });
    }
    return out;
  }, [count, minR]);

  return (
    <group>
      {trees.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]} scale={t.s}>
          <mesh position={[0, 0.35, 0]} castShadow>
            <cylinderGeometry args={[0.08, 0.1, 0.7, 6]} />
            <meshStandardMaterial color="#6b4f2a" />
          </mesh>
          <mesh position={[0, 0.95, 0]} castShadow>
            <icosahedronGeometry args={[0.45, 0]} />
            <meshStandardMaterial color="#2f9e57" flatShading />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function CityGround({ active }: { active: boolean }) {
  return (
    <group>
      {/* Base plate — greenland when idle, dark city plate when active */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial
          color={active ? "#0e1626" : "#16331f"}
          roughness={1}
          metalness={0}
        />
      </mesh>

      {/* Road grid only once a city exists */}
      {active && (
        <Grid
          position={[0, 0, 0]}
          args={[80, 80]}
          cellSize={2}
          cellThickness={0.6}
          cellColor="#1e293b"
          sectionSize={10}
          sectionThickness={1.1}
          sectionColor="#2b6cb0"
          fadeDistance={70}
          fadeStrength={1.5}
          infiniteGrid={false}
        />
      )}

      <Trees count={active ? 60 : 120} minR={active ? 7 : 3} />
    </group>
  );
}
