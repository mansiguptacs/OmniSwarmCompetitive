"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";

type Vec3 = [number, number, number];

interface Props {
  from: Vec3;
  to: Vec3;
  color: string;
  active: boolean;
}

/** A link between an agent node and its competitor, with a data packet that
 *  streams along it while the agent is actively running. */
export function ConnectionLine({ from, to, color, active }: Props) {
  const packetRef = useRef<THREE.Mesh>(null);
  const start = useMemo(() => new THREE.Vector3(...from), [from]);
  const end = useMemo(() => new THREE.Vector3(...to), [to]);

  useFrame((state) => {
    const mesh = packetRef.current;
    if (!mesh) return;
    mesh.visible = active;
    if (active) {
      const t = (state.clock.elapsedTime * 0.8) % 1;
      mesh.position.lerpVectors(start, end, t);
    }
  });

  return (
    <group>
      <Line
        points={[from, to]}
        color={color}
        lineWidth={active ? 2 : 1}
        transparent
        opacity={active ? 0.9 : 0.25}
        dashed={!active}
        dashSize={0.35}
        gapSize={0.25}
      />
      <mesh ref={packetRef} visible={false}>
        <sphereGeometry args={[0.18, 10, 10]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.6} />
      </mesh>
    </group>
  );
}
