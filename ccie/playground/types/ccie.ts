export type Phase =
  | "idle"
  | "classifying"
  | "discovering"
  | "analyzing"
  | "synthesizing"
  | "complete";

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
}

export interface ProductItem {
  name: string;
  description?: string;
  pricing?: string;
}

export interface Competitor {
  name: string;
  description?: string;
  threat_level?: number;
  sentiment?: number;
  status?: string;
  news?: NewsItem[];
  products?: ProductItem[];
  swot?: Record<string, string[]>;
}

export interface CCIEState {
  target_company?: string;
  target_description?: string;
  is_hypothetical?: boolean;
  competitors?: Competitor[];
  landscape_summary?: string;
  agent_activity?: AgentActivity[];
  phase?: Phase;
}
