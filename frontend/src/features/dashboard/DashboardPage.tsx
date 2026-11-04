import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  ChevronRight,
  Plus,
  ArrowUpRight,
  TrendingUp,
  Receipt,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { useAnalyticsSummary, useAnalyticsByCategory, useAnalyticsTrend } from '../analytics/useAnalytics';
import { useBudgets } from '../budgets/useBudgets';
import { useTransactions } from '../transactions/useTransactions';
import { formatINR, formatPaymentMethod } from '../../lib/money';
import { CategoryDonutChart } from '../analytics/CategoryDonutChart';
import { DailyTrendChart } from '../analytics/DailyTrendChart';
import { CategoryIcon } from '../../components/ui/CategoryIcon';
import { InsightsCarousel } from '../insights/InsightsCarousel';
import { DueRecurringCard } from '../recurring/DueRecurringCard';
import { haptic } from '../../lib/haptics';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: summary, isLoading: isLoadingSummary } = useAnalyticsSummary();
  const { data: byCat, isLoading: isLoadingByCat } = useAnalyticsByCategory({ period: 'month' });
  const { data: trend, isLoading: isLoadingTrend } = useAnalyticsTrend({ period: 'month' });
  const { data: budgetData } = useBudgets();
  const { data: recentTxData } = useTransactions({ limit: 5 });

  // Time-aware personalized greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  // Formatted active month label (e.g. "November 2026")
  const activeMonthLabel = useMemo(() => {
    return new Date().toLocaleDateString('en-IN', {
      month: 'long',
      year: 'numeric',
    });
  }, []);

  const totalMonthMinor = summary?.month?.sum_minor ?? 0;
  const recentTransactions = recentTxData?.items || [];
  const isEmpty = totalMonthMinor === 0 && (!recentTransactions || recentTransactions.length === 0);

  return (
    <div className="space-y-5 pb-8 animate-in fade-in duration-150">
      {/* Top Greeting & Active Month */}
      <div className="flex items-center justify-between px-1">
        <div>
          <p className="text-xs font-medium text-muted">
            {greeting}, <span className="text-text font-bold">{user?.name || 'Explorer'}</span>
          </p>
          <h2 className="text-lg md:text-xl font-extrabold tracking-tight text-text flex items-center gap-1.5 mt-0.5">
            <span>{activeMonthLabel}</span>
          </h2>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-2 text-xs font-semibold text-muted">
          <Calendar className="w-3.5 h-3.5 text-primary" />
          <span>Active Cycle</span>
        </div>
      </div>

      {/* Warning Alert Banner */}
      {budgetData?.has_alerts && (
        <div
          onClick={() => navigate('/budgets')}
          className="flex items-center justify-between p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-semibold cursor-pointer hover:bg-amber-500/15 transition-colors"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>
              {budgetData.alert_count} budget{budgetData.alert_count > 1 ? 's' : ''} exceeded or near threshold
            </span>
          </div>
          <span className="text-[11px] font-bold underline">Review</span>
        </div>
      )}

      {/* Guided First-Run Onboarding (Displayed when no expenses recorded yet) */}
      {isEmpty && (
        <section className="ios-card bg-surface border border-primary/25 rounded-3xl p-5 shadow-sm space-y-3.5 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="w-4 h-4" />
            <h3 className="text-sm font-bold text-text">Get Started with SpendWise</h3>
          </div>
          <p className="text-xs text-muted leading-relaxed">
            Welcome to your financial command center. Complete these 3 quick steps to automate your personal finances:
          </p>
          <div className="space-y-2 pt-1">
            <div
              onClick={() => {
                haptic.trigger('selection');
                navigate('/budgets');
              }}
              className="flex items-center justify-between p-3 rounded-2xl bg-surface-2/60 hover:bg-surface-2 transition-colors cursor-pointer border border-surface-2"
            >
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">1</span>
                <div>
                  <p className="text-xs font-bold text-text">Set your monthly budget</p>
                  <p className="text-[10px] text-muted">Keep daily spending paced to your salary cycle</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted" />
            </div>

            <div
              onClick={() => {
                haptic.trigger('selection');
                navigate('/add');
              }}
              className="flex items-center justify-between p-3 rounded-2xl bg-surface-2/60 hover:bg-surface-2 transition-colors cursor-pointer border border-surface-2"
            >
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">2</span>
                <div>
                  <p className="text-xs font-bold text-text">Record your first expense</p>
                  <p className="text-[10px] text-muted">Use the tactile keypad and priority categories</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted" />
            </div>

            <div
              onClick={() => {
                haptic.trigger('selection');
                navigate('/settings/shortcuts');
              }}
              className="flex items-center justify-between p-3 rounded-2xl bg-surface-2/60 hover:bg-surface-2 transition-colors cursor-pointer border border-surface-2"
            >
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">3</span>
                <div>
                  <p className="text-xs font-bold text-text">Enable Siri & iOS Shortcuts</p>
                  <p className="text-[10px] text-muted">Voice log transactions or trigger automatic prompts</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted" />
            </div>
          </div>
        </section>
      )}

      {/* Main Responsive Grid Layout (Single Column on mobile, 5-col split on desktop) */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
        {/* Left Primary Column (3 cols on md/lg) */}
        <div className="md:col-span-3 space-y-4">
          {/* Hero Card: Big Monthly Expenses */}
          <section className="ios-card bg-gradient-to-br from-primary via-primary-dark to-indigo-950 text-white rounded-[28px] p-5 shadow-xl shadow-primary/20 border border-white/15 relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-white/80 uppercase tracking-wider">
                  Total Spent This Month
                </span>
                <span className="text-xs bg-white/20 backdrop-blur-md px-2.5 py-0.5 rounded-full font-bold border border-white/10">
                  {summary?.month?.count || 0} expenses
                </span>
              </div>

              <div className="text-4xl font-extrabold tracking-tight tabular-nums my-2">
                {isLoadingSummary ? (
                  <div className="h-10 w-36 bg-white/20 rounded-xl animate-pulse" />
                ) : (
                  formatINR(totalMonthMinor)
                )}
              </div>

              {/* Budget progress bar or call-to-action */}
              {summary?.month_budget ? (
                <div
                  onClick={() => {
                    haptic.trigger('selection');
                    navigate('/budgets');
                  }}
                  className="mt-4 pt-3 border-t border-white/15 cursor-pointer hover:opacity-90 transition-opacity"
                >
                  <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                    <span>{summary.month_budget.pct_used}% of budget</span>
                    <span>
                      {summary.month_budget.pct_used >= 100
                        ? `${formatINR(totalMonthMinor - summary.month_budget.amount_minor)} over budget`
                        : `${formatINR(summary.month_budget.remaining_minor)} left`}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/20 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        summary.month_budget.pct_used >= 100
                          ? 'bg-rose-400'
                          : summary.month_budget.pct_used >= 80
                          ? 'bg-amber-400'
                          : 'bg-emerald-400'
                      }`}
                      style={{ width: `${Math.min(summary.month_budget.pct_used, 100)}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="mt-3 pt-3 border-t border-white/15 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-white/90 font-medium">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Daily Average: {formatINR(summary?.avg_daily_minor || 0)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      haptic.trigger('selection');
                      navigate('/budgets');
                    }}
                    className="ios-press inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white text-primary text-xs font-bold shadow-xs hover:bg-white/90 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Set Budget</span>
                  </button>
                </div>
              )}
            </div>

            {/* Decorative background glow */}
            <div className="absolute -right-8 -bottom-8 w-44 h-44 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          </section>

          {/* Pending / Due Recurring Obligations (M6) */}
          <DueRecurringCard />

          {/* Stat Row: Today & This Week */}
          <section className="grid grid-cols-2 gap-3">
            {/* Today Card */}
            <div
              onClick={() => {
                haptic.trigger('selection');
                navigate('/transactions');
              }}
              className="ios-card ios-press bg-surface rounded-2xl p-4 border border-surface-2 dark:border-white/5 shadow-xs hover:border-primary/40 cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                  Today
                </span>
                <ArrowUpRight className="w-3.5 h-3.5 text-muted group-hover:text-primary transition-colors" />
              </div>
              <p className="text-xl font-extrabold text-text tabular-nums">
                {formatINR(summary?.today?.sum_minor || 0)}
              </p>
              <p className="text-[11px] text-muted font-medium mt-0.5">
                {summary?.today?.count || 0} transaction{summary?.today?.count !== 1 ? 's' : ''}
              </p>
            </div>

            {/* This Week Card */}
            <div
              onClick={() => {
                haptic.trigger('selection');
                navigate('/transactions');
              }}
              className="ios-card ios-press bg-surface rounded-2xl p-4 border border-surface-2 dark:border-white/5 shadow-xs hover:border-primary/40 cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                  This Week
                </span>
                <TrendingUp className="w-3.5 h-3.5 text-muted group-hover:text-primary transition-colors" />
              </div>
              <p className="text-xl font-extrabold text-text tabular-nums">
                {formatINR(summary?.week?.sum_minor || 0)}
              </p>
              <p className="text-[11px] text-muted font-medium mt-0.5">
                {summary?.week?.count || 0} transaction{summary?.week?.count !== 1 ? 's' : ''}
              </p>
            </div>
          </section>

          {/* Recent Transactions List */}
          <section className="ios-card bg-surface rounded-2xl p-4 border border-surface-2 shadow-xs">
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-text">Recent Expenses</h3>
              </div>
              <button
                type="button"
                onClick={() => navigate('/transactions')}
                className="text-xs font-bold text-primary hover:underline"
              >
                View All
              </button>
            </div>

            {isEmpty ? (
              <div className="text-center py-7 px-4 flex flex-col items-center">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3">
                  <Receipt className="w-6 h-6 stroke-[1.75]" />
                </div>
                <h4 className="text-sm font-bold text-text">No expenses recorded yet</h4>
                <p className="text-xs text-muted max-w-xs mt-1 mb-4 leading-relaxed">
                  Your financial journey starts with your first entry. Log your coffee, commute, or daily shopping.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    haptic.trigger('selection');
                    navigate('/add');
                  }}
                  className="ios-press inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-primary text-white text-xs font-bold shadow-md shadow-primary/25"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Record your first expense</span>
                </button>
              </div>
            ) : (
              <div className="divide-y divide-surface-2">
                {recentTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    onClick={() => navigate('/transactions')}
                    className="py-2.5 flex items-center justify-between cursor-pointer hover:bg-surface-2/40 rounded-xl px-1 transition-colors"
                  >
                    <div className="flex items-center space-x-3 min-w-0 pr-2">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${tx.category.color}15`, color: tx.category.color }}
                      >
                        <CategoryIcon name={tx.category.icon} className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-text truncate">
                          {tx.merchant || tx.description || tx.category.name}
                        </p>
                        <p className="text-xs text-muted truncate">
                          {new Date(tx.occurred_at).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                          })} · {formatPaymentMethod(tx.payment_method)}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-extrabold text-text tabular-nums">
                      -{formatINR(tx.amount_minor)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right Secondary Column (2 cols on md/lg) */}
        <div className="md:col-span-2 space-y-4">
          {/* Category Donut Card */}
          <section className="ios-card bg-surface rounded-2xl p-4 border border-surface-2 dark:border-white/5 shadow-xs">
            <div className="flex items-center justify-between mb-2 px-1">
              <div>
                <h3 className="text-sm font-bold text-text">Where is the Money Going?</h3>
                <p className="text-[11px] text-muted">Category breakdown this month</p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/analytics')}
                className="text-xs font-bold text-primary hover:underline flex items-center gap-0.5"
              >
                <span>Details</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {isLoadingByCat ? (
              <div className="h-56 bg-surface-2/40 rounded-xl animate-pulse" />
            ) : (
              <CategoryDonutChart
                items={byCat?.items || []}
                totalMinor={byCat?.total_minor || 0}
                onSelectCategory={(catId) => navigate(`/transactions?category_id=${catId}`)}
              />
            )}
          </section>

          {/* Daily Spending Trend Card */}
          <section className="ios-card bg-surface rounded-2xl p-4 border border-surface-2 shadow-xs">
            <div className="flex items-center justify-between mb-2 px-1">
              <div>
                <h3 className="text-sm font-bold text-text">Daily Spending Trend</h3>
                <p className="text-[11px] text-muted">Day-by-day expenditure pattern</p>
              </div>
              <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                Daily Trend
              </span>
            </div>

            {isLoadingTrend ? (
              <div className="h-44 bg-surface-2/40 rounded-xl animate-pulse" />
            ) : (
              <DailyTrendChart points={trend?.points || []} height={180} />
            )}
          </section>

          {/* Spending Insights Carousel */}
          <InsightsCarousel />
        </div>
      </div>
    </div>
  );
};
