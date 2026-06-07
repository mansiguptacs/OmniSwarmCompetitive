"use client";

import { useMemo } from "react";

interface Props {
  positions: [number, number][];
  plazaRadius?: number;
}

/**
 * Roads radiating from the central plaza out to each competitor building,
 * plus a ring road around the plaza. Evokes the connected-city reference.
 */
export function Roads({ positions, plazaRadius = 5 }: Props) {
  const roads = useMemo(
    () =>
      positions.map(([x, z]) => {
        const len = Math.hypot(x, z);
        const angle = -Math.atan2(z, x);
        return { len, angle, midX: x / 2, midZ: z / 2 };
      }),
    [positions],
  );

  return (
    <group>
      {/* Ring road around the plaza */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[plazaRadius - 0.6, plazaRadius, 64]} />
        <meshStandardMaterial color="#27324a" roughness={0.9} />
      </mesh>

      {roads.map((r, i) => (
        <group key={i} position={[r.midX, 0.03, r.midZ]} rotation={[0, r.angle, 0]}>
          {/* Asphalt */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[r.len, 1.4]} />
            <meshStandardMaterial color="#1b2436" roughness={0.95} />
          </mesh>
          {/* Center line (dashed look via emissive thin strip) */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
            <planeGeometry args={[r.len * 0.92, 0.12]} />
            <meshStandardMaterial
              color="#3b82f6"
              emissive="#3b82f6"
              emissiveIntensity={0.5}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
