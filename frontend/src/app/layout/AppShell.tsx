import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Menu,
  PieChart,
  Plus,
  Receipt,
  WifiOff,
  RefreshCw,
  X,
  Settings,
  Repeat,
  FileSpreadsheet,
  Target,
} from 'lucide-react';
import { useOfflineSync } from '../../features/offline/useOfflineSync';
import { useAuth } from '../../features/auth/useAuth';
import { haptic } from '../../lib/haptics';

export const AppShell: React.FC = () => {
  const { isOnline, pendingCount, isSyncing } = useOfflineSync();
  const { user } = useAuth();
  const location = useLocation();
  const isAddRoute = location.pathname === '/add';
  const [showInstallBanner, setShowInstallBanner] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
    const isStandalone =
      Boolean((window.navigator as unknown as { standalone?: boolean }).standalone) ||
      (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches);
    const dismissed = localStorage.getItem('spendwise_hide_install_banner') === 'true';

    if (isIOS && !isStandalone && !dismissed) {
      setShowInstallBanner(true);
    }
  }, []);

  const dismissInstallBanner = () => {
    localStorage.setItem('spendwise_hide_install_banner', 'true');
    setShowInstallBanner(false);
  };

  return (
    <div className="min-h-[100dvh] bg-bg text-text flex flex-col md:flex-row max-w-7xl mx-auto relative safe-top">
      {/* Desktop Navigation Sidebar (shown on md: screens and wider) */}
      <aside
        aria-label="Desktop Navigation"
        className="hidden md:flex flex-col w-64 border-r border-surface-2 dark:border-white/5 py-6 px-4 sticky top-0 h-screen justify-between flex-shrink-0 bg-surface/50 backdrop-blur-md"
      >
        <div className="space-y-6">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-indigo-600 text-white flex items-center justify-center font-extrabold text-lg shadow-md shadow-primary/20 ios-card">
              ₹
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-text">SpendWise</h1>
              <p className="text-[11px] text-muted font-medium">Smart Financial OS</p>
            </div>
          </div>

          {/* Quick Add Action in Desktop Sidebar */}
          <NavLink
            to="/add"
            onClick={() => haptic.trigger('selection')}
            className="ios-press flex items-center justify-center gap-2 w-full py-3 px-4 rounded-2xl bg-primary hover:bg-primary/90 text-white font-bold text-sm shadow-md shadow-primary/25 border border-white/15 transition-all"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Add Expense</span>
          </NavLink>

          {/* Primary Sidebar Links */}
          <nav className="space-y-1">
            <NavLink
              to="/"
              end
              onClick={() => haptic.trigger('selection')}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isActive ? 'bg-primary text-white shadow-xs' : 'text-muted hover:text-text hover:bg-surface-2'
                }`
              }
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard</span>
            </NavLink>

            <NavLink
              to="/transactions"
              onClick={() => haptic.trigger('selection')}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isActive ? 'bg-primary text-white shadow-xs' : 'text-muted hover:text-text hover:bg-surface-2'
                }`
              }
            >
              <Receipt className="w-4 h-4" />
              <span>Transactions</span>
            </NavLink>

            <NavLink
              to="/budgets"
              onClick={() => haptic.trigger('selection')}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isActive ? 'bg-primary text-white shadow-xs' : 'text-muted hover:text-text hover:bg-surface-2'
                }`
              }
            >
              <Target className="w-4 h-4" />
              <span>Budgets & Limits</span>
            </NavLink>

            <NavLink
              to="/analytics"
              onClick={() => haptic.trigger('selection')}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isActive ? 'bg-primary text-white shadow-xs' : 'text-muted hover:text-text hover:bg-surface-2'
                }`
              }
            >
              <PieChart className="w-4 h-4" />
              <span>Financial Analytics</span>
            </NavLink>

            <NavLink
              to="/recurring"
              onClick={() => haptic.trigger('selection')}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isActive ? 'bg-primary text-white shadow-xs' : 'text-muted hover:text-text hover:bg-surface-2'
                }`
              }
            >
              <Repeat className="w-4 h-4" />
              <span>Recurring Rules</span>
            </NavLink>

            <NavLink
              to="/import"
              onClick={() => haptic.trigger('selection')}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isActive ? 'bg-primary text-white shadow-xs' : 'text-muted hover:text-text hover:bg-surface-2'
                }`
              }
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Statement Import</span>
            </NavLink>

            <NavLink
              to="/more"
              onClick={() => haptic.trigger('selection')}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isActive ? 'bg-primary text-white shadow-xs' : 'text-muted hover:text-text hover:bg-surface-2'
                }`
              }
            >
              <Menu className="w-4 h-4" />
              <span>More Tools</span>
            </NavLink>
          </nav>
        </div>

        {/* User Account Footer */}
        <div className="pt-4 border-t border-surface-2 dark:border-white/5 flex items-center justify-between px-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-primary/20 text-primary font-bold text-xs flex items-center justify-center flex-shrink-0">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-text truncate">{user?.name || 'SpendWise User'}</p>
              <p className="text-[10px] text-muted truncate">{user?.email || ''}</p>
            </div>
          </div>
          <NavLink
            to="/settings"
            onClick={() => haptic.trigger('selection')}
            className="p-1.5 rounded-lg text-muted hover:text-text hover:bg-surface-2 transition-colors"
            title="Account Settings"
          >
            <Settings className="w-4 h-4" />
          </NavLink>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* Dismissible iOS Safari Add to Home Screen Banner */}
        {showInstallBanner && (
          <div className="bg-primary/10 border-b border-primary/20 px-4 py-2.5 flex items-center justify-between text-xs text-text animate-fadeIn">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center text-primary text-sm flex-shrink-0">
                📲
              </div>
              <div className="text-[11px] leading-snug">
                <span className="font-semibold text-primary block">Install SpendWise</span>
                <span className="text-muted">
                  Tap Share <span className="font-bold text-text">⎋</span> then{' '}
                  <span className="font-bold text-text">Add to Home Screen</span> [+]
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={dismissInstallBanner}
              aria-label="Dismiss install prompt"
              className="p-1 rounded-md text-muted hover:text-text hover:bg-surface-2 transition-colors ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Offline Status Banner */}
        {!isOnline && (
          <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-1.5 flex items-center justify-between text-xs font-medium text-amber-500">
            <div className="flex items-center gap-1.5">
              <WifiOff className="w-3.5 h-3.5 flex-shrink-0" />
              <span>
                {pendingCount > 0
                  ? `⚡ Offline: ${pendingCount} expense${pendingCount > 1 ? 's' : ''} pending automatic sync`
                  : '⚡ Offline — saving locally'}
              </span>
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20">
              Local Mode
            </span>
          </div>
        )}

        {/* Syncing Banner */}
        {isOnline && isSyncing && (
          <div className="bg-primary/15 border-b border-primary/30 px-4 py-1.5 flex items-center justify-between text-xs font-medium text-primary animate-pulse">
            <div className="flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
              <span>
                Syncing {pendingCount} pending expense{pendingCount > 1 ? 's' : ''}...
              </span>
            </div>
          </div>
        )}

        {/* Page Content: Mobile phone width on small screens, expands dynamically on desktop */}
        <main className="flex-1 px-4 py-4 md:px-8 md:py-6 overflow-y-auto max-w-md md:max-w-6xl mx-auto w-full">
          <Outlet />
        </main>

        {/* Bottom 5-Slot TabBar for Mobile screens (hidden on desktop and hidden in dedicated Add flow) */}
        {!isAddRoute && (
          <nav
            aria-label="Bottom Navigation"
            className="md:hidden sticky bottom-0 z-40 ios-glass border-t border-surface-2 dark:border-white/5 px-2 py-1 safe-bottom shadow-lg"
          >
            <div className="grid grid-cols-5 items-center justify-items-center h-14">
              {/* Home */}
              <NavLink
                to="/"
                end
                onClick={() => haptic.trigger('selection')}
                className={({ isActive }) =>
                  `ios-press flex flex-col items-center justify-center w-full h-full text-xs font-medium transition-colors ${
                    isActive ? 'text-primary' : 'text-muted hover:text-text'
                  }`
                }
              >
                <LayoutDashboard className="w-5 h-5 mb-0.5" />
                <span>Home</span>
              </NavLink>

              {/* History */}
              <NavLink
                to="/transactions"
                onClick={() => haptic.trigger('selection')}
                className={({ isActive }) =>
                  `ios-press flex flex-col items-center justify-center w-full h-full text-xs font-medium transition-colors ${
                    isActive ? 'text-primary' : 'text-muted hover:text-text'
                  }`
                }
              >
                <Receipt className="w-5 h-5 mb-0.5" />
                <span>History</span>
              </NavLink>

              {/* Centered Large + Add Button */}
              <NavLink
                to="/add"
                aria-label="Add expense"
                onClick={() => haptic.trigger('selection')}
                className="ios-press flex items-center justify-center w-12 h-12 rounded-full bg-primary text-white shadow-lg shadow-primary/30 border border-white/20 -mt-3"
              >
                <Plus className="w-6 h-6 stroke-[2.5]" />
              </NavLink>

              {/* Analytics */}
              <NavLink
                to="/analytics"
                onClick={() => haptic.trigger('selection')}
                className={({ isActive }) =>
                  `ios-press flex flex-col items-center justify-center w-full h-full text-xs font-medium transition-colors ${
                    isActive ? 'text-primary' : 'text-muted hover:text-text'
                  }`
                }
              >
                <PieChart className="w-5 h-5 mb-0.5" />
                <span>Analytics</span>
              </NavLink>

              {/* More */}
              <NavLink
                to="/more"
                onClick={() => haptic.trigger('selection')}
                className={({ isActive }) =>
                  `ios-press flex flex-col items-center justify-center w-full h-full text-xs font-medium transition-colors ${
                    isActive ? 'text-primary' : 'text-muted hover:text-text'
                  }`
                }
              >
                <Menu className="w-5 h-5 mb-0.5" />
                <span>More</span>
              </NavLink>
            </div>
          </nav>
        )}
      </div>
    </div>
  );
};
