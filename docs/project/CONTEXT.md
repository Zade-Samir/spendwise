# SpendWise — Project Context & Current State Snapshot

> **AI AGENT CONTEXT HANDOFF:**  
> This file is a continuously updated executive snapshot of project state.  
> Read this file first when resuming work on this repository to immediately understand current progress, active blockers, and the next recommended task without having to re-read conversation history.

---

## 1. Project Purpose & Summary

**SpendWise** is a mobile-first personal expense tracking and financial intelligence Progressive Web Application (PWA) tailored for individuals in India. It enables rapid transaction entry (5–10 seconds, ≤ 3 taps) for frequent digital UPI and cash payments, enforces strict integer paise financial arithmetic (`BIGINT` paise), operates seamlessly offline via IndexedDB, and delivers instant spending analytics and budgets without external LLM dependencies in v1.

---

## 2. Current Project Status

- **Development Stage:** **Milestone M8 Complete — Production Release v1.1.0**
- **Active Codebase Implementation:** **Milestones M0 through M8 100% Complete & 10/10 UI/UX Certified**
- **Current Milestone:** **Release Complete (v1.1.0)**
- **Active Blockers:** **None**.

---

## 3. Milestones Status Summary

| Milestone | Title | Status | Notes |
|---|---|---|---|
| **M0** | Scaffolding & Tooling Baseline | `[x] Completed` | Repo layout, Docker Compose, Makefile, FastAPI health check, Vite setup, lint/tests pass. |
| **M1** | Database Schema & Authentication | `[x] Completed` | PostgreSQL 16 schema, Alembic migration, Argon2id, JWT rotation, seed categories, LoginPage, RegisterPage, AuthGuard. |
| **M2** | Categories & Transactions | `[x] Completed` | Custom numeric keypad, Quick Add, History, soft-delete with Undo toast, trigram fuzzy search, integer paise formatting, 22 backend / 20 frontend tests pass. |
| **M3** | Visual Analytics & Dashboard | `[x] Completed` | Recharts Donut & Trend charts, executive dashboard, 7 analytics endpoints with zero-fill and same-elapsed-days comparison, 27 backend / 24 frontend tests pass. |
| **M4** | Budgets & Spending Insights | `[x] Completed` | Overall & category budgets, safe daily spend calculation, alert thresholds, 11-rule statistical insight engine, BudgetsPage, InsightsCarousel, 34 backend / 28 frontend tests pass. |
| **M5** | PWA Capabilities & Offline Sync | `[x] Completed` | Standalone PWA, Workbox caching, IndexedDB queue, idempotent replay, offline banners, 34 backend / 33 frontend tests pass. |
| **M6** | Statement Import/Export & Recurring| `[x] Completed` | CSV import wizard (HDFC/SBI/ICICI dialect sniff, dedup hash), Excel 3-sheet export, formula injection defense, APScheduler recurring rules, DueRecurringCard on Dashboard. 46 backend tests pass. |
| **M7** | Web Push & iOS Shortcuts | `[x] Completed` | VAPID Web Push, 15-min daily reminder scheduler, deduplication log, personal API tokens (`sw_*`), headless `POST /shortcuts/transactions`, Mode B URL prefill on `/add`, Settings and Shortcuts UI. 57 backend / 35 frontend tests pass. |
| **M8** | Polish, Accessibility & Hardening | `[x] Completed` | Dark/Light/Auto theme manager, safe area utilities, touch target audit (>=44px), code-split routes, initial bundle <= 250 KB (144 KB gzip), sliding-window rate limiting, security headers, logging sanitizer, 3-month demo seed (demo@spendwise.app / demo1234), Playwright mobile E2E suite. 61 backend / 35 frontend tests pass. |

---

## 4. Key Settled Architectural Decisions

- **Currency Unit:** Stored strictly as 64-bit integer paise (`amount_minor BIGINT NOT NULL CHECK (amount_minor > 0)`). Floating-point math is strictly forbidden.
- **Frontend Stack:** React 18, TypeScript (strict), Vite 5, Tailwind CSS 3, TanStack React Query v5, Recharts, `idb`, `vite-plugin-pwa`.
- **Backend Stack:** Python 3.12/3.13, FastAPI, SQLAlchemy 2.0 (async), Alembic, PostgreSQL 16 (`asyncpg`), Pydantic v2, APScheduler, `pywebpush`.
- **Client Deployment:** Progressive Web Application (PWA) with iOS Safari "Add to Home Screen" target and Web Push (VAPID).
- **Security:** Multi-tenant user isolation enforced on every query (`WHERE user_id = :current_user_id`). Refresh token rotation with automatic token-theft revocation. Personal API tokens SHA-256 hashed and scoped to `transactions:create`. Hardened HTTP headers and sliding-window rate limiting. Sensitive logging filter.
- **Platform Reality:** An iOS PWA cannot independently read Google Pay or UPI transactions. All transactions require explicit user confirmation via Quick Add, CSV import, or iOS Shortcuts.

---

## 5. Next Recommended Task for Autonomous Agent

SpendWise v1.0.0 is fully implemented and tested. Future maintenance and roadmap phases:
1. **Phase 3 Intelligence:** Spending forecasting, automated subscription detection, and spending anomaly alerts.
2. **Phase 4 Automation:** Additional iOS Shortcut recipes (SMS clipboard parser) and bank Account Aggregator consent flows.
