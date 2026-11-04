export interface CategoryChild {
  id: string;
  name: string;
  icon: string;
  color: string;
  sort_order: number;
  is_default: boolean;
  archived_at: string | null;
  usage_count_30d: number;
}

export interface CategoryTree {
  id: string;
  name: string;
  icon: string;
  color: string;
  sort_order: number;
  is_default: boolean;
  archived_at: string | null;
  usage_count_30d: number;
  children: CategoryChild[];
}

export type Category = CategoryTree;

export interface CategorySuggestion {
  category_id: string | null;
  subcategory_id: string | null;
  confidence: 'rule' | 'history' | null;
}
