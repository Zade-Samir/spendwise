import React, { useState, useEffect } from 'react';
import { Trash2, BellRing } from 'lucide-react';
import { Sheet } from '../../components/ui/Sheet';
import { Budget, BudgetUpsertPayload } from '../../types/budget';
import { Category } from '../../types/categories';
import { parseRupeesToMinor, formatINR } from '../../lib/money';
import { CategoryIcon } from '../../components/ui/CategoryIcon';
import { haptic } from '../../lib/haptics';

interface BudgetSheetProps {
  isOpen: boolean;
  onClose: () => void;
  budget?: Budget | null;
  categories: Category[];
  onSave: (payload: BudgetUpsertPayload) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

export const BudgetSheet: React.FC<BudgetSheetProps> = ({
  isOpen,
  onClose,
  budget,
  categories,
  onSave,
  onDelete,
}) => {
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [amountStr, setAmountStr] = useState<string>('');
  const [thresholdPct, setThresholdPct] = useState<number>(80);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state when editing or creating
  useEffect(() => {
    if (budget) {
      setSelectedCatId(budget.category ? budget.category.id : null);
      setAmountStr(String(budget.amount_minor / 100));
      setThresholdPct(budget.alert_threshold_pct);
    } else {
      setSelectedCatId(null);
      setAmountStr('');
      setThresholdPct(80);
    }
    setError(null);
  }, [budget, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const amountMinor = parseRupeesToMinor(amountStr);
    if (amountMinor <= 0) {
      setError('Please enter a valid budget amount greater than 0');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSave({
        category_id: selectedCatId,
        period: 'monthly',
        amount_minor: amountMinor,
        alert_threshold_pct: thresholdPct,
      });
      haptic.trigger('success');
      onClose();
    } catch (err: unknown) {
      haptic.trigger('warning');
      const msg = err instanceof Error ? err.message : 'Failed to save budget';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!budget || !onDelete) return;
    try {
      setIsDeleting(true);
      await onDelete(budget.id);
      haptic.trigger('medium');
      onClose();
    } catch (err: unknown) {
      haptic.trigger('warning');
      const msg = err instanceof Error ? err.message : 'Failed to delete budget';
      setError(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const parsedMinor = parseRupeesToMinor(amountStr);
  const thresholdMinor = Math.floor((parsedMinor * thresholdPct) / 100);

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={budget ? 'Edit Budget' : 'Set New Budget'}
      description="Define an expenditure limit and receive notifications before overspending."
    >
      <form onSubmit={handleSubmit} className="space-y-5 py-2">
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs font-medium text-rose-500">
            {error}
          </div>
        )}

        {/* Category Picker or Overall Toggle */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-text uppercase tracking-wider">
            Budget Scope
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                haptic.trigger('selection');
                setSelectedCatId(null);
              }}
              className={`p-3 rounded-2xl border text-left flex items-center gap-2.5 ios-press transition-all ${
                selectedCatId === null
                  ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                  : 'border-surface-2 bg-surface text-muted hover:border-surface-2/80'
              }`}
            >
              <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center text-primary font-bold">
                ₹
              </div>
              <div>
                <span className="text-xs font-bold block text-text">Overall Monthly</span>
                <span className="text-[10px] text-muted block">All categories</span>
              </div>
            </button>

            <select
              value={selectedCatId || ''}
              onChange={(e) => {
                haptic.trigger('selection');
                setSelectedCatId(e.target.value ? e.target.value : null);
              }}
              className="p-3 rounded-2xl border border-surface-2 bg-surface text-xs font-bold text-text focus:outline-hidden focus:border-primary"
            >
              <option value="">Specific Category...</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Selected Category Preview */}
        {selectedCatId && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-2/40 border border-surface-2 text-xs">
            {(() => {
              const cat = categories.find((c) => c.id === selectedCatId);
              return cat ? (
                <>
                  <div
                    className="w-6 h-6 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                  >
                    <CategoryIcon name={cat.icon} className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-bold text-text">{cat.name}</span>
                  <span className="text-muted text-[11px]">includes all subcategories</span>
                </>
              ) : null;
            })()}
          </div>
        )}

        {/* Budget Amount Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-text uppercase tracking-wider">
            Monthly Limit (₹)
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted font-bold text-lg">
              ₹
            </div>
            <input
              type="number"
              inputMode="decimal"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="e.g. 15,000"
              className="w-full pl-8 pr-4 py-3 rounded-2xl bg-surface border border-surface-2 text-base font-extrabold text-text placeholder:text-muted/50 focus:outline-hidden focus:border-primary"
            />
          </div>
        </div>

        {/* Alert Threshold Slider */}
        <div className="space-y-2 bg-surface-2/30 rounded-2xl p-4 border border-surface-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="flex items-center gap-1.5 text-text">
              <BellRing className="w-3.5 h-3.5 text-amber-500" />
              <span>Warning Threshold</span>
            </span>
            <span className="text-primary tabular-nums">{thresholdPct}%</span>
          </div>
          <input
            type="range"
            min="50"
            max="100"
            step="5"
            value={thresholdPct}
            onChange={(e) => setThresholdPct(Number(e.target.value))}
            className="w-full accent-primary h-2 bg-surface-2 rounded-lg cursor-pointer"
          />
          <p className="text-[11px] text-muted font-medium">
            Notify me when spending reaches {thresholdPct}%
            {parsedMinor > 0 && ` (${formatINR(thresholdMinor)})`}.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 px-4 rounded-2xl bg-primary hover:bg-primary-dark ios-press text-white font-extrabold text-sm shadow-md transition-all disabled:opacity-50"
          >
            {isSubmitting ? 'Saving Budget...' : budget ? 'Update Budget' : 'Create Budget'}
          </button>

          {budget && onDelete && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="w-full py-2.5 px-4 rounded-2xl border border-rose-500/20 text-rose-500 hover:bg-rose-500/10 font-bold text-xs flex items-center justify-center gap-1.5 ios-press transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isDeleting ? 'Deleting...' : 'Delete Budget'}</span>
            </button>
          )}
        </div>
      </form>
    </Sheet>
  );
};
