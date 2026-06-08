"use client";

import { Html } from "@react-three/drei";

/**
 * Iconic SF landmarks placed around the edges of the city grid
 * as decorative context — purely visual, not interactive.
 */

function GoldenGateBridge() {
  const towerH = 22;
  const deckY = 6;
  const span = 40;
  const z = 70;

  return (
    <group position={[0, 0, z]}>
      {/* Left tower */}
      <mesh position={[-span / 2, towerH / 2, 0]} castShadow>
        <boxGeometry args={[1.2, towerH, 1.2]} />
        <meshStandardMaterial color="#c0392b" roughness={0.6} metalness={0.3} />
      </mesh>
      {/* Right tower */}
      <mesh position={[span / 2, towerH / 2, 0]} castShadow>
        <boxGeometry args={[1.2, towerH, 1.2]} />
        <meshStandardMaterial color="#c0392b" roughness={0.6} metalness={0.3} />
      </mesh>

      {/* Tower cross-beams */}
      {[0.45, 0.7, 0.95].map((frac, i) => (
        <group key={`beam-${i}`}>
          <mesh position={[-span / 2, towerH * frac, 0]}>
            <boxGeometry args={[2.0, 0.3, 0.3]} />
            <meshStandardMaterial color="#c0392b" roughness={0.6} metalness={0.3} />
          </mesh>
          <mesh position={[span / 2, towerH * frac, 0]}>
            <boxGeometry args={[2.0, 0.3, 0.3]} />
            <meshStandardMaterial color="#c0392b" roughness={0.6} metalness={0.3} />
          </mesh>
        </group>
      ))}

      {/* Road deck */}
      <mesh position={[0, deckY, 0]} castShadow receiveShadow>
        <boxGeometry args={[span + 12, 0.5, 3.5]} />
        <meshStandardMaterial color="#a93226" roughness={0.7} metalness={0.2} />
      </mesh>

      {/* Main cables (simplified as thin boxes) */}
      {[-1, 1].map((side) => (
        <group key={`cable-${side}`}>
          {Array.from({ length: 8 }).map((_, i) => {
            const t = (i + 0.5) / 8;
            const x = -span / 2 + t * span;
            const sag = Math.sin(t * Math.PI) * 6;
            const cableY = towerH - sag;
            return (
              <mesh key={i} position={[x, cableY, side * 1.2]}>
                <boxGeometry args={[span / 8 + 0.5, 0.12, 0.12]} />
                <meshStandardMaterial color="#b03a2e" roughness={0.5} metalness={0.4} />
              </mesh>
            );
          })}
          {/* Suspender cables */}
          {Array.from({ length: 12 }).map((_, i) => {
            const t = (i + 0.5) / 12;
            const x = -span / 2 + t * span;
            const sag = Math.sin(t * Math.PI) * 6;
            const cableY = towerH - sag;
            const h = cableY - deckY;
            return (
              <mesh key={`sus-${i}`} position={[x, deckY + h / 2, side * 1.2]}>
                <boxGeometry args={[0.06, h, 0.06]} />
                <meshStandardMaterial color="#b03a2e" roughness={0.5} metalness={0.4} />
              </mesh>
            );
          })}
        </group>
      ))}

      <Html position={[0, towerH + 2, 0]} center zIndexRange={[1, 0]}>
        <div style={{
          fontSize: 10, color: "#c0392b", fontWeight: 700, whiteSpace: "nowrap",
          textShadow: "0 1px 3px rgba(255,255,255,0.8)",
        }}>
          Golden Gate Bridge
        </div>
      </Html>
    </group>
  );
}

function TransamericaPyramid() {
  return (
    <group position={[-55, 0, -20]}>
      {/* Pyramid body */}
      <mesh position={[0, 10, 0]} castShadow>
        <coneGeometry args={[3.5, 20, 4]} />
        <meshStandardMaterial color="#f5f0e8" roughness={0.4} metalness={0.2} />
      </mesh>
      {/* Spire */}
      <mesh position={[0, 21.5, 0]}>
        <coneGeometry args={[0.3, 5, 8]} />
        <meshStandardMaterial color="#e8e0d0" roughness={0.3} metalness={0.3} />
      </mesh>
      <Html position={[0, 25, 0]} center zIndexRange={[1, 0]}>
        <div style={{
          fontSize: 9, color: "#8b7355", fontWeight: 600, whiteSpace: "nowrap",
          textShadow: "0 1px 2px rgba(255,255,255,0.9)",
        }}>
          Transamerica Pyramid
        </div>
      </Html>
    </group>
  );
}

