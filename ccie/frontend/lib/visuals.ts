import type {
  AgentNode,
  AgentRole,
  AgentStatus,
  Competitor,
  CompetitorStatus,
} from "@/types/ccie";

const AGENT_ROLES: AgentRole[] = [
  "News Scout",
  "Product Tracker",
  "Financial Analyst",
];

export function deriveAgents(status?: CompetitorStatus): AgentNode[] {
  let agentStatus: AgentStatus;
  if (status === "complete") agentStatus = "done";
  else if (status === "analyzing") agentStatus = "running";
  else return [];
  return AGENT_ROLES.map((role) => ({ role, status: agentStatus }));
}

export const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

export const clamp01 = (v: number) => clamp(v, 0, 1);

export function threatToHeight(threat = 0.5): number {
  const t = clamp01(threat);
  return 1.5 + t * t * 16;
}

export function sizeToWidth(size = 0.5): number {
  const s = clamp01(size);
  return 1.2 + s * 3.5;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToHex(rgb: [number, number, number]): string {
  return (
    "#" +
    rgb
      .map((c) => clamp(Math.round(c), 0, 255).toString(16).padStart(2, "0"))
      .join("")
  );
}

function lerpColor(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const k = clamp01(t);
  return rgbToHex([
    ca[0] + (cb[0] - ca[0]) * k,
    ca[1] + (cb[1] - ca[1]) * k,
    ca[2] + (cb[2] - ca[2]) * k,
  ]);
}

const NEUTRAL = "#3b82f6";
const POSITIVE = "#22c55e";
const NEGATIVE = "#ef4444";

export function sentimentColor(sentiment = 0): string {
  const v = clamp(sentiment, -1, 1);
  return v >= 0 ? lerpColor(NEUTRAL, POSITIVE, v) : lerpColor(NEUTRAL, NEGATIVE, -v);
}

export function sentimentLabel(sentiment = 0): string {
  if (sentiment > 0.15) return "Positive";
  if (sentiment < -0.15) return "Negative";
  return "Neutral";
}

/* ── City-grid layout ────────────────────────────────────────────── */

const BLOCK = 9;
const STREET = 2.8;
const CELL = BLOCK + STREET;

/** Seeded RNG so positions are deterministic across renders. */
function seededRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Grid lots spiraling outward from center. Every other step in the
 * raw spiral is skipped so competitors always have a gap between them.
 */
const SPIRAL_LOTS: [number, number][] = (() => {
  const raw: [number, number][] = [];
  const dirs: [number, number][] = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  let x = 0, z = 0, dir = 0, steps = 1, taken = 0, turns = 0;

  for (let i = 0; raw.length < 120; i++) {
    x += dirs[dir][0];
    z += dirs[dir][1];
    raw.push([x, z]);
    taken++;
    if (taken >= steps) {
      taken = 0;
      dir = (dir + 1) % 4;
      turns++;
      if (turns % 2 === 0) steps++;
    }
  }
  // keep every 2nd lot so there's a gap between each competitor
  return raw.filter((_, i) => i % 2 === 0);
})();

/**
 * Place competitors on a city grid with natural spacing.
 */
export function competitorPosition(
  index: number,
  total: number,
  overlap = 0.5,
): [number, number] {
  const lot = SPIRAL_LOTS[index % SPIRAL_LOTS.length];
  const rand = seededRand(index * 7919 + 31);
  const jitterX = (rand() - 0.5) * 2.0;
  const jitterZ = (rand() - 0.5) * 2.0;

  return [
    lot[0] * CELL + jitterX,
    lot[1] * CELL + jitterZ,
  ];
}

/** How many grid cells the city spans for a given competitor count. */
export function cityExtent(total: number): number {
  if (total <= 0) return 0;
  const lastLot = SPIRAL_LOTS[Math.min(total - 1, SPIRAL_LOTS.length - 1)];
  return (Math.max(Math.abs(lastLot[0]), Math.abs(lastLot[1])) + 1) * CELL + BLOCK;
}

export function compositeThreat(c: Competitor): number {
  return clamp01(c.threat_level ?? 0.5);
}
