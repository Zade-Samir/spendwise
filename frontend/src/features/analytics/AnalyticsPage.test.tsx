import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AnalyticsPage } from './AnalyticsPage';
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

describe('AnalyticsPage', () => {
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
          month_budget: null,
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
              children: [
                {
                  subcategory_id: 'sub-1',
                  name: 'Delivery',
                  sum_minor: 380000,
                  pct: 61.3,
                },
              ],
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
      if (url.startsWith('/analytics/by-payment-method')) {
        return Promise.resolve({
          items: [
            { payment_method: 'upi', sum_minor: 1420000, count: 55, pct: 77.0 },
          ],
        });
      }
      if (url.startsWith('/analytics/top-merchants')) {
        return Promise.resolve({
          items: [{ merchant: 'Swiggy', sum_minor: 245000, count: 12 }],
        });
      }
      if (url.startsWith('/analytics/compare')) {
        return Promise.resolve({
          current_minor: 1845000,
          previous_minor: 1620000,
          delta_minor: 225000,
          delta_pct: 13.9,
          by_category: [],
        });
      }
      if (url.startsWith('/analytics/heatmap')) {
        return Promise.resolve({
          points: [
            { date: '2026-11-01', sum_minor: 120000, count: 4, level: 3 },
            { date: '2026-11-02', sum_minor: 53000, count: 3, level: 2 },
          ],
        });
      }
      return Promise.resolve([]);
    });
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/analytics']}>
          <AnalyticsPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it('renders period filter bar, core tabs, and category breakdown', async () => {
    renderComponent();

    expect(screen.getByText('Spending Analytics')).toBeDefined();
    expect(screen.getByText('This Month')).toBeDefined();
    expect(screen.getByText('Overview')).toBeDefined();
    expect(screen.getByText('Categories')).toBeDefined();
    expect(screen.getByText('Trends')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('Category Distribution')).toBeDefined();
      expect(screen.getByText('Swiggy')).toBeDefined();
    });
  });

  it('switches to accessible table view when toggled', async () => {
    renderComponent();

    const tableToggle = screen.getByRole('button', { name: /Toggle Accessible Table View/i });
    fireEvent.click(tableToggle);

    await waitFor(() => {
      expect(screen.getByRole('table', { name: 'Category Spending Breakdown Table' })).toBeDefined();
      expect(screen.getByText('Food & Dining')).toBeDefined();
      expect(screen.getByText('Total Spend')).toBeDefined();
    });
  });
});