function CoitTower() {
  return (
    <group position={[55, 0, -40]}>
      {/* Hill */}
      <mesh position={[0, 1.5, 0]}>
        <sphereGeometry args={[5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#7cb06a" roughness={0.9} />
      </mesh>
      {/* Tower base */}
      <mesh position={[0, 6, 0]} castShadow>
        <cylinderGeometry args={[1.5, 1.8, 9, 12]} />
        <meshStandardMaterial color="#f0ece0" roughness={0.6} metalness={0.1} />
      </mesh>
      {/* Tower top */}
      <mesh position={[0, 11, 0]} castShadow>
        <cylinderGeometry args={[1.8, 1.5, 1.2, 12]} />
        <meshStandardMaterial color="#e5dfd0" roughness={0.5} metalness={0.15} />
      </mesh>
      <Html position={[0, 13, 0]} center zIndexRange={[1, 0]}>
        <div style={{
          fontSize: 9, color: "#6b7c5a", fontWeight: 600, whiteSpace: "nowrap",
          textShadow: "0 1px 2px rgba(255,255,255,0.9)",
        }}>
          Coit Tower
        </div>
      </Html>
    </group>
  );
}

function CableCar() {
  return (
    <group position={[15, 0, -50]}>
      {/* Track rails */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <planeGeometry args={[30, 0.8]} />
        <meshStandardMaterial color="#8a7a6a" roughness={0.8} />
      </mesh>
      {/* Rail lines */}
      {[-0.25, 0.25].map((offset, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, offset]}>
          <planeGeometry args={[30, 0.06]} />
          <meshStandardMaterial color="#a0a0a0" metalness={0.6} roughness={0.3} />
        </mesh>
      ))}
      {/* Cable car body */}
      <mesh position={[3, 1.1, 0]} castShadow>
        <boxGeometry args={[2.5, 1.8, 1.3]} />
        <meshStandardMaterial color="#cc4444" roughness={0.7} />
      </mesh>
      {/* Roof */}
      <mesh position={[3, 2.2, 0]}>
        <boxGeometry args={[2.8, 0.2, 1.5]} />
        <meshStandardMaterial color="#8b2020" roughness={0.6} />
      </mesh>
      <Html position={[3, 3.2, 0]} center zIndexRange={[1, 0]}>
        <div style={{
          fontSize: 8, color: "#cc4444", fontWeight: 600, whiteSpace: "nowrap",
          textShadow: "0 1px 2px rgba(255,255,255,0.9)",
        }}>
          Cable Car
        </div>
      </Html>
    </group>
  );
}

function PierSign() {
  return (
    <group position={[35, 0, 62]}>
      {/* Pier deck */}
      <mesh position={[0, 0.3, 0]} receiveShadow>
        <boxGeometry args={[14, 0.4, 6]} />
        <meshStandardMaterial color="#c4a97d" roughness={0.85} />
      </mesh>
      {/* Warehouse */}
      <mesh position={[0, 2.5, 0]} castShadow>
        <boxGeometry args={[10, 4, 4]} />
        <meshStandardMaterial color="#e8dcc8" roughness={0.8} />
      </mesh>
      {/* Roof */}
      <mesh position={[0, 4.8, 0]} castShadow>
        <boxGeometry args={[11, 0.6, 4.5]} />
        <meshStandardMaterial color="#a0785a" roughness={0.7} />
      </mesh>
      <Html position={[0, 6, 0]} center zIndexRange={[1, 0]}>
        <div style={{
          fontSize: 9, color: "#8b6f47", fontWeight: 600, whiteSpace: "nowrap",
          textShadow: "0 1px 2px rgba(255,255,255,0.9)",
        }}>
          Fisherman&apos;s Wharf
        </div>
      </Html>
    </group>
  );
}

/** Salesforce Tower — tallest building in SF skyline */
function SalesforceTower() {
  return (
    <group position={[-40, 0, 28]}>
      <mesh position={[0, 14, 0]} castShadow>
        <cylinderGeometry args={[2.2, 2.5, 28, 16]} />
        <meshStandardMaterial color="#b8c8d8" roughness={0.2} metalness={0.5} />
      </mesh>
      <mesh position={[0, 28.5, 0]}>
        <sphereGeometry args={[2.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#c0d0e0" roughness={0.15} metalness={0.6} />
      </mesh>
      <Html position={[0, 30, 0]} center zIndexRange={[1, 0]}>
        <div style={{ fontSize: 9, color: "#6888a8", fontWeight: 600, whiteSpace: "nowrap", textShadow: "0 1px 2px rgba(255,255,255,0.9)" }}>
          Salesforce Tower
        </div>
      </Html>
    </group>
  );
}

/** Painted Ladies — row of Victorian houses */
function PaintedLadies() {
  const colors = ["#e8a0a0", "#a0c8e8", "#b8e0a0", "#e8d0a0", "#c8a0d8"];
  return (
    <group position={[-58, 0, 18]}>
      {colors.map((c, i) => (
        <group key={i} position={[i * 2.8, 0, 0]}>
          <mesh position={[0, 1.5, 0]} castShadow>
            <boxGeometry args={[2.2, 3, 2]} />
            <meshStandardMaterial color={c} roughness={0.7} />
          </mesh>
          {/* Peaked roof */}
          <mesh position={[0, 3.5, 0]} castShadow>
            <coneGeometry args={[1.6, 1.5, 4]} />
            <meshStandardMaterial color="#5a4a3a" roughness={0.8} />
          </mesh>
          {/* Door */}
          <mesh position={[0, 0.6, 1.01]}>
            <planeGeometry args={[0.5, 1.2]} />
            <meshStandardMaterial color="#3a2a1a" />
          </mesh>
          {/* Windows */}
          <mesh position={[-0.5, 2, 1.01]}>
            <planeGeometry args={[0.4, 0.5]} />
            <meshStandardMaterial color="#a0d0f0" transparent opacity={0.8} />
          </mesh>
          <mesh position={[0.5, 2, 1.01]}>
            <planeGeometry args={[0.4, 0.5]} />
            <meshStandardMaterial color="#a0d0f0" transparent opacity={0.8} />
          </mesh>
        </group>
      ))}
      <Html position={[5.6, 5.5, 0]} center zIndexRange={[1, 0]}>
        <div style={{ fontSize: 9, color: "#8a6a5a", fontWeight: 600, whiteSpace: "nowrap", textShadow: "0 1px 2px rgba(255,255,255,0.9)" }}>
          Painted Ladies
        </div>
      </Html>
    </group>
  );
}

/** Alcatraz — small island with building in the bay */
function Alcatraz() {
  return (
    <group position={[55, -0.1, 82]}>
      {/* Island */}
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[4, 5, 0.8, 12]} />
        <meshStandardMaterial color="#8a9a70" roughness={0.95} />
      </mesh>
      {/* Main building */}
      <mesh position={[0, 1.8, 0]} castShadow>
        <boxGeometry args={[5, 2.4, 2.5]} />
        <meshStandardMaterial color="#d8d0c0" roughness={0.8} />
      </mesh>
      {/* Lighthouse */}
      <mesh position={[2, 3.5, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.35, 2, 8]} />
        <meshStandardMaterial color="#f0ece0" roughness={0.6} />
      </mesh>
      <Html position={[0, 4.5, 0]} center zIndexRange={[1, 0]}>
        <div style={{ fontSize: 9, color: "#6a7a5a", fontWeight: 600, whiteSpace: "nowrap", textShadow: "0 1px 2px rgba(255,255,255,0.9)" }}>
          Alcatraz
        </div>
      </Html>
    </group>
  );
}

/** Trolley tracks running through the city */
function TrolleyTracks() {
  return (
    <group>
      {[-0.15, 0.15].map((offset, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[offset, 0.025, 0]}>
          <planeGeometry args={[0.08, 80]} />
          <meshStandardMaterial color="#909090" metalness={0.7} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

/** Ferry Building — clock tower on the waterfront */
function FerryBuilding() {
  return (
    <group position={[0, 0, 62]}>
      <mesh position={[0, 2, 0]} castShadow>
        <boxGeometry args={[16, 4, 3.5]} />
        <meshStandardMaterial color="#e8dcc8" roughness={0.7} />
      </mesh>
      <mesh position={[0, 4.5, 0]} castShadow>
        <boxGeometry args={[1.8, 5, 1.8]} />
        <meshStandardMaterial color="#d8ccb8" roughness={0.6} />
      </mesh>
      <mesh position={[0, 7.5, 0]}>
        <coneGeometry args={[1.2, 2, 4]} />
        <meshStandardMaterial color="#b8a888" roughness={0.5} />
      </mesh>
      <Html position={[0, 9.5, 0]} center zIndexRange={[1, 0]}>
        <div style={{ fontSize: 9, color: "#8b7355", fontWeight: 600, whiteSpace: "nowrap", textShadow: "0 1px 2px rgba(255,255,255,0.9)" }}>
          Ferry Building
        </div>
      </Html>
    </group>
  );
}

/** Marina with small boats */
function Marina() {
  return (
    <group position={[-35, 0, 68]}>
      {/* Dock */}
      <mesh position={[0, 0.2, 0]} receiveShadow>
        <boxGeometry args={[20, 0.3, 2]} />
        <meshStandardMaterial color="#c4a97d" roughness={0.85} />
      </mesh>
      {/* Boats */}
      {[-6, -2, 2, 5, 8].map((x, i) => (
        <group key={i} position={[x, 0.15, 3 + (i % 2) * 1.5]}>
          <mesh>
            <boxGeometry args={[1.5, 0.3, 0.7]} />
            <meshStandardMaterial color={["#f5f0e8", "#e0d5c5", "#d0e0f0", "#f0e0d0", "#e5e5e0"][i]} roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.6, 0]}>
            <boxGeometry args={[0.06, 0.9, 0.06]} />
            <meshStandardMaterial color="#8a7a6a" roughness={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Dolores Park — large green area */
function DoloresPark() {
  return (
    <group position={[-50, 0, -40]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[18, 14]} />
        <meshStandardMaterial color="#5a9a4e" roughness={0.95} />
      </mesh>
      {/* Walking paths */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <planeGeometry args={[0.4, 14]} />
        <meshStandardMaterial color="#c8bca8" roughness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, Math.PI / 4]} position={[3, 0.03, 2]}>
        <planeGeometry args={[0.3, 10]} />
        <meshStandardMaterial color="#c8bca8" roughness={0.9} />
      </mesh>
      {/* Trees along edges */}
      {Array.from({ length: 8 }).map((_, i) => {
        const x = -7 + i * 2 + (i % 2) * 0.5;
        const z = (i % 2 === 0 ? -5 : 5) + (i % 3) * 0.5;
        return (
          <group key={i} position={[x, 0, z]} scale={0.7 + (i % 3) * 0.15}>
            <mesh position={[0, 0.5, 0]} castShadow>
              <cylinderGeometry args={[0.08, 0.12, 1, 6]} />
              <meshStandardMaterial color="#8b6b4a" />
            </mesh>
            <mesh position={[0, 1.3, 0]} castShadow>
              <sphereGeometry args={[0.6, 8, 8]} />
              <meshStandardMaterial color="#3d8c4f" roughness={0.9} />
            </mesh>
          </group>
        );
      })}
      <Html position={[0, 3, 0]} center zIndexRange={[1, 0]}>
        <div style={{ fontSize: 9, color: "#4a7a3a", fontWeight: 600, whiteSpace: "nowrap", textShadow: "0 1px 2px rgba(255,255,255,0.9)" }}>
          Dolores Park
        </div>
      </Html>
    </group>
  );
}

export function SFLandmarks() {
  return (
    <group>
      <GoldenGateBridge />
      <TransamericaPyramid />
      <CoitTower />
      <CableCar />
      <PierSign />
      <SalesforceTower />
      <PaintedLadies />
      <Alcatraz />
      <TrolleyTracks />
      <FerryBuilding />
      <Marina />
      <DoloresPark />
    </group>
  );
}
