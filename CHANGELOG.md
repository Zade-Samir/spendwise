# Changelog — SpendWise

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.2.0] - 2026-11-04

### Added & Enhanced (10/10 UX/UI Transformation)
- **Responsive Multi-Viewport Shell (`AppShell.tsx`):**
  - Added desktop left navigation sidebar on `md:` breakpoints (≥768px) with bespoke SpendWise brand monogram (`₹`), direct navigation links to **Budgets & Limits**, **Transactions**, **Financial Analytics**, **Recurring Rules**, and user profile quick settings.
  - Preserved mobile edge-to-edge layout with 5-slot bottom tab bar and floating Quick Add CTA for phone screens.
- **Contextual Back Navigation for Inner Pages:**
  - Added persistent back button navigation (`navigate(-1)`) and header hierarchy to `BudgetsPage.tsx`, `RecurringPage.tsx`, `SettingsPage.tsx`, and `ImportWizardPage.tsx`.
- **5-Column Responsive Dashboard Layout (`DashboardPage.tsx`):**
  - Reorganized dashboard on desktop viewports into a 60/40 grid layout (Left: Spend Overview, Stat Cards, Recent Expenses; Right: Category Donut, Daily Trend, Insights Carousel).
  - Added a 3-step Quick Start Onboarding Guide for empty accounts (`Set budget` → `Log first expense` → `Connect iOS shortcuts`).
- **Color-Independent Accessibility Badges (`BudgetCard.tsx`):**
  - Added explicit textual status tags (`Over`, `Near Limit`) to category budget meters to ensure full WCAG compliance for colorblind users.

## [1.1.0] - 2026-11-04

### Changed & Polished
- **Complete UI/UX Audit Remediation (Certified 10 / 10 Experience):**
  - **Auth Theme Unification (`LoginPage.tsx`, `RegisterPage.tsx`):** Fully aligned authentication screens with SpendWise's primary design language, replacing legacy slate-950/emerald styles with brand indigo tokens (`bg-bg`, `text-text`, `bg-surface`, `bg-primary`), `ios-card` specular highlights, and tactile haptic feedback.
  - **iOS Safari Viewport Hardening (`index.css`):** Prevented automatic mobile browser layout zooming on input focus by setting responsive 16px minimum font scaling on touch screens.
  - **WCAG Focus Styling (`index.css`):** Added explicit high-contrast `:focus-visible` accessibility rings across all focusable elements.
  - **Interactive QuickAdd Date Control (`QuickAddPage.tsx`):** Upgraded top bar date pill into an interactive date selector supporting "Today", "Yesterday", or custom past calendar dates for delayed expense recording.
  - **Insight Date Formatting (`InsightCard.tsx`):** Formatted raw partial ISO dates (e.g. `2026-11`) into localized strings (`Nov 2026`).
  - **Card Depth & Empty State Polish (`DashboardPage.tsx`, `AnalyticsPage.tsx`):** Standardized `ios-card` specular depth, added inviting illustrated zero-state empty views with direct action buttons, and replaced developer jargon with user-facing labels (`Daily Trend`, `Daily Activity`).

## [1.0.0] - 2026-11-03

