import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';
import { tokenStorage } from './lib/api';

describe('App & Authentication Flow', () => {
  beforeEach(() => {
    tokenStorage.clearAll();
    vi.restoreAllMocks();
  });

  it('renders LoginPage by default when unauthenticated', () => {
    render(<App />);

    expect(screen.getByText(/Welcome Back to SpendWise/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
    expect(screen.getByText(/Create an account/i)).toBeInTheDocument();
  });

  it('validates email and password on login form submission', async () => {
    render(<App />);

    const submitBtn = screen.getByRole('button', { name: /Sign In/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Please enter a valid email address/i)).toBeInTheDocument();
    });
  });

  it('authenticates user and renders AppShell dashboard upon successful login', async () => {
    // Mock successful login and health check
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/auth/login')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              user: {
                id: '11111111-1111-1111-1111-111111111111',
                email: 'priya@example.com',
                name: 'Priya Sharma',
                currency: 'INR',
                timezone: 'Asia/Kolkata',
                week_start: 1,
                month_start_day: 1,
                default_payment_method: 'upi',
                reminder_enabled: true,
                reminder_time: '21:00:00',
                theme: 'system',
                created_at: '2026-11-02T00:00:00Z',
                updated_at: '2026-11-02T00:00:00Z',
              },
              access_token: 'fake-access-token',
              refresh_token: 'fake-refresh-token',
            }),
        });
      }

      if (url.includes('/health')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              status: 'ok',
              db: 'ok',
              environment: 'test',
              version: '0.1.0',
            }),
        });
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });
    });

    render(<App />);

    const emailInput = screen.getByLabelText(/Email Address/i);
    const passwordInput = screen.getByLabelText(/^Password$/i);
    const submitBtn = screen.getByRole('button', { name: /Sign In/i });

    fireEvent.change(emailInput, { target: { value: 'priya@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'ValidPassword123!' } });
    fireEvent.click(submitBtn);

    // Expect transition to AppShell
    await waitFor(() => {
      expect(screen.getAllByText('Priya Sharma').length).toBeGreaterThanOrEqual(1);
    });

    // Check AppShell navigation tabs
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('History')).toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
    expect(screen.getByText('More')).toBeInTheDocument();
  });
});
