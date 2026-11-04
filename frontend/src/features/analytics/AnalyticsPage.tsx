import React, { useState } from 'react';
import {
  PieChart as PieIcon,
  BarChart3,
  TrendingUp,
  Table as TableIcon,
  Calendar,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Store,
} from 'lucide-react';
import {
  useAnalyticsByCategory,
  useAnalyticsCompare,
  useAnalyticsHeatmap,
  useAnalyticsPaymentMethod,
  useAnalyticsSummary,
  useAnalyticsTrend,
  useTopMerchants,
} from './useAnalytics';
import { formatINR, formatPaymentMethod } from '../../lib/money';
import { CategoryDonutChart } from './CategoryDonutChart';
import { DailyTrendChart } from './DailyTrendChart';
import { CalendarHeatmap } from './CalendarHeatmap';
import { AccessibleDataTable } from './AccessibleDataTable';
import { CategoryIcon } from '../../components/ui/CategoryIcon';
import { useInsights } from '../insights/useInsights';
import { InsightCard } from '../insights/InsightCard';
import { haptic } from '../../lib/haptics';

type PeriodType = 'week' | 'month' | 'last_month';
type TabType = 'overview' | 'categories' | 'trends';

export const AnalyticsPage: React.FC = () => {
  const [period, setPeriod] = useState<PeriodType>('month');
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [showTable, setShowTable] = useState<boolean>(false);
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);

  // Queries
  const { data: summary } = useAnalyticsSummary();
  const { data: byCat, isLoading: isLoadingByCat } = useAnalyticsByCategory({ period });
  const { data: trend, isLoading: isLoadingTrend } = useAnalyticsTrend({ period });
  const { data: pmData } = useAnalyticsPaymentMethod({ period });
  const { data: topMerchants } = useTopMerchants({ period, limit: 5 });
  const { data: compare } = useAnalyticsCompare('month');
  const { data: heatmap } = useAnalyticsHeatmap({ period });
  const { data: insightsData } = useInsights();

  const totalMinor = byCat?.total_minor ?? 0;
  const categories = byCat?.items || [];

  return (
    <div className="space-y-4 pb-12 animate-in fade-in duration-150">
      {/* Top Header & Accessible Table Toggle */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-lg font-extrabold tracking-tight text-text">
            Spending Analytics
          </h2>
          <p className="text-xs text-muted">Visual financial intelligence</p>
        </div>
        <button
          type="button"
          onClick={() => {
            haptic.trigger('selection');
            setShowTable(!showTable);
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ios-press transition-all ${
            showTable
              ? 'bg-primary text-white border-primary shadow-xs'
              : 'bg-surface border-surface-2 text-muted hover:text-text'
          }`}
          aria-label="Toggle Accessible Table View"
        >
          <TableIcon className="w-3.5 h-3.5" />
          <span>{showTable ? 'Charts' : 'Table'}</span>
        </button>
      </div>

      {/* Period Filter Bar */}
      <div className="flex items-center bg-surface-2/70 p-1 rounded-2xl">
        {(
          [
            { id: 'week', label: 'This Week' },
            { id: 'month', label: 'This Month' },
            { id: 'last_month', label: 'Last Month' },
          ] as { id: PeriodType; label: string }[]
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              haptic.trigger('selection');
              setPeriod(item.id);
            }}
            className={`flex-1 py-1.5 rounded-xl text-xs font-semibold ios-press transition-all ${
              period === item.id
                ? 'bg-surface text-primary shadow-xs'
                : 'text-muted hover:text-text'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Show Accessible Table if toggled */}
      {showTable ? (
        <AccessibleDataTable items={categories} totalMinor={totalMinor} />
      ) : (
        <>
          {/* Three Core Tabs: Overview · Categories · Trends */}
          <div className="flex border-b border-surface-2">
            {[
              { id: 'overview', label: 'Overview', icon: PieIcon },
              { id: 'categories', label: 'Categories', icon: BarChart3 },
              { id: 'trends', label: 'Trends', icon: TrendingUp },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    haptic.trigger('selection');
                    setActiveTab(tab.id as TabType);
                  }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold border-b-2 transition-all ${
                    isActive
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted hover:text-text'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Column: Donut & Daily Spending Pace */}
              <div className="space-y-4">
                {/* Donut Card */}
                <div className="bg-surface rounded-2xl p-4 border border-surface-2 shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-text uppercase tracking-wider">
                      Category Distribution
                    </span>
                    <span className="text-xs font-semibold text-muted">
                      {categories.length} categories
                    </span>
                  </div>
                  {isLoadingByCat ? (
                    <div className="h-56 bg-surface-2/40 rounded-xl animate-pulse" />
                  ) : (
                    <CategoryDonutChart items={categories} totalMinor={totalMinor} />
                  )}
                </div>

                {/* Key Spending Metrics Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-surface rounded-2xl p-3.5 border border-surface-2 shadow-xs">
                    <div className="flex items-center gap-1.5 text-muted text-xs font-semibold uppercase mb-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>Daily Average</span>
                    </div>
                    <p className="text-base sm:text-lg font-extrabold text-text tabular-nums">
                      {formatINR(summary?.avg_daily_minor || 0)}
                    </p>
                  </div>

                  <div className="bg-surface rounded-2xl p-3.5 border border-surface-2 shadow-xs">
                    <div className="flex items-center gap-1.5 text-muted text-xs font-semibold uppercase mb-1">
                      <Calendar className="w-3.5 h-3.5 text-primary" />
                      <span>Projected Month</span>
                    </div>
                    <p className="text-base sm:text-lg font-extrabold text-text tabular-nums">
                      {formatINR(summary?.projected_month_minor || 0)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Column: Payment Methods, Merchants & Insights */}
              <div className="space-y-4">
                {/* Payment Methods Breakdown */}
                <div className="bg-surface rounded-2xl p-4 border border-surface-2 shadow-xs">
                  <h4 className="text-xs font-bold text-text uppercase tracking-wider mb-3">
                    Payment Methods
                  </h4>
                  <div className="space-y-3">
                    {(pmData?.items || []).map((pm) => (
                      <div key={pm.payment_method}>
                        <div className="flex items-center justify-between text-xs font-semibold mb-1">
                          <span className="text-text font-bold">
                            {formatPaymentMethod(pm.payment_method)}
                          </span>
                          <div className="flex items-center space-x-2">
                            <span className="tabular-nums text-text font-bold">
                              {formatINR(pm.sum_minor)}
                            </span>
                            <span className="text-xs text-muted w-10 text-right">
                              {pm.pct}%
                            </span>
                          </div>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-surface-2 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${Math.min(pm.pct, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top Merchants Card */}
                {topMerchants && topMerchants.items.length > 0 && (
                  <div className="bg-surface rounded-2xl p-4 border border-surface-2 shadow-xs">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-text uppercase tracking-wider mb-3">
                      <Store className="w-3.5 h-3.5 text-primary" />
                      <span>Top Merchants & Payees</span>
                    </div>
                    <div className="divide-y divide-surface-2">
                      {topMerchants.items.map((m, idx) => (
                        <div key={m.merchant} className="py-2.5 flex items-center justify-between">
                          <div className="flex items-center space-x-2.5">
                            <span className="w-5 h-5 rounded-full bg-surface-2 text-muted text-xs font-bold flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span className="text-xs font-bold text-text">{m.merchant}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-text tabular-nums">
                              {formatINR(m.sum_minor)}
                            </span>
                            <span className="text-xs text-muted font-medium">
                              ({m.count}x)
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Statistical Spending Insights List */}
                {Boolean(insightsData?.items && insightsData.items.length > 0) && (
                  <div className="bg-surface rounded-2xl p-4 border border-surface-2 shadow-xs space-y-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-text uppercase tracking-wider">
                      <Sparkles className="w-3.5 h-3.5 text-primary" />
                      <span>Statistical Insights ({insightsData?.items?.length || 0})</span>
                    </div>
                    <div className="space-y-2.5">
                      {insightsData?.items?.slice(0, 4).map((it) => (
                        <InsightCard key={it.id} insight={it} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: CATEGORIES (Ranked Bars & Drilldown) */}
          {activeTab === 'categories' && (
            <div className="space-y-3">
              {categories.map((cat) => {
                const isExpanded = expandedCategoryId === cat.category_id;
                return (
                  <div
                    key={cat.category_id}
                    className="bg-surface rounded-2xl border border-surface-2 p-3.5 shadow-xs transition-all"
                  >
                    <div
                      onClick={() =>
                        cat.children.length > 0 &&
                        setExpandedCategoryId(isExpanded ? null : cat.category_id)
                      }
                      className={`flex items-center justify-between ${
                        cat.children.length > 0 ? 'cursor-pointer' : ''
                      }`}
                    >
                      <div className="flex items-center space-x-3 min-w-0 pr-2">
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                        >
                          <CategoryIcon name={cat.icon} className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-text truncate">{cat.name}</p>
                          <p className="text-[10px] text-muted">
                            {cat.count} expense{cat.count !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 flex-shrink-0">
                        <div className="text-right">
                          <span className="text-xs font-extrabold text-text tabular-nums block">
                            {formatINR(cat.sum_minor)}
                          </span>
                          <span className="text-[10px] text-muted font-bold">
                            {cat.pct}%
                          </span>
                        </div>
                        {cat.children.length > 0 && (
                          <div className="text-muted p-1">
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-1.5 rounded-full bg-surface-2 mt-2.5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(cat.pct, 100)}%`,
                          backgroundColor: cat.color,
                        }}
                      />
                    </div>

                    {/* Subcategories Breakdown Accordion */}
                    {isExpanded && cat.children.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-surface-2 space-y-2 animate-in fade-in duration-150">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1">
                          Subcategory Breakdown
                        </span>
                        {cat.children.map((sub) => (
                          <div
                            key={sub.subcategory_id}
                            className="flex items-center justify-between text-xs pl-2 py-1 bg-surface-2/40 rounded-lg pr-2"
                          >
                            <span className="text-text font-medium text-[11px]">
                              {sub.name}
                            </span>
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-text tabular-nums text-[11px]">
                                {formatINR(sub.sum_minor)}
                              </span>
                              <span className="text-[10px] text-muted font-semibold w-8 text-right">
                                {sub.pct}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 3: TRENDS & HEATMAP */}
          {activeTab === 'trends' && (
            <div className="space-y-4">
              {/* Daily Trend Chart */}
              <div className="bg-surface rounded-2xl p-4 border border-surface-2 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-text uppercase tracking-wider">
                    Daily Spending Curve
                  </h4>
                  <span className="text-[10px] font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                    Daily Activity
                  </span>
                </div>
                {isLoadingTrend ? (
                  <div className="h-44 bg-surface-2/40 rounded-xl animate-pulse" />
                ) : (
                  <DailyTrendChart points={trend?.points || []} height={180} />
                )}
              </div>

              {/* Same-Elapsed-Days Comparison Card */}
              {compare && (
                <div className="bg-surface rounded-2xl p-4 border border-surface-2 shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="text-xs font-bold text-text uppercase tracking-wider">
                        Period Comparison
                      </h4>
                      <p className="text-[10px] text-muted">
                        Fair same-elapsed-days analysis
                      </p>
                    </div>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        compare.delta_minor > 0
                          ? 'bg-rose-500/10 text-rose-500'
                          : 'bg-emerald-500/10 text-emerald-500'
                      }`}
                    >
                      {compare.delta_minor > 0 ? '+' : ''}
                      {compare.delta_pct}%
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-surface-2">
                    <div>
                      <span className="text-[10px] font-medium text-muted uppercase">
                        Current Period
                      </span>
                      <p className="text-sm font-extrabold text-text tabular-nums">
                        {formatINR(compare.current_minor)}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-medium text-muted uppercase">
                        Previous Period
                      </span>
                      <p className="text-sm font-extrabold text-text tabular-nums">
                        {formatINR(compare.previous_minor)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Calendar Heatmap */}
              <CalendarHeatmap points={heatmap?.points || []} />
            </div>
          )}
        </>
      )}
    </div>
  );
};
