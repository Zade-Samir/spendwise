import React from 'react';
import { AlertTriangle, CheckCircle2, Edit3, ShieldAlert } from 'lucide-react';
import { Budget } from '../../types/budget';
import { formatINR } from '../../lib/money';
import { CategoryIcon } from '../../components/ui/CategoryIcon';

interface OverallBudgetCardProps {
  budget: Budget;
  onEdit: () => void;
}

export const OverallBudgetCard: React.FC<OverallBudgetCardProps> = ({ budget, onEdit }) => {
  const isExceeded = budget.status === 'exceeded';
  const isWarning = budget.status === 'warning';

  const statusBg = isExceeded
    ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
    : isWarning
    ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
    : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';

  const progressColor = isExceeded
    ? 'bg-rose-500'
    : isWarning
    ? 'bg-amber-500'
    : 'bg-emerald-500';

  return (
    <div className="bg-surface rounded-3xl p-5 border border-surface-2 shadow-sm space-y-4">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-muted uppercase tracking-wider">
            Overall Monthly Budget
          </span>
          <h3 className="text-2xl font-extrabold text-text tabular-nums mt-0.5">
            {formatINR(budget.amount_minor)}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${statusBg}`}
          >
            {isExceeded ? (
              <>
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Exceeded</span>
              </>
            ) : isWarning ? (
              <>
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Warning</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>On Track</span>
              </>
            )}
          </span>
          <button
            type="button"
            onClick={onEdit}
            aria-label="Edit Overall Budget"
            className="p-1.5 rounded-xl hover:bg-surface-2 text-muted hover:text-text transition-colors"
          >
            <Edit3 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div>
        <div className="flex items-center justify-between text-xs font-bold mb-1.5">
          <span className="text-text tabular-nums">
            {formatINR(budget.spent_minor)} spent ({budget.pct_used}%)
          </span>
          <span className="text-muted tabular-nums">
            {isExceeded
              ? `Over by ${formatINR(budget.spent_minor - budget.amount_minor)}`
              : `${formatINR(budget.remaining_minor)} left`}
          </span>
        </div>
        <div className="w-full h-3 rounded-full bg-surface-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
            style={{ width: `${Math.min(budget.pct_used, 100)}%` }}
          />
        </div>
      </div>

      {/* Safe Daily Spend & Days Left Indicator */}
      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-surface-2 text-xs">
        <div className="bg-surface-2/40 rounded-2xl p-2.5">
          <span className="text-muted block text-[11px] font-medium">Safe Daily Spend</span>
          <span className="text-text font-extrabold text-sm tabular-nums">
            {formatINR(budget.safe_daily_minor)}
            <span className="text-[10px] text-muted font-normal"> / day</span>
          </span>
        </div>
        <div className="bg-surface-2/40 rounded-2xl p-2.5">
          <span className="text-muted block text-[11px] font-medium">Cycle Remaining</span>
          <span className="text-text font-extrabold text-sm tabular-nums">
            {budget.days_left}
            <span className="text-[10px] text-muted font-normal"> day{budget.days_left !== 1 ? 's' : ''}</span>
          </span>
        </div>
      </div>
    </div>
  );
};

interface CategoryBudgetCardProps {
  budget: Budget;
  onEdit: () => void;
}

export const CategoryBudgetCard: React.FC<CategoryBudgetCardProps> = ({ budget, onEdit }) => {
  const isExceeded = budget.status === 'exceeded';
  const isWarning = budget.status === 'warning';

  const progressColor = isExceeded
    ? 'bg-rose-500'
    : isWarning
    ? 'bg-amber-500'
    : 'bg-primary';

  return (
    <div
      onClick={onEdit}
      className="bg-surface rounded-2xl p-4 border border-surface-2 shadow-xs hover:border-primary/40 cursor-pointer transition-all active:scale-[0.99] space-y-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3 min-w-0">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              backgroundColor: `${budget.category?.color || '#6366F1'}15`,
              color: budget.category?.color || '#6366F1',
            }}
          >
            <CategoryIcon name={budget.category?.icon || 'tag'} className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h4 className="text-sm font-bold text-text truncate">
                {budget.category?.name || 'Category'}
              </h4>
              {isExceeded && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/15 text-rose-500 border border-rose-500/20">
                  Over
                </span>
              )}
              {isWarning && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/15 text-amber-500 border border-amber-500/20">
                  Near Limit
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted font-medium">
              Alert at {budget.alert_threshold_pct}% · {budget.days_left}d left
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-sm font-extrabold text-text tabular-nums block">
            {formatINR(budget.spent_minor)}
          </span>
          <span className="text-[11px] text-muted tabular-nums block">
            of {formatINR(budget.amount_minor)}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div>
        <div className="flex items-center justify-between text-[11px] font-medium mb-1">
          <span
            className={`font-semibold ${
              isExceeded
                ? 'text-rose-500'
                : isWarning
                ? 'text-amber-500'
                : 'text-muted'
            }`}
          >
            {budget.pct_used}% used
          </span>
          <span className="text-muted tabular-nums">
            {isExceeded
              ? `Over by ${formatINR(budget.spent_minor - budget.amount_minor)}`
              : `${formatINR(budget.remaining_minor)} left`}
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-surface-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${progressColor}`}
            style={{ width: `${Math.min(budget.pct_used, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
};
