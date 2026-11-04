import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardPage } from './DashboardPage';
import { AuthContext } from '../auth/authContextDef';
import { ToastProvider } from '../../components/ui/ToastContext';
import * as apiModule from '../../lib/api';

vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn(),
  },
  tokenStorage: {
    getAccessToken: () => 'fake_token',
    getRefreshToken: () => 'fake_refresh',
  },
}));

describe('DashboardPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();

    (apiModule.api.get as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.startsWith('/analytics/summary')) {
        return Promise.resolve({
          today: { sum_minor: 53000, count: 3 },
          week: { sum_minor: 325000, count: 14 },
          month: { sum_minor: 1845000, count: 68 },
          month_budget: {
            amount_minor: 2500000,
            spent_minor: 1845000,
            remaining_minor: 655000,
            pct_used: 73.8,
          },
          avg_daily_minor: 61500,
          projected_month_minor: 2240000,
        });
      }
      if (url.startsWith('/analytics/by-category')) {
        return Promise.resolve({
          total_minor: 1845000,
          items: [
            {
              category_id: 'cat-1',
              name: 'Food & Dining',
              icon: 'utensils',
              color: '#F97316',
              sum_minor: 620000,
              count: 28,
              pct: 33.6,
              children: [],
            },
          ],
        });
      }
      if (url.startsWith('/analytics/trend')) {
        return Promise.resolve({
          points: [
            { date: '2026-11-01', sum_minor: 120000, count: 4 },
            { date: '2026-11-02', sum_minor: 53000, count: 3 },
          ],
        });
      }
      if (url.startsWith('/transactions')) {
        return Promise.resolve({
          items: [
            {
              id: 'tx-1',
              amount_minor: 15000,
              merchant: 'Swiggy',
              payment_method: 'upi',
              occurred_at: '2026-11-02T13:30:00Z',
              category: { id: 'cat-1', name: 'Food & Dining', icon: 'utensils', color: '#F97316' },
              subcategory: null,
            },
          ],
          next_cursor: null,
          totals: { count: 1, sum_minor: 15000 },
        });
      }
      return Promise.resolve([]);
    });
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider
          value={{
            user: {
              id: 'user-1',
              email: 'priya@spendwise.in',
              name: 'Priya',
              timezone: 'Asia/Kolkata',
              currency: 'INR',
              week_start: 1,
              month_start_day: 1,
              default_payment_method: 'upi',
              reminder_enabled: true,
              reminder_time: '21:00:00',
              theme: 'system',
              created_at: '',
              updated_at: '',
            },
            isAuthenticated: true,
            isLoading: false,
            error: null,
            login: vi.fn(),
            register: vi.fn(),
            logout: vi.fn(),
            refreshProfile: vi.fn(),
          }}
        >
          <ToastProvider>
            <MemoryRouter initialEntries={['/']}>
              <DashboardPage />
            </MemoryRouter>
          </ToastProvider>
        </AuthContext.Provider>
      </QueryClientProvider>
    );

  it('renders executive summary cards and total monthly spend', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Priya')).toBeDefined();
      expect(screen.getByText('Total Spent This Month')).toBeDefined();
      expect(screen.getAllByText('₹18,450').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Today')).toBeDefined();
      expect(screen.getByText('This Week')).toBeDefined();
    });
  });

  it('renders donut chart section and recent transactions', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Where is the Money Going?')).toBeDefined();
      expect(screen.getByText('Daily Spending Trend')).toBeDefined();
      expect(screen.getByText('Recent Expenses')).toBeDefined();
      expect(screen.getByText('Swiggy')).toBeDefined();
    });
  });
});
