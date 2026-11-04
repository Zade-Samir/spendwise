import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, User as UserIcon, Wallet } from 'lucide-react';
import { useAuth } from './useAuth';
import { ApiError } from '../../lib/api';
import { haptic } from '../../lib/haptics';

const registerSchema = z.object({
  name: z.string().optional(),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
});

type RegisterFormData = z.infer<typeof registerSchema>;

export const RegisterPage: React.FC = () => {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: RegisterFormData): Promise<void> => {
    setApiError(null);
    haptic.trigger('selection');
    try {
      await registerUser(data.email, data.password, data.name || undefined);
      haptic.trigger('success');
      navigate('/', { replace: true });
    } catch (err: unknown) {
      haptic.trigger('warning');
      if (err instanceof ApiError) {
        setApiError(err.message);
      } else {
        setApiError('Unable to complete registration. Please check your network connection.');
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
          <h1 className="text-2xl font-extrabold text-text tracking-tight">Create your SpendWise Account</h1>
          <p className="text-sm text-muted mt-1.5 font-medium">Free, private, and localized for your salary cycle</p>
        </div>

        {/* Register Card */}
        <div className="bg-surface border border-surface-2 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-xl ios-card">
          {apiError && (
            <div className="mb-6 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-500 text-xs font-semibold flex items-start gap-2.5">
              <span>{apiError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div>
              <label htmlFor="name" className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">
                Full Name (Optional)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  placeholder="Priya Sharma"
                  {...register('name')}
                  className="w-full bg-surface-2/70 border border-surface-2 dark:border-white/10 focus:border-primary rounded-2xl pl-10 pr-4 py-3 text-sm text-text placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            </div>

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
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
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
              <p className="text-[11px] text-muted font-medium mt-1">Must be at least 8 characters</p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="ios-press w-full mt-3 bg-primary hover:bg-primary/90 text-white font-bold py-3.5 px-4 rounded-2xl text-sm transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/25 border border-white/15"
            >
              {isSubmitting ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-muted font-medium">
            Already have an account?{' '}
            <Link to="/login" className="font-bold text-primary hover:underline underline-offset-4">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
