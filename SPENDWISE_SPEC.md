# SpendWise: Technical & Product Specification

> **Audience:** an AI coding agent (or developer) who will build the whole project from this file.
> **How to use:** read the entire document first, then execute the build in the order given in **§19 Build Plan**. Every milestone has acceptance criteria. Do not skip them. When this spec is ambiguous, choose the simplest option consistent with §2 (Principles) and record the decision in `docs/DECISIONS.md`.

---

## 1. Product Summary

**SpendWise** is a mobile-first personal expense tracker. It helps an individual record spending in 5–10 seconds, then shows where the money goes (daily / weekly / monthly totals, category breakdowns, budgets, insights).

- **Problem:** people make many small digital payments (Google Pay, PhonePe, Paytm, cash) and have no clear picture of their spending. Excel sheets and notebooks get abandoned because manual entry is tedious.
- **Solution:** a PWA with a very fast quick-add flow, automatic calculations and categorization, a clear dashboard, and analytics.
- **Primary device:** iPhone (Safari → Add to Home Screen). Desktop works but is secondary.
- **Primary market:** India (INR ₹, UPI, `en-IN` number formatting, IST default timezone).
- **One-line value:** *Spend less time recording expenses and more time understanding your money.*

### 1.1 Product decisions (settled, do not revisit)

| Decision | Choice |
|---|---|
| Primary user | **Individuals** tracking their own expenses (no family/shared accounts in v1; schema is multi-user safe) |
| How transactions get in | **Quick manual entry + CSV import** first; iPhone Shortcuts deep-link/API as a Phase 4 enhancement (scaffolded early, see §12) |
| Strongest selling point | **Spending analytics** (dashboard, category breakdown, trends, budgets, rule-based insights) |
| Biggest risk | **Entry friction.** Every UX decision must favor fewer taps |

### 1.2 Hard platform limitation (must be reflected in UI copy)

