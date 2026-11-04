import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Repeat,
  FileSpreadsheet,
  ChevronRight,
  Shield,
  Smartphone,
  Download,
  FileText,
  Loader2,
  LogOut,
  User as UserIcon,
  Target,
} from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { useBudgets } from '../budgets/useBudgets';
import { api } from '../../lib/api';
import { useToast } from '../../components/ui/useToast';
import { haptic } from '../../lib/haptics';

export const MoreMenuPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { data: budgetData } = useBudgets();
  const { showToast } = useToast();

  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  const alertCount = budgetData?.alert_count || 0;

  const handleExportCsv = async () => {
    try {
      setIsExportingCsv(true);
      await api.downloadBlob('/exports/transactions.csv', 'spendwise_transactions.csv');
      showToast('Downloaded transactions CSV with formula defense.', { type: 'success' });
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Could not export CSV.', { type: 'error' });
    } finally {
      setIsExportingCsv(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      setIsExportingExcel(true);
      await api.downloadBlob('/exports/transactions.xlsx', 'spendwise_transactions.xlsx');
      showToast('Downloaded formatted multi-sheet Excel workbook.', { type: 'success' });
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Could not export Excel file.', { type: 'error' });
    } finally {
      setIsExportingExcel(false);
    }
  };

  return (
    <div className="space-y-6 pb-8 animate-in fade-in duration-150">
      {/* User Information & Profile Card */}
      <div className="bg-surface rounded-3xl p-5 border border-surface-2 shadow-xs ios-card space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3.5 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-indigo-600 text-white font-extrabold text-base flex items-center justify-center shadow-sm flex-shrink-0">
              {user?.name ? (
                user.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()
              ) : (
                <UserIcon className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-text tracking-tight truncate">
                  {user?.name || 'SpendWise User'}
                </h3>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex-shrink-0">
                  ● Active
                </span>
              </div>
              <p className="text-xs text-muted font-medium mt-0.5 truncate">
                {user?.email}
              </p>
            </div>
          </div>
        </div>

        {/* Action Row: Settings shortcut + Sign Out */}
        <div className="flex items-center gap-2 pt-2 border-t border-surface-2">
          <button
            type="button"
            onClick={() => {
              haptic.trigger('selection');
              navigate('/settings');
            }}
            className="flex-1 py-2.5 px-3 rounded-xl bg-surface-2/60 hover:bg-surface-2 text-text font-bold text-xs transition-colors ios-press flex items-center justify-center gap-1.5"
          >
            <span>Account Settings</span>
          </button>
          <button
            type="button"
            onClick={() => {
              haptic.trigger('medium');
              logout();
            }}
            className="py-2.5 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/15 text-rose-500 font-bold text-xs transition-colors ios-press flex items-center gap-1.5 border border-rose-500/20"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-extrabold tracking-tight text-text">Features & Tools</h2>
        <p className="text-xs text-muted font-medium mt-0.5">
          Budgets, recurring automation, statements, and shortcuts
        </p>
      </div>

      {/* Feature Menu List */}
      <div className="bg-surface rounded-2xl border border-surface-2 divide-y divide-surface-2 overflow-hidden shadow-xs ios-card">
        {/* Budgets & Limits */}
        <div
          onClick={() => {
            haptic.trigger('selection');
            navigate('/budgets');
          }}
          className="p-4 flex items-center justify-between hover:bg-surface-2/40 cursor-pointer ios-press transition-colors group"
        >
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-text group-hover:text-primary transition-colors">
                  Budgets & Limits
                </span>
                {alertCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                    {alertCount} alert{alertCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted font-medium mt-0.5">
                Overall monthly limit and category allowances
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted group-hover:text-text transition-colors" />
        </div>

        {/* Recurring Expenses (Active M6) */}
        <div
          onClick={() => {
            haptic.trigger('selection');
            navigate('/recurring');
          }}
          className="p-4 flex items-center justify-between hover:bg-surface-2/40 cursor-pointer ios-press transition-colors group"
        >
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <Repeat className="w-5 h-5" />
            </div>
            <div>
              <span className="text-sm font-bold text-text group-hover:text-primary transition-colors">
                Recurring Obligations
              </span>
              <p className="text-xs text-muted font-medium mt-0.5">
                Subscriptions, rent, EMIs, and auto-logging
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted group-hover:text-text transition-colors" />
        </div>

        {/* Statement Import / Export (Active M6) */}
        <div
          onClick={() => {
            haptic.trigger('selection');
            navigate('/import');
          }}
          className="p-4 flex items-center justify-between hover:bg-surface-2/40 cursor-pointer ios-press transition-colors group"
        >
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <span className="text-sm font-bold text-text group-hover:text-primary transition-colors">
                Statement Import Wizard
              </span>
              <p className="text-xs text-muted font-medium mt-0.5">
                Bank CSV import, column mapping & duplicate filter
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted group-hover:text-text transition-colors" />
        </div>

        {/* Web Push & Shortcuts (Active M7) */}
        <div
          onClick={() => {
            haptic.trigger('selection');
            navigate('/settings/shortcuts');
          }}
          className="p-4 flex items-center justify-between hover:bg-surface-2/40 cursor-pointer ios-press transition-colors group"
        >
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <span className="text-sm font-bold text-text group-hover:text-primary transition-colors">
                Push Notifications & Shortcuts
              </span>
              <p className="text-xs text-muted font-medium mt-0.5">
                Instant Siri entry, API tokens & evening reminders
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted group-hover:text-text transition-colors" />
        </div>
      </div>

      {/* Export Section */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-muted uppercase tracking-wider px-1">
          Export Financial Data
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              haptic.trigger('selection');
              handleExportCsv();
            }}
            disabled={isExportingCsv}
            className="p-3.5 rounded-2xl bg-surface border border-surface-2 hover:border-primary/40 ios-press transition-all text-left flex items-start gap-3 shadow-xs disabled:opacity-50"
          >
            <div className="w-8 h-8 rounded-lg bg-surface-2 text-muted flex items-center justify-center flex-shrink-0">
              {isExportingCsv ? (
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
              ) : (
                <FileText className="w-4 h-4 text-primary" />
              )}
            </div>
            <div>
              <p className="text-xs font-bold text-text">Export CSV</p>
              <p className="text-[10px] text-muted mt-0.5">With formula defense</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              haptic.trigger('selection');
              handleExportExcel();
            }}
            disabled={isExportingExcel}
            className="p-3.5 rounded-2xl bg-surface border border-surface-2 hover:border-primary/40 ios-press transition-all text-left flex items-start gap-3 shadow-xs disabled:opacity-50"
          >
            <div className="w-8 h-8 rounded-lg bg-surface-2 text-muted flex items-center justify-center flex-shrink-0">
              {isExportingExcel ? (
                <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
              ) : (
                <Download className="w-4 h-4 text-emerald-500" />
              )}
            </div>
            <div>
              <p className="text-xs font-bold text-text">Export Excel</p>
              <p className="text-[10px] text-muted mt-0.5">3-sheet .xlsx workbook</p>
            </div>
          </button>
        </div>
      </div>

      {/* Trust & Privacy Notice */}
      <div className="p-4 rounded-2xl bg-surface-2/30 border border-surface-2 flex items-start gap-3">
        <Shield className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
        <div className="text-xs text-muted leading-relaxed">
          <span className="font-bold text-text">Private & Honest: </span>
          SpendWise stores data securely with integer-paise financial precision and zero third-party advertising trackers.
        </div>
      </div>
    </div>
  );
};
