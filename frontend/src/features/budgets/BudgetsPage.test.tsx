import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BudgetsPage } from './BudgetsPage';
import * as apiModule from '../../lib/api';

vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  tokenStorage: {
    getAccessToken: () => 'fake_token',
    getRefreshToken: () => 'fake_refresh',
  },
}));

describe('BudgetsPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();

    (apiModule.api.get as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.startsWith('/budgets')) {
        return Promise.resolve({
          overall: {
            id: 'b-overall',
            category: null,
            period: 'monthly',
            amount_minor: 2500000,
            spent_minor: 1845000,
            remaining_minor: 655000,
            pct_used: 73.8,
            status: 'ok',
            alert_threshold_pct: 80,
            days_left: 20,
            safe_daily_minor: 32750,
            active: true,
            created_at: '',
            updated_at: '',
          },
          items: [
            {
              id: 'b-food',
              category: {
                id: 'cat-food',
                name: 'Food & Dining',
                icon: 'utensils',
                color: '#F97316',
              },
              period: 'monthly',
              amount_minor: 600000,
              spent_minor: 540000,
              remaining_minor: 60000,
              pct_used: 90.0,
              status: 'warning',
              alert_threshold_pct: 80,
              days_left: 20,
              safe_daily_minor: 3000,
              active: true,
              created_at: '',
              updated_at: '',
            },
          ],
          has_alerts: true,
          alert_count: 1,
        });
      }
      if (url.startsWith('/categories')) {
        return Promise.resolve([
          {
            id: 'cat-food',
            name: 'Food & Dining',
            icon: 'utensils',
            color: '#F97316',
            parent_id: null,
            children: [],
          },
        ]);
      }
      return Promise.resolve([]);
    });

    (apiModule.api.put as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'b-new',
      amount_minor: 1000000,
      status: 'ok',
    });
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/budgets']}>
          <BudgetsPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it('renders overall budget, category budget, and warning banner', async () => {
    renderComponent();

    expect(screen.getByText('Budgets & Limits')).toBeDefined();

    await waitFor(() => {
      // Overall budget amount
      expect(screen.getByText('₹25,000')).toBeDefined();
      expect(screen.getByText('₹6,550 left')).toBeDefined();
      // Category budget
      expect(screen.getByText('Food & Dining')).toBeDefined();
      expect(screen.getByText('₹5,400')).toBeDefined();
      // Alert banner
      expect(screen.getByText(/1 budget exceeded or near threshold/i)).toBeDefined();
    });
  });

  it('opens BudgetSheet and submits new budget', async () => {
    renderComponent();

    const newBtn = screen.getByRole('button', { name: /New Budget/i });
    fireEvent.click(newBtn);

    await waitFor(() => {
      expect(screen.getByText('Set New Budget')).toBeDefined();
    });

    const amountInput = screen.getByPlaceholderText(/e.g. 15,000/i);
    fireEvent.change(amountInput, { target: { value: '10000' } });

    const submitBtn = screen.getByRole('button', { name: /Create Budget/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(apiModule.api.put).toHaveBeenCalledWith(
        '/budgets',
        expect.objectContaining({
          amount_minor: 1000000,
          period: 'monthly',
        })
      );
    });
  });
});
