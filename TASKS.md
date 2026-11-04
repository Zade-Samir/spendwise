# SpendWise — Development Roadmap & Implementation Tasks

> **AI AGENT INSTRUCTION:**  
> This file tracks the exact execution state of the SpendWise engineering roadmap.  
> Mark items as:  
> - `[ ]` Not started  
> - `[~]` In progress  
> - `[x]` Completed  
> **RULE:** Never mark an item as `[x]` without verifying automated tests, static analysis (`make lint`), and acceptance criteria satisfaction.

---

## Milestone M0: Project Scaffolding & Tooling Baseline

- **Objective:** Establish the foundational repository structure, Docker environment, Makefile automation, linting/formatting pipelines, and healthcheck endpoints.
- **Dependencies:** None.
- **Status:** `[x] Completed`

### Tasks
- [x] **Infrastructure & Repo Layout:**
  - [x] Initialize repository structure matching `SPENDWISE_SPEC.md` Section 5.
  - [x] Create `docker-compose.yml` with `db` (Postgres 16), `api` (FastAPI), and `web` (Vite) services.
  - [x] Create `.env.example` containing all backend and frontend placeholders.
  - [x] Create `Makefile` with targets: `up`, `down`, `migrate`, `revision`, `seed-demo`, `test`, `e2e`, `lint`, `vapid`.
- [x] **Backend Baseline:**
  - [x] Configure `backend/pyproject.toml` with Python 3.12, FastAPI, SQLAlchemy 2.0, Pydantic v2, Ruff, and Mypy.
  - [x] Implement `app/main.py` with FastAPI factory, CORS middleware, and `/health` route.
  - [x] Initialize Alembic with asyncpg driver (`backend/alembic.ini`, `backend/alembic/env.py`).
  - [x] Implement `app/core/config.py` using `pydantic-settings`.
- [x] **Frontend Baseline:**
  - [x] Initialize React 18 + TypeScript SPA via Vite 5 (`frontend/`).
  - [x] Configure Tailwind CSS 3 with CSS variables and `class` dark mode.
  - [x] Configure ESLint, Prettier, and strict TypeScript checks (`tsconfig.json`).
  - [x] Set up basic `react-router-dom` router and TanStack Query provider.
- [x] **Testing & Quality Assurance:**
  - [x] Configure `pytest` and `pytest-asyncio` on backend; verify `/health` test passes.
  - [x] Configure `vitest` and `@testing-library/react` on frontend.
  - [x] Configure Playwright mobile viewport in `e2e/playwright.config.ts`.
- **Milestone M0 Acceptance Criteria:**
  - `docker compose config` validates configuration cleanly.
  - `http://localhost:8000/health` and `/api/v1/health` verified with live responses and tests.
  - `make lint` and `make test` pass cleanly with zero warnings/errors.

---

## Milestone M1: Database Schema & Authentication

- **Objective:** Provision complete PostgreSQL schema (including Phase 3/4 future tables), implement Argon2id password security, JWT access/refresh token rotation, user registration, and mobile AppShell.
- **Dependencies:** Milestone M0.
- **Status:** `[x] Completed`

### Tasks
- [x] **Database & Migrations:**
  - [x] Create initial Alembic migration enabling `citext` and `pg_trgm` extensions.
  - [x] Create tables: `users`, `refresh_tokens`, `categories`, `transactions`, `budgets`, `recurring_rules`, `category_rules`, `import_batches`, `api_tokens`, `push_subscriptions`, `notification_log`.
  - [x] Create future-proof Phase 3/4 tables: `accounts`, `goals`, and `transactions.account_id`.
  - [x] Implement seed data module: 10 default categories + 25 subcategories + 9 merchant auto-rules.
