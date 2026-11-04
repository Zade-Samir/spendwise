import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { X, ChevronDown, ChevronUp, Plus, Sparkles, Clock, Loader2 } from 'lucide-react';
import { parseRupeesToMinor, formatINR } from '../../lib/money';
import { AmountDisplay } from '../../components/ui/AmountDisplay';
import { Keypad } from '../../components/ui/Keypad';
import { Chip } from '../../components/ui/Chip';
import { Sheet } from '../../components/ui/Sheet';
import { CategoryIcon } from '../../components/ui/CategoryIcon';
import { useToast } from '../../components/ui/useToast';
import { haptic } from '../../lib/haptics';
import { useCategories, useCategorySuggest } from '../categories/useCategories';
import { CreateCategoryModal } from '../categories/CreateCategoryModal';
import { getPriorityCategoryIds, addPriorityCategoryId } from '../../lib/categoryPriority';
import {
  useCreateTransaction,
  useDeleteTransaction,
  useRecentMerchants,
} from '../transactions/useTransactions';
import { CategoryTree } from '../../types/categories';
import { PaymentMethod } from '../../types/transactions';

export const QuickAddPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();

  // State
  const [amountStr, setAmountStr] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('upi');
  const [merchant, setMerchant] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [showDetails, setShowDetails] = useState<boolean>(false);
  const [showMoreCategories, setShowMoreCategories] = useState<boolean>(false);
  const [moreSearch, setMoreSearch] = useState<string>('');
  const [isCreateCategoryOpen, setIsCreateCategoryOpen] = useState<boolean>(false);

  // Date selection state (default: today)
  const todayISO = useMemo(() => new Date().toISOString().split('T')[0] as string, []);
  const [occurredDate, setOccurredDate] = useState<string>(todayISO);

  const dateLabel = useMemo(() => {
    if (occurredDate === todayISO) return 'Today';
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayISO = yesterday.toISOString().split('T')[0];
    if (occurredDate === yesterdayISO) return 'Yesterday';
    const d = new Date(occurredDate + 'T12:00:00');
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }, [occurredDate, todayISO]);

  // Data queries
  const { data: categories = [], isLoading: isLoadingCategories } = useCategories();
  const { data: recentMerchants = [] } = useRecentMerchants();
  const createMutation = useCreateTransaction();
  const deleteMutation = useDeleteTransaction();

  // Debounced category suggestion based on merchant
  const { data: suggestion } = useCategorySuggest(merchant, !selectedCategoryId);

  // Auto-apply category suggestion if user hasn't explicitly picked a category
  useEffect(() => {
    if (suggestion?.category_id && !selectedCategoryId) {
      setSelectedCategoryId(suggestion.category_id);
      if (suggestion.subcategory_id) {
        setSelectedSubcategoryId(suggestion.subcategory_id);
      }
    }
  }, [suggestion, selectedCategoryId]);

  // URL Query Parameter Prefill (Mode B iOS Shortcuts / Deep Links)
  useEffect(() => {
    const prefillAmount = searchParams.get('amount');
    if (prefillAmount) {
      setAmountStr((prev) => prev || prefillAmount.replace(/[^0-9.]/g, ''));
    }

    const prefillMerchant = searchParams.get('merchant');
    if (prefillMerchant) {
      setMerchant((prev) => prev || prefillMerchant);
    }

    const prefillPm = searchParams.get('pm') || searchParams.get('payment_method');
    if (prefillPm) {
      const lowerPm = prefillPm.toLowerCase();
      if (['upi', 'cash', 'card', 'netbanking', 'other'].includes(lowerPm)) {
        setPaymentMethod(lowerPm as PaymentMethod);
      }
    }

    const prefillNotes = searchParams.get('notes') || searchParams.get('note');
    if (prefillNotes) {
      setNotes((prev) => prev || prefillNotes);
    }
  }, [searchParams]);

  // URL Category prefill when categories load
  useEffect(() => {
    const prefillCategory = searchParams.get('category');
    if (prefillCategory && categories.length > 0) {
      const match = categories.find(
        (c) =>
          c.id.toLowerCase() === prefillCategory.toLowerCase() ||
          c.name.toLowerCase() === prefillCategory.toLowerCase() ||
          c.name.toLowerCase().includes(prefillCategory.toLowerCase())
      );
      if (match) {
        setSelectedCategoryId(match.id);
      }
    }
  }, [searchParams, categories]);

  // Derived: Top 5 categories prioritized by user creation & recency, then rolling 30-day usage count
  const topCategories = useMemo(() => {
    const priorityIds = getPriorityCategoryIds();
    return [...categories]
      .sort((a, b) => {
        const aPriority = priorityIds.indexOf(a.id);
        const bPriority = priorityIds.indexOf(b.id);
        if (aPriority !== -1 && bPriority !== -1) return aPriority - bPriority;
        if (aPriority !== -1) return -1;
        if (bPriority !== -1) return 1;

        // Custom user-created categories come before system defaults
        if (!a.is_default && b.is_default) return -1;
        if (a.is_default && !b.is_default) return 1;

        return (b.usage_count_30d || 0) - (a.usage_count_30d || 0);
      })
      .slice(0, 6);
  }, [categories]);

  // Selected parent category object
  const selectedCategory = useMemo(() => {
    return categories.find((c) => c.id === selectedCategoryId) || null;
  }, [categories, selectedCategoryId]);

  // Auto-select first category if nothing selected once categories load
  useEffect(() => {
    if (!selectedCategoryId && topCategories.length > 0 && topCategories[0]) {
      setSelectedCategoryId(topCategories[0].id);
    }
  }, [selectedCategoryId, topCategories]);

  // Reset subcategory if parent category changes and doesn't own it
  const handleSelectCategory = (cat: CategoryTree) => {
    haptic.trigger('selection');
    setSelectedCategoryId(cat.id);
    setSelectedSubcategoryId(null);
  };

  // Minor amount calculation
  const amountMinor = useMemo(() => parseRupeesToMinor(amountStr), [amountStr]);
  const canSave = amountMinor > 0 && selectedCategoryId !== null && !createMutation.isPending;

  const handleSave = useCallback(async () => {
    if (!canSave || !selectedCategoryId) return;

    const clientId = crypto.randomUUID();
    const dateToSave = occurredDate === todayISO 
      ? new Date().toISOString() 
      : new Date(`${occurredDate}T12:00:00.000Z`).toISOString();

    const payload = {
      amount_minor: amountMinor,
      category_id: selectedCategoryId,
      subcategory_id: selectedSubcategoryId || undefined,
      merchant: merchant.trim() || undefined,
      description: description.trim() || undefined,
      notes: notes.trim() || undefined,
      payment_method: paymentMethod,
      client_id: clientId,
      occurred_at: dateToSave,
    };

    try {
      const created = await createMutation.mutateAsync(payload);
      addPriorityCategoryId(selectedCategoryId);
      haptic.trigger('success');
      const catName = selectedCategory?.name || 'Expense';
      const formattedAmount = formatINR(amountMinor);

      if (created.is_pending_sync) {
        showToast('Saved offline · Will sync automatically', {
          type: 'info',
        });
      } else {
        // Show Undo Toast
        showToast(`${formattedAmount} added to ${catName}`, {
          type: 'success',
          undoLabel: 'UNDO',
          undoAction: async () => {
            await deleteMutation.mutateAsync(created.id);
            showToast(`Expense reversed`, { type: 'info' });
          },
        });
      }

      // Navigate to transactions or reset
      navigate('/transactions');
    } catch {
      showToast('Failed to save transaction. Please check your inputs.', {
        type: 'error',
      });
    }
  }, [
    canSave,
    selectedCategoryId,
    occurredDate,
    todayISO,
    amountMinor,
    selectedSubcategoryId,
    merchant,
    description,
    notes,
    paymentMethod,
    createMutation,
    selectedCategory?.name,
    showToast,
    deleteMutation,
    navigate,
  ]);

  // Desktop keyboard Enter & Escape shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        const activeTag = document.activeElement?.tagName.toLowerCase();
        if (activeTag === 'textarea') return;
        if (canSave) {
          e.preventDefault();
          handleSave();
        }
      } else if (e.key === 'Escape') {
        const activeTag = document.activeElement?.tagName.toLowerCase();
        if (activeTag === 'input' || activeTag === 'textarea') {
          (document.activeElement as HTMLElement)?.blur();
        } else {
          navigate(-1);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canSave, handleSave, navigate]);

  return (
    <div className="flex flex-col min-h-[calc(100dvh-5.5rem)] max-w-lg mx-auto w-full justify-between pb-1">
      {/* Scrollable Center Form Area */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-3 px-0.5">
        {/* Top Bar */}
        <div className="flex items-center justify-between pb-1">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-2 -ml-1 rounded-full text-muted hover:text-text hover:bg-surface-2 transition-colors min-touch-target flex items-center justify-center"
            aria-label="Dismiss"
            title="Dismiss (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-sm font-bold tracking-tight text-text">Add Expense</h2>
          <label className="relative inline-flex items-center gap-1.5 text-xs font-semibold text-text bg-surface-2 hover:bg-surface-2/80 px-3 py-1.5 rounded-full cursor-pointer transition-colors border border-surface-2 dark:border-white/10 ios-press">
            <Clock className="w-3.5 h-3.5 text-primary pointer-events-none" />
            <span className="pointer-events-none">{dateLabel}</span>
            <input
              type="date"
              max={todayISO}
              value={occurredDate}
              onChange={(e) => {
                if (e.target.value) {
                  haptic.trigger('selection');
                  setOccurredDate(e.target.value);
                }
              }}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              aria-label="Select expense date"
            />
          </label>
        </div>

        {/* Amount Display — Tapping brings back keypad if details are open */}
        <div
          onClick={() => {
            if (showDetails) setShowDetails(false);
          }}
          className={showDetails ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''}
          title={showDetails ? 'Click to show numeric keypad' : undefined}
        >
          <AmountDisplay value={amountStr} />
        </div>

        {/* Category Chips Carousel */}
        <div className="mt-1 mb-2">
          <div className="flex items-center justify-between px-1 mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">
              Category
            </span>
            {suggestion?.confidence && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                <Sparkles className="w-3 h-3" /> Auto-suggested
              </span>
            )}
          </div>

          {isLoadingCategories ? (
            <div className="flex gap-2 overflow-hidden py-1">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-8 w-20 bg-surface-2 rounded-full animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {topCategories.map((cat) => (
                <Chip
                  key={cat.id}
                  label={cat.name}
                  color={cat.color}
                  selected={selectedCategoryId === cat.id}
                  onClick={() => handleSelectCategory(cat)}
                  icon={<CategoryIcon name={cat.icon} className="w-3.5 h-3.5" />}
                />
              ))}
              <Chip
                label="More"
                selected={
                  selectedCategory !== null &&
                  !topCategories.some((c) => c.id === selectedCategoryId)
                }
                onClick={() => setShowMoreCategories(true)}
                icon={<Plus className="w-3.5 h-3.5" />}
              />
              <button
                type="button"
                onClick={() => {
                  haptic.trigger('selection');
                  setIsCreateCategoryOpen(true);
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold border border-dashed border-primary/50 text-primary bg-primary/5 hover:bg-primary/10 ios-press transition-all flex-shrink-0"
              >
                <Plus className="w-3 h-3 stroke-[2.5]" />
                <span>Custom</span>
              </button>
            </div>
          )}

          {/* Subcategories if any */}
          {selectedCategory && selectedCategory.children.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pt-2 pb-1">
              <span className="text-xs font-medium text-muted pl-1 pr-0.5 flex-shrink-0">
                Sub:
              </span>
              {selectedCategory.children.map((sub) => (
                <Chip
                  key={sub.id}
                  size="sm"
                  label={sub.name}
                  selected={selectedSubcategoryId === sub.id}
                  onClick={() =>
                    setSelectedSubcategoryId(
                      selectedSubcategoryId === sub.id ? null : sub.id
                    )
                  }
                />
              ))}
            </div>
          )}
        </div>

        {/* Payment Method Selector */}
        <div className="flex items-center justify-between bg-surface-2/60 p-1 rounded-xl mb-2 border border-surface-2 dark:border-white/5">
          {(['upi', 'cash', 'card', 'bank'] as PaymentMethod[]).map((pm) => (
            <button
              key={pm}
              type="button"
              onClick={() => {
                haptic.trigger('selection');
                setPaymentMethod(pm);
              }}
              className={`ios-press flex-1 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all min-h-[36px] ${
                paymentMethod === pm
                  ? 'bg-surface text-primary shadow-xs border border-surface-2 dark:border-white/10'
                  : 'text-muted hover:text-text'
              }`}
            >
              {pm}
            </button>
          ))}
        </div>

        {/* Collapsible Details Drawer */}
        <div className="bg-surface rounded-2xl border border-surface-2 overflow-hidden transition-all">
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center justify-between w-full px-3.5 py-2.5 text-xs font-semibold text-muted hover:text-text transition-colors"
          >
            <span>
              {merchant
                ? `Merchant: ${merchant}`
                : '+ Add Details (Merchant, Note)'}
            </span>
            {showDetails ? (
              <ChevronUp className="w-4 h-4 text-muted" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted" />
            )}
          </button>

          {showDetails && (
            <div className="px-3.5 pb-3.5 pt-1 space-y-2.5 border-t border-surface-2 animate-in fade-in duration-150">
              {/* Merchant autocomplete chips */}
              {recentMerchants.length > 0 && (
                <div>
                  <span className="text-xs font-semibold text-muted block mb-1">
                    Recent Merchants
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {recentMerchants.slice(0, 4).map((item) => (
                      <button
                        key={item.merchant}
                        type="button"
                        onClick={() => {
                          setMerchant(item.merchant);
                          if (item.last_category_id) {
                            setSelectedCategoryId(item.last_category_id);
                          }
                          if (item.last_subcategory_id) {
                            setSelectedSubcategoryId(item.last_subcategory_id);
                          }
                        }}
                        className="text-xs px-2.5 py-1 rounded-lg bg-surface-2 hover:bg-surface-2/80 text-text transition-colors font-medium"
                      >
                        {item.merchant}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="merchant-input" className="text-xs font-semibold text-muted block mb-1">
                  Merchant / Store
                </label>
                <input
                  id="merchant-input"
                  type="text"
                  placeholder="e.g. Swiggy, Uber, DMart"
                  value={merchant}
                  onChange={(e) => setMerchant(e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl bg-surface-2/70 border border-surface-2 focus:outline-none focus:border-primary text-text placeholder:text-muted/60 transition-colors"
                />
              </div>

              <div>
                <label htmlFor="description-input" className="text-xs font-semibold text-muted block mb-1">
                  Description / Item
                </label>
                <input
                  id="description-input"
                  type="text"
                  placeholder="e.g. Lunch with team, Groceries"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl bg-surface-2/70 border border-surface-2 focus:outline-none focus:border-primary text-text placeholder:text-muted/60 transition-colors"
                />
              </div>

              <div>
                <label htmlFor="notes-input" className="text-xs font-semibold text-muted block mb-1">
                  Notes
                </label>
                <input
                  id="notes-input"
                  type="text"
                  placeholder="Additional notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl bg-surface-2/70 border border-surface-2 focus:outline-none focus:border-primary text-text placeholder:text-muted/60 transition-colors"
                />
              </div>
            </div>
          )}
        </div>

        {/* Numeric Keypad — Collapsed when text details are expanded to prevent viewport collision */}
        {!showDetails ? (
          <Keypad
            value={amountStr}
            onChange={setAmountStr}
            className="mt-2 mb-1"
          />
        ) : (
          <div className="pt-2 pb-1 text-center">
            <button
              type="button"
              onClick={() => setShowDetails(false)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-2 hover:bg-surface-2/80 text-primary text-xs font-bold transition-colors"
            >
              <span>Show Numeric Keypad</span>
            </button>
          </div>
        )}
      </div>

      {/* Sticky Bottom Save Action Bar — ALWAYS VISIBLE ON SCREEN */}
      <div className="sticky bottom-0 z-20 pt-2 pb-1 bg-bg/95 backdrop-blur-md border-t border-surface-2/80 dark:border-white/5">
        <button
          type="button"
          disabled={!canSave}
          onClick={handleSave}
          className={`ios-press w-full py-3.5 rounded-2xl font-bold text-base transition-all select-none shadow-md flex items-center justify-center gap-2 ${
            canSave
              ? 'bg-primary hover:bg-primary-dark text-white shadow-primary/30 border border-white/20'
              : 'bg-surface-2 text-muted border border-surface-2 cursor-not-allowed opacity-80'
          }`}
        >
          {createMutation.isPending ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Saving...</span>
            </>
          ) : amountMinor > 0 ? (
            `Save ${formatINR(amountMinor)}`
          ) : (
            'Enter Amount'
          )}
        </button>
      </div>

      {/* More Categories Sheet */}
      <Sheet
        isOpen={showMoreCategories}
        onClose={() => setShowMoreCategories(false)}
        title="Select Category"
        description="Choose a category for this transaction"
      >
        <div className="space-y-3">
          {/* Create category shortcut button */}
          <button
            type="button"
            onClick={() => {
              haptic.trigger('selection');
              setIsCreateCategoryOpen(true);
            }}
            className="w-full py-2.5 px-3 rounded-2xl border border-dashed border-primary/50 bg-primary/5 text-primary text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-primary/10 ios-press transition-colors"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Create New Custom Category</span>
          </button>

          <input
            type="text"
            placeholder="Search categories..."
            value={moreSearch}
            onChange={(e) => setMoreSearch(e.target.value)}
            className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-surface-2 border border-surface-2 focus:outline-none focus:border-primary text-text font-medium"
          />

          <div className="grid grid-cols-2 gap-2 pt-1 max-h-[50vh] overflow-y-auto">
            {categories
              .filter((c) =>
                c.name.toLowerCase().includes(moreSearch.toLowerCase())
              )
              .map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    handleSelectCategory(cat);
                    setShowMoreCategories(false);
                  }}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-left ios-press transition-all ${
                    selectedCategoryId === cat.id
                      ? 'border-primary bg-primary/10 text-primary font-bold'
                      : 'border-surface-2 bg-surface hover:bg-surface-2 text-text'
                  }`}
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                  >
                    <CategoryIcon name={cat.icon} className="w-4 h-4" />
                  </div>
                  <span className="text-xs truncate">{cat.name}</span>
                </button>
              ))}

            {categories.filter((c) =>
              c.name.toLowerCase().includes(moreSearch.toLowerCase())
            ).length === 0 && (
              <div className="col-span-2 py-6 text-center space-y-2">
                <p className="text-xs text-muted font-medium">
                  No category named &ldquo;{moreSearch}&rdquo;
                </p>
                <button
                  type="button"
                  onClick={() => setIsCreateCategoryOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-white text-xs font-bold ios-press shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Create &ldquo;{moreSearch}&rdquo;</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </Sheet>

      {/* Custom Category Creation Modal */}
      <CreateCategoryModal
        isOpen={isCreateCategoryOpen}
        onClose={() => setIsCreateCategoryOpen(false)}
        initialName={moreSearch.trim()}
        onCreated={(newCat) => {
          setSelectedCategoryId(newCat.id);
          setSelectedSubcategoryId(null);
          setShowMoreCategories(false);
        }}
      />
    </div>
  );
};
