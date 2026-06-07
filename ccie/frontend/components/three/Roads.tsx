"use client";

import { useMemo } from "react";

interface Props {
  positions: [number, number][];
}

/**
 * Sidewalk patches around each competitor building — light concrete pads
 * that frame the lots on the city blocks.
 */
export function Roads({ positions }: Props) {
  const pads = useMemo(
    () => positions.map(([x, z]) => ({ x, z })),
    [positions],
  );

  return (
    <group>
      {pads.map((p, i) => (
        <mesh
          key={i}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[p.x, 0.018, p.z]}
          receiveShadow
        >
          <planeGeometry args={[7.5, 7.5]} />
          <meshStandardMaterial color="#e2ddd3" roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}
