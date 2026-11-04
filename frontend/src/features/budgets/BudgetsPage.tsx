import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, AlertTriangle, ShieldCheck, Sparkles, ArrowLeft } from 'lucide-react';
import { useBudgets, useUpsertBudget, useDeleteBudget } from './useBudgets';
import { useCategories } from '../categories/useCategories';
import { OverallBudgetCard, CategoryBudgetCard } from './BudgetCard';
import { BudgetSheet } from './BudgetSheet';
import { Budget, BudgetUpsertPayload } from '../../types/budget';
import { haptic } from '../../lib/haptics';

export const BudgetsPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: budgetData, isLoading } = useBudgets();
  const { data: categories = [] } = useCategories();
  const upsertMutation = useUpsertBudget();
  const deleteMutation = useDeleteBudget();

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);

  const handleOpenCreate = () => {
    haptic.trigger('selection');
    setSelectedBudget(null);
    setIsSheetOpen(true);
  };

  const handleOpenEdit = (b: Budget) => {
    haptic.trigger('selection');
    setSelectedBudget(b);
    setIsSheetOpen(true);
  };

  const handleSave = async (payload: BudgetUpsertPayload) => {
    await upsertMutation.mutateAsync(payload);
  };

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync(id);
  };

  const overall = budgetData?.overall || null;
  const categoryBudgets = budgetData?.items || [];
  const hasAlerts = budgetData?.has_alerts || false;
  const alertCount = budgetData?.alert_count || 0;

  return (
    <div className="space-y-5 pb-8 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              haptic.trigger('selection');
              navigate(-1);
            }}
            className="p-1.5 -ml-1.5 rounded-xl text-muted hover:text-text hover:bg-surface-2 transition-colors ios-press"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-text">
              Budgets & Limits
            </h2>
            <p className="text-xs text-muted font-medium mt-0.5">
              Track allowances and control monthly overspending
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-primary hover:bg-primary-dark text-white font-extrabold text-xs shadow-sm ios-press transition-all"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>New Budget</span>
        </button>
      </div>

      {/* Warning Banner if any budgets exceeded or in warning state */}
      {hasAlerts && (
        <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-semibold animate-in slide-in-from-top-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <div className="flex-1">
            <span>
              {alertCount} budget{alertCount > 1 ? 's' : ''} exceeded or near threshold. Review your spending pacing below.
            </span>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          <div className="h-44 bg-surface rounded-3xl animate-pulse" />
          <div className="h-28 bg-surface rounded-2xl animate-pulse" />
          <div className="h-28 bg-surface rounded-2xl animate-pulse" />
        </div>
      ) : (
        <>
          {/* Overall Monthly Budget Section */}
          <section className="space-y-2">
            <span className="text-xs font-bold text-muted uppercase tracking-wider px-1">
              Primary Ceiling
            </span>
            {overall ? (
              <OverallBudgetCard
                budget={overall}
                onEdit={() => handleOpenEdit(overall)}
              />
            ) : (
              <div
                onClick={handleOpenCreate}
                className="bg-surface rounded-3xl p-5 border border-dashed border-surface-2 hover:border-primary/50 cursor-pointer ios-press transition-all flex flex-col items-center text-center space-y-3 group"
              >
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text">No Overall Budget Set</h3>
                  <p className="text-xs text-muted max-w-xs mt-0.5">
                    Set a total monthly expenditure limit to monitor safe daily disposable income.
                  </p>
                </div>
                <button
                  type="button"
                  className="px-4 py-1.5 rounded-xl bg-primary/10 text-primary font-bold text-xs hover:bg-primary hover:text-white ios-press transition-colors"
                >
                  + Set Monthly Limit
                </button>
              </div>
            )}
          </section>

          {/* Category Budgets Section */}
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-muted uppercase tracking-wider">
                Category Allowances ({categoryBudgets.length})
              </span>
              {categoryBudgets.length > 0 && (
                <button
                  type="button"
                  onClick={handleOpenCreate}
                  className="text-xs font-bold text-primary hover:underline"
                >
                  + Add
                </button>
              )}
            </div>

            {categoryBudgets.length === 0 ? (
              <div className="bg-surface rounded-2xl p-6 border border-surface-2 text-center space-y-2">
                <ShieldCheck className="w-8 h-8 text-muted mx-auto" />
                <h4 className="text-xs font-bold text-text">No Category Budgets Yet</h4>
                <p className="text-[11px] text-muted max-w-xs mx-auto">
                  Add specific limits for Food, Shopping, or Travel to keep discretionary purchases in check.
                </p>
                <button
                  type="button"
                  onClick={handleOpenCreate}
                  className="mt-2 text-xs font-bold text-primary hover:underline block mx-auto"
                >
                  + Create Category Budget
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {categoryBudgets.map((b) => (
                  <CategoryBudgetCard
                    key={b.id}
                    budget={b}
                    onEdit={() => handleOpenEdit(b)}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* Edit / Create Sheet */}
      <BudgetSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        budget={selectedBudget}
        categories={categories}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  );
};