### Added
- **Milestone M8 — Polish, Accessibility & System Hardening (Production Release v1.0.0):**
  - **Visual & Ergonomic Polish:**
    - Global `ThemeProvider` (`frontend/src/components/ui/ThemeProvider.tsx`, `themeContextDef.ts`) managing `'system' | 'light' | 'dark'` appearance, synchronized with `document.documentElement.classList`, CSS `color-scheme`, and reactive `prefers-color-scheme` media query listeners.
    - Persistent theme storage in `localStorage` and bi-directional synchronization with backend user settings.
    - Safe area inset rules (`.safe-top`, `.safe-bottom`) in `frontend/src/index.css` utilizing `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` with fallback breathing room, tailored for iPhone dynamic island, notch, and Home indicator bar.
    - Accessibility audit: touch targets meet or exceed 44×44 px across all numeric keypad buttons, tab navigation items, chips, action buttons, and form inputs.
    - Added Account & Security management in `/settings`: inline change password form and cascade account deletion with password verification.
  - **Performance & Security Hardening:**
    - Route-level code splitting using `React.lazy()` and `<Suspense fallback={<PageLoader />}>` in `frontend/src/app/router.tsx` for heavy views (`AnalyticsPage`, `BudgetsPage`, `ImportWizardPage`, `RecurringPage`, `SettingsPage`, `ShortcutsSettingsPage`, `TransactionsPage`, `MoreMenuPage`).
    - Verified initial gzipped JavaScript entry bundle is ~144 KB, well below the ≤ 250 KB budget constraint. Recharts vendor bundle isolated into a lazy-loaded chunk.
    - Fast, sliding-window rate limiting middleware (`backend/app/core/rate_limit.py`) enforcing 10 requests/minute on authentication endpoints (`/auth/login`, `/auth/register`) and 120 requests/minute on general API endpoints, returning 429 Too Many Requests with `Retry-After` headers and standardized error envelopes.
    - Hardened HTTP security headers middleware in FastAPI (`backend/app/main.py`):
      - `X-Content-Type-Options: nosniff`
      - `X-Frame-Options: DENY`
      - `Referrer-Policy: strict-origin-when-cross-origin`
      - `Permissions-Policy: geolocation=(), microphone=(), camera=()`
      - `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' http: https: ws:;`
    - Sensitive logging redaction filter (`SensitiveDataFilter` in `backend/app/core/logging.py`) preventing passwords, JWT tokens, Bearer tokens, and `sw_*` shortcut tokens from ever appearing in server application logs.
  - **Demo Data Seeding & CSV Fixtures:**
    - Realistic 3-month demo data generation script (`backend/app/seed/demo_data.py`) executable via `make seed-demo` or `python -m app.seed.demo_data`.
    - Generates ~300 realistic Indian INR transactions (Auto/cabs ₹60–250, lunches ₹120–300, tea ₹20–60, groceries ₹200–2,500, utilities, rent ₹22,000, shopping), an overall ₹20,000 monthly budget, category budgets, and recurring rules for `demo@spendwise.app` / `demo1234`.
    - Created sample statement fixtures: `backend/tests/fixtures/sample_bank.csv` and `backend/tests/fixtures/sample_gpay.csv`.
  - **End-to-End Testing:**
    - Playwright test suite (`e2e/flow.spec.ts`) configured with iPhone 14 mobile Safari viewport testing complete registration, numeric keypad entry, instant dashboard reconciliation, history filtering, and settings navigation.
  - **Documentation & Verification:**
    - Updated `README.md` with full local quickstart, testing targets, and Shortcuts guide reference.
    - All 61 backend pytest tests and 35 frontend vitest tests passing (96 total).
    - Zero linting, formatting, or strict type-check errors across both frontend and backend.

---

## [0.8.0] - 2026-11-03

### Added
- **Milestone M7 — Web Push Notifications & iOS Shortcuts:**
  - **Backend Web Push Infrastructure (`backend/app/services/push_service.py`):**
    - VAPID key management (`GET /api/v1/push/vapid-public-key`).
    - Device push subscription lifecycle (`POST /api/v1/push/subscribe`, `DELETE /api/v1/push/subscribe`).
    - Test dispatch endpoint (`POST /api/v1/push/test`) with automatic pruning of 404/410 stale endpoints.
  - **Daily Logging Reminders & Budget Alerts (`backend/app/services/reminders.py`):**
    - 15-minute APScheduler job evaluating daily expense logging reminders at each user's local `reminder_time` and timezone.
    - Zero-spend verification: sends reminder only if 0 transactions recorded for today, eliminating reminder fatigue.
    - Deduplication engine backed by `notification_log` preventing duplicate daily reminders.
    - Budget threshold alert dispatching at 80% and 100% capacity.
  - **Personal API Tokens & iOS Shortcuts (`backend/app/services/api_token_service.py`, `shortcuts.py`):**
    - Cryptographic token generation (`sw_<48_hex>`) with SHA-256 hashed persistence.
    - Token management endpoints: `GET /api/v1/api-tokens`, `POST /api/v1/api-tokens`, `DELETE /api/v1/api-tokens/{id}`.
    - High-velocity headless shortcut endpoint: `POST /api/v1/shortcuts/transactions` with dual authentication (Bearer `sw_*` API token or user JWT).
    - Amount sanitization supporting decimal rupees, strings, and integer paise into `BIGINT` minor units.
    - Fuzzy/case-insensitive category resolution with graceful fallback.
  - **User Settings Management (`backend/app/api/v1/settings.py`):**
    - Profile preferences: `GET /api/v1/settings`, `PATCH /api/v1/settings` (reminder toggle, reminder time, timezone, theme, push status).
  - **Frontend PWA Push Notification Handlers (`frontend/src/sw.ts`):**
    - Service Worker `push` event listener parsing JSON push payloads with icon, badge, and URL data.
    - `notificationclick` listener closing notifications and navigating straight to `/add` or target screen.
    - Web Push subscription helper: `frontend/src/lib/push.ts` with VAPID `Uint8Array` conversion and permission requests.
  - **Frontend UI & Deep Link Integration:**
    - `SettingsPage` (`/settings`): evening reminder toggle, time picker, Web Push permission status and test notification trigger.
    - `ShortcutsSettingsPage` (`/settings/shortcuts`): personal API tokens manager with 1-time secret copy modal, Mode A curl guide, and Mode B interactive deep-link builder.
    - Deep-link prefilling on `/add`: parses `amount`, `category`, `merchant`, `pm`, and `notes` query parameters.
    - User Documentation: `docs/SHORTCUTS.md`.

