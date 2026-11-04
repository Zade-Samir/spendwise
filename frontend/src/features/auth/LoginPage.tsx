import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, Wallet } from 'lucide-react';
import { useAuth } from './useAuth';
import { ApiError } from '../../lib/api';
import { haptic } from '../../lib/haptics';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData): Promise<void> => {
    setApiError(null);
    haptic.trigger('selection');
    try {
      await login(data.email, data.password);
      haptic.trigger('success');
      navigate(from, { replace: true });
    } catch (err: unknown) {
      haptic.trigger('warning');
      if (err instanceof ApiError) {
        setApiError(err.message);
      } else {
        setApiError('Unable to sign in. Please check your network connection.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col justify-center items-center px-4 py-8 safe-top safe-bottom">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-primary/10 border border-primary/25 text-primary mb-4 shadow-xl shadow-primary/10 ios-card">
            <Wallet className="w-8 h-8 stroke-[2.25]" />
          </div>
          <h1 className="text-2xl font-extrabold text-text tracking-tight">Welcome Back to SpendWise</h1>
          <p className="text-sm text-muted mt-1.5 font-medium">Smart, private expense tracking tailored for India</p>
        </div>

        {/* Login Card */}
        <div className="bg-surface border border-surface-2 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-xl ios-card">
          {apiError && (
            <div className="mb-6 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-500 text-xs font-semibold flex items-start gap-2.5">
              <span>{apiError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            <div>
              <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="priya@example.com"
                  {...register('email')}
                  className={`w-full bg-surface-2/70 border ${
                    errors.email ? 'border-rose-500 focus:border-rose-500' : 'border-surface-2 dark:border-white/10 focus:border-primary'
                  } rounded-2xl pl-10 pr-4 py-3 text-sm text-text placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all`}
                />
              </div>
              {errors.email && <p className="text-xs text-rose-500 font-medium mt-1.5">{errors.email.message}</p>}
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  {...register('password')}
                  className={`w-full bg-surface-2/70 border ${
                    errors.password ? 'border-rose-500 focus:border-rose-500' : 'border-surface-2 dark:border-white/10 focus:border-primary'
                  } rounded-2xl pl-10 pr-10 py-3 text-sm text-text placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-muted hover:text-text transition-colors p-1"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-rose-500 font-medium mt-1.5">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="ios-press w-full mt-2 bg-primary hover:bg-primary/90 text-white font-bold py-3.5 px-4 rounded-2xl text-sm transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/25 border border-white/15"
            >
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-muted font-medium">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="font-bold text-primary hover:underline underline-offset-4">
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
