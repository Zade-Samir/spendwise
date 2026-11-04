import React, { useState } from 'react';
import { Sheet } from '../../components/ui/Sheet';
import { useCategories } from '../categories/useCategories';
import { CategoryTree } from '../../types/categories';
import { PaymentMethod } from '../../types/transactions';
import { TransactionFilters } from './useTransactions';
import { parseRupeesToMinor, formatPaymentMethod } from '../../lib/money';

interface TransactionFilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  filters: TransactionFilters;
  onApply: (filters: TransactionFilters) => void;
}

export const TransactionFilterSheet: React.FC<TransactionFilterSheetProps> = ({
  isOpen,
  onClose,
  filters,
  onApply,
}) => {
  const { data: categories = [] } = useCategories();

  const [datePreset, setDatePreset] = useState<string>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(
    filters.category_id || ''
  );
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<PaymentMethod[]>(
    filters.payment_method
      ? Array.isArray(filters.payment_method)
        ? filters.payment_method
        : [filters.payment_method]
      : []
  );
  const [minAmount, setMinAmount] = useState<string>(
    filters.min_amount_minor ? (filters.min_amount_minor / 100).toString() : ''
  );
  const [maxAmount, setMaxAmount] = useState<string>(
    filters.max_amount_minor ? (filters.max_amount_minor / 100).toString() : ''
  );

  const handleApply = () => {
    let fromDate: string | undefined;
    let toDate: string | undefined;

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (datePreset === 'today') {
      fromDate = todayStr;
      toDate = todayStr;
    } else if (datePreset === 'week') {
      const d = new Date(now);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
      const monday = new Date(d.setDate(diff));
      fromDate = monday.toISOString().split('T')[0];
      toDate = todayStr;
    } else if (datePreset === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      fromDate = startOfMonth.toISOString().split('T')[0];
      toDate = todayStr;
    } else if (datePreset === 'last_month') {
      const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      fromDate = firstDayLastMonth.toISOString().split('T')[0];
      toDate = lastDayLastMonth.toISOString().split('T')[0];
    }

    const minMinor = minAmount ? parseRupeesToMinor(minAmount) : undefined;
    const maxMinor = maxAmount ? parseRupeesToMinor(maxAmount) : undefined;

    onApply({
      ...filters,
      from: fromDate,
      to: toDate,
      category_id: selectedCategoryId || undefined,
      payment_method:
        selectedPaymentMethods.length > 0 ? selectedPaymentMethods : undefined,
      min_amount_minor: minMinor && minMinor > 0 ? minMinor : undefined,
      max_amount_minor: maxMinor && maxMinor > 0 ? maxMinor : undefined,
    });

    onClose();
  };

  const handleReset = () => {
    setDatePreset('all');
    setSelectedCategoryId('');
    setSelectedPaymentMethods([]);
    setMinAmount('');
    setMaxAmount('');
    onApply({});
    onClose();
  };

  const togglePaymentMethod = (pm: PaymentMethod) => {
    if (selectedPaymentMethods.includes(pm)) {
      setSelectedPaymentMethods(selectedPaymentMethods.filter((p) => p !== pm));
    } else {
      setSelectedPaymentMethods([...selectedPaymentMethods, pm]);
    }
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title="Filter Transactions"
      description="Refine your spending history"
    >
      <div className="space-y-4">
        {/* Date presets */}
        <div>
          <span className="text-xs font-semibold text-muted block mb-1.5">Date Range</span>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { id: 'all', label: 'All Time' },
              { id: 'today', label: 'Today' },
              { id: 'week', label: 'This Week' },
              { id: 'month', label: 'This Month' },
              { id: 'last_month', label: 'Last Month' },
            ].map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setDatePreset(preset.id)}
                className={`py-1.5 px-2 rounded-xl text-xs font-semibold transition-all ${
                  datePreset === preset.id
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-surface-2 text-muted hover:text-text'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Category Filter */}
        <div>
          <label htmlFor="filter-category-select" className="text-xs font-semibold text-muted block mb-1.5">
            Category
          </label>
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pb-1">
            <button
              type="button"
              onClick={() => setSelectedCategoryId('')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                selectedCategoryId === ''
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-surface-2 text-muted hover:text-text'
              }`}
            >
              All
            </button>
            {categories.map((c: CategoryTree) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCategoryId(c.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  selectedCategoryId === c.id
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-surface-2 text-muted hover:text-text'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: c.color }}
                />
                <span>{c.name}</span>
              </button>
            ))}
          </div>
          {/* Accessible Select Fallback */}
          <select
            id="filter-category-select"
            value={selectedCategoryId}
            onChange={(e) => setSelectedCategoryId(e.target.value)}
            className="sr-only"
            aria-label="Filter by Category"
          >
            <option value="">All Categories</option>
            {categories.map((c: CategoryTree) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Payment Methods */}
        <div>
          <span className="text-xs font-semibold text-muted block mb-1.5">Payment Method</span>
          <div className="flex gap-1.5">
            {(['upi', 'cash', 'card', 'bank'] as PaymentMethod[]).map((pm) => (
              <button
                key={pm}
                type="button"
                onClick={() => togglePaymentMethod(pm)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors ${
                  selectedPaymentMethods.includes(pm)
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-surface-2 text-muted hover:text-text'
                }`}
              >
                {formatPaymentMethod(pm)}
              </button>
            ))}
          </div>
        </div>

        {/* Amount range */}
        <div>
          <span className="text-xs font-semibold text-muted block mb-1.5">Amount Range (₹)</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="Min"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
              className="w-1/2 text-xs px-3 py-2 rounded-xl bg-surface-2 border border-surface-2 focus:outline-none focus:border-primary text-text"
            />
            <span className="text-muted text-xs">to</span>
            <input
              type="number"
              placeholder="Max"
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
              className="w-1/2 text-xs px-3 py-2 rounded-xl bg-surface-2 border border-surface-2 focus:outline-none focus:border-primary text-text"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-3 rounded-xl bg-surface-2 text-muted hover:text-text font-semibold text-xs transition-colors"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="flex-1 py-3 rounded-xl bg-primary hover:bg-primary-dark text-white font-bold text-sm shadow-md transition-colors"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </Sheet>
  );
};