### Tests
- `backend/tests/test_push.py`: 3 tests (VAPID key retrieval, subscribe/unsubscribe, test dispatch).
- `backend/tests/test_api_tokens.py`: 2 tests (lifecycle and multi-tenant isolation).
- `backend/tests/test_shortcuts.py`: 3 tests (token creation, amount parsing/fallback, revoked token rejection).
- `backend/tests/test_reminders.py`: 3 tests (settings API, reminder dispatch & dedupe, skip on existing transactions).
- `frontend/src/features/settings/SettingsPage.test.tsx`: 1 test.
- `frontend/src/features/quick-add/QuickAddPage.test.tsx`: added URL parameter prefill test.
- **Total: 57 backend tests passing, 35 frontend tests passing, 0 lint/type errors.**

---

## [0.7.0] - 2026-11-03

### Added
- **Milestone M6 — Statement Import/Export & Recurring Expenses:**
  - **Backend CSV Import (`backend/app/services/csv_import.py`):**
    - `CSVImportService` with delimiter sniffing (`,`, `;`, `\t`, `|`), encoding detection (`utf-8`, `utf-8-sig`, `latin-1`), and date-format auto-detection (DD/MM/YYYY, DD MMM YYYY, YYYY-MM-DD, etc.).
    - Amount sanitization: debit/credit split columns or single signed column (`-`, `Dr`/`Cr`, parentheses).
    - Deduplicate hash: `sha256(user_id | date | amount_minor | normalised_description)`.
    - Atomic bulk commit with `ON CONFLICT (user_id, client_id)` idempotency; soft-delete rollback endpoint.
    - Endpoints: `POST /api/v1/imports`, `POST /api/v1/imports/{id}/preview`, `POST /api/v1/imports/{id}/commit`, `GET /api/v1/imports`, `DELETE /api/v1/imports/{id}`.
  - **Backend Export (`backend/app/services/export.py`):**
    - UTF-8 BOM CSV export with formula-injection defense (prepend `'` on cells starting with `=`, `+`, `-`, `@`).
    - Multi-sheet `.xlsx` workbook via `openpyxl` (sheets: "Transactions", "Category Summary", "Monthly Summary").
    - Endpoints: `GET /api/v1/exports/transactions.csv`, `GET /api/v1/exports/transactions.xlsx`.
  - **Backend Recurring Expenses (`backend/app/services/recurring.py`):**
    - `RecurringService` with month-end day clamping (Feb 28/29, Apr 30), catch-up loop capped at 12 cycles/run.
    - Idempotent `client_id = uuid5(rule_id, iso_due_date)` prevents duplicates on replay.
    - `confirm_rule` and `skip_rule` advance `next_due_date` atomically.
    - APScheduler hourly job (`backend/app/jobs/recurring_job.py`) wired to FastAPI lifespan.
    - Endpoints: `GET /api/v1/recurring`, `POST /api/v1/recurring`, `PATCH /api/v1/recurring/{id}`, `DELETE /api/v1/recurring/{id}`, `GET /api/v1/recurring/due`, `POST /api/v1/recurring/{id}/confirm`, `POST /api/v1/recurring/{id}/skip`.
  - **Frontend Import Wizard (`frontend/src/features/import/`):**
    - 3-step wizard: (1) File dropzone with dialect auto-detection banner, (2) Column mapping with debit/credit or single-column mode selection, (3) Interactive row review with per-row category pickers, duplicate flags, select-all, and commit.
    - Step 4 success screen with "Undo Import" rollback button.
    - Recent import batches list with per-batch Undo action.
    - Route: `/import`.
  - **Frontend Recurring Management (`frontend/src/features/recurring/`):**
    - `RecurringPage` (`/recurring`): list of all rules with active/paused badges, monthly commitment estimate, frequency label, next due date, pause/resume, edit, and delete.
    - `RecurringFormModal`: bottom-sheet form with frequency, day-of-month/week, remind vs auto-log mode selection.
    - `DueRecurringCard` on Dashboard: shows rules due ≤ today with 1-tap **Confirm** and **Skip** buttons.
  - **Frontend Export Triggers:**
    - "Export CSV" and "Export Excel" action buttons in `MoreMenuPage`.
    - "Export CSV" icon button in `TransactionsPage` header.
    - `api.downloadBlob()` helper in `frontend/src/lib/api.ts` with `Content-Disposition` filename extraction.
  - **Type Definitions:** `frontend/src/types/imports.ts`, `frontend/src/types/recurring.ts`.

