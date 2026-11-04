import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TransactionsPage } from './TransactionsPage';
import { ToastProvider } from '../../components/ui/ToastContext';
import * as apiModule from '../../lib/api';

vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  tokenStorage: {
    getAccessToken: () => 'fake_token',
    getRefreshToken: () => 'fake_refresh',
  },
}));

describe('TransactionsPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();

    (apiModule.api.get as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.startsWith('/transactions')) {
        return Promise.resolve({
          items: [
            {
              id: 'tx-1',
              amount_minor: 15000,
              merchant: 'Saravana Bhavan',
              description: 'Lunch',
              notes: null,
              payment_method: 'upi',
              occurred_at: '2026-11-02T13:30:00Z',
              source: 'manual',
              category: {
                id: 'cat-1',
                name: 'Food & Dining',
                icon: 'utensils',
                color: '#F97316',
              },
              subcategory: {
                id: 'sub-1',
                name: 'Restaurant',
              },
            },
          ],
          next_cursor: null,
          totals: {
            count: 1,
            sum_minor: 15000,
          },
        });
      }
      if (url.startsWith('/categories')) {
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter initialEntries={['/transactions']}>
            <TransactionsPage />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    );

  it('renders search bar, transaction row, and totals reconciliation', async () => {
    renderComponent();

    expect(screen.getByPlaceholderText('Search merchant, notes...')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('Saravana Bhavan')).toBeDefined();
      expect(screen.getByText('-₹150')).toBeDefined();
      expect(screen.getByText('1 transactions')).toBeDefined();
      expect(screen.getByText(/Total: ₹150/i)).toBeDefined();
    });
  });
});
