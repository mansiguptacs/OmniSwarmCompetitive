// TypeScript mirror of ccie/backend/simulation/schemas.py.
// Keep in sync with the backend Pydantic models. See simulation_plan.md.

export type SimStatus = "setup" | "running" | "awaiting_choice" | "complete";

export type LedgerKind =
  | "reaction"
  | "adjudication"
  | "choice"
  | "grounding"
  | "persona"
  | "recommendation";

export type ActorKind = "company" | "referee" | "player" | "system";

export type Temperament =
  | "aggressive"
  | "litigious"
  | "partner_first"
  | "wait_and_see"
  | "acquisitive";

export interface Evidence {
  claim?: string;
  source_url?: string;
  source_title?: string;
  as_of?: string;
}

export interface CompanyPersona {
  name: string;
  strategy_thesis?: string;
  ethos?: string;
  m_and_a_history?: string[];
  financial_firepower?: string;
  temperament?: Temperament;
  recent_moves?: string[];
  leadership_style?: string;
  sources?: Evidence[];
}

export interface AcquisitionTarget {
  name: string;
  description?: string;
  why_attractive?: string;
  price_estimate?: string;
  capabilities?: string[];
  sources?: Evidence[];
}

export interface PlayerProfile {
  company: string;
  resources?: string;
  objective?: string;
}

export interface Sector {
  name: string;
  incumbents?: string[];
  notes?: string;
}

export interface AgentReaction {
  actor: string;
  intent?: string;
  action?: string;
  rationale?: string;
  intensity?: number;
  ally_with?: string[];
  evidence?: Evidence[];
  weave_trace_id?: string;
  redis_key?: string;
}

export interface CompanyBoardPosition {
  name: string;
  market_position?: number;
  threat?: number;
  sentiment?: number;
  pressure?: number;
  alliances?: string[];
}

export interface PlayerBoardPosition {
  position?: number;
  momentum?: number;
  risk?: number;
}

export interface BoardState {
  companies?: CompanyBoardPosition[];
  player?: PlayerBoardPosition;
}

export interface DecisionOption {
  id: string;
  label: string;
  expected_effect?: string;
  risk?: string;
}

export interface DecisionPoint {
  iteration_index: number;
  situation_summary?: string;
  options?: DecisionOption[];
  allow_free_text?: boolean;
}

export interface SimulationIteration {
  index: number;
  move?: string;
  reactions?: AgentReaction[];
  referee_outcome?: string;
  board?: BoardState;
  decision_point?: DecisionPoint | null;
  chosen_option?: string;
}

export interface LedgerEntry {
  session_id: string;
  iteration_index: number;
  actor: string;
  actor_kind?: ActorKind;
  kind: LedgerKind;
  summary?: string;
  structured_payload?: Record<string, unknown>;
  evidence?: Evidence[];
  weave_trace_id?: string;
  ts?: number;
}

export interface SimulationState {
  session_id?: string;
  sector?: Sector | null;
  target?: AcquisitionTarget | null;
  player?: PlayerProfile | null;
  personas?: CompanyPersona[];
  iterations?: SimulationIteration[];
  current_index?: number;
  max_iterations?: number;
  status?: SimStatus;
  final_recommendation?: string;
}
