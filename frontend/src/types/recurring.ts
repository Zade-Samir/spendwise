import { TransactionCategoryRef } from './transactions';

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type RecurringMode = 'remind' | 'auto_create';

export interface RecurringRule {
  id: string;
  name: string;
  amount_minor: number;
  category_id: string;
  subcategory_id?: string | null;
  payment_method: string;
  frequency: RecurringFrequency;
  interval_count: number;
  start_date: string;
  end_date?: string | null;
  day_of_month?: number | null;
  day_of_week?: number | null;
  mode: RecurringMode;
  notify_days_before: number;
  active: boolean;
  next_due_date: string;
  merchant?: string | null;
  category?: TransactionCategoryRef | null;
  created_at: string;
  updated_at: string;
}

export interface RecurringRuleCreateRequest {
  name: string;
  amount_minor: number;
  category_id: string;
  subcategory_id?: string | null;
  payment_method?: string;
  frequency: RecurringFrequency;
  interval_count?: number;
  start_date: string;
  end_date?: string | null;
  day_of_month?: number | null;
  day_of_week?: number | null;
  mode?: RecurringMode;
  notify_days_before?: number;
  merchant?: string | null;
}

export interface RecurringRuleUpdateRequest {
  name?: string;
  amount_minor?: number;
  category_id?: string;
  subcategory_id?: string | null;
  payment_method?: string;
  frequency?: RecurringFrequency;
  interval_count?: number;
  start_date?: string;
  end_date?: string | null;
  day_of_month?: number | null;
  day_of_week?: number | null;
  mode?: RecurringMode;
  notify_days_before?: number;
  active?: boolean;
  merchant?: string | null;
}

export interface RecurringConfirmRequest {
  amount_minor?: number | null;
  occurred_at?: string | null;
}

