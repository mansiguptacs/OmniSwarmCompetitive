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

/**
 * Derive the per-competitor analysis agents from the live competitor status the
 * backend streams (it doesn't send an explicit `agents` field). This makes the
 * agent buildings + connections light up the same way the hardcoded demo did:
 *   discovering → no agents yet, analyzing → agents running, complete → done.
 */
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

/** Building height encodes competitive threat (taller = bigger threat). */
export function threatToHeight(threat = 0.5): number {
  return 2 + clamp01(threat) * 12;
}

/** Building footprint encodes market presence (wider = larger company). */
export function sizeToWidth(size = 0.5): number {
  return 1.6 + clamp01(size) * 3;
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

const NEUTRAL = "#3b82f6"; // blue
const POSITIVE = "#22c55e"; // green
const NEGATIVE = "#ef4444"; // red

/** Sentiment (-1..1) -> red (negative) / blue (neutral) / green (positive). */
export function sentimentColor(sentiment = 0): string {
  const v = clamp(sentiment, -1, 1);
  return v >= 0 ? lerpColor(NEUTRAL, POSITIVE, v) : lerpColor(NEUTRAL, NEGATIVE, -v);
}

export function sentimentLabel(sentiment = 0): string {
  if (sentiment > 0.15) return "Positive";
  if (sentiment < -0.15) return "Negative";
  return "Neutral";
}

/**
 * Radial layout: angle spreads competitors around the target; radius encodes
 * market overlap (closer to center = more direct competitor).
 */
export function competitorPosition(
  index: number,
  total: number,
  overlap = 0.5,
): [number, number] {
  const angle = (index / Math.max(1, total)) * Math.PI * 2 + Math.PI / 7;
  const radius = 9 + (1 - clamp01(overlap)) * 13;
  return [Math.cos(angle) * radius, Math.sin(angle) * radius];
}

export function compositeThreat(c: Competitor): number {
  return clamp01(c.threat_level ?? 0.5);
}