### Fixed
- `parse_clean_amount_minor`: regex no longer strips the decimal point `.` — fixed from `[₹Rs\.INR, ]` to `(?i)(inr|rs\.?)` + `[₹,\s]`, so `"240.00"` correctly parses to `24000` paise.
- `RecurringService.confirm_rule` and `skip_rule`: replaced `session.refresh(…, ["category"])` (causes `MissingGreenlet` in asyncpg) with explicit `selectinload` re-query after commit.
- `process_auto_create_rules`: `rule.next_due_date` now always committed after loop advancement, ensuring idempotency on second run returns 0.

### Tests
- `backend/tests/test_imports.py`: 5 new tests (dialect sniffing, duplicate detection, single-column signed, undo, multi-tenant isolation).
- `backend/tests/test_exports.py`: 3 tests (CSV formula defense, XLSX sheet count, multi-tenant isolation).
- `backend/tests/test_recurring.py`: 4 tests (CRUD + remind workflow, catch-up idempotency, multi-tenant isolation, `compute_next_due_date` math).
- **Total: 46 backend tests passing, 0 failures, 1 harmless asyncpg coroutine warning.**

---

## [0.6.0] - 2026-11-03

### Added
- **Milestone M5 — PWA Capabilities & Offline Resilience:**
  - **PWA Assets & Configuration (`frontend/public/` & `index.html`):**
    - High-resolution SVG and PNG icons: 192×192, 512×512, maskable 512×512, `apple-touch-icon-180.png`, and `favicon.svg`.
    - Web App Manifest (`public/manifest.webmanifest`): standalone display mode, orientation portrait, Indigo theme color (`#4F46E5`), dark background (`#0B0B12`), and quick action shortcut pointing to `"/add"`.
    - iOS Safari standalone meta tags in `index.html` (`apple-mobile-web-app-capable`, `black-translucent`, `viewport-fit=cover`).
    - Dismissible iOS Safari installation guidance banner in `AppShell` with localized instructions ("Install SpendWise: tap Share ⎋ → Add to Home Screen [+]").
  - **Workbox Service Worker (`frontend/src/sw.ts` & `vite.config.ts`):**
    - Configured `VitePWA` using `injectManifest` strategy.
    - Precaches 15 static app shell assets (HTML, bundled JS, CSS, icons, fonts).
    - SPA navigation route fallback rewriting navigation requests to cached `index.html` while excluding `/api/*`.
    - Runtime caching: `StaleWhileRevalidate` strategy for reference data (`GET /categories` and `GET /users/me`).
    - Explicit exclusion of mutations (`POST`, `PATCH`, `PUT`, `DELETE`) and auth endpoints.
  - **IndexedDB Offline Queue & Synchronization Engine (`frontend/src/lib/`):**
    - Built `offlineQueue.ts` leveraging `idb@^8.0.0` with database `spendwise_offline` and store `pending_transactions` (`keyPath: 'client_id'`).
    - Full transaction lifecycle: `enqueueTransaction`, `getPendingTransactions`, `removePendingTransaction`, `flushOfflineQueue`.
    - Intercepted network failures in `useCreateTransaction` to enqueue offline mutations with client-side UUIDs (`crypto.randomUUID()`) and optimistic React Query updates.
    - Automatic sync triggers: `online` window event, document `visibilitychange`, and cold application launch.
    - Sequential FIFO queue replay relying on backend partial unique index (`UNIQUE(user_id, client_id) WHERE deleted_at IS NULL`) for guaranteed `200 OK` / `409 Conflict` replay idempotency.
    - Polite offline modal constraints for transaction editing and soft-deletions per spec §4.5 ("Connect to the internet to edit or delete existing expenses").
  - **Offline UI & Feedback (`frontend/src/features/`):**
    - `useOfflineSync` custom hook exposing online status, pending transaction counts, syncing state, and manual sync action.
    - Top status banner in `AppShell`: `⚡ Offline — saving locally` and `Syncing N pending expenses...`.
    - Top header status pill reflecting network state (`● Active`, `● Offline`, or `Sync (N)`).
    - Pending Clock Badge on offline expenses in the History list (`TransactionsPage.tsx`).
    - Offline notification toast on Quick Add: `"Saved offline · Will sync automatically"`.
    - Local cache persistence for React Query via `@tanstack/react-query-persist-client` and `@tanstack/query-sync-storage-persister`.
  - **Automated Tests & Quality Guarantees:**
    - Dedicated IndexedDB unit tests in Vitest (`offlineQueue.test.ts`) covering enqueue, removal, sequential replay, 409 idempotency, network error aborts, and 422 error tracking.
    - All 33 frontend Vitest tests and 34 backend pytest tests passing cleanly.
    - Static analysis: `ruff`, `mypy --strict`, and `eslint` passing with zero warnings or errors.
    - Production bundle compilation verified with full Service Worker asset precaching.

