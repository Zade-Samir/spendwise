import React, { useState, useEffect } from 'react';
import { Sheet } from '../../components/ui/Sheet';
import { parseRupeesToMinor, formatINR } from '../../lib/money';
import { CategoryTree } from '../../types/categories';
import { Transaction, PaymentMethod } from '../../types/transactions';
import { useCategories } from '../categories/useCategories';
import { useUpdateTransaction, useDeleteTransaction } from './useTransactions';
import { useToast } from '../../components/ui/useToast';
import { Trash2 } from 'lucide-react';
import { haptic } from '../../lib/haptics';

interface TransactionEditSheetProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
}

export const TransactionEditSheet: React.FC<TransactionEditSheetProps> = ({
  transaction,
  isOpen,
  onClose,
}) => {
  const { showToast } = useToast();
  const { data: categories = [] } = useCategories();
  const updateMutation = useUpdateTransaction();
  const deleteMutation = useDeleteTransaction();

  const [amountStr, setAmountStr] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [subcategoryId, setSubcategoryId] = useState<string>('');
  const [merchant, setMerchant] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('upi');

  useEffect(() => {
    if (transaction) {
      // Convert minor paise to rupee string representation
      const rupees = (transaction.amount_minor / 100).toString();
      setAmountStr(rupees);
      setCategoryId(transaction.category.id);
      setSubcategoryId(transaction.subcategory?.id || '');
      setMerchant(transaction.merchant || '');
      setDescription(transaction.description || '');
      setNotes(transaction.notes || '');
      setPaymentMethod(transaction.payment_method);
    }
  }, [transaction]);

  const selectedCategory = categories.find((c: CategoryTree) => c.id === categoryId);

  const handleSave = async () => {
    if (!transaction) return;
    const amountMinor = parseRupeesToMinor(amountStr);
    if (amountMinor <= 0) {
      showToast('Amount must be greater than 0', { type: 'error' });
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id: transaction.id,
        payload: {
          amount_minor: amountMinor,
          category_id: categoryId,
          subcategory_id: subcategoryId || null,
          merchant: merchant.trim() || null,
          description: description.trim() || null,
          notes: notes.trim() || null,
          payment_method: paymentMethod,
        },
      });
      haptic.trigger('success');
      showToast('Transaction updated', { type: 'success' });
      onClose();
    } catch {
      showToast('Failed to update transaction', { type: 'error' });
    }
  };

  const handleDelete = async () => {
    if (!transaction) return;
    try {
      await deleteMutation.mutateAsync(transaction.id);
      haptic.trigger('medium');
      showToast(`Deleted ${formatINR(transaction.amount_minor)}`, { type: 'info' });
      onClose();
    } catch {
      showToast('Failed to delete transaction', { type: 'error' });
    }
  };

  if (!transaction) return null;

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Transaction"
      description="Update expense details or remove"
    >
      <div className="space-y-3.5">
        {/* Amount */}
        <div>
          <label htmlFor="edit-amount-input" className="text-xs font-semibold text-muted block mb-1">
            Amount (₹)
          </label>
          <input
            id="edit-amount-input"
            type="number"
            step="0.01"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            className="w-full text-base font-bold px-3 py-2 rounded-xl bg-surface-2 border border-surface-2 focus:outline-none focus:border-primary text-text"
          />
        </div>

        {/* Category */}
        <div>
          <label htmlFor="edit-category-select" className="text-xs font-semibold text-muted block mb-1">
            Category
          </label>
          <select
            id="edit-category-select"
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setSubcategoryId('');
            }}
            className="w-full text-xs px-3 py-2 rounded-xl bg-surface-2 border border-surface-2 focus:outline-none focus:border-primary text-text"
          >
            {categories.map((c: CategoryTree) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Subcategory */}
        {selectedCategory && selectedCategory.children.length > 0 && (
          <div>
            <label htmlFor="edit-subcategory-select" className="text-xs font-semibold text-muted block mb-1">
              Subcategory (Optional)
            </label>
            <select
              id="edit-subcategory-select"
              value={subcategoryId}
              onChange={(e) => setSubcategoryId(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-xl bg-surface-2 border border-surface-2 focus:outline-none focus:border-primary text-text"
            >
              <option value="">None</option>
              {selectedCategory.children.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Payment Method */}
        <div>
          <span className="text-xs font-semibold text-muted block mb-1">Payment Method</span>
          <div className="flex gap-1.5">
            {(['upi', 'cash', 'card', 'bank'] as PaymentMethod[]).map((pm) => (
              <button
                key={pm}
                type="button"
                onClick={() => setPaymentMethod(pm)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors ${
                  paymentMethod === pm
                    ? 'bg-primary text-white'
                    : 'bg-surface-2 text-muted hover:text-text'
                }`}
              >
                {pm}
              </button>
            ))}
          </div>
        </div>

        {/* Merchant */}
        <div>
          <label htmlFor="edit-merchant-input" className="text-xs font-semibold text-muted block mb-1">
            Merchant / Payee
          </label>
          <input
            id="edit-merchant-input"
            type="text"
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            className="w-full text-xs px-3 py-2 rounded-xl bg-surface-2 border border-surface-2 focus:outline-none focus:border-primary text-text"
            placeholder="e.g. Swiggy"
          />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="edit-desc-input" className="text-xs font-semibold text-muted block mb-1">
            Description
          </label>
          <input
            id="edit-desc-input"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full text-xs px-3 py-2 rounded-xl bg-surface-2 border border-surface-2 focus:outline-none focus:border-primary text-text"
            placeholder="e.g. Dinner"
          />
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="edit-notes-input" className="text-xs font-semibold text-muted block mb-1">
            Notes
          </label>
          <textarea
            id="edit-notes-input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full text-xs px-3 py-2 rounded-xl bg-surface-2 border border-surface-2 focus:outline-none focus:border-primary text-text resize-none"
            placeholder="Additional details..."
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-2">
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="p-3 rounded-xl bg-danger/10 hover:bg-danger/20 text-danger transition-colors"
            title="Delete transaction"
            aria-label="Delete transaction"
          >
            <Trash2 className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="flex-1 py-3 rounded-xl bg-primary hover:bg-primary-dark text-white font-bold text-sm shadow-md transition-colors"
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </Sheet>
  );
};
