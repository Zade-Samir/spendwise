export type BudgetPeriod = 'weekly' | 'monthly' | 'yearly';
export type BudgetStatus = 'ok' | 'warning' | 'exceeded';

export interface BudgetCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface Budget {
  id: string;
  category: BudgetCategory | null;
  period: BudgetPeriod;
  amount_minor: number;
  spent_minor: number;
  remaining_minor: number;
  pct_used: number;
  status: BudgetStatus;
  alert_threshold_pct: number;
  days_left: number;
  safe_daily_minor: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BudgetListResponse {
  items: Budget[];
  overall: Budget | null;
  has_alerts: boolean;
  alert_count: number;
}

export interface BudgetUpsertPayload {
  category_id?: string | null;
  period?: BudgetPeriod;
  amount_minor: number;
  alert_threshold_pct?: number;
}
