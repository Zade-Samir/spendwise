import React, { useState } from 'react';
import { Repeat, Check, SkipForward, Loader2, AlertCircle } from 'lucide-react';
import { useDueRecurringRules, useConfirmRecurring, useSkipRecurring } from './useRecurring';
import { formatINR } from '../../lib/money';
import { CategoryIcon } from '../../components/ui/CategoryIcon';
import { useToast } from '../../components/ui/useToast';
import { RecurringRule } from '../../types/recurring';
import { haptic } from '../../lib/haptics';

export const DueRecurringCard: React.FC = () => {
  const { data: dueRules, isLoading } = useDueRecurringRules();
  const confirmMutation = useConfirmRecurring();
  const skipMutation = useSkipRecurring();
  const { showToast } = useToast();

  const [processingId, setProcessingId] = useState<string | null>(null);

  if (isLoading || !dueRules || dueRules.length === 0) {
    return null;
  }

  const handleConfirm = async (rule: RecurringRule) => {
    try {
      setProcessingId(rule.id);
      await confirmMutation.mutateAsync({ id: rule.id });
      haptic.trigger('success');
      showToast(`Recorded ${rule.name} for ${formatINR(rule.amount_minor)}`, { type: 'success' });
    } catch {
      showToast('Failed to confirm recurring payment.', { type: 'error' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleSkip = async (rule: RecurringRule) => {
    try {
      setProcessingId(rule.id);
      await skipMutation.mutateAsync(rule.id);
      haptic.trigger('medium');
      showToast(`Skipped ${rule.name} for this cycle`, { type: 'info' });
    } catch {
      showToast('Failed to skip recurring cycle.', { type: 'error' });
    } finally {
      setProcessingId(null);
    }
  };

  const formatDueLabel = (nextDueStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(nextDueStr);
    due.setHours(0, 0, 0, 0);

    const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return `Overdue by ${Math.abs(diffDays)}d`;
    if (diffDays === 0) return 'Due Today';
    if (diffDays === 1) return 'Due Tomorrow';
    return `Due in ${diffDays} days`;
  };

  return (
    <div className="ios-card bg-surface rounded-2xl border border-surface-2 dark:border-white/5 p-4 shadow-xs space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Repeat className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-extrabold text-text">Due Recurring Obligations</h3>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-primary/10 text-primary border border-primary/20">
          {dueRules.length} pending
        </span>
      </div>

      <div className="divide-y divide-surface-2">
        {dueRules.map((rule) => {
          const isProcessing = processingId === rule.id;
          const dueLabel = formatDueLabel(rule.next_due_date);
          const isOverdue = dueLabel.includes('Overdue');

          return (
            <div key={rule.id} className="py-3 first:pt-1 last:pb-0 flex items-center justify-between gap-3">
              <div className="flex items-center space-x-3 min-w-0">
                <CategoryIcon
                  name={rule.category?.icon || 'Tag'}
                  color={rule.category?.color || '#3B82F6'}
                  size={16}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold text-text truncate">{rule.name}</p>
                    {rule.mode === 'auto_create' && (
                      <span className="text-[9px] font-semibold px-1 rounded bg-surface-2 text-muted">
                        Auto
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[11px] mt-0.5">
                    <span className="font-extrabold text-text tabular-nums">
                      {formatINR(rule.amount_minor)}
                    </span>
                    <span className="text-muted">•</span>
                    <span
                      className={`font-semibold flex items-center gap-0.5 ${
                        isOverdue ? 'text-rose-500' : 'text-amber-500'
                      }`}
                    >
                      {isOverdue && <AlertCircle className="w-3 h-3 inline" />}
                      {dueLabel}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleSkip(rule)}
                  aria-label={`Skip ${rule.name}`}
                  className="ios-press px-2.5 py-1 text-xs font-semibold rounded-lg text-muted hover:text-text hover:bg-surface-2 transition-colors disabled:opacity-50"
                  title="Skip this cycle"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleConfirm(rule)}
                  aria-label={`Confirm ${rule.name}`}
                  className="ios-press flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-white hover:bg-primary-dark transition-colors disabled:opacity-50 shadow-xs"
                >
                  {isProcessing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Confirm</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
