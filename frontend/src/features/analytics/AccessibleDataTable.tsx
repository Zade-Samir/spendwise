import React from 'react';
import { CategoryAnalyticsItem } from '../../types/analytics';
import { formatINR } from '../../lib/money';

interface AccessibleDataTableProps {
  items: CategoryAnalyticsItem[];
  totalMinor: number;
}

export const AccessibleDataTable: React.FC<AccessibleDataTableProps> = ({
  items,
  totalMinor,
}) => {
  return (
    <div className="overflow-x-auto rounded-2xl border border-surface-2 bg-surface">
      <table
        className="w-full text-left text-xs border-collapse"
        aria-label="Category Spending Breakdown Table"
      >
        <thead>
          <tr className="border-b border-surface-2 bg-surface-2/50 text-[11px] font-bold text-muted uppercase tracking-wider">
            <th scope="col" className="p-3">
              Category
            </th>
            <th scope="col" className="p-3 text-right">
              Amount
            </th>
            <th scope="col" className="p-3 text-right">
              Count
            </th>
            <th scope="col" className="p-3 text-right">
              Share
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-2 font-medium">
          {items.map((cat) => (
            <React.Fragment key={cat.category_id}>
              <tr className="hover:bg-surface-2/40 transition-colors">
                <th scope="row" className="p-3 font-semibold text-text">
                  <div className="flex items-center space-x-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: cat.color }}
                      aria-hidden="true"
                    />
                    <span>{cat.name}</span>
                  </div>
                </th>
                <td className="p-3 text-right tabular-nums text-text font-bold">
                  {formatINR(cat.sum_minor)}
                </td>
                <td className="p-3 text-right tabular-nums text-muted">
                  {cat.count}
                </td>
                <td className="p-3 text-right tabular-nums text-text font-semibold">
                  {cat.pct}%
                </td>
              </tr>
              {cat.children.map((sub) => (
                <tr
                  key={sub.subcategory_id}
                  className="bg-surface-2/20 text-[11px] text-muted"
                >
                  <td className="p-2.5 pl-8 italic">↳ {sub.name}</td>
                  <td className="p-2.5 text-right tabular-nums">
                    {formatINR(sub.sum_minor)}
                  </td>
                  <td className="p-2.5 text-right">—</td>
                  <td className="p-2.5 text-right tabular-nums">{sub.pct}%</td>
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-surface-2 bg-surface-2/60 font-bold text-text">
            <th scope="row" className="p-3">
              Total Spend
            </th>
            <td className="p-3 text-right tabular-nums">{formatINR(totalMinor)}</td>
            <td className="p-3 text-right tabular-nums">
              {items.reduce((acc, c) => acc + c.count, 0)}
            </td>
            <td className="p-3 text-right tabular-nums">100%</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};
