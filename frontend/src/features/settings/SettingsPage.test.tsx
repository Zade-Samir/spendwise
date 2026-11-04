import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SettingsPage } from './SettingsPage';
import { ToastProvider } from '../../components/ui/ToastContext';
import { ThemeProvider } from '../../components/ui/ThemeProvider';
import { AuthContext } from '../auth/authContextDef';
import * as apiModule from '../../lib/api';

vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
  tokenStorage: {
    getAccessToken: () => 'fake_token',
    getRefreshToken: () => 'fake_refresh',
  },
}));

describe('SettingsPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();

    (apiModule.api.get as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.startsWith('/settings')) {
        return Promise.resolve({
          name: 'Priya',
          email: 'priya@spendwise.in',
          timezone: 'Asia/Kolkata',
          currency: 'INR',
          month_start_day: 1,
          reminder_enabled: true,
          reminder_time: '21:00',
          theme: 'system',
          has_push_subscription: false,
        });
      }
      return Promise.resolve({});
    });
  });

  it('renders notification settings, daily reminder, and shortcuts banner', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
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
              <MemoryRouter initialEntries={['/settings']}>
                <SettingsPage />
              </MemoryRouter>
            </ToastProvider>
          </AuthContext.Provider>
        </ThemeProvider>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Settings & Preferences')).toBeDefined();
      expect(screen.getByText('iOS Shortcuts & API Tokens')).toBeDefined();
      expect(screen.getByText('Evening Reminder')).toBeDefined();
      expect(screen.getByText('Asia/Kolkata')).toBeDefined();
    });
  });
});

