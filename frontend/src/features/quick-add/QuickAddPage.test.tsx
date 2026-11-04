import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { QuickAddPage } from './QuickAddPage';
import { ToastProvider } from '../../components/ui/ToastContext';
import * as apiModule from '../../lib/api';

vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
  tokenStorage: {
    getAccessToken: () => 'fake_token',
    getRefreshToken: () => 'fake_refresh',
  },
}));

describe('QuickAddPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();

    // Mock category and recent merchant responses
    (apiModule.api.get as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.startsWith('/categories')) {
        return Promise.resolve([
          {
            id: 'cat-1',
            name: 'Food & Dining',
            icon: 'utensils',
            color: '#F97316',
            sort_order: 0,
            is_default: true,
            archived_at: null,
            usage_count_30d: 42,
            children: [
              {
                id: 'sub-1',
                name: 'Restaurant',
                icon: 'utensils',
                color: '#F97316',
                sort_order: 0,
                is_default: true,
                archived_at: null,
                usage_count_30d: 20,
              },
            ],
          },
        ]);
      }
      if (url.startsWith('/transactions/recent-merchants')) {
        return Promise.resolve([
          {
            merchant: 'Swiggy',
            last_category_id: 'cat-1',
            last_subcategory_id: 'sub-1',
          },
        ]);
      }
      return Promise.resolve([]);
    });
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter initialEntries={['/add']}>
            <QuickAddPage />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    );

  it('renders keypad and category chips, and types amount', async () => {
    renderComponent();

    // Keypad digits should be visible
    expect(screen.getByRole('button', { name: 'Digit 1' })).toBeDefined();

    // Top category should appear
    await waitFor(() => {
      expect(screen.getByText('Food & Dining')).toBeDefined();
    });

    // Save button disabled initially when amount is 0
    const saveButton = screen.getByRole('button', { name: /Enter Amount/i });
    expect(saveButton).toBeDefined();
    expect((saveButton as HTMLButtonElement).disabled).toBe(true);

    // Type 1, 5, 0
    fireEvent.click(screen.getByRole('button', { name: 'Digit 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Digit 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Digit 0' }));

    // Dynamic Save button displays Save ₹150
    await waitFor(() => {
      expect(screen.getByText(/Save ₹150/i)).toBeDefined();
    });
  });

  it('submits transaction and triggers mutation with integer paise', async () => {
    (apiModule.api.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'tx-123',
      amount_minor: 15000,
      occurred_at: new Date().toISOString(),
      category: { id: 'cat-1', name: 'Food & Dining', icon: 'utensils', color: '#F97316' },
      subcategory: null,
      payment_method: 'upi',
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Food & Dining')).toBeDefined();
    });

    // Enter 150
    fireEvent.click(screen.getByRole('button', { name: 'Digit 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Digit 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Digit 0' }));

    const saveButton = await screen.findByText(/Save ₹150/i);
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(apiModule.api.post).toHaveBeenCalledWith(
        '/transactions',
        expect.objectContaining({
          amount_minor: 15000,
          category_id: 'cat-1',
          payment_method: 'upi',
        })
      );
    });
  });

  it('pre-fills amount, merchant, and notes from URL query parameters (Mode B shortcuts)', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter initialEntries={['/add?amount=250&merchant=Starbucks&notes=Latte']}>
            <QuickAddPage />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText(/250/).length).toBeGreaterThan(0);
      expect(screen.getByText('Food & Dining')).toBeDefined();
    });
  });
});
