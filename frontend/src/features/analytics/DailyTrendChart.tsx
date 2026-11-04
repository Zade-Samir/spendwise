import React, { useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TrendPoint } from '../../types/analytics';
import { formatINR, formatINRCompact } from '../../lib/money';
import { Eye, EyeOff } from 'lucide-react';

interface DailyTrendChartProps {
  points: TrendPoint[];
  className?: string;
  height?: number;
}

export const DailyTrendChart: React.FC<DailyTrendChartProps> = ({
  points,
  className = '',
  height = 180,
}) => {
  const [excludeOutliers, setExcludeOutliers] = useState<boolean>(false);
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0] ?? '', []);

  // Detect if a single major outlier is flattening the rest of the month
  const outlierInfo = useMemo(() => {
    if (points.length < 3) return null;
    const sorted = [...points].sort((a, b) => b.sum_minor - a.sum_minor);
    const max = sorted[0];
    const secondMax = sorted[1];
    if (max && secondMax && max.sum_minor > 3 * secondMax.sum_minor && max.sum_minor > 500_000) {
      return {
        date: max.date,
        amountMinor: max.sum_minor,
        thresholdRupees: (secondMax.sum_minor * 1.25) / 100,
      };
    }
    return null;
  }, [points]);

  const chartData = useMemo(() => {
    return points.map((p) => {
      const parts = p.date.split('-');
      const day = parts[2] ? parseInt(parts[2], 10) : 1;
      const isToday = p.date === todayStr;
      const isOutlier = outlierInfo && p.date === outlierInfo.date;

      let plotRupees = p.sum_minor / 100;
      if (excludeOutliers && isOutlier && outlierInfo) {
        plotRupees = outlierInfo.thresholdRupees;
      }

      return {
        date: p.date,
        dayLabel: `${day}`,
        amountRupees: plotRupees,
        trueAmountRupees: p.sum_minor / 100,
        sum_minor: p.sum_minor,
        count: p.count,
        isToday,
        isOutlier,
      };
    });
  }, [points, todayStr, excludeOutliers, outlierInfo]);

  const isEmpty = points.length === 0 || points.every((p) => p.sum_minor === 0);

  return (
    <div className={`w-full ${className}`}>
      {outlierInfo && !isEmpty && (
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-[11px] text-muted">
            {excludeOutliers
              ? 'Showing focused daily pace (peak normalized)'
              : 'Rent/Large bill detected on chart'}
          </span>
          <button
            type="button"
            onClick={() => setExcludeOutliers(!excludeOutliers)}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
          >
            {excludeOutliers ? (
              <>
                <Eye className="w-3 h-3" />
                <span>Show full peak</span>
              </>
            ) : (
              <>
                <EyeOff className="w-3 h-3" />
                <span>Focus daily spending</span>
              </>
            )}
          </button>
        </div>
      )}

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center h-40 text-center bg-surface rounded-2xl border border-surface-2 p-4">
          <p className="text-xs font-semibold text-text">No spending recorded yet</p>
          <p className="text-[11px] text-muted mt-0.5">
            Daily trend will appear here as you log expenses.
          </p>
        </div>
      ) : (
        <div style={{ width: '100%', height }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 8, right: 8, left: -22, bottom: 0 }}
            >
              <defs>
                <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="dayLabel"
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                tick={{ fontSize: 10, fill: 'var(--muted)' }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => formatINRCompact(val * 100)}
                tick={{ fontSize: 9, fill: 'var(--muted)' }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length > 0) {
                    const data = payload[0]?.payload;
                    if (!data) return null;
                    return (
                      <div className="bg-surface border border-surface-2 shadow-lg rounded-xl px-3 py-1.5 text-xs">
                        <div className="flex items-center gap-1.5 font-bold text-text">
                          <span>{data.date}</span>
                          {data.isToday && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-primary/10 text-primary uppercase">
                              Today
                            </span>
                          )}
                          {data.isOutlier && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold">
                              Major Expense
                            </span>
                          )}
                        </div>
                        <p className="text-primary font-bold tabular-nums mt-0.5">
                          {formatINR(data.sum_minor)}
                        </p>
                        <p className="text-[10px] text-muted">
                          {data.count} transaction{data.count !== 1 ? 's' : ''}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="amountRupees"
                stroke="var(--primary)"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#trendGradient)"
                activeDot={{
                  r: 5,
                  fill: 'var(--primary)',
                  stroke: '#FFFFFF',
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