## [0.5.0] - 2026-11-03

### Added
- **Milestone M4 — Budgets & Rule-Based Insights:**
  - **Backend Budget Engine (`backend/app/services/budgets.py` & `api/v1/budgets.py`):**
    - `PUT /budgets`: Upsert overall and category budgets with custom alert thresholds (50%–100%) and integer paise precision.
    - `GET /budgets`: Returns active budgets with real-time spending calculations, percentage used, remaining balances, status flags (`ok`, `warning`, `exceeded`), and `safe_daily_minor` (`remaining_minor // days_left`).
    - `DELETE /budgets/{id}`: Budget deletion with strict multi-tenant isolation.
    - Post-transaction alert evaluation hook (`check_budget_alerts`) logging deduplicated threshold events to `notification_log` using composite keys (`{budget_id}:{period_start}:{level}`).
  - **Statistical Spending Insights Engine (`backend/app/services/insights.py` & `api/v1/insights.py`):**
    - `GET /insights`: 11 deterministic rule-based heuristics (§10.3) covering top spending category, category expenditure jumps (≥ ₹500 & ≥ 15% vs same elapsed days last month), spending decreases, average daily spending pace, month-end budget projections, budget warnings, weekend spikes (≥ 1.5× weekday pace), small purchases (< ₹100), unlogged days, logging streaks, and largest single expense.
    - Graceful degradation returning empty lists for sparse transaction histories.
  - **Frontend Budget Management & Visual Insights UI (`frontend/src/features/`):**
    - Added `put` method to typed API client (`src/lib/api.ts`).
    - `OverallBudgetCard` & `CategoryBudgetCard`: Accessible cards with status-coded progress bars, safe daily spending, and cycle countdowns.
    - `BudgetSheet`: Bottom sheet drawer for configuring overall or category limits and interactive threshold slider.
    - `BudgetsPage` (`/budgets`): Full budget management dashboard with alert banners and primary ceiling controls.
    - `InsightCard` & `InsightsCarousel`: Horizontally swipeable insights cards on the Dashboard and full list on `/analytics`.
    - `MoreMenuPage` (`/more`): Central feature hub connecting Budgets, Recurring Expenses, Import/Export, and App Settings.
  - **Automated Tests & Quality Guarantees:**
    - 7 new backend integration tests (`test_budgets.py` and `test_insights.py`) covering status transitions, boundary conditions, and multi-tenant isolation.
    - Full pytest suite: 34 tests passing with zero float calls in backend calculations.
    - Frontend unit tests: 9 test files and 28 Vitest tests passing.
    - ESLint passing with zero warnings/errors and TypeScript production build verified with chunk sizes < 110 KB gzipped.

## [0.4.0] - 2026-11-02

