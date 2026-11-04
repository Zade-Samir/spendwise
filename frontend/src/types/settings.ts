export interface UserSettings {
  name: string | null;
  email: string;
  timezone: string;
  currency: string;
  month_start_day: number;
  reminder_enabled: boolean;
  reminder_time: string;
  theme: 'system' | 'light' | 'dark';
  has_push_subscription: boolean;
}

export interface UserSettingsUpdateRequest {
  name?: string;
  timezone?: string;
  month_start_day?: number;
  reminder_enabled?: boolean;
  reminder_time?: string;
  theme?: 'system' | 'light' | 'dark';
}

