import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InsightsCarousel } from './InsightsCarousel';
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

describe('InsightsCarousel', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <InsightsCarousel />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it('renders nothing when there are no insights (graceful degradation)', async () => {
    (apiModule.api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      items: [],
    });

    const { container } = renderComponent();

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it('renders insight cards when insights exist', async () => {
    (apiModule.api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      items: [
        {
          id: 'top_category',
          kind: 'top_category',
          severity: 'info',
          title: 'Top Spending Category',
          body: 'Food & Dining is your biggest category this month: ₹6,200 (34%).',
          data: {},
          generated_for: '2026-11',
        },
        {
          id: 'streak',
          kind: 'streak',
          severity: 'positive',
          title: 'Logging Streak',
          body: '7-day logging streak! 🔥',
          data: {},
          generated_for: '2026-11',
        },
      ],
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Spending Insights')).toBeDefined();
      expect(screen.getByText('Top Spending Category')).toBeDefined();
      expect(screen.getByText(/Food & Dining is your biggest category/i)).toBeDefined();
      expect(screen.getByText('Logging Streak')).toBeDefined();
      expect(screen.getByText(/7-day logging streak/i)).toBeDefined();
    });
  });
});
