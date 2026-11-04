export interface ColumnMapping {
  date: string;
  description: string;
  debit?: string | null;
  credit?: string | null;
  amount?: string | null;
}

export interface DetectedDialect {
  delimiter: string;
  encoding: string;
  date_format: string;
  has_header: boolean;
}

export interface ImportUploadResponse {
  batch_id: string;
  original_filename: string;
  row_count_preview: number;
  detected: DetectedDialect;
  headers: string[];
  sample_rows: Record<string, string>[];
  suggested_mapping: ColumnMapping;
}

export interface ImportPreviewRow {
  row_no: number;
  date_raw: string;
  parsed_date?: string | null;
  description: string;
  amount_minor: number;
  is_debit: boolean;
  suggested_category_id?: string | null;
  suggested_category_name?: string | null;
  is_duplicate: boolean;
  dedupe_hash: string;
}

export interface ImportPreviewResponse {
  batch_id: string;
  rows: ImportPreviewRow[];
  stats: {
    total: number;
    debits: number;
    credits: number;
    duplicates: number;
  };
}

export interface ImportPreviewRequest {
  mapping: ColumnMapping;
  date_format: string;
  amount_mode: 'debit_credit' | 'single_column';
  skip_credits?: boolean;
}

export interface ImportCommitRow {
  row_no: number;
  category_id?: string | null;
  subcategory_id?: string | null;
  include: boolean;
}

export interface ImportCommitRequest {
  rows: ImportCommitRow[];
  skip_duplicates: boolean;
}

export interface ImportCommitResponse {
  batch_id: string;
  imported: number;
  skipped: number;
  status: string;
}

export interface ImportBatchResponse {
  id: string;
  original_filename: string;
  file_size_bytes: number;
  row_count_total: number;
  row_count_imported: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'rolled_back';
  created_at: string;
  completed_at?: string | null;
}

