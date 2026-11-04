import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { CategoryAnalyticsItem } from '../../types/analytics';
import { formatINR } from '../../lib/money';
import { CategoryIcon } from '../../components/ui/CategoryIcon';

interface CategoryDonutChartProps {
  items: CategoryAnalyticsItem[];
  totalMinor: number;
  onSelectCategory?: (categoryId: string) => void;
  className?: string;
}

export const CategoryDonutChart: React.FC<CategoryDonutChartProps> = ({
  items,
  totalMinor,
  onSelectCategory,
  className = '',
}) => {
  // Aggregate into top 5 + "Others"
  const { chartData, displayLegend } = useMemo(() => {
    if (items.length === 0) {
      return {
        chartData: [{ name: 'No Expenses', value: 1, color: '#94A3B8' }],
        displayLegend: [],
      };
    }

    if (items.length <= 5) {
      const data = items.map((c) => ({
        id: c.category_id,
        name: c.name,
        value: c.sum_minor,
        color: c.color,
        pct: c.pct,
        icon: c.icon,
      }));
      return { chartData: data, displayLegend: data };
    }

    const top5 = items.slice(0, 5).map((c) => ({
      id: c.category_id,
      name: c.name,
      value: c.sum_minor,
      color: c.color,
      pct: c.pct,
      icon: c.icon,
    }));

    const othersSum = items.slice(5).reduce((acc, curr) => acc + curr.sum_minor, 0);
    const othersPct = totalMinor > 0 ? round1((othersSum / totalMinor) * 100) : 0;

    const data = [
      ...top5,
      {
        id: 'others',
        name: 'Others',
        value: othersSum,
        color: '#64748B',
        pct: othersPct,
        icon: 'tag',
      },
    ];

    return { chartData: data, displayLegend: data };
  }, [items, totalMinor]);

  const isEmpty = items.length === 0 || totalMinor === 0;

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* Donut Chart Container */}
      <div className="relative w-full h-52 flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length > 0) {
                  const data = payload[0];
                  if (!data || data.value === undefined) return null;
                  return (
                    <div className="bg-surface border border-surface-2 shadow-lg rounded-xl px-3 py-1.5 text-xs">
                      <p className="font-bold text-text">{data.name}</p>
                      <p className="text-muted tabular-nums">
                        {isEmpty ? '₹0' : formatINR(Number(data.value))}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={58}
              outerRadius={82}
              paddingAngle={isEmpty ? 0 : 3}
              dataKey="value"
              stroke="none"
              animationDuration={800}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center Total Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            Total Spent
          </span>
          <span className="text-lg font-extrabold text-text tabular-nums tracking-tight">
            {formatINR(totalMinor)}
          </span>
        </div>
      </div>

      {/* Interactive Legend List */}
      {!isEmpty && (
        <div className="w-full space-y-2 mt-2">
          {displayLegend.map((cat) => (
            <div
              key={cat.id}
              onClick={() => cat.id !== 'others' && onSelectCategory?.(cat.id)}
              className={`flex items-center justify-between p-2 rounded-xl transition-all ${
                cat.id !== 'others' && onSelectCategory
                  ? 'hover:bg-surface-2 cursor-pointer active:scale-[0.99]'
                  : ''
              }`}
            >
              <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                >
                  <CategoryIcon name={cat.icon} className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-semibold text-text truncate">
                  {cat.name}
                </span>
              </div>

              <div className="flex items-center space-x-3 flex-shrink-0">
                <span className="text-xs font-bold text-text tabular-nums">
                  {formatINR(cat.value)}
                </span>
                <span className="text-[11px] font-medium text-muted tabular-nums w-10 text-right">
                  {cat.pct}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

function round1(num: number): number {
  return Math.round(num * 10) / 10;
}
