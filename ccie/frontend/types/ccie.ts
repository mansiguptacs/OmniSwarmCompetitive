export type Phase =
  | "idle"
  | "classifying"
  | "discovering"
  | "analyzing"
  | "synthesizing"
  | "complete";

export type CompetitorStatus = "discovering" | "analyzing" | "complete";

export interface AgentActivity {
  agent: string;
  status: string;
  ts: number;
}

export interface NewsItem {
  title: string;
  url?: string;
  summary?: string;
  sentiment?: number;
  published_at?: string;
}

export interface ProductItem {
  name: string;
  description?: string;
  pricing?: string;
}

export type AgentRole =
  | "News Scout"
  | "Product Tracker"
  | "Financial Analyst";

export type AgentStatus = "idle" | "running" | "done";

export interface AgentNode {
  role: AgentRole;
  status: AgentStatus;
}

export interface Financials {
  revenue?: string;
  funding_total?: string;
  valuation?: string;
  market_cap?: string;
  growth_rate?: string;
  employee_count?: string;
  source?: string;
}

export interface Competitor {
  name: string;
  description?: string;
  threat_level?: number;
  sentiment?: number;
  market_size?: number;
  market_overlap?: number;
  status?: CompetitorStatus;
  news?: NewsItem[];
  products?: ProductItem[];
  financials?: Financials;
  swot?: Record<string, string[]>;
  /** Frontend-only: our analysis agents working this competitor (demo viz). */
  agents?: AgentNode[];
}

export interface MarketQuadrants {
  leader: string[];
  challenger: string[];
  niche: string[];
  visionary: string[];
}

export interface CCIEState {
  target_company?: string;
  target_description?: string;
  is_hypothetical?: boolean;
  competitors?: Competitor[];
  landscape_summary?: string;
  market_quadrants?: MarketQuadrants;
  agent_activity?: AgentActivity[];
  phase?: Phase;
  session_id?: string;
}