- [x] **Backend Authentication:**
  - [x] Implement password hashing with Argon2id (`app/core/security.py`).
  - [x] Implement JWT access token (15m) and rotating refresh token (30d) logic.
  - [x] Implement `POST /auth/register` (creates user, seeds default categories/rules, issues tokens).
  - [x] Implement `POST /auth/login`, `POST /auth/refresh` (with reuse-detection revocation), and `POST /auth/logout`.
  - [x] Implement `GET /users/me`, `PATCH /users/me`, `POST /users/me/change-password`, `DELETE /users/me`.
  - [x] Implement `deps.get_current_user` dependency guard.
- [x] **Frontend Authentication & Shell:**
  - [x] Implement typed API client (`src/lib/api.ts`) with automatic 401 refresh-and-retry.
  - [x] Implement `LoginPage` and `RegisterPage` with form validation (React Hook Form + Zod).
  - [x] Implement `AuthGuard` protecting internal routes.
  - [x] Implement mobile `AppShell` with bottom 5-slot `TabBar` (Home, History, ＋ Add, Analytics, More).
- [x] **Testing:**
  - [x] Test password length validation and common password rejection.
  - [x] Test refresh token rotation and token theft reuse revocation.
  - [x] Test account deletion cascading.
- **Milestone M1 Acceptance Criteria:**
  - User can register, log in, view their profile, refresh tokens, and log out.
  - Default categories and rules are seeded upon registration.
  - Protected routes redirect unauthenticated users to `/login`.

---

## Milestone M2: Categories & Transaction Management

- **Objective:** Implement core transaction tracking: custom numeric keypad, category selection, transaction CRUD, soft-delete with undo, filters, search, and user-isolation guarantees.
- **Dependencies:** Milestone M1.
- **Status:** `[x] Completed`

### Tasks
- [x] **Core Utilities & Backend Services:**
  - [x] Implement `backend/app/core/time.py` (day, week, month boundaries with salary start day).
  - [x] Implement `TransactionService` (CRUD, soft-delete, restore, idempotency via `client_id`).
  - [x] Implement `CategorizationService` (merchant learning and auto-suggestion).
  - [x] Implement `POST /transactions`, `GET /transactions` (cursor pagination, filters, trigram search).
  - [x] Implement `PATCH /transactions/{id}`, `DELETE /transactions/{id}`, `POST /transactions/{id}/restore`.
  - [x] Implement `GET /categories` (tree with `usage_count_30d`), `POST /categories`, `PATCH /categories/{id}`.
  - [x] Implement `GET /categories/suggest?merchant=...`.
- [x] **Frontend Implementation:**
  - [x] Implement `src/lib/money.ts` (`parseRupeesToMinor`, `formatINR`, `formatINRCompact`).
  - [x] Build reusable UI primitives: `Keypad` (custom 3×4 numeric), `AmountDisplay`, `Chip`, `Sheet`.
  - [x] Implement **Quick Add Screen (`/add`)**:
    - Numeric keypad with 2-decimal limit.
    - Top-5 frequency-based category chips + "More" sheet.
    - Subcategory selector chips.
    - Payment method selector (UPI, Cash, Card, Bank).
    - Details collapsible row (merchant autocomplete, notes).
    - Dynamic `Save ₹150` button.
    - Floating Toast with **Undo** action.
  - [x] Implement **Transaction History (`/transactions`)**:
    - Day-grouped transaction rows with day headers.
    - Sticky search bar with trigram fuzzy filtering.
    - Filter bottom sheet (date presets, categories, payment methods, amount range).
    - Swipe-to-delete with undo toast.
    - Detail/Edit bottom sheet.
- [x] **Testing:**
  - [x] Unit tests for `money.ts` and `time.py`.
  - [x] Parametrized multi-tenant user isolation tests across all transaction routes.
  - [x] Zero-float grep test across backend codebase.
  - [x] Test idempotent `client_id` replay on `POST /transactions`.
