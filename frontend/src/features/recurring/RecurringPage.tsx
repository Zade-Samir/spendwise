import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Repeat,
  Clock,
  Edit2,
  Trash2,
  PauseCircle,
  PlayCircle,
  ArrowLeft,
} from 'lucide-react';
import {
  useRecurringRules,
  useCreateRecurringRule,
  useUpdateRecurringRule,
  useDeleteRecurringRule,
} from './useRecurring';
import { RecurringRule, RecurringRuleCreateRequest, RecurringRuleUpdateRequest } from '../../types/recurring';
import { RecurringFormModal } from './RecurringFormModal';
import { formatINR, formatPaymentMethod } from '../../lib/money';
import { CategoryIcon } from '../../components/ui/CategoryIcon';
import { useToast } from '../../components/ui/useToast';

export const RecurringPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: rules = [], isLoading } = useRecurringRules();
  const createMutation = useCreateRecurringRule();
  const updateMutation = useUpdateRecurringRule();
  const deleteMutation = useDeleteRecurringRule();
  const { showToast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RecurringRule | null>(null);

  // Compute monthly-equivalent commitment for active rules
  const totalMonthlyCommitmentMinor = useMemo(() => {
    return rules
      .filter((r) => r.active)
      .reduce((sum, r) => {
        if (r.frequency === 'daily') return sum + r.amount_minor * 30;
        if (r.frequency === 'weekly') return sum + Math.round((r.amount_minor * 52) / 12);
        if (r.frequency === 'monthly') return sum + Math.round(r.amount_minor / (r.interval_count || 1));
        if (r.frequency === 'yearly') return sum + Math.round(r.amount_minor / 12);
        return sum;
      }, 0);
  }, [rules]);

  const activeCount = rules.filter((r) => r.active).length;

  const handleOpenCreate = () => {
    setEditingRule(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (rule: RecurringRule) => {
    setEditingRule(rule);
    setIsModalOpen(true);
  };

  const handleToggleActive = async (rule: RecurringRule) => {
    try {
      await updateMutation.mutateAsync({
        id: rule.id,
        data: { active: !rule.active },
      });
      showToast(`${rule.name} has been ${rule.active ? 'paused' : 'activated'}.`, { type: 'info' });
    } catch {
      showToast('Failed to update rule status.', { type: 'error' });
    }
  };

  const handleDelete = async (rule: RecurringRule) => {
    if (!window.confirm(`Delete recurring rule "${rule.name}"?`)) return;
    try {
      await deleteMutation.mutateAsync(rule.id);
      showToast(`Removed "${rule.name}".`, { type: 'success' });
    } catch {
      showToast('Failed to delete recurring rule.', { type: 'error' });
    }
  };

  const handleFormSubmit = async (data: RecurringRuleCreateRequest | RecurringRuleUpdateRequest) => {
    if (editingRule) {
      await updateMutation.mutateAsync({
        id: editingRule.id,
        data: data as RecurringRuleUpdateRequest,
      });
      showToast('Recurring rule updated successfully.', { type: 'success' });
    } else {
      await createMutation.mutateAsync(data as RecurringRuleCreateRequest);
      showToast('Recurring rule created successfully.', { type: 'success' });
    }
  };

  const formatNextDue = (dateStr?: string | null) => {
    if (!dateStr) return 'Not scheduled';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0] || '2026', 10);
      const m = parseInt(parts[1] || '1', 10) - 1;
      const d = parseInt(parts[2] || '1', 10);
      const dateObj = new Date(y, m, d);
      return dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    return dateStr;
  };

  const formatFrequencyLabel = (rule: RecurringRule) => {
    if (rule.frequency === 'daily') return 'Daily';
    if (rule.frequency === 'weekly') {
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const dayName = rule.day_of_week != null ? (days[rule.day_of_week] ?? 'Weekly') : 'Weekly';
      return `Weekly (${dayName})`;
    }
    if (rule.frequency === 'monthly') {
      const day = rule.day_of_month ?? 1;
      return rule.interval_count > 1 ? `Every ${rule.interval_count} mos (Day ${day})` : `Monthly (Day ${day})`;
    }
    if (rule.frequency === 'yearly') return 'Yearly';
    return rule.frequency;
  };

  return (
    <div className="space-y-5 pb-12 animate-in fade-in duration-150">
      {/* Page Title & Add Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              navigate(-1);
            }}
            className="p-1.5 -ml-1.5 rounded-xl text-muted hover:text-text hover:bg-surface-2 transition-colors ios-press"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-text">Recurring Obligations</h2>
            <p className="text-xs text-muted font-medium mt-0.5">
              Subscriptions, rent, EMIs, and regular commitments
            </p>
          </div>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-dark transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Add Rule</span>
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-2xl bg-surface border border-surface-2 shadow-xs">
          <p className="text-xs text-muted font-semibold">Monthly Commitment</p>
          <p className="text-xl font-extrabold text-text tabular-nums mt-1">
            {formatINR(totalMonthlyCommitmentMinor)}
          </p>
          <p className="text-[10px] text-muted font-medium mt-0.5">Active recurring rules (est.)</p>
        </div>
        <div className="p-4 rounded-2xl bg-surface border border-surface-2 shadow-xs">
          <p className="text-xs text-muted font-semibold">Active Rules</p>
          <p className="text-xl font-extrabold text-primary tabular-nums mt-1">
            {activeCount} <span className="text-xs text-muted font-normal">/ {rules.length} total</span>
          </p>
          <p className="text-[10px] text-muted font-medium mt-0.5">Auto & remind schedules</p>
        </div>
      </div>

      {/* Rules List */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-muted uppercase tracking-wider px-1">Scheduled Rules</h3>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-surface rounded-2xl border border-surface-2 animate-pulse" />
            ))}
          </div>
        ) : rules.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-surface border border-dashed border-surface-2 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-surface-2 text-muted mx-auto flex items-center justify-center">
              <Repeat className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-text">No recurring rules configured</p>
              <p className="text-xs text-muted mt-1 max-w-xs mx-auto">
                Set up recurring rules for rent, Netflix, gym, or broadband to never miss an expense.
              </p>
            </div>
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-dark transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Rule</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className={`p-4 rounded-2xl bg-surface border transition-all ${
                  rule.active ? 'border-surface-2' : 'border-surface-2/60 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start space-x-3 min-w-0">
                    <CategoryIcon
                      name={rule.category?.icon || 'Tag'}
                      color={rule.category?.color || '#3B82F6'}
                      size={18}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-extrabold text-text truncate">{rule.name}</p>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            rule.mode === 'auto_create'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                          }`}
                        >
                          {rule.mode === 'auto_create' ? 'Auto-Log' : 'Remind'}
                        </span>
                        {!rule.active && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-surface-2 text-muted">
                            Paused
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted font-medium mt-1 flex-wrap">
                        <span>{formatFrequencyLabel(rule)}</span>
                        <span>•</span>
                        <span className="font-semibold text-text">{formatPaymentMethod(rule.payment_method)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className="text-sm sm:text-base font-extrabold text-text tabular-nums">
                      {formatINR(rule.amount_minor)}
                    </p>
                  </div>
                </div>

                {/* Footer row */}
                <div className="flex items-center justify-between pt-3 mt-3 border-t border-surface-2 text-xs">
                  <div className="flex items-center gap-1.5 text-muted">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-medium">Next due: {formatNextDue(rule.next_due_date)}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(rule)}
                      className="p-2 rounded-xl text-muted hover:text-text hover:bg-surface-2 transition-colors min-touch-target flex items-center justify-center"
                      title={rule.active ? 'Pause Rule' : 'Activate Rule'}
                      aria-label={rule.active ? 'Pause Rule' : 'Activate Rule'}
                    >
                      {rule.active ? (
                        <PauseCircle className="w-4 h-4 text-amber-500" />
                      ) : (
                        <PlayCircle className="w-4 h-4 text-emerald-500" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(rule)}
                      className="p-2 rounded-xl text-muted hover:text-text hover:bg-surface-2 transition-colors min-touch-target flex items-center justify-center"
                      title="Edit Rule"
                      aria-label="Edit Rule"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(rule)}
                      className="p-2 rounded-xl text-muted hover:text-rose-500 hover:bg-rose-500/10 transition-colors min-touch-target flex items-center justify-center"
                      title="Delete Rule"
                      aria-label="Delete Rule"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <RecurringFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingRule={editingRule}
        onSubmit={handleFormSubmit}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
};
