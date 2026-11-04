export * from './auth';
export * from './categories';
export * from './transactions';
export * from './analytics';
export * from './budget';
export * from './insight';

export interface HealthStatus {
  status: string;
  db: string;
  environment: string;
  version: string;
}

export type NavTab = 'home' | 'history' | 'add' | 'analytics' | 'more';