- **Milestone M2 Acceptance Criteria:**
  - Quick Add meets the **≤ 3 taps after typing amount** target.
  - History list correctly groups by day and reconciles total count and sum.
  - Soft-deleted transactions can be restored via the Undo toast.

---

## Milestone M3: Visual Analytics & Dashboard

- **Objective:** Implement executive dashboard, Recharts visual analytics (Category Donut, Daily Spending Trend), and comprehensive analytical query endpoints.
- **Dependencies:** Milestone M2.
- **Status:** `[x] Completed`

### Tasks
- [x] **Backend Analytics Services:**
  - [x] Implement `AnalyticsService` (`/analytics/summary`, `/analytics/by-category`, `/analytics/trend`, `/analytics/by-payment-method`, `/analytics/top-merchants`, `/analytics/compare`, `/analytics/heatmap`).
  - [x] Enforce zero-filling for missing calendar days in trend endpoints.
  - [x] Implement same-elapsed-days period comparison logic.
- [x] **Frontend Dashboard & Analytics UI:**
  - [x] Implement **Dashboard (`/`)**:
    - Greeting, month navigation label.
    - Hero Card: Big Monthly Expense number + overall budget progress bar.
    - Stat Row: Today and This Week cards (tap filters History).
    - Recharts Donut chart with category legend and tap-to-filter.
    - Daily spending bar/area chart with highlighted current day.
    - Recent transactions list (last 5) with "View all" link.
    - Clean empty state for new users without data.
  - [x] Implement **Analytics Screen (`/analytics`)**:
    - Period selector (Week, Month, Last month, Custom).
    - Tabs: Overview, Categories, Trends.
    - Expandable category rows revealing subcategory splits.
    - Calendar heatmap of daily expenditures.
    - Accessible "Show as table" toggle for screen reader compliance.
- [x] **Testing & Benchmarking:**
  - [x] Test analytics calculations with seeded transactions (`demo_data.py`); assert p95 latency < 300ms.
  - [x] Verify that summary totals reconcile mathematically with raw transaction sums.
- **Milestone M3 Acceptance Criteria:**
  - Dashboard loads in < 1.5s on mobile network.
  - All charts render responsively on the 390×844 iPhone viewport.

---

## Milestone M4: Budgets & Rule-Based Insights

- **Objective:** Implement overall and category budgets with overspend warning thresholds, and the 11-rule deterministic spending insight engine.
- **Dependencies:** Milestone M3.
- **Status:** `[x] Completed`

### Tasks
- [x] **Budgets Engine:**
  - [x] Implement `BudgetService` (upsert, active period spending, safe daily spend calculation).
  - [x] Implement `GET /budgets`, `PUT /budgets`, `DELETE /budgets/{id}`.
  - [x] Implement automated budget threshold evaluation hook in transaction lifecycle.
  - [x] Implement `BudgetsPage` (`/budgets`) with progress rings, threshold sliders, and status colors (`ok`, `warning`, `exceeded`).
  - [x] Add warning banner on Dashboard when any budget crosses threshold.
- [x] **Insight Engine:**
  - [x] Implement `InsightService` with 11 statistical heuristics (top category, category jump, weekend spike, small spends, streaks, etc.).
  - [x] Implement `GET /insights` endpoint.
  - [x] Build horizontal Insights Carousel on the Dashboard and full list on Analytics.
- [x] **Testing:**
  - [x] Test budget status transitions (`ok` → `warning` → `exceeded`).
  - [x] Test mid-period budget creation accounting for past spend.
  - [x] Test insight heuristic threshold boundaries and empty data states.
- **Milestone M4 Acceptance Criteria:**
  - Budgets accurately calculate `safe_daily_minor` and display warning states.
  - Insights degrade gracefully without crashing on sparse transaction data.

---

## Milestone M5: PWA Capabilities & Offline Resilience

- **Objective:** Complete iOS PWA installation, Service Worker shell precaching, IndexedDB offline transaction queue, and seamless idempotent synchronization.
- **Dependencies:** Milestone M2.
- **Status:** `[x] Completed`

