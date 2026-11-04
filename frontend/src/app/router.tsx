import { Suspense, lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from './layout/AppShell';
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { AuthGuard } from '../features/auth/AuthGuard';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { QuickAddPage } from '../features/quick-add/QuickAddPage';
import { PageLoader } from '../components/ui/PageLoader';

// Code-split heavy routes to keep initial bundle <= 250 KB
const TransactionsPage = lazy(() =>
  import('../features/transactions/TransactionsPage').then((m) => ({
    default: m.TransactionsPage,
  }))
);
const AnalyticsPage = lazy(() =>
  import('../features/analytics/AnalyticsPage').then((m) => ({
    default: m.AnalyticsPage,
  }))
);
const BudgetsPage = lazy(() =>
  import('../features/budgets/BudgetsPage').then((m) => ({
    default: m.BudgetsPage,
  }))
);
const MoreMenuPage = lazy(() =>
  import('../features/more/MoreMenuPage').then((m) => ({
    default: m.MoreMenuPage,
  }))
);
const ImportWizardPage = lazy(() =>
  import('../features/import/ImportWizardPage').then((m) => ({
    default: m.ImportWizardPage,
  }))
);
const RecurringPage = lazy(() =>
  import('../features/recurring/RecurringPage').then((m) => ({
    default: m.RecurringPage,
  }))
);
const SettingsPage = lazy(() =>
  import('../features/settings/SettingsPage').then((m) => ({
    default: m.SettingsPage,
  }))
);
const ShortcutsSettingsPage = lazy(() =>
  import('../features/settings/ShortcutsSettingsPage').then((m) => ({
    default: m.ShortcutsSettingsPage,
  }))
);

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/register',
    element: <RegisterPage />,
  },
  {
    path: '/',
    element: <AuthGuard />,
    children: [
      {
        element: <AppShell />,
        children: [
          {
            index: true,
            element: <DashboardPage />,
          },
          {
            path: 'transactions',
            element: (
              <Suspense fallback={<PageLoader />}>
                <TransactionsPage />
              </Suspense>
            ),
          },
          {
            path: 'add',
            element: <QuickAddPage />,
          },
          {
            path: 'analytics',
            element: (
              <Suspense fallback={<PageLoader />}>
                <AnalyticsPage />
              </Suspense>
            ),
          },
          {
            path: 'budgets',
            element: (
              <Suspense fallback={<PageLoader />}>
                <BudgetsPage />
              </Suspense>
            ),
          },
          {
            path: 'more',
            element: (
              <Suspense fallback={<PageLoader />}>
                <MoreMenuPage />
              </Suspense>
            ),
          },
          {
            path: 'import',
            element: (
              <Suspense fallback={<PageLoader />}>
                <ImportWizardPage />
              </Suspense>
            ),
          },
          {
            path: 'recurring',
            element: (
              <Suspense fallback={<PageLoader />}>
                <RecurringPage />
              </Suspense>
            ),
          },
          {
            path: 'settings',
            element: (
              <Suspense fallback={<PageLoader />}>
                <SettingsPage />
              </Suspense>
            ),
          },
          {
            path: 'settings/shortcuts',
            element: (
              <Suspense fallback={<PageLoader />}>
                <ShortcutsSettingsPage />
              </Suspense>
            ),
          },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