A PWA **cannot** read Google Pay (or any other app's) transactions on iOS. The app **never auto-detects payments**. The user always confirms amount and category. Any "automation" is limited to: a Shortcut that opens SpendWise's quick-add screen (optionally prefilled), and statement import.

---

## 2. Guiding Principles

1. **Entry speed above all.** Amount → category → Save. Everything else is optional.
2. **Correctness of money.** Integers only (paise). Never floats. Totals must always equal the sum of transactions.
3. **Honest data.** Insights and charts derive only from stored transactions. No fabricated numbers. Use empty states instead of fake data.
4. **Mobile-first.** Design at 390×844 (iPhone 17 class) first, then scale up.
5. **Works offline.** Adding an expense must never fail because of a bad connection.
6. **Simple rules before AI.** v1 has no LLM. Insights are deterministic SQL/Python rules.
7. **Boring tech, strict types.** TypeScript strict on the frontend; type-annotated Python with Pydantic v2 on the backend.

---

## 3. Scope

### 3.1 In scope for v1 (Phases 1–2)

Auth, quick expense entry, categories + subcategories (custom allowed), dashboard, transaction history with search/filter/sort/edit/delete, daily/weekly/monthly analytics, category analytics, monthly + category budgets with warnings, recurring expenses, CSV import (with mapping, duplicate detection, category suggestion), CSV export, rule-based spending insights, PWA install + offline add, in-app + web-push reminders, settings.

### 3.2 Scaffolded early, finished later (Phases 3–4)

Spending predictions, anomaly detection, subscription detection, savings goals, multi-wallet accounts, AI assistant, native-style automation. The **data model already supports** them (see §6). **UI for these is out of scope for v1.**

### 3.3 Non-goals

Auto-reading Google Pay/bank data, multi-currency conversion, family/shared budgets, bank-account linking (Account Aggregator), native iOS/Android apps, investment tracking, receipt OCR.

---

## 4. Tech Stack (pinned choices)

| Layer | Choice | Notes |
|---|---|---|
| Frontend | **React 18 + TypeScript (strict) + Vite 5** | SPA |
| Styling | **Tailwind CSS 3** | Mobile-first, CSS variables for theme tokens, dark mode via `class` strategy |
| Routing | `react-router-dom` v6 | |
| Server state | `@tanstack/react-query` v5 | |
| Forms/validation | `react-hook-form` + `zod` | |
| Charts | **Recharts** | Donut/Pie, Bar, Area/Line |
| Offline storage | `idb` (IndexedDB wrapper) | Offline queue + cached reference data |
| PWA | `vite-plugin-pwa` (Workbox, `injectManifest` strategy) | |
| Dates | `date-fns` + `date-fns-tz` | |
| Icons | `lucide-react` | |
| CSV parsing (client preview) | `papaparse` | |
| Backend | **Python 3.12 + FastAPI** | async |
| ORM / migrations | **SQLAlchemy 2.0 (async) + Alembic** | `asyncpg` driver |
| Validation | **Pydantic v2** | |
| Auth | JWT access (15 min) + refresh token (30 days, rotating, stored hashed) ; `argon2-cffi` for passwords | |
| Scheduler | **APScheduler** (in-process, `AsyncIOScheduler`) | Recurring expenses + reminders |
| Web push | `pywebpush` (VAPID) | |
| Database | **PostgreSQL 16** | |
| Tests | Backend: `pytest`, `pytest-asyncio`, `httpx`, `testcontainers` or a dedicated test DB. Frontend: `vitest` + `@testing-library/react`. E2E: `playwright` (mobile viewport) | |
| Lint/format | Backend: `ruff` + `mypy --strict`. Frontend: `eslint` + `prettier` | |
| Dev infra | `docker compose` (db, api, web), `Makefile` | |

---

## 5. Repository Layout

```
spendwise/
├── README.md
├── Makefile
├── docker-compose.yml
├── .env.example
├── docs/
│   ├── DECISIONS.md
│   └── SHORTCUTS.md                # iOS Shortcut setup guide (see §12)
├── backend/
│   ├── pyproject.toml
│   ├── alembic.ini
│   ├── alembic/versions/
│   ├── app/
│   │   ├── main.py                 # FastAPI app factory, routers, CORS, lifespan (scheduler)
│   │   ├── core/
│   │   │   ├── config.py           # pydantic-settings
│   │   │   ├── security.py         # hashing, JWT, token generation
│   │   │   ├── db.py               # async engine, session dependency
│   │   │   ├── errors.py           # AppError + exception handlers
│   │   │   └── time.py             # tz helpers, period boundaries
│   │   ├── models/                 # SQLAlchemy models (one file per table group)
│   │   ├── schemas/                # Pydantic request/response models
│   │   ├── api/
│   │   │   ├── deps.py             # get_current_user, get_db, api-token auth
│   │   │   └── v1/                 # auth, users, categories, transactions, budgets,
│   │   │                           # recurring, analytics, insights, imports, exports,
│   │   │                           # push, api_tokens, shortcuts, health
│   │   ├── services/               # business logic (no FastAPI imports)
│   │   │   ├── transactions.py
│   │   │   ├── analytics.py
│   │   │   ├── budgets.py
│   │   │   ├── insights.py
│   │   │   ├── categorization.py
│   │   │   ├── csv_import.py
│   │   │   ├── recurring.py
│   │   │   └── reminders.py
│   │   ├── jobs/scheduler.py
│   │   └── seed/
│   │       ├── default_categories.py
│   │       └── demo_data.py        # `python -m app.seed.demo_data --email ...`
│   └── tests/
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── index.html                  # iOS PWA meta tags (see §11)
│   ├── public/
│   │   ├── icons/                  # 192, 512, maskable-512, apple-touch-icon-180
│   │   └── splash/                 # optional iOS splash images
│   └── src/
│       ├── main.tsx
│       ├── sw.ts                   # custom service worker (injectManifest)
│       ├── app/                    # router, providers, layout (AppShell, TabBar)
│       ├── lib/                    # api client, money, dates, offlineQueue, push
│       ├── features/
│       │   ├── auth/  dashboard/  quick-add/  transactions/  analytics/
│       │   ├── budgets/  recurring/  import-export/  settings/  insights/
│       ├── components/             # ui primitives (Button, Sheet, Chip, Keypad, ...)
│       └── types/                  # generated/hand-written API types
└── e2e/                            # playwright tests
```

---

## 6. Data Model (PostgreSQL)

Conventions: UUID primary keys (`gen_random_uuid()`), `timestamptz` everywhere, `created_at`/`updated_at` on all tables, **money stored as `BIGINT` paise (`amount_minor`)**, soft delete on transactions (`deleted_at`). Every user-owned table has `user_id` and **every query must filter by `user_id`**.

### 6.1 Enums

```sql
CREATE TYPE payment_method AS ENUM ('upi','cash','card','bank_transfer','other');
CREATE TYPE txn_source     AS ENUM ('manual','shortcut','csv_import','recurring');
CREATE TYPE budget_period  AS ENUM ('weekly','monthly');
CREATE TYPE recur_freq     AS ENUM ('daily','weekly','monthly','yearly');
CREATE TYPE recur_mode     AS ENUM ('auto_create','remind');
CREATE TYPE import_status  AS ENUM ('uploaded','mapped','committed','failed');
```

### 6.2 Tables

```sql
users (
  id uuid PK, email citext UNIQUE NOT NULL, password_hash text NOT NULL, name text,
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  currency char(3) NOT NULL DEFAULT 'INR',
  week_start smallint NOT NULL DEFAULT 1,           -- 1=Monday … 7=Sunday
  month_start_day smallint NOT NULL DEFAULT 1,      -- 1..28 (salary-cycle support)
  default_payment_method payment_method NOT NULL DEFAULT 'upi',
  reminder_enabled boolean NOT NULL DEFAULT true,
  reminder_time time NOT NULL DEFAULT '21:00',      -- local to user tz
  theme text NOT NULL DEFAULT 'system',             -- system|light|dark
  created_at, updated_at
)

refresh_tokens (
  id uuid PK, user_id FK, token_hash text UNIQUE, expires_at, revoked_at, created_at,
  user_agent text
)

categories (
  id uuid PK, user_id FK, parent_id uuid NULL FK categories(id) ON DELETE CASCADE,
  name text NOT NULL, icon text NOT NULL,           -- lucide icon name or emoji
  color text NOT NULL,                              -- hex
  sort_order int NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,        -- seeded; may be renamed/archived but not hard-deleted
  archived_at timestamptz NULL,
  UNIQUE (user_id, parent_id, lower(name))          -- implemented via unique index with COALESCE(parent_id, zero-uuid)
)
-- Max depth = 2 (category → subcategory). Enforce in service layer.

transactions (
  id uuid PK, user_id FK,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  category_id uuid NOT NULL FK categories(id),      -- always the TOP-LEVEL category
  subcategory_id uuid NULL FK categories(id),       -- optional child of category_id
  merchant text NULL, description text NULL, notes text NULL,
  payment_method payment_method NOT NULL DEFAULT 'upi',
  occurred_at timestamptz NOT NULL DEFAULT now(),
  source txn_source NOT NULL DEFAULT 'manual',
  client_id uuid NULL,                              -- idempotency key from the client (offline queue)
  import_batch_id uuid NULL FK import_batches(id),
  recurring_rule_id uuid NULL FK recurring_rules(id),
  dedupe_hash text NULL,                            -- sha256(user|date|amount|normalized description)
  deleted_at timestamptz NULL,
  created_at, updated_at,
  UNIQUE (user_id, client_id)                       -- partial: WHERE client_id IS NOT NULL
)
-- Indexes:
--   (user_id, occurred_at DESC) WHERE deleted_at IS NULL
--   (user_id, category_id, occurred_at DESC) WHERE deleted_at IS NULL
--   (user_id, dedupe_hash)
--   GIN trigram on (merchant || ' ' || description) via pg_trgm for search
-- Extensions: citext, pg_trgm

budgets (
  id uuid PK, user_id FK,
  category_id uuid NULL FK categories(id),          -- NULL = overall budget
  period budget_period NOT NULL DEFAULT 'monthly',
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  alert_threshold_pct smallint NOT NULL DEFAULT 80, -- warn at this % used
  active boolean NOT NULL DEFAULT true,
  created_at, updated_at,
  UNIQUE (user_id, category_id, period)             -- COALESCE for NULL category
)

recurring_rules (
  id uuid PK, user_id FK, name text NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  category_id FK, subcategory_id NULL FK, merchant text NULL,
  payment_method payment_method NOT NULL DEFAULT 'upi',
  frequency recur_freq NOT NULL, interval_count smallint NOT NULL DEFAULT 1,
  day_of_month smallint NULL,                       -- for monthly/yearly (clamped to month length)
  day_of_week smallint NULL,                        -- for weekly (1..7)
  start_date date NOT NULL, end_date date NULL,
  next_due_date date NOT NULL,
  mode recur_mode NOT NULL DEFAULT 'remind',
  active boolean NOT NULL DEFAULT true,
  created_at, updated_at
)

category_rules (                                    -- merchant → category auto-categorization
  id uuid PK, user_id FK,
  pattern text NOT NULL,                            -- case-insensitive "contains"
  category_id FK, subcategory_id NULL FK,
  priority int NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'user',              -- 'user' | 'learned'
  created_at
)

import_batches (
  id uuid PK, user_id FK, filename text, status import_status,
  row_count int, imported_count int, duplicate_count int, skipped_count int,
  column_mapping jsonb, raw_rows jsonb,             -- parsed rows kept until commit (cap 5,000 rows, 2 MB)
  created_at, committed_at
)

api_tokens (                                        -- personal tokens for iOS Shortcuts
  id uuid PK, user_id FK, name text, token_hash text UNIQUE, last4 text,
  scopes text[] NOT NULL DEFAULT '{transactions:create}',
  last_used_at, revoked_at, created_at
)

push_subscriptions (
  id uuid PK, user_id FK, endpoint text UNIQUE, p256dh text, auth text,
  user_agent text, created_at
)

notification_log (
  id uuid PK, user_id FK, kind text,                -- daily_reminder | budget_warning | budget_exceeded | recurring_due
  dedupe_key text, sent_at,
  UNIQUE (user_id, kind, dedupe_key)                -- prevents duplicate sends
)

-- Phase 3/4 tables (create migrations now, no UI in v1):
accounts (id, user_id, name, type[cash|bank|card|wallet], opening_balance_minor, archived_at)
goals    (id, user_id, name, target_minor, saved_minor, target_date)
-- transactions gets nullable account_id FK accounts(id) in the same migration set.
```

### 6.3 Seed data: default categories (created on registration)

| Category | Icon | Color | Subcategories |
|---|---|---|---|
| Food & Dining | `utensils` | `#F97316` | Restaurant, Cafe, Delivery |
| Transportation | `car` | `#3B82F6` | Auto, Cab, Bus, Train, Fuel |
| Groceries | `shopping-basket` | `#22C55E` | Vegetables, Household |
| Shopping | `shopping-bag` | `#A855F7` | Clothes, Electronics |
| Bills | `receipt` | `#EAB308` | Electricity, Internet, Mobile |
| Housing | `home` | `#14B8A6` | Rent, Maintenance |
| Entertainment | `film` | `#EC4899` | Movies, Games |
| Healthcare | `heart-pulse` | `#EF4444` | Medicine, Doctor |
| Travel | `plane` | `#06B6D4` | Hotels, Tickets |
| Others | `circle-ellipsis` | `#64748B` | Miscellaneous |

Default `category_rules` seeded on registration (priority 0, source `user`): `uber/ola/rapido → Transportation/Cab`, `swiggy/zomato → Food & Dining/Delivery`, `bigbasket/blinkit/zepto/dmart → Groceries`, `amazon/flipkart/myntra → Shopping`, `airtel/jio/vi/bsnl → Bills/Mobile`, `bescom/mseb/tata power/adani electricity → Bills/Electricity`, `irctc → Travel/Tickets`, `bookmyshow → Entertainment/Movies`, `apollo/medplus/pharmeasy → Healthcare/Medicine`.

---

## 7. Money, Time & Period Rules (critical; implement once, reuse everywhere)

### 7.1 Money
- Store **paise** as `int`/`BIGINT`. API sends and receives `amount_minor` (integer). No decimals in JSON for money.
- Frontend `lib/money.ts`: `parseRupeesToMinor("150.50") → 15050`, `formatINR(15050) → "₹150.50"`, `formatINRCompact(1845000) → "₹18,450"` (drop `.00`), always `Intl.NumberFormat('en-IN')` (lakh/crore grouping: `₹1,25,000`).
- Max single amount: `₹1,00,00,000` (10 crore = `1_000_000_000` paise). Min `₹0.01`.
- Keypad accepts up to 2 decimal places.

### 7.2 Time
- `occurred_at` stored UTC. All "today / this week / this month" logic is computed in the **user's timezone** (`users.timezone`).
- `backend/app/core/time.py` provides:
  - `day_bounds(date, tz) -> (start_utc, end_utc)`
  - `week_bounds(date, tz, week_start)`
  - `month_bounds(date, tz, month_start_day)` (if `month_start_day=25`, "this month" for 10 Nov is 25 Oct → 24 Nov)
  - `iter_days(start, end, tz)`
- Ranges are **half-open** `[start, end)`.
- Frontend sends `tz` implicitly via the user profile; the API never trusts a client-sent offset.
- Group-by-day in SQL uses `date_trunc('day', occurred_at AT TIME ZONE :tz)`.

### 7.3 Week/month "to date" semantics
- "This week" = from week start through now. "Last week" = full previous week.
- "Compare to last month" for insights compares **same elapsed days** (e.g. 1–12 Nov vs 1–12 Oct), not full previous month, unless the previous period is complete and the user asks for "full".

---

## 8. Backend API Specification

Base path: `/api/v1`. JSON only (except CSV export/upload). Auth: `Authorization: Bearer <access_jwt>`; Shortcut endpoint also accepts `Bearer sw_<api_token>`. All timestamps ISO-8601 UTC. All lists are scoped to the current user.

### 8.1 Conventions

**Error envelope (all non-2xx):**
```json
{ "error": { "code": "validation_error", "message": "Amount must be greater than 0", "fields": { "amount_minor": "must be > 0" } } }
```
Codes: `validation_error` (422), `unauthorized` (401), `forbidden` (403), `not_found` (404), `conflict` (409), `rate_limited` (429), `server_error` (500).

**Pagination (cursor):** `?limit=50&cursor=<opaque>` → `{ "items": [...], "next_cursor": "..." | null }`. Default limit 50, max 200. Cursor encodes `(occurred_at, id)`.

**Idempotency:** `POST /transactions` accepts `client_id` (UUID). A repeat with the same `client_id` returns the **existing** transaction with `200` (not 409), so offline replays are safe.

**Rate limits:** auth endpoints 10/min/IP; others 120/min/user (simple in-memory limiter is fine for v1).

**CORS:** allow `FRONTEND_ORIGIN` only.

### 8.2 Auth

| Method & Path | Body | Response |
|---|---|---|
| `POST /auth/register` | `{email, password(min 8), name?}` | `201 {user, access_token, refresh_token}`; seeds default categories + rules |
| `POST /auth/login` | `{email, password}` | `200 {user, access_token, refresh_token}` |
| `POST /auth/refresh` | `{refresh_token}` | `200 {access_token, refresh_token}`; old refresh token is revoked (rotation); reuse of a revoked token revokes all of that user's tokens |
| `POST /auth/logout` | `{refresh_token}` | `204` |
| `GET /users/me` | | `User` |
| `PATCH /users/me` | any of `name, timezone, currency, week_start, month_start_day, default_payment_method, reminder_enabled, reminder_time, theme` | `User` |
| `POST /users/me/change-password` | `{current_password, new_password}` | `204` |
| `DELETE /users/me` | `{password}` | `204`; hard-deletes all user data |

### 8.3 Categories

| Method & Path | Notes |
|---|---|
| `GET /categories` | Returns tree: `[{id,name,icon,color,sort_order,archived,children:[...], usage_count_30d}]`. `?include_archived=false` |
| `POST /categories` | `{name, icon, color, parent_id?}`. Enforce depth ≤ 2, unique name per parent (case-insensitive) |
| `PATCH /categories/{id}` | rename/icon/color/sort_order/archive |
| `DELETE /categories/{id}` | If it has transactions → `409`, with hint to archive or pass `?reassign_to=<id>`; with `reassign_to`, move transactions then delete. Default categories can only be archived |
| `GET /categories/suggest?merchant=uber` | `{category_id, subcategory_id, confidence: "rule"|"history"|null}` (see §10.1) |

`usage_count_30d` powers "frequently used first" ordering in the quick-add UI.

### 8.4 Transactions

`Transaction` response:
```json
{
  "id": "uuid", "amount_minor": 15000,
  "category": {"id":"..","name":"Food & Dining","icon":"utensils","color":"#F97316"},
  "subcategory": {"id":"..","name":"Restaurant"} ,
  "merchant": "Saravana Bhavan", "description": "Lunch", "notes": null,
  "payment_method": "upi", "occurred_at": "2026-11-02T07:15:00Z",
  "source": "manual", "client_id": "uuid|null",
  "created_at": "...", "updated_at": "..."
}
```

| Method & Path | Notes |
|---|---|
| `POST /transactions` | Body: `{amount_minor, category_id, subcategory_id?, merchant?, description?, notes?, payment_method?, occurred_at? (default now), client_id?, source? (manual|shortcut)}`. `occurred_at` may not be > now + 5 min. Validates `subcategory.parent_id == category_id`. On success also upserts a **learned** category rule when `merchant` present (§10.1). Returns `201` (or `200` for idempotent replay) |
| `GET /transactions` | Filters: `q` (merchant/description/notes, trigram `ILIKE`), `from`, `to` (dates, user tz, inclusive), `category_id` (matches category OR subcategory parent), `subcategory_id`, `payment_method` (repeatable), `min_amount_minor`, `max_amount_minor`, `source`. Sort: `sort=date_desc` (default) `date_asc` `amount_desc` `amount_asc`. Cursor-paginated. Response also includes `totals: {count, sum_minor}` for the **whole filtered set** (not just the page) |
| `GET /transactions/{id}` | |
| `PATCH /transactions/{id}` | Partial update of any editable field |
| `DELETE /transactions/{id}` | Soft delete → `204` |
| `POST /transactions/{id}/restore` | Undo delete (used by the "Undo" toast, valid for any time) |
| `POST /transactions/bulk-delete` | `{ids: [...]}` max 200 → `{deleted: n}` |
| `GET /transactions/recent-merchants?limit=10` | Distinct recent merchants with their last category (for autocomplete chips) |

### 8.5 Analytics (all computed server-side, user timezone)

Common query params: `from`, `to` (dates) **or** `period=today|week|month|last_week|last_month|custom`. Defaults to `month`.

| Path | Response |
|---|---|
| `GET /analytics/summary` | `{today:{sum_minor,count}, week:{...}, month:{...}, month_budget:{amount_minor, spent_minor, remaining_minor, pct_used} | null, avg_daily_minor (month-to-date), projected_month_minor (spent so far / elapsed days × days in month; null before day 3)}` |
| `GET /analytics/by-category` | `{total_minor, items:[{category_id,name,icon,color,sum_minor,count,pct, children:[{subcategory_id,name,sum_minor,pct}]}]}` sorted desc |
| `GET /analytics/trend` | `?granularity=day|week|month&from&to` → `{points:[{date, sum_minor, count}]}`. **Zero-fill** missing days/weeks/months |
| `GET /analytics/by-payment-method` | `{items:[{payment_method,sum_minor,count,pct}]}` |
| `GET /analytics/top-merchants` | `?limit=10` → `{items:[{merchant,sum_minor,count}]}` (merchant normalized: trimmed, case-insensitive grouping) |
| `GET /analytics/compare` | `?period=month` → current vs previous (same elapsed days) per category: `{current_minor, previous_minor, delta_minor, delta_pct}` |
| `GET /analytics/day/{date}` | Transactions + total + category split for one date |
| `GET /analytics/heatmap` | `?month=2026-11` → per-day sums for the calendar heatmap |

### 8.6 Budgets

| Method & Path | Notes |
|---|---|
| `GET /budgets` | Each budget with live status for the **current period**: `{id, category (null=overall), period, amount_minor, spent_minor, remaining_minor, pct_used, status: "ok"|"warning"|"exceeded", alert_threshold_pct, days_left, safe_daily_minor}` where `safe_daily_minor = max(remaining,0) / days_left` |
| `PUT /budgets` | Upsert: `{category_id|null, period, amount_minor, alert_threshold_pct?}` |
| `DELETE /budgets/{id}` | |

Status rules: `exceeded` when `spent >= amount`; `warning` when `pct_used >= alert_threshold_pct`; else `ok`. Overall budget `spent` includes all categories (not just budgeted ones). Category budgets include that category's subcategories.

### 8.7 Recurring

| Method & Path | Notes |
|---|---|
| `GET /recurring` | Rules with `next_due_date`, `upcoming:[next 3 dates]` |
| `POST /recurring` | Create rule (validate frequency fields) |
| `PATCH /recurring/{id}` / `DELETE /recurring/{id}` | |
| `GET /recurring/due` | Rules with `mode=remind` and `next_due_date <= today` (user tz) → drives the "Confirm payments" card on the dashboard |
| `POST /recurring/{id}/confirm` | `{amount_minor?, occurred_at?}` → creates the transaction (`source=recurring`), advances `next_due_date` |
| `POST /recurring/{id}/skip` | Advances `next_due_date` without creating a transaction |

### 8.8 Import / Export

**Import flow (3 steps):**

1. `POST /imports` (multipart `file`, CSV only, ≤ 2 MB, ≤ 5,000 rows) → `{batch_id, headers:[...], sample_rows:[first 10], suggested_mapping:{date,amount,description,payment_method,type,debit,credit}, detected: {date_format, delimiter, encoding}}`. Server auto-detects delimiter, encoding (utf-8 / utf-8-sig / latin-1), and date format (`DD/MM/YYYY`, `DD-MM-YYYY`, `YYYY-MM-DD`, `DD MMM YYYY`, `DD/MM/YY`).
2. `POST /imports/{id}/preview` body `{mapping, date_format, amount_mode: "single_signed"|"debit_credit"|"single_positive", skip_credits: true}` → `{rows:[{row_no, date, amount_minor, description, payment_method, suggested_category_id, suggested_subcategory_id, is_duplicate, duplicate_of_txn_id?, error?}], stats:{total, valid, duplicates, errors}}`.
3. `POST /imports/{id}/commit` body `{rows:[{row_no, category_id, subcategory_id?, include: bool}], skip_duplicates: true}` → `{imported, skipped, duplicates}`. Runs in a **single DB transaction**; all-or-nothing. Sets `source=csv_import`, `import_batch_id`.

`GET /imports` (history) and `DELETE /imports/{id}` (**undo**: soft-deletes every transaction from that batch).

Rules: debit-only rows are expenses; credits are skipped by default (this is an expense tracker). Amount parsing strips `₹`, `Rs`, `INR`, commas, and handles `Dr/Cr` suffixes and parentheses negatives. Rows with unparseable date/amount are flagged with `error`, never silently dropped.

**Duplicate detection:** `dedupe_hash = sha256(user_id | local_date | amount_minor | normalize(description))` where `normalize` = lowercase, collapse whitespace, strip punctuation. A row is a duplicate if its hash matches any existing non-deleted transaction **or** another row earlier in the same file with ≥ 2 identical hashes beyond the first occurrence count is *not* treated as duplicate within the file (two ₹40 teas on the same day are legit; only compare to existing DB rows and mark within-file repeats as "possible duplicate" informational).

**Export:**
- `GET /exports/transactions.csv` accepts the same filters as `GET /transactions`. Columns: `Date, Time, Amount, Category, Subcategory, Merchant, Description, Payment Method, Notes, Source`. Amount as decimal rupees (`150.00`). UTF-8 with BOM (Excel-friendly), dates in user tz as `DD/MM/YYYY`.
- `GET /exports/transactions.xlsx` same data using `openpyxl`, plus a second sheet "Category Summary" and a third "Monthly Summary". Header row bold, frozen, amount column formatted `₹#,##,##0.00`.

### 8.9 Insights

`GET /insights` → `{items:[{id, kind, severity: "info"|"warning"|"positive", title, body, data:{}, generated_for: "2026-11"}]}` max 8, ordered by severity then magnitude. Rules in §10.3. Pure Python/SQL; no LLM.

### 8.10 Push, tokens, shortcuts, health

| Method & Path | Notes |
|---|---|
| `GET /push/vapid-public-key` | |
| `POST /push/subscribe` | `{endpoint, keys:{p256dh,auth}}` upsert |
| `DELETE /push/subscribe` | `{endpoint}` |
| `POST /push/test` | Sends a test notification to the user |
| `GET/POST/DELETE /api-tokens` | Create returns the **plaintext token once** (format `sw_` + 32 url-safe random bytes); store only SHA-256 hash + last4 |
| `POST /shortcuts/transactions` | Authenticated with API token. Body: `{amount (decimal rupees, number or string "150"), category (name, case-insensitive, optional), merchant?, payment_method?, note?}`. Resolves category by name (falls back to rule suggestion, then "Others"). Returns `{id, message: "₹150 added to Food & Dining"}` — short text suited to a Shortcut notification |
| `GET /health` | `{status:"ok", db:"ok"}` |

---

## 9. Authentication Details

- Passwords: argon2id. Min length 8; reject the 1,000 most common passwords (bundle a small list).
- Access JWT claims: `sub` (user id), `exp`, `iat`, `type:"access"`. HS256 with `JWT_SECRET`.
- Frontend stores the **refresh token in `localStorage`** (PWA on iOS has no reliable cookie persistence across standalone mode) and the access token **in memory**. The API client auto-refreshes once on `401` and retries; on refresh failure it redirects to `/login`.
- Ensure iOS standalone session survives app restarts: on app start, if a refresh token exists, call `/auth/refresh` before rendering protected routes (show splash).

---

## 10. Business Logic Detail

### 10.1 Auto-categorization (`services/categorization.py`)

Order of resolution for `suggest(user, merchant_or_description)`:
1. **User rules** (`category_rules.source='user'`) — highest `priority`, then longest `pattern`, case-insensitive substring match.
2. **Learned rules** (`source='learned'`) — created/updated when a transaction is saved with a merchant: if the same normalized merchant has been saved ≥ 2 times with the same category in the last 90 days, upsert a learned rule.
3. **History**: most frequent category for the same normalized merchant in the past 180 days.
4. Otherwise `null` (UI shows no pre-selection; **never** auto-pick "Others" silently in the UI, but the CSV import and Shortcut endpoint fall back to "Others").

In the quick-add UI: typing a merchant (debounced 250 ms) calls `/categories/suggest`; if a suggestion returns and the user hasn't manually chosen a category yet, preselect it with a subtle "Suggested" tag. Manual choice always wins.

### 10.2 Budget logic (`services/budgets.py`)
- Period windows use §7 (`month_start_day`, `week_start`).
- After every transaction create/update/delete/restore/import-commit, call `check_budget_alerts(user)`. If a budget crossed `alert_threshold_pct` or 100% and no `notification_log` row exists for `(kind, dedupe_key = budget_id + period_start + level)`, send an in-app banner (returned via `GET /budgets` status) and a push notification if subscribed.
- A budget set mid-period counts spending already made in that period.

### 10.3 Insight rules (`services/insights.py`)

Each rule returns 0..1 insight. Thresholds are constants in one `INSIGHT_CONFIG` dict.

| Id | Condition | Example text |
|---|---|---|
| `top_category` | Month-to-date has ≥ 5 transactions | "Food & Dining is your biggest category this month: ₹6,200 (34%)." |
| `category_increase` | Category MTD vs same elapsed days last month: delta ≥ ₹500 **and** ≥ 15% | "Your food expenses increased by 18% compared with the same days last month." |
| `category_decrease` | Delta ≤ −₹500 and ≤ −15% | "Nice: shopping is down ₹1,200 (−24%) vs last month." |
| `avg_daily` | ≥ 3 days elapsed | "Your average daily spending is ₹450." |
| `projection` | ≥ 7 days elapsed and overall budget exists | "At this pace you'll spend ~₹21,300 this month, ₹1,300 over budget." |
| `budget_warning` | Any budget status warning/exceeded | "Shopping is at 117% of its ₹3,000 budget." |
| `weekend_spike` | Weekend daily avg ≥ 1.5× weekday avg over last 4 weeks (≥ 14 txns) | "You spend 1.8× more per day on weekends." |
| `small_spends` | Transactions < ₹100 total ≥ 10% of MTD and ≥ 15 such txns | "42 small purchases under ₹100 added up to ₹2,900." |
| `unlogged_days` | ≥ 2 of the last 7 days have zero transactions | "No expenses logged on 2 of the last 7 days. Forgot to add any?" |
| `streak` | ≥ 7 consecutive days with ≥ 1 transaction | "7-day logging streak! 🔥" |
| `largest_expense` | Always when ≥ 1 txn in month | "Your largest expense this month: ₹8,500 at Croma." |

Insights must degrade gracefully with little data (return `[]`, the UI shows "Add a few more expenses to unlock insights").

### 10.4 Recurring logic (`services/recurring.py`)
- `compute_next_due(rule, after_date)`: daily/weekly add `interval_count` units; monthly/yearly use `day_of_month` clamped to month length (31 → 28/29/30).
- Scheduler job runs **hourly**: for each active rule with `next_due_date <= today (user tz)`:
  - `auto_create` → create transaction at 09:00 user-local on the due date, `source=recurring`, advance `next_due_date`. Catch up on missed dates (max 12 per run), idempotent via `client_id = uuid5(rule.id, due_date)`.
  - `remind` → send `recurring_due` notification once per due date; the rule appears in `GET /recurring/due` until confirmed/skipped.
- Rules end when `end_date` passes (`active=false`).

### 10.5 Reminders (`services/reminders.py`)
- Scheduler runs every 15 min. For users with `reminder_enabled` whose local time passed `reminder_time` today and who have **no** `daily_reminder` log for today: if they have zero transactions today → push "Spent anything today? Add your expenses (takes 10 seconds)"; if they already logged something, **do not send** (and log as skipped).
- Never send more than 1 reminder + 2 other notifications per user per day.
- Notification click opens `/add`.

---

## 11. Frontend Specification

### 11.1 Design system
- **Look:** clean, calm, high-contrast numbers. Rounded-2xl cards, 16 px page padding, generous touch targets (**min 44×44 px**).
- **Tokens (Tailwind + CSS variables):** `--bg`, `--surface`, `--surface-2`, `--text`, `--muted`, `--primary` (indigo-600 `#4F46E5`), `--success`, `--warning`, `--danger`, plus per-category colors from the DB. Light + dark themes; `theme: system` follows `prefers-color-scheme`.
- **Typography:** system font stack (`-apple-system, SF Pro`), tabular numerals for money (`font-variant-numeric: tabular-nums`). Big amounts 32–40 px semibold.
- **Safe areas:** use `env(safe-area-inset-*)` on the tab bar and sheets. `viewport-fit=cover`.
- **Motion:** subtle (150–200 ms), respect `prefers-reduced-motion`.
- **Components to build** (`src/components`): `Button`, `IconButton`, `Card`, `Chip`, `SegmentedControl`, `Sheet` (bottom sheet w/ drag-to-dismiss), `Keypad`, `AmountDisplay`, `CategoryIcon`, `ProgressBar`, `EmptyState`, `Skeleton`, `Toast` (with Undo action), `ConfirmDialog`, `DateRangePicker`, `ListRow`, `Banner` (offline/pending sync), `Stat`.

### 11.2 App shell & navigation
- Bottom **TabBar** (5 slots): **Home**, **History**, **＋ Add** (large, centered, primary), **Analytics**, **More**. Hidden on `/add`, auth screens, and when the keyboard is open.
- Top area: page title; an **offline/pending banner** ("Offline: 2 expenses will sync when you're back online").
- Desktop (≥ 1024 px): left sidebar replaces the tab bar; content max-width 960 px centered; `/add` opens as a centered modal.

### 11.3 Routes

| Route | Screen |
|---|---|
| `/login`, `/register` | Auth |
| `/` | Dashboard |
| `/add` | Quick Add (full-screen sheet). Supports query prefill (§12) |
| `/transactions` | History with search/filters |
| `/transactions/:id` | Detail/edit |
| `/analytics` | Analytics (tabs: Overview · Categories · Trends) |
| `/budgets` | Budgets |
| `/recurring` | Recurring rules |
| `/import` | CSV import wizard (+ export buttons) |
| `/more` | Menu: Budgets, Recurring, Import/Export, Categories, Settings, Shortcuts, Logout |
| `/settings` | Profile, timezone, week/month start, theme, reminders, password, delete account |
| `/settings/categories` | Manage categories/subcategories/rules |
| `/settings/shortcuts` | API tokens + guided setup (§12) |

All except auth are protected by a route guard.

### 11.4 Screen specs

**Dashboard (`/`)**: top-to-bottom:
1. Greeting + month label + (optional) month nav arrows.
2. **Hero card:** "Monthly expenses" big `₹18,450`; sub-row with overall-budget `ProgressBar` ("72% used · ₹5,600 left") if a budget exists, else a "Set a monthly budget" CTA.
3. **Stat row (2 cards):** Today `₹530` · This week `₹3,250`. (Tap → History filtered.)
4. **Due recurring card** (only if `/recurring/due` non-empty): each item with **Confirm** / **Skip**.
5. **Where is the money going?** Donut chart (Recharts `PieChart`, inner radius) with a legend list below: icon, name, ₹, %, tap row → History filtered by category. Top 5 + "Others" grouped slice if > 6.
6. **Daily spending trend:** Recharts `AreaChart`/`BarChart`, current month days, today highlighted, tooltip with ₹ and date.
7. **Insights carousel:** horizontally scrollable cards from `/insights` (max 3 shown + "See all").
8. **Recent transactions:** last 5 with "View all".
Empty state (no transactions): illustration + "Add your first expense" button (no fake sample data in the live UI).
Pull-to-refresh invalidates queries.

**Quick Add (`/add`)**: the most important screen. Target: Save in ≤ 3 taps for a frequent category.
- Layout (top → bottom, fits one 844 px screen **without scrolling**):
  1. Header: ✕ close · "Add expense" · date chip (default "Today, 2:30 PM"; tap → date/time picker sheet).
  2. **AmountDisplay:** `₹` + big number, blinking caret, auto-focus (no system keyboard; custom keypad).
  3. **Category chips (one row, horizontally scrollable):** top 5 by `usage_count_30d` (falling back to default order) + "More" chip that opens a category picker sheet (grid with icons, search, and subcategory step). Selected chip highlighted.
  4. **Subcategory chips** appear (animated) after choosing a category that has subcategories; optional, never blocking.
  5. **Payment method segmented control:** UPI · Cash · Card · Bank · defaults to `user.default_payment_method`, then remembers last used.
  6. Collapsible **"+ Details"** row: Merchant (autocomplete from recent merchants), Description, Notes.
  7. **Custom numeric Keypad** (3×4: 1–9, `.`, 0, ⌫). Long-press ⌫ clears.
  8. **Save button** (full width, disabled until amount > 0 and category chosen). Label: `Save ₹150`.
- Behaviors:
  - On save: optimistic insert → close → Toast "₹150 added to Food & Dining · **Undo**" (Undo calls `DELETE`, or removes from the offline queue if unsent).
  - **"Save & add another"** via long-press of Save or a secondary link (keeps payment method, clears amount/category).
  - Offline → write to the IndexedDB queue (§11.6), show "Saved offline" toast.
  - Validates amount ≤ max, 2 decimals, `occurred_at` not in the future.
  - Prefill from query string (§12), then focus the first missing required field.
  - Haptics via `navigator.vibrate` where supported (ignore on iOS).

**History (`/transactions`)**: sticky search bar + filter button (badge with active filter count). Filter sheet: date range (presets: Today, Yesterday, This week, This month, Last month, Custom), categories (multi), payment methods (multi), amount range, sort. List grouped by **day** with a day total in the header ("Mon, 2 Nov · ₹530"). Row: category icon, merchant/description (fallback to category name), payment-method tag, amount right-aligned. Swipe-left → Delete (with Undo toast); tap → detail/edit sheet. Footer: "N transactions · ₹X total" (from `totals`). Infinite scroll via cursor. Multi-select mode via long-press → bulk delete. Active filters shown as removable chips. URL query params mirror filters (shareable/back-button safe).

**Analytics (`/analytics`)**: period selector (Week · Month · Last month · Custom) controls all tabs.
- *Overview:* totals, average per day, highest-spend day, count, projected month-end, compare-to-previous delta badges, payment-method breakdown (donut), top merchants (bar list).
- *Categories:* donut + ranked list; tap a category → expands subcategory split and a mini trend; "View transactions" link.
- *Trends:* bar chart per day (week/month) or per month (last 12 months); calendar heatmap of daily spend; compare-to-previous-period grouped bars by category.
- Insights list (all) at the bottom.
- Charts: Recharts, `ResponsiveContainer`, accessible (aria-label + data table fallback via a "Show as table" toggle). Use category colors from DB. Y-axis ticks compact (`₹5k`, `₹1.2L`).

**Budgets (`/budgets`)**: Overall monthly budget card (editable amount, big progress ring/bar, spent/remaining/safe-daily). Category budgets list with progress bars colored by status (ok = category color, warning = amber, exceeded = red). "Add category budget" sheet (pick category, amount, threshold slider 50–100%). Warning banner on dashboard when any budget is `warning|exceeded`.

**Recurring (`/recurring`)**: list of rules (name, amount, schedule text "Monthly on the 5th", next due), mode badge (Auto-add / Remind me), active toggle. Add/Edit sheet with all fields. Presets: Rent, Electricity, Internet, Mobile, Subscription (Netflix etc.), EMI.

**Import/Export (`/import`)**: Wizard — (1) Choose CSV (drag-drop on desktop, file picker on iOS) → (2) Column mapping with live sample preview, date-format select, amount mode → (3) Review table: row checkbox, date, description, amount, category select (prefilled by suggestion), duplicate badge (auto-unchecked), error rows highlighted → (4) Commit summary + **Undo import** button. Import history list below. Export card: date range + "Download CSV" / "Download Excel". On iOS, downloads use a Blob + `<a download>`; fall back to opening in a new tab.

**Settings**: grouped lists; timezone `<select>` (IANA list, default detected `Intl.DateTimeFormat().resolvedOptions().timeZone`), week start, month start day, theme, default payment method, reminders (toggle, time, "Enable notifications" flow per §11.7), change password, delete account (type-to-confirm), app version.

**Categories management**: tree list with drag-reorder (or up/down buttons), add/edit/archive, icon + color pickers, "Auto-categorization rules" sub-list (pattern → category) with add/delete.

### 11.5 State & data fetching
- `lib/api.ts`: typed `fetch` wrapper (base URL from `VITE_API_URL`), auth header injection, refresh-and-retry, error envelope parsing into `ApiError`.
- React Query keys: `['transactions', filters]`, `['categories']`, `['summary']`, `['analytics', kind, params]`, `['budgets']`, `['insights']`, `['recurring']`. Any mutation invalidates `summary`, `analytics`, `budgets`, `insights`, `transactions`.
- `staleTime`: categories 5 min; summary/analytics 30 s; transactions 15 s. `refetchOnWindowFocus: true` (important for PWA resume).
- Persist the React Query cache (`@tanstack/react-query-persist-client` + IndexedDB) so the dashboard renders instantly and offline from last-known data (show "Last updated …" when offline).

### 11.6 Offline support (required)
- **Offline queue (`lib/offlineQueue.ts`)** in IndexedDB store `pending_transactions`: each item `{client_id, payload, created_at, attempts, last_error}`.
- `useCreateTransaction` generates `client_id = crypto.randomUUID()`. If `navigator.onLine === false` **or** the request fails with a network error → enqueue; otherwise send directly.
- **Sync triggers:** `online` event, app `visibilitychange → visible`, app start, and Background Sync (`sync` event) where supported (Safari does not support it, so the first three are mandatory). Replay sequentially; on `2xx` remove; on `422` mark `failed` and surface in a "Needs attention" list; on network error stop and retry later (exponential backoff).
- Pending items are **merged into the History/Dashboard UI optimistically** with a small "clock" badge; totals include them (clearly flagged as "pending").
- Cached reference data for offline: categories, recent merchants, user profile.
- Edits/deletes while offline: show a message "Connect to the internet to edit existing expenses" (v1 limitation; **only creates are supported offline**).

### 11.7 PWA configuration (iPhone-first)

`index.html` must include:
```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="SpendWise" />
<meta name="theme-color" content="#4F46E5" media="(prefers-color-scheme: light)" />
<meta name="theme-color" content="#0B0B12" media="(prefers-color-scheme: dark)" />
<link rel="apple-touch-icon" href="/icons/apple-touch-icon-180.png" />
<link rel="manifest" href="/manifest.webmanifest" />
```
- `manifest.webmanifest`: `name: "SpendWise"`, `short_name: "SpendWise"`, `start_url: "/?source=pwa"`, `scope: "/"`, `display: "standalone"`, `orientation: "portrait"`, `background_color`, `theme_color`, icons 192/512 + maskable 512, `shortcuts: [{name:"Add expense", url:"/add"}]`.
- Service worker (`src/sw.ts`, Workbox `injectManifest`): precache app shell; `NavigationRoute` → `index.html` (SPA fallback, deny-list `/api`); runtime cache for `GET /api/v1/categories`, `/users/me` (StaleWhileRevalidate); **never cache** auth endpoints or mutations; handle `push` and `notificationclick` (focus/open `/add` or `/`). Auto-update with an in-app "New version available · Reload" toast.
- **Install guidance:** if `navigator.standalone !== true` and the UA is iOS Safari, show a dismissible one-time banner: "Install SpendWise: tap **Share** → **Add to Home Screen**" with a small illustration. (iOS has no `beforeinstallprompt`.) On Android/desktop Chrome, capture `beforeinstallprompt` and show an Install button in Settings.
- **Push on iOS:** works only for the Home-Screen-installed app on iOS/iPadOS 16.4+, and the permission request **must be triggered by a user tap** (button in Settings/onboarding). If not installed, show "Install the app first to enable reminders". Fallback when push is unavailable: in-app reminder banner on next open.
- Prevent iOS zoom on inputs (`font-size ≥ 16px`), disable rubber-band overscroll on fixed layouts (`overscroll-behavior: none`), and use `100dvh` for full-height screens.

---

## 12. iPhone Shortcuts Integration

Goal: reduce manual steps without pretending to read Google Pay. Two supported modes, documented in `docs/SHORTCUTS.md` and in-app at `/settings/shortcuts`.

**Mode A: Open Quick Add (no token needed, works for everyone).**
A personal automation in the Shortcuts app: *Trigger:* "App → Is Closed → Google Pay" (also PhonePe/Paytm); *Action:* "Open URL" → `https://<your-domain>/add?source=shortcut`. The user lands on Quick Add; the amount keypad is focused. (Marked "requires iOS automation testing" in product docs; iOS may ask for confirmation before running unless "Ask Before Running" is disabled.)

**Prefill via URL:** `/add?amount=150&category=Food%20%26%20Dining&merchant=Cafe&pm=upi&source=shortcut`. The frontend validates every param (amount numeric & in range; category matched by name case-insensitively; pm in enum) and ignores invalid ones.

**Mode B: Direct add via API (token).**
Shortcut actions: *Ask for Input (Number) "Amount"* → *Choose from Menu (Food / Transport / Shopping / Other)* → *Get Contents of URL* `POST https://<api>/api/v1/shortcuts/transactions` with header `Authorization: Bearer sw_...` and JSON `{"amount":"<Amount>","category":"<Choice>"}` → *Show Notification* with `message` from the response.

`/settings/shortcuts` page: create/revoke tokens (shown once with a copy button), step-by-step instructions with copy-able URL/JSON snippets, a "Test token" button, and a security note (tokens only allow creating transactions).

---

## 13. Non-Functional Requirements

| Area | Requirement |
|---|---|
| Performance | Dashboard first contentful paint < 1.5 s on mid-range phone with 4G (cached shell < 0.5 s). Quick Add interactive < 300 ms from tap. All analytics endpoints p95 < 300 ms for 50k transactions per user (verify with the seed script `--count 50000`) |
| Bundle size | Initial JS ≤ 250 KB gzip; lazy-load Analytics, Import, Settings routes and Recharts |
| Accessibility | WCAG AA contrast, labels on all inputs, focus rings, `aria-live` for toasts, charts have text alternatives |
| Security | Parameterized queries only (ORM), per-user row scoping in every query (unit-test this), CORS locked, security headers (`X-Content-Type-Options`, `Referrer-Policy`), refresh token rotation, hashed API tokens, upload size/type limits, CSV formula-injection guard on **export** (prefix cells starting with `= + - @` with `'`) |
| Privacy | No third-party analytics or trackers. User can export all data and delete account (hard delete) |
| Reliability | Idempotent creates, DB transactions for imports, migrations via Alembic only, `/health` endpoint |
| Logging | Structured JSON logs, request id, never log passwords/tokens/amounts-with-PII |
| i18n | English only; formatting through `Intl` with `en-IN`. Keep strings in a single `strings.ts` for future translation |

---

## 14. Configuration

`.env.example` (backend & compose):
```
DATABASE_URL=postgresql+asyncpg://spendwise:spendwise@db:5432/spendwise
JWT_SECRET=change-me-to-a-long-random-string
ACCESS_TOKEN_MINUTES=15
REFRESH_TOKEN_DAYS=30
FRONTEND_ORIGIN=http://localhost:5173
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:you@example.com
ENV=development
```
Frontend `.env`: `VITE_API_URL=http://localhost:8000/api/v1`, `VITE_VAPID_PUBLIC_KEY=`.

Provide `make vapid` that generates a VAPID keypair and prints it. HTTPS is **required** for service workers/push outside `localhost`. For testing on a real iPhone, document using a tunnel (e.g. Cloudflare Tunnel/ngrok) or deploying to a staging host in `README.md`.

---

## 15. Dev Environment & Commands

`docker-compose.yml` services: `db` (postgres:16, volume, healthcheck), `api` (uvicorn `--reload`, depends on db healthy, runs `alembic upgrade head` on start), `web` (vite dev server, `--host`). 

`Makefile` targets:
```
make up            # docker compose up --build
make down
make migrate       # alembic upgrade head
make revision m="msg"   # alembic revision --autogenerate
make seed-demo     # create demo user demo@spendwise.app / demo1234 with ~3 months of realistic INR data
make test          # backend + frontend unit tests
make e2e           # playwright
make lint          # ruff, mypy, eslint, tsc --noEmit
make vapid         # generate VAPID keys
```
`seed.demo_data` generates realistic Indian-context data: auto/cab ₹60–250, lunch ₹120–300, tea ₹20–60, groceries ₹200–2,500, bills monthly, rent, a few large shopping items; ~3–6 transactions/day on weekdays, a few days with none; with a default overall budget (₹20,000) and category budgets. **Demo data exists only via this script, never in the live UI.**

---

## 16. Testing Requirements

**Backend (pytest)** — minimum coverage 80% on `services/`:
- `time.py`: week/month boundaries incl. `month_start_day ≠ 1`, DST-free IST and one DST timezone, leap years, 31-day clamp for recurring.
- Money: no float usage (grep test); CSV amount parsing table-test (`"₹1,250.50"`, `"1250.5 Dr"`, `"(250)"`, `"Rs. 40"`).
- Transactions: create / idempotent replay / validation (subcategory parent mismatch, future date, zero amount) / soft delete + restore / filters / totals / cursor pagination stability with identical timestamps.
- **User isolation:** user A can never read/modify user B's transactions, categories, budgets, tokens (parametrized across every endpoint).
- Analytics: sums equal raw SUM; zero-fill trend; by-category percentages sum to ~100; compare same-elapsed-days logic.
- Budgets: status transitions, mid-period creation, notification dedupe.
- Import: delimiter/encoding/date-format detection, duplicate detection, atomic commit rollback on failure, undo.
- Recurring: next-due math, catch-up idempotency, confirm/skip.
- Insights: each rule with boundary data (just below/above threshold) and empty-data case.
- Auth: refresh rotation and reuse detection, API token scope.

**Frontend (vitest/RTL):** `money.ts` (parse/format), Keypad input rules (max 2 decimals, leading zeros, backspace), Quick Add validation and prefill parsing, offline queue (enqueue → replay → dedupe), filter ⇄ URL sync.

**E2E (Playwright, iPhone 14 viewport):** register → add expense via keypad → appears on dashboard with correct totals → edit → delete + undo → set budget and see warning → import sample CSV → export CSV → go offline, add expense, go online, verify sync exactly once.

---

## 17. Acceptance Criteria (global "Definition of Done")

1. `make up` from a clean checkout yields a working app at `http://localhost:5173` with API docs at `http://localhost:8000/docs`.
2. A new user can register, add an expense in **≤ 3 taps after the keypad entry** (amount → category chip → Save), and see Today/Week/Month totals update immediately.
3. Dashboard numbers always equal the sum of listed transactions for the same range (verified by test).
4. App is installable on iOS Safari (Add to Home Screen), launches standalone with correct icon/status bar, and Quick Add works offline with later sync and **no duplicates**.
5. CSV import of a bank-style sample (provide `backend/tests/fixtures/sample_bank.csv` and `sample_gpay.csv`) maps, previews, flags duplicates, commits, and can be undone.
6. Budgets show correct status and emit warnings at threshold and 100%.
7. All linters, type-checkers, and tests pass (`make lint && make test`).
8. No console errors in normal flows; Lighthouse PWA/Accessibility ≥ 90 on `/`.
9. README documents setup, iPhone testing over HTTPS, env vars, and the Shortcuts guide.

---

## 18. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Entry friction → users quit | Custom keypad, frequent-category chips, no required subcategory, Shortcut opening `/add`, daily reminder only when nothing was logged |
| iOS PWA storage eviction / session loss | Refresh-token in `localStorage` + silent refresh on launch; server is the source of truth; export available |
| iOS push limitations | Require installed PWA + user gesture; in-app reminder fallback |
| Bank CSV format variety | Column mapping UI, auto-detection, per-row errors instead of silent drops, undo |
| Timezone bugs in analytics | Single `time.py` module, boundary tests, all grouping in SQL with user tz |
| Float money errors | Integer paise only; grep-test forbids `float` in money paths |

---

## 19. Build Plan (execute in this order; run tests after each milestone)

**M0: Scaffolding.** Repo layout (§5), docker-compose, Makefile, `.env.example`, FastAPI app with `/health`, Alembic init, Vite + Tailwind + TS strict, ESLint/Prettier/Ruff/mypy configs, CI-ready scripts.
*Accept:* `make up` serves both apps; `/health` returns ok.

**M1: Database & auth.** All migrations from §6 (including Phase 3/4 tables), extensions (`citext`, `pg_trgm`), seed default categories/rules on registration, auth endpoints (§8.2, §9), frontend login/register, API client with refresh, route guard, AppShell + TabBar.
*Accept:* register/login/logout/refresh-rotation tests pass; protected route redirect works.

**M2: Categories & transactions.** `time.py`, money utils, categories API, transactions API (§8.3–8.4) incl. idempotency, search, filters, totals, soft delete/restore, auto-categorization suggest. Frontend: **Quick Add** (keypad, chips, payment control, details, undo toast), **History** (filters, grouping, swipe delete, edit sheet).
*Accept:* user-isolation + transaction tests pass; Quick Add meets the ≤ 3-tap criterion; History totals correct.

**M3: Analytics & dashboard.** Analytics endpoints (§8.5), dashboard UI with donut + trend charts, Analytics screen (3 tabs), compare & heatmap, empty states, skeletons, pull-to-refresh.
*Accept:* analytics tests pass; sums reconcile with raw data on a 50k-row seed within perf targets.

**M4: Budgets & insights.** Budgets API/UI (§8.6, §10.2), alert state, insights engine/UI (§10.3).
*Accept:* budget state transition tests, insight boundary tests pass.

**M5: PWA & offline.** Manifest, icons, service worker, install banner, offline queue + sync + pending UI (§11.6–11.7), update toast, persisted query cache.
*Accept:* Playwright offline scenario passes; Lighthouse PWA checks pass; manual iPhone install checklist in README.

**M6: Import/Export & recurring.** CSV import wizard + backend (§8.8), XLSX/CSV export, recurring rules + scheduler (§8.7, §10.4), due-card on dashboard.
*Accept:* import fixtures tests, atomic rollback, undo; recurring catch-up idempotency tests.

**M7: Notifications & Shortcuts.** Push subscribe/test/send, reminders + budget notifications (§10.5), API tokens, `/shortcuts/transactions`, `/settings/shortcuts` page and `docs/SHORTCUTS.md` (§12), query prefill on `/add`.
*Accept:* notification dedupe tests, shortcut endpoint tests, prefill parser tests.

**M8: Polish & hardening.** Dark mode, accessibility pass, bundle splitting, error boundaries, rate limiting, security headers, empty/error states everywhere, settings screens, account deletion, final README, demo seed, full E2E suite.
*Accept:* all items in §17 satisfied.

### Execution rules for the agent
- Build **vertically** (backend + frontend per feature), commit per milestone with a clear message.
- Never leave placeholder/TODO UI visible; unfinished Phase 3/4 features must not appear in navigation.
- Add every non-trivial choice to `docs/DECISIONS.md`.
- If a requirement here conflicts with an iOS/PWA platform limit, follow the limit, show honest UI copy, and note it in `DECISIONS.md`.
- Finish with a verification pass: run `make lint && make test && make e2e`, then walk the §17 checklist and report any gaps.

---

## 20. Future Roadmap (not v1; keep the schema ready)

- **Phase 3 (intelligence):** spending predictions (linear/seasonal on daily totals), anomaly detection (z-score / IQR per category), subscription detection (same merchant ± amount at ~monthly cadence), savings goals, budget recommendations (median of last 3 months + 10%), natural-language Q&A over the user's own data (LLM generates a **structured query**; answers are computed from stored transactions and cited, never invented).
- **Phase 4 (automation):** more Shortcut recipes (share-sheet text parsing of UPI SMS/receipts), supported financial data integrations (e.g. Account Aggregator) with consent flows, improved ML categorization, multi-account/wallet balances, optional family/shared mode.