### Tasks
- [x] **PWA Configuration:**
  - [x] Create `manifest.webmanifest` with icons (192, 512, maskable 512, apple-touch-icon-180).
  - [x] Add iOS PWA meta tags in `index.html` (`apple-mobile-web-app-capable`, `black-translucent`, `viewport-fit=cover`).
  - [x] Configure `vite-plugin-pwa` with `injectManifest` strategy.
  - [x] Build custom service worker (`src/sw.ts`) precaching static assets and routing navigation requests.
  - [x] Build dismissible iOS Safari "Add to Home Screen" installation guidance banner.
- [x] **Offline Pipeline:**
  - [x] Implement `src/lib/offlineQueue.ts` using `idb` (`pending_transactions` store).
  - [x] Intercept network failures in `useCreateTransaction` and enqueue offline mutations.
  - [x] Implement sync triggers: `online` event, `visibilitychange`, and app launch.
  - [x] Render pending offline transactions with clock badges and optimistic dashboard updates.
  - [x] Implement React Query cache persistence via `@tanstack/react-query-persist-client`.
- [x] **Testing:**
  - [x] Offline queue unit tests: enqueue, delete, sequential replay, network abort, 422 error tracking.
  - [x] Service worker injectManifest and static asset precache validation in production build.
- **Milestone M5 Acceptance Criteria:**
  - App is installable on iOS Safari Home Screen.
  - Expenses created offline sync reliably upon network reconnection without duplicates.

---

## Milestone M6: Statement Import/Export & Recurring Expenses

- **Objective:** Implement 3-step CSV statement import wizard with duplicate detection, multi-sheet Excel export, and recurring expenses scheduler.
- **Dependencies:** Milestone M3.
- **Status:** `[x] Completed — 2026-11-03`

### Tasks
- [x] **CSV / Excel Import & Export:**
  - [x] Implement `CSVImportService` (delimiter sniffing, encoding detection, date format parsing, duplicate hash calculation).
  - [x] Implement `POST /imports`, `POST /imports/{id}/preview`, `POST /imports/{id}/commit`, `DELETE /imports/{id}` (undo).
  - [x] Implement `ExportService` generating UTF-8 CSV with formula injection defense and multi-sheet `.xlsx` via `openpyxl`.
  - [x] Implement `ImportWizardPage` (`/import`): file picker, column mapping preview, row review table, commit summary with Undo.
- [x] **Recurring Expenses:**
  - [x] Implement `RecurringService` (schedule calculation, month-end day clamping, catch-up logic, idempotent `uuid5` client_id).
  - [x] Implement `POST /recurring`, `GET /recurring`, `GET /recurring/due`, `POST /recurring/{id}/confirm`, `POST /recurring/{id}/skip`.
  - [x] Configure APScheduler hourly background job executing `auto_create` rules.
  - [x] Add `DueRecurringCard` confirmation card on the Dashboard.
  - [x] Implement `RecurringPage` (`/recurring`) with full CRUD and pause/resume.
- [x] **Testing:**
  - [x] Test CSV import with HDFC, SBI, and single-column signed-amount fixtures (5 tests passing).
  - [x] Test export CSV and xlsx (3 tests passing).
  - [x] Test recurring CRUD, catch-up idempotency, and multi-tenant isolation (4 tests passing).
- **Milestone M6 Acceptance Criteria:**
  - [x] Bank statements import cleanly with accurate duplicate detection.
  - [x] Exported CSVs contain escaped formula injection characters (`'` prefix).
  - [x] All 46 backend tests pass, zero ruff/mypy errors (58 source files).
  - [x] Frontend TypeScript strict: 0 errors. Production build: 2.45s ✓.

---

## Milestone M7: Web Push Notifications & iOS Shortcuts

