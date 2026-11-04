import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Clock,
  Globe,
  SunMoon,
  ChevronRight,
  Send,
  Loader2,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Trash2,
  ShieldAlert,
  ArrowLeft,
} from 'lucide-react';
import { useSettings, useUpdateSettings } from './useSettings';
import { useAuth } from '../auth/useAuth';
import { useTheme, Theme } from '../../components/ui/themeContextDef';
import { api } from '../../lib/api';
import {
  isPushNotificationSupported,
  subscribeToPush,
  sendTestPush,
} from '../../lib/push';
import { useToast } from '../../components/ui/useToast';
import { haptic } from '../../lib/haptics';

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user, logout } = useAuth();
  const { theme: currentTheme, setTheme: setGlobalTheme } = useTheme();
  const { data: settings, isLoading } = useSettings();
  const updateMutation = useUpdateSettings();

  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderTime, setReminderTime] = useState('21:00');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);

  // Password change states
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Account deletion states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  useEffect(() => {
    if (settings) {
      setReminderEnabled(settings.reminder_enabled);
      setReminderTime(settings.reminder_time || '21:00');
      setTimezone(settings.timezone || 'Asia/Kolkata');
      if (settings.theme && settings.theme !== currentTheme) {
        setGlobalTheme(settings.theme);
      }
    }
  }, [settings, currentTheme, setGlobalTheme]);

  useEffect(() => {
    isPushNotificationSupported().then(setPushSupported);
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPushPermission(Notification.permission);
    }
  }, []);

  const handleToggleReminder = async (enabled: boolean) => {
    haptic.trigger('selection');
    setReminderEnabled(enabled);
    try {
      await updateMutation.mutateAsync({ reminder_enabled: enabled });
      showToast(enabled ? 'Daily reminder enabled' : 'Daily reminder disabled', { type: 'info' });
    } catch {
      showToast('Failed to update reminder settings', { type: 'error' });
    }
  };

  const handleTimeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setReminderTime(val);
    try {
      await updateMutation.mutateAsync({ reminder_time: val });
      showToast(`Reminder set to ${val}`, { type: 'success' });
    } catch {
      showToast('Failed to update reminder time', { type: 'error' });
    }
  };

  const handleThemeChange = async (newTheme: Theme) => {
    haptic.trigger('selection');
    setGlobalTheme(newTheme);
    try {
      await updateMutation.mutateAsync({ theme: newTheme });
      showToast(`Theme updated to ${newTheme}`, { type: 'info' });
    } catch {
      showToast('Failed to update theme on server', { type: 'error' });
    }
  };

  const handleEnablePush = async () => {
    try {
      setIsSubscribing(true);
      await subscribeToPush();
      setPushPermission('granted');
      showToast('Web Push notifications enabled successfully!', { type: 'success' });
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to enable push notifications', {
        type: 'error',
      });
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleSendTestPush = async () => {
    try {
      setIsSendingTest(true);
      const res = await sendTestPush();
      if (res.sent > 0) {
        showToast('Test push notification dispatched!', { type: 'success' });
      } else {
        showToast('No active devices received the test. Subscribe below first.', { type: 'info' });
      }
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Error sending test push', { type: 'error' });
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword || !newPassword) {
      showToast('Please fill all password fields', { type: 'info' });
      return;
    }
    if (newPassword.length < 8) {
      showToast('New password must be at least 8 characters long', { type: 'info' });
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match', { type: 'info' });
      return;
    }

    try {
      setIsChangingPassword(true);
      await api.post('/users/me/change-password', {
        current_password: oldPassword,
        new_password: newPassword,
      });
      showToast('Password changed successfully!', { type: 'success' });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordSection(false);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to update password', { type: 'error' });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletePassword) {
      showToast('Please enter your password to confirm account deletion', { type: 'info' });
      return;
    }

    try {
      setIsDeletingAccount(true);
      await api.delete('/users/me', {
        data: { password: deletePassword },
      });
      showToast('Your account and all associated data have been permanently deleted', {
        type: 'info',
      });
      setShowDeleteModal(false);
      logout();
      navigate('/login');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to delete account. Incorrect password.', {
        type: 'error',
      });
    } finally {
      setIsDeletingAccount(false);
    }
  };

  if (isLoading || !settings) {
    return (
      <div className="space-y-4 pb-8 animate-pulse">
        <div className="h-8 w-40 bg-surface rounded-xl" />
        <div className="h-44 bg-surface rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-150">
      {/* Title */}
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
          <h2 className="text-xl font-extrabold tracking-tight text-text">Settings & Preferences</h2>
          <p className="text-xs text-muted font-medium mt-0.5">
            Notifications, daily reminders, shortcuts, display, and account
          </p>
        </div>
      </div>

      {/* User Info Badge */}
      <div className="p-4 rounded-2xl bg-surface border border-surface-2 flex items-center justify-between shadow-xs">
        <div>
          <p className="text-xs font-bold text-text">{user?.name || 'SpendWise User'}</p>
          <p className="text-[11px] text-muted font-medium mt-0.5">{user?.email}</p>
        </div>
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          Active Account
        </span>
      </div>

      {/* iOS Shortcuts Navigation Banner */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => navigate('/settings/shortcuts')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') navigate('/settings/shortcuts');
        }}
        className="p-4 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 flex items-center justify-between cursor-pointer hover:border-primary/40 transition-all group shadow-xs min-h-[44px]"
      >
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shadow-xs">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-text group-hover:text-primary transition-colors">
                iOS Shortcuts & API Tokens
              </span>
              <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-primary/20 text-primary">
                Active
              </span>
            </div>
            <p className="text-xs text-muted font-medium mt-0.5">
              1-tap Siri expense logging & personal access tokens
            </p>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-muted group-hover:text-text transition-colors" />
      </div>

      {/* Daily Reminders Section */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-muted uppercase tracking-wider px-1">
          Daily Expense Reminders
        </h3>
        <div className="bg-surface rounded-2xl border border-surface-2 divide-y divide-surface-2 overflow-hidden shadow-xs">
          {/* Toggle */}
          <div className="p-4 flex items-center justify-between min-h-[44px]">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-surface-2 text-primary flex items-center justify-center">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-text">Evening Reminder</p>
                <p className="text-[11px] text-muted">
                  Gentle alert if 0 expenses have been recorded today
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer min-h-[44px] min-w-[44px] justify-center">
              <input
                type="checkbox"
                checked={reminderEnabled}
                aria-label="Toggle evening reminder"
                onChange={(e) => handleToggleReminder(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-surface-2 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[12px] after:left-[8px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
            </label>
          </div>

          {/* Time Picker */}
          {reminderEnabled && (
            <div className="p-4 flex items-center justify-between min-h-[44px]">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-surface-2 text-muted flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-text">Reminder Time</p>
                  <p className="text-[11px] text-muted">Local time ({timezone})</p>
                </div>
              </div>
              <input
                type="time"
                value={reminderTime}
                aria-label="Reminder Time"
                onChange={handleTimeChange}
                className="px-3 py-2 rounded-xl bg-surface-2 text-xs font-bold text-text border border-surface-2 focus:outline-none focus:border-primary min-h-[44px]"
              />
            </div>
          )}
        </div>
      </div>

      {/* Web Push Configuration */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-muted uppercase tracking-wider px-1">
          Web Push Notifications
        </h3>
        <div className="p-4 rounded-2xl bg-surface border border-surface-2 shadow-xs space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-text">Device Push Permission</p>
              <p className="text-[11px] text-muted mt-0.5">
                VAPID Web Push delivered directly to your device
              </p>
            </div>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                pushPermission === 'granted'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                  : pushPermission === 'denied'
                  ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                  : 'bg-surface-2 text-muted'
              }`}
            >
              {pushPermission === 'granted'
                ? 'Permission Granted'
                : pushPermission === 'denied'
                ? 'Permission Denied'
                : 'Not Registered'}
            </span>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={handleEnablePush}
              disabled={isSubscribing || !pushSupported}
              className="flex-1 py-2.5 px-3 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-dark transition-colors flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50 min-h-[44px]"
            >
              {isSubscribing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              <span>{pushPermission === 'granted' ? 'Re-sync Push' : 'Enable Web Push'}</span>
            </button>

            {pushPermission === 'granted' && (
              <button
                type="button"
                onClick={handleSendTestPush}
                disabled={isSendingTest}
                className="py-2.5 px-4 rounded-xl text-xs font-bold bg-surface-2 text-text hover:bg-surface-2/80 transition-colors flex items-center gap-1.5 disabled:opacity-50 min-h-[44px]"
              >
                {isSendingTest ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Test</span>
              </button>
            )}
          </div>

          {!pushSupported && (
            <p className="text-[11px] text-amber-500 font-medium flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Add SpendWise to your iPhone Home Screen to receive Web Push alerts.</span>
            </p>
          )}
        </div>
      </div>

      {/* Display & Timezone */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-muted uppercase tracking-wider px-1">Display & Regional</h3>
        <div className="bg-surface rounded-2xl border border-surface-2 divide-y divide-surface-2 overflow-hidden shadow-xs">
          {/* Timezone */}
          <div className="p-4 flex items-center justify-between min-h-[44px]">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-surface-2 text-muted flex items-center justify-center">
                <Globe className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-text">Timezone</p>
                <p className="text-[11px] text-muted">Boundary evaluations</p>
              </div>
            </div>
            <span className="text-xs font-semibold text-text">{timezone}</span>
          </div>

          {/* Theme */}
          <div className="p-4 flex items-center justify-between min-h-[44px]">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-surface-2 text-muted flex items-center justify-center">
                <SunMoon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-text">Theme</p>
                <p className="text-[11px] text-muted">Dark / Light appearance</p>
              </div>
            </div>

            <div className="flex items-center gap-1 p-1 bg-surface-2 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => handleThemeChange('system')}
                className={`px-3 py-2 rounded-lg transition-colors min-h-[36px] ${
                  currentTheme === 'system' ? 'bg-surface text-text shadow-xs' : 'text-muted'
                }`}
              >
                Auto
              </button>
              <button
                type="button"
                onClick={() => handleThemeChange('light')}
                className={`px-3 py-2 rounded-lg transition-colors min-h-[36px] ${
                  currentTheme === 'light' ? 'bg-surface text-text shadow-xs' : 'text-muted'
                }`}
              >
                Light
              </button>
              <button
                type="button"
                onClick={() => handleThemeChange('dark')}
                className={`px-3 py-2 rounded-lg transition-colors min-h-[36px] ${
                  currentTheme === 'dark' ? 'bg-surface text-text shadow-xs' : 'text-muted'
                }`}
              >
                Dark
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Account & Security Section */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-muted uppercase tracking-wider px-1">
          Account & Security
        </h3>
        <div className="bg-surface rounded-2xl border border-surface-2 divide-y divide-surface-2 overflow-hidden shadow-xs">
          {/* Change Password Expander */}
          <div className="p-4">
            <button
              type="button"
              onClick={() => setShowPasswordSection(!showPasswordSection)}
              className="w-full flex items-center justify-between text-left min-h-[44px]"
            >
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-surface-2 text-muted flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-text">Change Password</p>
                  <p className="text-[11px] text-muted">Update your account credentials</p>
                </div>
              </div>
              <ChevronRight
                className={`w-4 h-4 text-muted transition-transform ${
                  showPasswordSection ? 'rotate-90' : ''
                }`}
              />
            </button>

            {showPasswordSection && (
              <form onSubmit={handleChangePassword} className="mt-4 pt-3 border-t border-surface-2 space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-muted mb-1">
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 rounded-xl bg-surface-2 text-xs font-medium text-text border border-surface-2 focus:outline-none focus:border-primary min-h-[44px]"
                    placeholder="Enter current password"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-muted mb-1">
                    New Password (min 8 chars)
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full px-3 py-2.5 rounded-xl bg-surface-2 text-xs font-medium text-text border border-surface-2 focus:outline-none focus:border-primary min-h-[44px]"
                    placeholder="Enter new password"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-muted mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full px-3 py-2.5 rounded-xl bg-surface-2 text-xs font-medium text-text border border-surface-2 focus:outline-none focus:border-primary min-h-[44px]"
                    placeholder="Confirm new password"
                  />
                </div>
                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={isChangingPassword}
                    className="py-2.5 px-4 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-dark transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50 min-h-[44px]"
                  >
                    {isChangingPassword && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Update Password</span>
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Delete Account */}
          <div className="p-4 flex items-center justify-between min-h-[44px]">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-rose-600 dark:text-rose-400">Delete Account</p>
                <p className="text-[11px] text-muted">Permanently wipe all transactions & data</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition-colors border border-rose-500/20 min-h-[44px]"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-surface border border-surface-2 rounded-2xl max-w-sm w-full p-5 shadow-xl space-y-4">
            <div className="flex items-center space-x-3 text-rose-500">
              <ShieldAlert className="w-6 h-6 flex-shrink-0" />
              <h4 className="text-sm font-bold text-text">Permanently Delete Account?</h4>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              This action cannot be undone. All your categories, transactions, budgets, recurring
              rules, and API tokens will be permanently erased.
            </p>
            <form onSubmit={handleDeleteAccount} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-muted mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  required
                  placeholder="Enter your account password"
                  className="w-full px-3 py-2.5 rounded-xl bg-surface-2 text-xs font-medium text-text border border-surface-2 focus:outline-none focus:border-rose-500 min-h-[44px]"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeletePassword('');
                  }}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-surface-2 text-text hover:bg-surface-2/80 transition-colors min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDeletingAccount || !deletePassword}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50 min-h-[44px]"
                >
                  {isDeletingAccount && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Delete Forever</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
