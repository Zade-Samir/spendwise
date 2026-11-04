import React from 'react';
import { HeatmapPoint } from '../../types/analytics';
import { formatINR } from '../../lib/money';

interface CalendarHeatmapProps {
  points: HeatmapPoint[];
  className?: string;
}

const LEVEL_COLORS: Record<number, string> = {
  0: 'bg-surface-2/60 border-surface-2',
  1: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-800 dark:text-emerald-300',
  2: 'bg-emerald-500/40 border-emerald-500/50 text-emerald-900 dark:text-emerald-200',
  3: 'bg-emerald-500/70 border-emerald-500/80 text-white',
  4: 'bg-emerald-600 border-emerald-700 text-white shadow-xs',
};

export const CalendarHeatmap: React.FC<CalendarHeatmapProps> = ({
  points,
  className = '',
}) => {
  const daysOfWeek = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  // Pad the first week if start date does not fall on Monday
  const firstDate = points[0] ? new Date(points[0].date) : new Date();
  const dayOfWeekIndex = (firstDate.getDay() + 6) % 7; // Monday = 0
  const emptyPadding = Array.from({ length: dayOfWeekIndex });

  return (
    <div className={`bg-surface rounded-2xl border border-surface-2 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-bold text-text uppercase tracking-wider">
          Daily Spending Heatmap
        </h4>
        <div className="flex items-center space-x-1 text-[10px] text-muted">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((lvl) => (
            <div
              key={lvl}
              className={`w-2.5 h-2.5 rounded-xs border ${LEVEL_COLORS[lvl]}`}
            />
          ))}
          <span>More</span>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1.5 text-center mb-1">
        {daysOfWeek.map((day, idx) => (
          <span key={idx} className="text-[10px] font-semibold text-muted">
            {day}
          </span>
        ))}
      </div>

      {/* Heatmap grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {emptyPadding.map((_, idx) => (
          <div key={`pad-${idx}`} className="h-8 rounded-lg bg-transparent" />
        ))}
        {points.map((p) => {
          const parts = p.date.split('-');
          const dayNum = parts[2] ? parseInt(parts[2], 10) : '';

          return (
            <div
              key={p.date}
              title={`${p.date}: ${formatINR(p.sum_minor)} (${p.count} transactions)`}
              className={`h-8 rounded-lg border flex flex-col items-center justify-center text-[10px] font-semibold transition-all select-none hover:scale-105 ${
                LEVEL_COLORS[p.level] || LEVEL_COLORS[0]
              }`}
            >
              <span>{dayNum}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
