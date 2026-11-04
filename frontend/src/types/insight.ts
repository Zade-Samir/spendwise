export type InsightSeverity = 'info' | 'warning' | 'positive';

export interface Insight {
  id: string;
  kind: string;
  severity: InsightSeverity;
  title: string;
  body: string;
  data: Record<string, unknown>;
  generated_for: string;
}

export interface InsightListResponse {
  items: Insight[];
}
