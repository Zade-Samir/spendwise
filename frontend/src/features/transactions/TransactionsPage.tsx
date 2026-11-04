import React, { useState, useMemo, useEffect } from 'react';
import { Search, SlidersHorizontal, Plus, Trash2, ArrowUpRight, Clock, Download, Edit3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatINR, formatPaymentMethod } from '../../lib/money';
import { api } from '../../lib/api';
import { CategoryIcon } from '../../components/ui/CategoryIcon';
import { useToast } from '../../components/ui/useToast';
import {
  useTransactions,
  useDeleteTransaction,
  useRestoreTransaction,
  TransactionFilters,
} from './useTransactions';
import { Transaction } from '../../types/transactions';
import { TransactionFilterSheet } from './TransactionFilterSheet';
import { TransactionEditSheet } from './TransactionEditSheet';
import { haptic } from '../../lib/haptics';

export const TransactionsPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [searchInput, setSearchInput] = useState<string>('');
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');
  const [filters, setFilters] = useState<TransactionFilters>({});
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const handleExportCsv = async () => {
    try {
      setIsExporting(true);
      await api.downloadBlob('/exports/transactions.csv', 'spendwise_transactions.csv');
      showToast('Transactions exported to CSV', { type: 'success' });
    } catch {
      showToast('Failed to export transactions', { type: 'error' });
    } finally {
      setIsExporting(false);
    }
  };

  // Debounce search query 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Combine query and filters
  const activeFilters = useMemo(() => {
    return {
      ...filters,
      q: debouncedQuery || undefined,
    };
  }, [filters, debouncedQuery]);

  const { data, isLoading, isError } = useTransactions(activeFilters);
  const deleteMutation = useDeleteTransaction();
  const restoreMutation = useRestoreTransaction();

  // Active filter count (excluding query)
  const filterCount = useMemo(() => {
    let count = 0;
    if (filters.from || filters.to) count++;
    if (filters.category_id) count++;
    if (filters.payment_method) count++;
    if (filters.min_amount_minor || filters.max_amount_minor) count++;
    return count;
  }, [filters]);

  const transactions = useMemo(() => data?.items || [], [data?.items]);
  const totals = data?.totals || { count: 0, sum_minor: 0 };

  // Group transactions by calendar day using local calendar boundaries (Rule 7)
  const groupedTransactions = useMemo(() => {
    const map = new Map<string, { label: string; totalMinor: number; items: Transaction[] }>();

    transactions.forEach((tx) => {
      const d = new Date(tx.occurred_at);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateKey = `${y}-${m}-${day}`;

      if (!map.has(dateKey)) {
        // Localized day format e.g. "Monday, 2 Nov 2026"
        const label = d.toLocaleDateString('en-IN', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
        map.set(dateKey, { label, totalMinor: 0, items: [] });
      }

      const entry = map.get(dateKey)!;
      entry.items.push(tx);
      entry.totalMinor += tx.amount_minor;
    });

    // Chronologically sort groups descending by dateKey (most recent first)
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([dateKey, val]) => ({ dateKey, ...val }));
  }, [transactions]);

  const handleDelete = async (e: React.MouseEvent, tx: Transaction) => {
    e.stopPropagation();
    if (tx.is_pending_sync) {
      showToast('Cannot delete while pending sync', { type: 'info' });
      return;
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      showToast('Connect to the internet to edit or delete existing expenses', { type: 'info' });
      return;
    }
    try {
      await deleteMutation.mutateAsync(tx.id);
      showToast(`Deleted ${formatINR(tx.amount_minor)}`, {
        type: 'info',
        undoLabel: 'UNDO',
        undoAction: async () => {
          await restoreMutation.mutateAsync(tx.id);
          showToast('Transaction restored', { type: 'success' });
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete transaction';
      showToast(msg, { type: 'error' });
    }
  };

  return (
    <div className="flex flex-col min-h-full pb-8">
      {/* Sticky Header with Search & Filter */}
      <div className="sticky top-0 z-20 bg-bg/95 backdrop-blur-md pb-2 pt-1">
        <div className="flex items-center gap-2">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search merchant, notes..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-2 rounded-xl bg-surface border border-surface-2 focus:outline-none focus:border-primary text-text placeholder:text-muted/70 shadow-xs"
            />
          </div>

          {/* Filter Button */}
          <button
            type="button"
            onClick={() => setIsFilterOpen(true)}
            className={`relative p-2 rounded-xl border transition-all ${
              filterCount > 0
                ? 'bg-primary/10 border-primary text-primary'
                : 'bg-surface border-surface-2 text-muted hover:text-text'
            }`}
            aria-label="Filter transactions"
          >
            <SlidersHorizontal className="w-4 h-4" />
            {filterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">
                {filterCount}
              </span>
            )}
          </button>

          {/* Export Button */}
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={isExporting}
            className="p-2 rounded-xl border bg-surface border-surface-2 text-muted hover:text-text hover:border-primary/40 transition-all disabled:opacity-50"
            title="Export CSV"
            aria-label="Export CSV"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>

        {/* Financial Totals Reconciliation Bar */}
        <div className="flex items-center justify-between px-1 mt-2 text-xs font-medium text-muted">
          <span>{totals.count} transactions</span>
          <span className="font-bold text-text tabular-nums">
            Total: {formatINR(totals.sum_minor)}
          </span>
        </div>
      </div>

      {/* Main List */}
      <div className="mt-2 flex-1">
        {isLoading ? (
          <div className="space-y-3 py-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-16 bg-surface rounded-2xl border border-surface-2 animate-pulse"
              />
            ))}
          </div>
        ) : isError ? (
          <div className="text-center py-12 text-muted">
            <p className="text-sm font-medium">Failed to load transactions</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-2 text-xs text-primary font-bold hover:underline"
            >
              Retry
            </button>
          </div>
        ) : groupedTransactions.length === 0 ? (
          /* Inviolable Rule 9: Clean empty state */
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-3 shadow-xs">
              <Plus className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-text tracking-tight">
              No transactions yet
            </h3>
            <p className="text-xs text-muted max-w-xs mt-1 mb-5">
              {filterCount > 0 || debouncedQuery
                ? 'No expenses matched your search or filters.'
                : 'Start tracking your digital and cash spending in seconds.'}
            </p>
            {filterCount > 0 || debouncedQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  setFilters({});
                }}
                className="px-4 py-2 rounded-xl bg-surface-2 text-text font-semibold text-xs hover:bg-surface-2/80 transition-colors"
              >
                Clear Filters
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate('/add')}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-dark text-white font-bold text-xs shadow-md transition-all active:scale-95"
              >
                <span>Record First Expense</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {groupedTransactions.map((group) => (
              <div key={group.dateKey} className="space-y-2">
                {/* Day Header */}
                <div className="flex items-center justify-between px-1 text-xs font-bold tracking-wider text-muted uppercase">
                  <span>{group.label}</span>
                  <span className="tabular-nums font-extrabold text-text">
                    {formatINR(group.totalMinor)}
                  </span>
                </div>

                {/* Day Items — Responsive Hybrid Card/Row */}
                <div className="bg-surface rounded-2xl border border-surface-2 divide-y divide-surface-2 overflow-hidden shadow-xs">
                  {group.items.map((tx) => (
                    <div
                      key={tx.id}
                      onClick={() => {
                        haptic.trigger('selection');
                        if (tx.is_pending_sync) {
                          showToast('This expense is pending sync. It will sync automatically when online.', {
                            type: 'info',
                          });
                          return;
                        }
                        if (typeof navigator !== 'undefined' && !navigator.onLine) {
                          showToast('Connect to the internet to edit or delete existing expenses', {
                            type: 'info',
                          });
                          return;
                        }
                        setEditingTransaction(tx);
                      }}
                      className="ios-press flex items-center justify-between p-3.5 hover:bg-surface-2/40 cursor-pointer transition-colors group gap-3"
                    >
                      {/* Left: Icon & Merchant & Category */}
                      <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-xs"
                          style={{
                            backgroundColor: `${tx.category.color}15`,
                            color: tx.category.color,
                          }}
                        >
                          <CategoryIcon
                            name={tx.category.icon}
                            className="w-4 h-4"
                          />
                        </div>
                        <div className="min-w-0 flex-1 md:grid md:grid-cols-2 md:gap-4 md:items-center">
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-bold text-text truncate">
                              {tx.merchant || tx.description || tx.category.name}
                            </p>
                            {tx.description && tx.merchant && (
                              <p className="text-[11px] text-muted truncate hidden sm:block">
                                {tx.description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 md:mt-0 flex-wrap">
                            <span className="text-[11px] font-medium text-muted truncate">
                              {tx.subcategory?.name || tx.category.name}
                            </span>
                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-surface-2 text-text border border-surface-2">
                              {formatPaymentMethod(tx.payment_method)}
                            </span>
                            {tx.is_pending_sync && (
                              <span
                                className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-500"
                                title="Pending offline sync"
                              >
                                <Clock className="w-2.5 h-2.5" />
                                <span>Pending</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Amount & Actions */}
                      <div className="flex items-center space-x-3 flex-shrink-0">
                        <span className="text-sm sm:text-base font-extrabold tabular-nums text-text">
                          -{formatINR(tx.amount_minor)}
                        </span>
                        <div
                          className="flex items-center gap-0.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => setEditingTransaction(tx)}
                            className="p-1.5 rounded-lg text-muted hover:text-text hover:bg-surface-2 transition-colors hidden sm:flex items-center justify-center min-touch-target"
                            title="Edit"
                            aria-label="Edit transaction"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDelete(e, tx)}
                            className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors flex items-center justify-center min-touch-target"
                            title="Delete"
                            aria-label="Delete transaction"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filter Bottom Sheet */}
      <TransactionFilterSheet
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        filters={filters}
        onApply={(newFilters) => setFilters(newFilters)}
      />

      {/* Edit Bottom Sheet */}
      <TransactionEditSheet
        isOpen={editingTransaction !== null}
        onClose={() => setEditingTransaction(null)}
        transaction={editingTransaction}
      />
    </div>
  );
};
