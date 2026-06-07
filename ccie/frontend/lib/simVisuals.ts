import type { BoardState, SimulationState } from "@/types/simulation";

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Building height encodes market position (taller = stronger standing). */
export function positionHeight(v = 0.5): number {
  return 2.5 + clamp01(v) * 12;
}

/** Footprint encodes threat (bigger = more threatening). */
export function threatWidth(v = 0.5): number {
  return 1.8 + clamp01(v) * 2.4;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * clamp01(t);
}

function rgb(r: number, g: number, b: number) {
  const h = (n: number) => Math.round(n).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Pressure 0..1 -> calm blue (low) to hot red (high). */
export function pressureColor(pressure = 0): string {
  const p = clamp01(pressure);
  // blue (#3b82f6) -> amber (#f59e0b) -> red (#ef4444)
  if (p < 0.5) {
    const t = p / 0.5;
    return rgb(lerp(59, 245, t), lerp(130, 158, t), lerp(246, 11, t));
  }
  const t = (p - 0.5) / 0.5;
  return rgb(lerp(245, 239, t), lerp(158, 68, t), lerp(11, 68, t));
}

/** Radial layout for incumbents around the player at the center. */
export function ringPosition(index: number, total: number, radius = 15): [number, number] {
  const angle = (index / Math.max(1, total)) * Math.PI * 2 + Math.PI / 6;
  return [Math.cos(angle) * radius, Math.sin(angle) * radius];
}

export function currentBoard(state: SimulationState | null): BoardState | null {
  if (!state?.iterations?.length) return null;
  return state.iterations[state.iterations.length - 1].board ?? null;
}

/** Map of company name -> [x, z] board position, aligned to board order. */
export function companyPositions(board: BoardState | null): Record<string, [number, number]> {
  const out: Record<string, [number, number]> = {};
  const companies = board?.companies ?? [];
  companies.forEach((c, i) => {
    out[c.name] = ringPosition(i, companies.length);
  });
  return out;
}

/** Unique alliance pairs from the board (A-B counted once). */
export function alliancePairs(board: BoardState | null): [string, string][] {
  const pairs: [string, string][] = [];
  const seen = new Set<string>();
  for (const c of board?.companies ?? []) {
    for (const ally of c.alliances ?? []) {
      const key = [c.name, ally].sort().join("::");
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push([c.name, ally]);
    }
  }
  return pairs;
}