### Added
- **Milestone M3 — Visual Analytics & Dashboard:**
  - **Backend Analytics Engine (`backend/app/services/analytics.py` & `api/v1/analytics.py`):**
    - `GET /analytics/summary`: Real-time executive financial KPIs (today, week, month spend & transaction counts, active monthly budget utilization with remaining balance and percentage, daily average spend, and projected month-end expenditure based on days elapsed).
    - `GET /analytics/by-category`: 2-level category and subcategory spending distribution with exact percentage breakdowns.
    - `GET /analytics/trend`: Chronological daily spending points enforcing strict zero-filling for days without expenditure across localized timezone periods.
    - `GET /analytics/by-payment-method`: UPI, Card, Cash, and Net Banking distribution with counts and percentages.
    - `GET /analytics/top-merchants`: Top merchant payees ranked by total expenditure with counts.
    - `GET /analytics/compare`: Same-elapsed-days period comparisons (e.g. Month-to-date vs previous month same-days) preventing false negative deltas.
    - `GET /analytics/heatmap`: Daily expenditure calendar points annotated with 0–4 spend intensity levels.
  - **High-Performance Seeding & Benchmark Suite (`backend/app/seed/demo_data.py`):**
    - Realistic Indian market dataset generator (UPI, Swiggy, Zomato, Blinkit, Uber, rent, utilities).
    - Latency benchmarking verifying all analytical queries return within < 300ms SLA (tested ~10ms on 1,000 transactions).
  - **Frontend Analytics & Visual Charts (`frontend/src/features/analytics/`):**
    - Installed and integrated Recharts (`^2.12.7`) with custom Rollup code splitting (vendor chunks < 110 KB gzipped).
    - `CategoryDonutChart.tsx`: Animated Donut chart (`innerRadius={58}`, `outerRadius={82}`), hex accents, center total display, and interactive category legend with tap-to-filter.
    - `DailyTrendChart.tsx`: Area chart with primary gradient fill, day tick formatting, compact currency axis, and highlighted today marker.
    - `CalendarHeatmap.tsx`: 7-column calendar grid visualizing daily spend intensity with hover/touch tooltips.
    - `AccessibleDataTable.tsx`: WCAG AA compliant semantic HTML table view for screen readers with category breakdown and reconciliation.
    - Custom React Query hooks: `useAnalyticsSummary`, `useAnalyticsByCategory`, `useAnalyticsTrend`, `useAnalyticsPaymentMethods`, `useAnalyticsTopMerchants`, `useAnalyticsCompare`, `useAnalyticsHeatmap`.
  - **Interactive Screens & Routing (`frontend/src/features/` & `src/app/`):**
    - **Dashboard (`/`):** Time-aware personalized greeting ("Good morning / afternoon / evening"), active salary cycle indicator, Hero Card with total monthly expenditure, budget progress bar, Stat Row (Today & This Week cards linking to filtered History), Category Donut breakdown, Daily Spending Trend, and Recent Transactions (last 5) with clean empty state for new users.
    - **Analytics (`/analytics`):** Period filter bar (Week, Month, Last Month), three core tabs (Overview, Categories, Trends), subcategory accordion disclosures, and accessible table view toggle.
  - **Automated Tests & Quality Guarantees:**
    - 5 new backend integration tests (`backend/tests/test_analytics.py`) covering reconciliation, zero-fill invariants, payment methods, top merchants, compare/heatmap, and multi-tenant isolation.
    - Full pytest suite (27 tests passing) and zero-float invariant verified.
    - Frontend unit tests across `DashboardPage.test.tsx` and `AnalyticsPage.test.tsx` (all 24 vitest tests passing).
    - ESLint passing with zero warnings/errors and TypeScript build verified.

## [0.3.0] - 2026-11-02

### Added
- **Milestone M2 — Categories & Transaction Management:**
  - **Temporal Engine (`backend/app/core/time.py`):**
    - Indian timezone fallback (`Asia/Kolkata`) and customized week start (Monday vs Sunday).
    - Custom salary cycle boundary calculations (`month_start_day` 1–28) with half-open UTC intervals `[start_inclusive, end_exclusive)`.
  - **Category Hierarchy & Smart Suggestion Engine (`backend/app/services/categories.py`):**
    - 2-level category tree generation with rolling 30-day transaction frequency tracking (`usage_count_30d`).
    - Merchant classification suggestion engine (`GET /categories/suggest?merchant=...`) resolving exact and substring rules before falling back to past transaction history.
    - Category CRUD with depth constraint enforcement (depth ≤ 2), default category protection against deletion, and transaction reassignment on custom category removal.
  - **Transaction Management Service & API (`backend/app/services/transactions.py` & `api/v1/transactions.py`):**
    - `POST /transactions`: Transaction creation with client-side UUID idempotency (`client_id`), ≤ 5-minute future restriction, integer paise boundary checks (1 paisa to ₹10 crore), and automatic category rule learning for novel merchant strings.
    - `GET /transactions`: Keyset cursor pagination (base64-encoded ISO timestamp + UUID tuple), PostgreSQL GIN trigram fuzzy search across merchant, description, and notes, multi-attribute filtering (date range in localized user timezone, category, subcategory, payment method, amount bounds), and pre-pagination financial totals reconciliation (`count` & `sum_minor`).
    - `GET /transactions/{id}` & `PATCH /transactions/{id}`: Single transaction detail lookup and field mutations.
    - `DELETE /transactions/{id}`: Soft deletion setting `deleted_at = now()`.
    - `POST /transactions/{id}/restore`: Soft deletion rollback for Undo toast.
    - `POST /transactions/bulk-delete`: Bulk soft-deletion supporting up to 200 transactions.
    - `GET /transactions/recent-merchants`: Recent unique merchant history for quick autocomplete.
  - **Frontend Financial Utilities & Primitives (`frontend/src/`):**
    - Integer paise formatting helpers (`src/lib/money.ts`): `parseRupeesToMinor`, `formatINR`, and compact Indian formatting `formatINRCompact` (Lakhs & Crores).
    - Custom tactile 3×4 numeric Keypad with decimal restrictions and long-press clear (`Keypad.tsx`).
    - Financial typography display with currency and cursor pulse (`AmountDisplay.tsx`).
    - Category pill chips with custom hex accents and Lucide icons (`Chip.tsx` & `CategoryIcon.tsx`).
    - Accessible slide-up drawer modal (`Sheet.tsx`).
    - Floating action Toast with 5-second timer and instant `[UNDO]` action trigger (`ToastContext.tsx` & `useToast.ts`).
  - **Mobile-First Feature Screens (`frontend/src/features/`):**
    - **Quick Add (`/add`):** Fast expense recording meeting the ≤ 3 taps goal, rolling 30-day top-5 category chips, expandable subcategories, segmented payment method control, collapsible merchant autocomplete & notes, and dynamic `Save ₹...` primary CTA.
    - **Transaction History (`/transactions`):** Day-grouped expense rows with localized date headers and day totals, sticky fuzzy search bar, filter bottom sheet with active filter badge, edit sheet modal, and swipe/button delete with instant Undo toast rollback.
    - Connected routes in `router.tsx` replacing previous milestone placeholders.
  - **Automated Test Suites & Zero-Float Invariants:**
    - 22 backend automated tests (`test_time.py`, `test_categories.py`, `test_transactions.py`) verifying multi-tenant isolation, idempotency, and boundary logic.
    - 20 frontend automated tests in Vitest covering `money.ts`, `Keypad.tsx`, `QuickAddPage.tsx`, and `TransactionsPage.tsx`.
    - Verified zero-float invariant across backend services (`grep -rn "float(" backend/app` -> 0 matches).

