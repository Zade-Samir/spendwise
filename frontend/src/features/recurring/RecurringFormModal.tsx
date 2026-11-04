import React, { useState, useEffect } from 'react';
import { Sheet } from '../../components/ui/Sheet';
import { useCategories } from '../categories/useCategories';
import {
  RecurringRule,
  RecurringRuleCreateRequest,
  RecurringRuleUpdateRequest,
  RecurringFrequency,
  RecurringMode,
} from '../../types/recurring';
import { CategoryChild } from '../../types/categories';
import { parseRupeesToMinor } from '../../lib/money';
import { Loader2 } from 'lucide-react';
import { haptic } from '../../lib/haptics';

interface RecurringFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingRule?: RecurringRule | null;
  onSubmit: (data: RecurringRuleCreateRequest | RecurringRuleUpdateRequest) => Promise<void>;
  isLoading: boolean;
}

const FREQUENCY_OPTIONS: { label: string; value: RecurringFrequency }[] = [
  { label: 'Monthly', value: 'monthly' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Daily', value: 'daily' },
  { label: 'Yearly', value: 'yearly' },
];

const PAYMENT_METHODS = [
  { label: 'UPI', value: 'upi' },
  { label: 'Card', value: 'card' },
  { label: 'Net Banking', value: 'netbanking' },
  { label: 'Cash', value: 'cash' },
];

export const RecurringFormModal: React.FC<RecurringFormModalProps> = ({
  isOpen,
  onClose,
  editingRule,
  onSubmit,
  isLoading,
}) => {
  const { data: categories = [] } = useCategories();

  const [name, setName] = useState('');
  const [amountRupees, setAmountRupees] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly');
  const [dayOfMonth, setDayOfMonth] = useState('1');
  const [dayOfWeek, setDayOfWeek] = useState('0');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [mode, setMode] = useState<RecurringMode>('remind');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (editingRule) {
      setName(editingRule.name);
      setAmountRupees((editingRule.amount_minor / 100).toFixed(2));
      setCategoryId(editingRule.category_id);
      setSubcategoryId(editingRule.subcategory_id ?? '');
      setPaymentMethod(editingRule.payment_method);
      setFrequency(editingRule.frequency);
      setDayOfMonth(String(editingRule.day_of_month ?? 1));
      setDayOfWeek(String(editingRule.day_of_week ?? 0));
      setStartDate(editingRule.start_date);
      setEndDate(editingRule.end_date ?? '');
      setMode(editingRule.mode);
    } else {
      setName('');
      setAmountRupees('');
      setCategoryId(categories.length > 0 ? (categories[0]?.id ?? '') : '');
      setSubcategoryId('');
      setPaymentMethod('upi');
      setFrequency('monthly');
      setDayOfMonth(String(new Date().getDate()));
      setDayOfWeek('0');
      setStartDate(new Date().toISOString().split('T')[0]);
      setEndDate('');
      setMode('remind');
    }
    setFormError(null);
  }, [editingRule, isOpen, categories]);

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const subcategories: CategoryChild[] = selectedCategory?.children ?? [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('Please enter a name for this recurring obligation.');
      return;
    }
    const minor = parseRupeesToMinor(amountRupees);
    if (minor <= 0) {
      setFormError('Please enter a valid amount greater than ₹0.');
      return;
    }
    if (!categoryId) {
      setFormError('Please select a category.');
      return;
    }

    try {
      const commonFields = {
        name: name.trim(),
        amount_minor: minor,
        category_id: categoryId,
        subcategory_id: subcategoryId || null,
        payment_method: paymentMethod,
        frequency,
        interval_count: 1,
        day_of_month: frequency === 'monthly' || frequency === 'yearly' ? parseInt(dayOfMonth, 10) || 1 : null,
        day_of_week: frequency === 'weekly' ? parseInt(dayOfWeek, 10) || 0 : null,
        start_date: startDate,
        end_date: endDate.trim() ? endDate : null,
        mode,
        notify_days_before: 1,
      };

      await onSubmit(commonFields);
      haptic.trigger('success');
      onClose();
    } catch (err: unknown) {
      haptic.trigger('warning');
      setFormError(err instanceof Error ? err.message : 'Failed to save recurring rule.');
    }
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={editingRule ? 'Edit Recurring Rule' : 'New Recurring Obligation'}
      description="Automate subscriptions, rent, SIPs, and regular bills"
      maxHeight="max-h-[90vh]"
    >
      <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
        {formError && (
          <div className="p-3 text-xs rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold border border-rose-500/20">
            {formError}
          </div>
        )}

        {/* Rule Name */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-muted">Rule Name / Bill Title *</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Netflix, Airtel Broadband, House Rent"
            className="w-full px-3.5 py-2.5 rounded-xl bg-surface-2 text-sm text-text border border-surface-2 focus:outline-hidden focus:border-primary font-medium"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Amount in INR */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted">Amount (₹) *</label>
            <input
              type="number"
              step="any"
              min="1"
              required
              value={amountRupees}
              onChange={(e) => setAmountRupees(e.target.value)}
              placeholder="e.g. 499"
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-2 text-sm text-text border border-surface-2 focus:outline-hidden focus:border-primary font-bold tabular-nums"
            />
          </div>

          {/* Payment Method */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-surface-2 text-sm text-text border border-surface-2 focus:outline-hidden focus:border-primary font-medium"
            >
              {PAYMENT_METHODS.map((pm) => (
                <option key={pm.value} value={pm.value}>
                  {pm.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Category & Subcategory */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted">Category *</label>
            <select
              required
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setSubcategoryId('');
              }}
              className="w-full px-3 py-2.5 rounded-xl bg-surface-2 text-sm text-text border border-surface-2 focus:outline-hidden focus:border-primary font-medium"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted">Subcategory</label>
            <select
              value={subcategoryId}
              onChange={(e) => setSubcategoryId(e.target.value)}
              disabled={subcategories.length === 0}
              className="w-full px-3 py-2.5 rounded-xl bg-surface-2 text-sm text-text border border-surface-2 focus:outline-hidden focus:border-primary font-medium disabled:opacity-40"
            >
              <option value="">None</option>
              {subcategories.map((sc: CategoryChild) => (
                <option key={sc.id} value={sc.id}>
                  {sc.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Frequency */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted">Frequency</label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}
              className="w-full px-3 py-2.5 rounded-xl bg-surface-2 text-sm text-text border border-surface-2 focus:outline-hidden focus:border-primary font-medium"
            >
              {FREQUENCY_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          {(frequency === 'monthly' || frequency === 'yearly') ? (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted">Day of Month</label>
              <input
                type="number"
                min="1"
                max="31"
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-2 text-sm text-text border border-surface-2 focus:outline-hidden focus:border-primary font-medium tabular-nums"
              />
            </div>
          ) : frequency === 'weekly' ? (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted">Day of Week</label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-surface-2 text-sm text-text border border-surface-2 focus:outline-hidden focus:border-primary font-medium"
              >
                <option value="0">Monday</option>
                <option value="1">Tuesday</option>
                <option value="2">Wednesday</option>
                <option value="3">Thursday</option>
                <option value="4">Friday</option>
                <option value="5">Saturday</option>
                <option value="6">Sunday</option>
              </select>
            </div>
          ) : <div />}
        </div>

        {/* Start / End Date */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted">Start Date *</label>
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-2 text-sm text-text border border-surface-2 focus:outline-hidden focus:border-primary font-medium"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted">End Date (Optional)</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-2 text-sm text-text border border-surface-2 focus:outline-hidden focus:border-primary font-medium"
            />
          </div>
        </div>

        {/* Mode: Remind vs Auto Create */}
        <div className="space-y-1.5 pt-1">
          <label className="text-xs font-bold text-muted">Execution Mode</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                haptic.trigger('selection');
                setMode('remind');
              }}
              className={`p-3 rounded-xl border text-left ios-press transition-all ${
                mode === 'remind'
                  ? 'border-primary bg-primary/10'
                  : 'border-surface-2 bg-surface text-muted hover:bg-surface-2/50'
              }`}
            >
              <p className="text-xs font-bold text-text">Remind Me</p>
              <p className="text-[11px] text-muted mt-0.5">Show in Due card for 1-tap confirmation</p>
            </button>

            <button
              type="button"
              onClick={() => {
                haptic.trigger('selection');
                setMode('auto_create');
              }}
              className={`p-3 rounded-xl border text-left ios-press transition-all ${
                mode === 'auto_create'
                  ? 'border-primary bg-primary/10'
                  : 'border-surface-2 bg-surface text-muted hover:bg-surface-2/50'
              }`}
            >
              <p className="text-xs font-bold text-text">Auto Log</p>
              <p className="text-[11px] text-muted mt-0.5">Automatically create expense on due date</p>
            </button>
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-3">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 rounded-xl font-extrabold text-sm text-white bg-primary hover:bg-primary-dark ios-press transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-md"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : editingRule ? (
              'Save Changes'
            ) : (
              'Create Recurring Obligation'
            )}
          </button>
        </div>
      </form>
    </Sheet>
  );
};