- **Objective:** Implement VAPID Web Push daily reminders, budget threshold alerts, personal API tokens, and iOS Shortcuts integration.
- **Dependencies:** Milestone M4, M5.
- **Status:** `[x] Completed — 2026-11-03`

### Tasks
- [x] **Push Notifications:**
  - [x] Implement `POST /push/subscribe`, `DELETE /push/subscribe`, `POST /push/test`.
  - [x] Configure APScheduler 15-minute job evaluating daily logging reminders at local `reminder_time`.
  - [x] Implement deduplicated alert dispatching in `notification_log`.
  - [x] Implement service worker `push` and `notificationclick` handlers opening `/add` or `/`.
  - [x] Add notification settings UI in `/settings`.
- [x] **iOS Shortcuts & Tokens:**
  - [x] Implement API token management (`POST /api-tokens`, `GET /api-tokens`, `DELETE /api-tokens/{id}`).
  - [x] Implement `POST /shortcuts/transactions` authenticated via `sw_*` token.
  - [x] Implement URL parameter prefill parsing on `/add` (`amount`, `category`, `merchant`, `pm`).
  - [x] Build `/settings/shortcuts` setup screen with copyable snippets and token generator.
  - [x] Create user guide document `docs/SHORTCUTS.md`.
- [x] **Testing:**
  - [x] Test notification deduplication keys (prevent duplicate daily reminders).
  - [x] Test `POST /shortcuts/transactions` with valid and revoked tokens.
  - [x] Test URL prefill validation on `/add`.
- **Milestone M7 Acceptance Criteria:**
  - [x] Shortcuts can create transactions headlessly via API token.
  - [x] `/add` pre-fills amount and category from URL query parameters.
  - [x] All 57 backend tests passing, 35 frontend tests passing, 0 lint errors.

---

## Milestone M8: Polish, Accessibility & System Hardening

- **Objective:** Final end-to-end hardening, light/dark themes, accessibility audit, bundle optimization, security headers, demo data seeding, and production readiness.
- **Dependencies:** Milestones M0 through M7.
- **Status:** `[x] Completed — 2026-11-03`

### Tasks
- [x] **Visual & Ergonomic Polish:**
  - [x] Audit light, dark, and system theme switching across all screens (`ThemeProvider`, reactive `prefers-color-scheme`, class toggle on root).
  - [x] Verify safe area insets on iPhone Home Screen bar and notch (`env(safe-area-inset-*)`).
  - [x] Verify touch targets meet or exceed 44×44 px everywhere.
  - [x] Add Account Management: change password and cascading account deletion in `/settings`.
- [x] **Performance & Security Hardening:**
  - [x] Implement route-level code splitting (`React.lazy` on Analytics, Import, Settings, Budgets, Recurring, Recharts).
  - [x] Confirm initial gzipped JavaScript bundle is ≤ 250 KB (actual: ~144 KB).
  - [x] Enforce rate limiting (10/min auth, 120/min general API via `RateLimitMiddleware`).
  - [x] Enforce hardened security headers on FastAPI (`CSP`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`).
  - [x] Audit application logs to confirm zero sensitive data leakage (`SensitiveDataFilter`).
- [x] **Documentation & Final Verification:**
  - [x] Verify `README.md` provides clean setup, tunnel instructions, and Make commands.
  - [x] Run full E2E test suite in mobile viewport (`e2e/flow.spec.ts`).
  - [x] Execute `make seed-demo` and verify dashboard numbers on 3-month realistic dataset.
  - [x] Provide CSV test fixtures (`sample_bank.csv`, `sample_gpay.csv`).
  - [x] Update `CHANGELOG.md` and `docs/project/CONTEXT.md`.
- **Milestone M8 Acceptance Criteria:**
  - [x] All items in Section 17 of `SPENDWISE_SPEC.md` satisfied.
  - [x] `make lint && make test` pass with 100% success rate (96 tests passing, 0 lint/type errors).