## [0.2.0] - 2026-11-02

### Added
- **Milestone M1 — Database Schema & Authentication:**
  - **Relational Schema & Migrations (`backend/alembic/`):**
    - Initial Alembic migration (`494b4b61087b_initial_schema.py`) enabling `citext` and `pg_trgm` extensions.
    - PostgreSQL 16 schema provisions: `users`, `refresh_tokens`, `categories`, `category_rules`, `transactions`, `budgets`, `recurring_rules`, `import_batches`, `api_tokens`, `push_subscriptions`, and `notification_log`.
    - Schema-ready Phase 3/4 entities: `accounts`, `goals`, and `transactions.account_id` foreign key.
  - **Database Models & Enums (`backend/app/models/`):**
    - Full SQLAlchemy 2.0 async models with UUID primary keys and UTC timestamp mixins.
    - StrEnum enumerations: `PaymentMethod`, `TxnSource`, `BudgetPeriod`, `RecurFreq`, `RecurMode`, `ImportStatus`, `AccountType`.
  - **Security & Hashing Services (`backend/app/core/` & `backend/app/services/`):**
    - Memory-hard Argon2id password hashing (`time_cost=3`, `memory_cost=65536`, `parallelism=4`).
    - Top 1,000 common passwords blacklist rejection check.
    - HS256 JWT access tokens (15-min TTL) and CSPRNG 32-byte hex refresh tokens (30-day TTL).
    - Refresh token rotation protocol with automatic breach neutralization (all user sessions revoked upon detected token reuse).
    - User account deletion with cascading foreign-key purge.
    - Default category seeding upon registration: 10 parent categories, 24 subcategories, and 25 merchant auto-classification rules.
  - **FastAPI Endpoints (`backend/app/api/v1/`):**
    - `POST /auth/register`: User registration with category and rule seeding.
    - `POST /auth/login`: Credential validation and token issuance.
    - `POST /auth/refresh`: Refresh token rotation.
    - `POST /auth/logout`: Refresh token revocation.
    - `GET /users/me`: Current user profile retrieval.
    - `PATCH /users/me`: Preference and salary cycle customization.
    - `POST /users/me/change-password`: Password update and session invalidation.
    - `DELETE /users/me`: Cascading account hard-delete.
  - **Frontend Authentication & Navigation (`frontend/src/`):**
    - Typed API client (`src/lib/api.ts`) with in-memory access token storage and automatic 401 refresh token interceptor.
    - Authentication state provider and hook (`AuthContext.tsx` & `useAuth.ts`).
    - Route protection guard (`AuthGuard.tsx`).
    - Responsive mobile authentication screens: `LoginPage.tsx` and `RegisterPage.tsx` built with React Hook Form and Zod schemas.
    - Updated `AppShell.tsx` displaying user profile name/email and sign-out action.

