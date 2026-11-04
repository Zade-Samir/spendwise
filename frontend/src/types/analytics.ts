export interface SummaryPeriodItem {
  sum_minor: number;
  count: number;
}

export interface MonthBudgetItem {
  amount_minor: number;
  spent_minor: number;
  remaining_minor: number;
  pct_used: number;
}

export interface AnalyticsSummary {
  today: SummaryPeriodItem;
  week: SummaryPeriodItem;
  month: SummaryPeriodItem;
  month_budget: MonthBudgetItem | null;
  avg_daily_minor: number;
  projected_month_minor: number;
}

export interface CategoryAnalyticsChild {
  subcategory_id: string;
  name: string;
  sum_minor: number;
  pct: number;
}

export interface CategoryAnalyticsItem {
  category_id: string;
  name: string;
  icon: string;
  color: string;
  sum_minor: number;
  count: number;
  pct: number;
  children: CategoryAnalyticsChild[];
}

export interface CategoryAnalyticsResponse {
  total_minor: number;
  items: CategoryAnalyticsItem[];
}

export interface TrendPoint {
  date: string; // YYYY-MM-DD
  sum_minor: number;
  count: number;
}

export interface TrendResponse {
  points: TrendPoint[];
}

export interface PaymentMethodAnalyticsItem {
  payment_method: string;
  sum_minor: number;
  count: number;
  pct: number;
}

export interface PaymentMethodAnalyticsResponse {
  items: PaymentMethodAnalyticsItem[];
}

export interface TopMerchantItem {
  merchant: string;
  sum_minor: number;
  count: number;
}

export interface TopMerchantsResponse {
  items: TopMerchantItem[];
}

export interface CategoryCompareItem {
  category_id: string;
  name: string;
  current_minor: number;
  previous_minor: number;
  delta_minor: number;
  delta_pct: number;
}

export interface CompareResponse {
  current_minor: number;
  previous_minor: number;
  delta_minor: number;
  delta_pct: number;
  by_category: CategoryCompareItem[];
}

export interface HeatmapPoint {
  date: string;
  sum_minor: number;
  count: number;
  level: number; // 0 to 4
}

export interface HeatmapResponse {
  points: HeatmapPoint[];
}
