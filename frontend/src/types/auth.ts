import { PaymentMethod } from './transactions';

export interface User {
  id: string;
  email: string;
  name: string | null;
  timezone: string;
  currency: string;
  week_start: number;
  month_start_day: number;
  default_payment_method: PaymentMethod;
  reminder_enabled: boolean;
  reminder_time: string;
  theme: 'system' | 'light' | 'dark';
  created_at: string;
  updated_at: string;
}

export interface TokenResponse {
  user: User;
  access_token: string;
  refresh_token: string;
}

export interface RefreshTokenResponse {
  access_token: string;
  refresh_token: string;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  fields?: Record<string, string>;
  request_id?: string;
}

export interface ApiErrorResponse {
  error: ApiErrorDetail;
}
