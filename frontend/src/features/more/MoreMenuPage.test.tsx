import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MoreMenuPage } from './MoreMenuPage';
import { ToastProvider } from '../../components/ui/ToastContext';
import * as authModule from '../auth/useAuth';

vi.mock('../budgets/useBudgets', () => ({
  useBudgets: () => ({ data: { alert_count: 0 } }),
}));

describe('MoreMenuPage Profile & Sign Out', () => {
  let queryClient: QueryClient;
  const mockLogout = vi.fn();

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();

    vi.spyOn(authModule, 'useAuth').mockReturnValue({
      user: {
        id: 'user-123',
        email: 'samir@example.com',
        name: 'Samir Zade',
        currency: 'INR',
        timezone: 'Asia/Kolkata',
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
      logout: mockLogout,
      refreshProfile: vi.fn(),
    });
  });

  it('renders user information profile card and triggers logout on Sign Out click', () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <MoreMenuPage />
          </ToastProvider>
        </QueryClientProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('Samir Zade')).toBeDefined();
    expect(screen.getByText('samir@example.com')).toBeDefined();
    expect(screen.getByText('● Active')).toBeDefined();

    const signOutBtn = screen.getByRole('button', { name: /Sign Out/i });
    expect(signOutBtn).toBeDefined();

    fireEvent.click(signOutBtn);
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });
});
