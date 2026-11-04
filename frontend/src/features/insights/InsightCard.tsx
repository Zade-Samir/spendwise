import React, { useMemo } from 'react';
import { AlertTriangle, Sparkles, Lightbulb } from 'lucide-react';
import { Insight } from '../../types/insight';

interface InsightCardProps {
  insight: Insight;
  className?: string;
}

export const InsightCard: React.FC<InsightCardProps> = ({ insight, className = '' }) => {
  const isWarning = insight.severity === 'warning';
  const isPositive = insight.severity === 'positive';

  const badgeStyle = isWarning
    ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
    : isPositive
    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
    : 'bg-primary/10 text-primary border-primary/20';

  const cardBorder = isWarning
    ? 'border-amber-500/30 bg-amber-500/[0.03]'
    : isPositive
    ? 'border-emerald-500/30 bg-emerald-500/[0.03]'
    : 'border-surface-2 bg-surface';

  const Icon = isWarning ? AlertTriangle : isPositive ? Sparkles : Lightbulb;

  const formattedPeriod = useMemo(() => {
    if (!insight.generated_for) return '';
    if (/^\d{4}-\d{2}$/.test(insight.generated_for)) {
      const parts = insight.generated_for.split('-');
      const year = parts[0] ? parseInt(parts[0], 10) : new Date().getFullYear();
      const month = parts[1] ? parseInt(parts[1], 10) : 1;
      const d = new Date(year, month - 1, 1);
      return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
    }
    const d = new Date(insight.generated_for);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
    }
    return insight.generated_for;
  }, [insight.generated_for]);

  return (
    <div
      className={`rounded-2xl p-4 border ${cardBorder} shadow-xs ios-card flex flex-col justify-between space-y-2.5 ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${badgeStyle}`}
        >
          <Icon className="w-3 h-3 stroke-[2.5]" />
          <span>{insight.severity}</span>
        </span>
        <span className="text-[11px] font-semibold text-muted">
          {formattedPeriod}
        </span>
      </div>

      <div>
        <h4 className="text-xs font-bold text-text mb-0.5">{insight.title}</h4>
        <p className="text-xs text-muted leading-relaxed font-medium">{insight.body}</p>
      </div>
    </div>
  );
};