- **Milestone M0 — Project Scaffolding & Tooling Baseline:**
  - Modern monorepo layout: Vite 5 + React 18 frontend and Python 3.12 + FastAPI backend.
  - Docker Compose orchestrating PostgreSQL 16 on port 5433 with healthchecks.
  - Makefile automation (`make lint`, `make test`, `make run-backend`, `make run-frontend`).

## [0.1.0] - 2026-11-02

### Added
- **Project Foundation & Master Documentation:**
  - `AGENTS.md`: Authoritative AI coding agent operating manual and inviolable engineering rules.
  - `PROJECT.md`: Comprehensive product definition, problem statement, market context (India/INR), and constraints.
  - `PRD.md`: Detailed Product Requirements Document with personas, journeys, functional requirements, and edge cases.
  - `TASKS.md`: Complete development roadmap across milestones M0 through M8 with granular checkboxes.
- **Architecture & System Design:**
  - `docs/architecture/ARCHITECTURE.md`: High-level system architecture, client PWA design, async FastAPI backend, and data flows.
  - `docs/architecture/SYSTEM_DESIGN.md`: Detailed C4 context and container diagrams, plus 7 Mermaid sequence diagrams.
  - `docs/architecture/DECISIONS.md`: Architectural Decision Records (ADR-0001 through ADR-0011) documenting settled decisions.
- **Technical Specifications:**
  - `docs/technical/TECH_STACK.md`: Complete inventory of pinned technologies, versions, responsibilities, and configs.
  - `docs/technical/DATABASE.md`: Full PostgreSQL 16 relational schema DDL, enums, indexes, constraints, ERD, and seeds.
  - `docs/technical/API_SPEC.md`: Comprehensive REST API documentation for all `/api/v1` endpoints with JSON contracts.
  - `docs/technical/SECURITY.md`: Security architecture covering Argon2id, JWT/refresh rotation, user isolation, and injection defense.
  - `docs/technical/ERROR_HANDLING.md`: Unified error envelope, backend exception hierarchy, correlation IDs, and UI boundaries.
  - `docs/technical/ENVIRONMENT.md`: Environment configuration specification for backend, frontend, and Docker Compose.
  - `docs/technical/INTEGRATIONS.md`: Specifications for PostgreSQL, Web Push (VAPID), iOS Shortcuts, and CSV statement dialects.
- **Development & Design Specifications:**
  - `docs/development/CODING_STANDARDS.md`: Strict conventions for Python 3.12, FastAPI, SQLAlchemy 2.0, React 18, and TypeScript.
  - `docs/development/TESTING.md`: Comprehensive testing strategy covering 80% coverage on services, user-isolation, and E2E.
  - `docs/development/DEPLOYMENT.md`: Local Docker Compose, Makefile automation, production Caddy/Nginx architecture, and backups.
  - `docs/design/UI_UX_SPEC.md`: Mobile-first iPhone 390×844 design specification, design tokens, and all 15 application screens.
- **Feature Specifications:**
  - `docs/features/EXPENSE_MANAGEMENT.md`: Quick Add, custom numeric keypad, category chips, and soft-delete undo.
  - `docs/features/ANALYTICS.md`: Summary metrics, Recharts Donut & Trends, timezone-aware boundaries, and reconciliation.
  - `docs/features/BUDGETS.md`: Overall and category budgets, threshold alerts, safe daily spend calculation, and alert deduplication.
  - `docs/features/RECURRING_EXPENSES.md`: Rule scheduling, month-end day clamping, catch-up idempotency, and dashboard cards.
  - `docs/features/IMPORT_EXPORT.md`: 3-step CSV statement import wizard, duplicate hash detection, and multi-sheet Excel export.
  - `docs/features/OFFLINE_PWA.md`: Standalone iOS PWA, Workbox precaching, IndexedDB queue, and idempotent sync.
  - `docs/features/NOTIFICATIONS.md`: Web Push (VAPID) daily logging reminders, budget alerts, and anti-fatigue limits.
  - `docs/features/IOS_SHORTCUTS.md`: Mode A deep link with prefill parameters and Mode B headless API with scoped tokens.
- **Project Tracking:**
  - `docs/project/CONTEXT.md`: Real-time executive project snapshot and agent handoff guide.
  - `docs/project/KNOWN_ISSUES.md`: Documented platform constraints (iOS WebKit sandbox, Safari Background Sync gap).
  - `docs/project/OPEN_QUESTIONS.md`: Documented edge case ambiguities and working assumptions.
