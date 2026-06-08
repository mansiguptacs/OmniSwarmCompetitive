import type { AgentReaction } from "@/types/simulation";

const STRIP_NOISE = /\b(inc|llc|corp|corporation|ltd|limited|co|company|payments|pay|holdings|group|technologies|software|systems|platform|labs)\b/gi;

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(STRIP_NOISE, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(name: string): Set<string> {
  return new Set(normalizeName(name).split(" ").filter((t) => t.length > 2));
}

/** Score how well an actor name matches a competitor building name (higher = better). */
export function matchScore(actor: string, candidate: string): number {
  if (actor === candidate) return 100;
  const a = normalizeName(actor);
  const c = normalizeName(candidate);
  if (!a || !c) return 0;
  if (a === c) return 95;

  const aTokens = tokenSet(actor);
  const cTokens = tokenSet(candidate);
  let shared = 0;
  for (const t of aTokens) {
    if (cTokens.has(t)) shared++;
  }
  if (shared > 0) {
    const ratio = shared / Math.max(aTokens.size, cTokens.size);
    return 70 + ratio * 25;
  }

  if (c.includes(a) || a.includes(c)) return 55;

  // Try matching first significant token (e.g. "Microsoft" matches "Microsoft Visio")
  const aFirst = a.split(" ")[0];
  const cFirst = c.split(" ")[0];
  if (aFirst.length > 3 && cFirst.length > 3) {
    if (aFirst === cFirst) return 80;
    if (c.startsWith(aFirst) || a.startsWith(cFirst)) return 65;
  }

  return 0;
}

/** Match simulation actor names to competitor building names (best score wins). */
export function matchActorToName(actor: string, names: string[]): string | null {
  if (names.includes(actor)) return actor;

  let best: string | null = null;
  let bestScore = 0;
  for (const n of names) {
    const s = matchScore(actor, n);
    if (s > bestScore) {
      bestScore = s;
      best = n;
    }
  }
  return bestScore >= 55 ? best : null;
}

export function buildReactionMap(
  reactions: AgentReaction[],
  competitorNames: string[],
): Map<string, AgentReaction> {
  const map = new Map<string, AgentReaction>();
  const used = new Set<string>();

  // Exact matches first
  for (const r of reactions) {
    if (competitorNames.includes(r.actor) && !used.has(r.actor)) {
      map.set(r.actor, r);
      used.add(r.actor);
    }
  }

  // Fuzzy match remaining
  for (const r of reactions) {
    if ([...map.values()].includes(r)) continue;
    const matched = matchActorToName(r.actor, competitorNames.filter((n) => !used.has(n)));
    if (matched) {
      map.set(matched, r);
      used.add(matched);
    }
  }

  return map;
}

/** Reactions that could not be placed on a competitor building. */
export function unmappedReactions(
  reactions: AgentReaction[],
  mapped: Map<string, AgentReaction>,
): AgentReaction[] {
  const placed = new Set(mapped.values());
  return reactions.filter((r) => !placed.has(r));
}
