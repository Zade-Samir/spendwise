export type PaymentMethod = 'upi' | 'cash' | 'card' | 'bank' | 'other';
export type TransactionSource = 'manual' | 'shortcut' | 'csv_import' | 'recurring';

export interface TransactionCategoryRef {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface TransactionSubcategoryRef {
  id: string;
  name: string;
}

export interface Transaction {
  id: string;
  amount_minor: number;
  category: TransactionCategoryRef;
  subcategory: TransactionSubcategoryRef | null;
  merchant: string | null;
  description: string | null;
  notes: string | null;
  payment_method: PaymentMethod;
  occurred_at: string;
  source: TransactionSource;
  client_id: string | null;
  created_at: string;
  updated_at: string;
  is_pending_sync?: boolean;
}

export interface TransactionCreatePayload {
  amount_minor: number;
  category_id: string;
  subcategory_id?: string | null;
  merchant?: string | null;
  description?: string | null;
  notes?: string | null;
  payment_method?: PaymentMethod;
  occurred_at?: string;
  client_id?: string | null;
  source?: TransactionSource;
}

export interface TransactionUpdatePayload {
  amount_minor?: number;
  category_id?: string;
  subcategory_id?: string | null;
  merchant?: string | null;
  description?: string | null;
  notes?: string | null;
  payment_method?: PaymentMethod;
  occurred_at?: string;
}

export interface TransactionListTotals {
  count: number;
  sum_minor: number;
}

export interface TransactionListResponse {
  items: Transaction[];
  next_cursor: string | null;
  totals: TransactionListTotals;
}

export interface RecentMerchant {
  merchant: string;
  last_category_id: string | null;
  last_subcategory_id: string | null;
}
