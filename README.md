# SpendWise

> **Mobile-first personal expense tracking and financial intelligence Progressive Web Application (PWA).**  
> *Spend less time recording expenses and more time understanding your money.*

---

## 1. Introduction

**SpendWise** is built specifically for individuals in India who make multiple digital micropayments daily (UPI via Google Pay, PhonePe, Paytm, cards, and cash) and struggle to maintain accurate spending records. 

Unlike traditional spreadsheets or heavy personal finance apps that suffer from high abandonment rates, SpendWise delivers an ultra-fast logging experience (**5–10 seconds, ≤ 3 taps after amount entry**), strict integer paise arithmetic (zero floating-point errors), offline resilience, and immediate visual spending analytics.

### Key Capabilities
- **Frictionless Quick Add:** Embedded custom 3×4 numeric keypad and rolling 30-day top-5 frequent category chips.
- **Financial Precision:** All money stored and calculated in integer paise (`BIGINT` / `amount_minor`).
- **Visual Analytics:** Interactive Recharts category donut charts, daily spending trend graphs, and calendar heatmaps.
- **Budget Tracking:** Overall monthly budget and category budgets with proactive 80% and 100% threshold alerts.
- **Recurring Expenses:** Automated scheduling for rent, utility bills, and subscriptions with day-clamping math.
- **Statement Import & Export:** 3-step CSV bank statement import wizard with duplicate detection and multi-sheet Excel export.
- **Offline Reliability:** Full offline transaction creation via IndexedDB (`idb`) queue and automatic idempotent background sync.
- **iOS Shortcuts Integration:** Open pre-filled Quick Add screens or log expenses headlessly via personal API tokens.
- **Deterministic Insights:** 11 rule-based financial heuristics with zero external LLM dependencies in v1.

---

## 2. Pinned Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, TypeScript (strict), Vite 5, Tailwind CSS 3, TanStack React Query v5, Recharts, `idb`, `date-fns` |
| **Backend** | Python 3.12, FastAPI, SQLAlchemy 2.0 (async), Alembic, Pydantic v2, APScheduler, `pywebpush` |
| **Database** | PostgreSQL 16 (extensions: `citext`, `pg_trgm`) |
| **Testing** | `pytest`, `pytest-asyncio`, `httpx`, `testcontainers`, `vitest`, React Testing Library, `playwright` |
| **Code Quality** | `ruff`, `mypy --strict`, `eslint`, `prettier` |
| **Infra & DevOps**| Docker, Docker Compose, GNU Make, Caddy / Nginx |

---

## 3. Documentation Sitemap

Every architectural, technical, design, and product decision is fully documented:

- **AI Agent Operating Manual:** [`AGENTS.md`](./AGENTS.md) *(Read this first before writing code)*
- **Product Definition:** [`PROJECT.md`](./PROJECT.md)
- **Product Requirements Document:** [`PRD.md`](./PRD.md)
- **Development Roadmap & Tasks:** [`TASKS.md`](./TASKS.md)
- **Master Consolidated Specification:** [`SPENDWISE_SPEC.md`](./SPENDWISE_SPEC.md)
- **Architecture & Design:**
  - Architecture Specification: [`docs/architecture/ARCHITECTURE.md`](./docs/architecture/ARCHITECTURE.md)
  - Detailed System Design & Sequence Models: [`docs/architecture/SYSTEM_DESIGN.md`](./docs/architecture/SYSTEM_DESIGN.md)
  - Architectural Decision Records: [`docs/architecture/DECISIONS.md`](./docs/architecture/DECISIONS.md)
- **Technical Specifications:**
  - Technology Stack Inventory: [`docs/technical/TECH_STACK.md`](./docs/technical/TECH_STACK.md)
  - Relational Database & DDL: [`docs/technical/DATABASE.md`](./docs/technical/DATABASE.md)
  - REST API Specification: [`docs/technical/API_SPEC.md`](./docs/technical/API_SPEC.md)
  - Security & Privacy Architecture: [`docs/technical/SECURITY.md`](./docs/technical/SECURITY.md)
  - Error Handling & Exceptions: [`docs/technical/ERROR_HANDLING.md`](./docs/technical/ERROR_HANDLING.md)
  - Environment Variables Reference: [`docs/technical/ENVIRONMENT.md`](./docs/technical/ENVIRONMENT.md)
  - External Integrations: [`docs/technical/INTEGRATIONS.md`](./docs/technical/INTEGRATIONS.md)
- **Development & UI/UX:**
  - Engineering Standards: [`docs/development/CODING_STANDARDS.md`](./docs/development/CODING_STANDARDS.md)
  - QA & Testing Strategy: [`docs/development/TESTING.md`](./docs/development/TESTING.md)
  - Deployment & Infrastructure: [`docs/development/DEPLOYMENT.md`](./docs/development/DEPLOYMENT.md)
  - Mobile UI/UX Design System: [`docs/design/UI_UX_SPEC.md`](./docs/design/UI_UX_SPEC.md)
- **Feature Specifications:**
  - Expense Management: [`docs/features/EXPENSE_MANAGEMENT.md`](./docs/features/EXPENSE_MANAGEMENT.md)
  - Spending Analytics: [`docs/features/ANALYTICS.md`](./docs/features/ANALYTICS.md)
  - Budget Management: [`docs/features/BUDGETS.md`](./docs/features/BUDGETS.md)
  - Recurring Expenses: [`docs/features/RECURRING_EXPENSES.md`](./docs/features/RECURRING_EXPENSES.md)
  - Statement Import & Export: [`docs/features/IMPORT_EXPORT.md`](./docs/features/IMPORT_EXPORT.md)
  - Offline PWA Runtime: [`docs/features/OFFLINE_PWA.md`](./docs/features/OFFLINE_PWA.md)
  - Web Push & Reminders: [`docs/features/NOTIFICATIONS.md`](./docs/features/NOTIFICATIONS.md)
  - iOS Shortcuts Integration: [`docs/features/IOS_SHORTCUTS.md`](./docs/features/IOS_SHORTCUTS.md)
  - iOS Shortcuts Setup Guide: [`docs/SHORTCUTS.md`](./docs/SHORTCUTS.md)
- **Project Tracking:**
  - Project State Snapshot: [`docs/project/CONTEXT.md`](./docs/project/CONTEXT.md)
  - Known Constraints & Debt: [`docs/project/KNOWN_ISSUES.md`](./docs/project/KNOWN_ISSUES.md)
  - Open Questions & Ambiguities: [`docs/project/OPEN_QUESTIONS.md`](./docs/project/OPEN_QUESTIONS.md)
  - Documentation Audit: [`docs/DOCUMENTATION_AUDIT.md`](./docs/DOCUMENTATION_AUDIT.md)

---

## 4. Local Quickstart (Docker Compose)

### 4.1 Prerequisites
- Docker Engine 24+ and Docker Compose v2.20+
- GNU Make

### 4.2 Initial Setup & Startup
```bash
# 1. Clone the repository
git clone https://github.com/your-org/spendwise.git
cd spendwise

# 2. Initialize environment configuration
cp .env.example .env

# 3. Generate VAPID keypair for Web Push
make vapid

# 4. Build and launch all services (db, api, web)
make up
```

Once running:
- **PWA Frontend:** [http://localhost:5173](http://localhost:5173)
- **FastAPI Backend Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **API Health Check:** [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)

### 4.3 Database Migrations & Demo Seeding
```bash
# Run latest database migrations
make migrate

# Seed a demo account with 3 months of realistic Indian INR transactions
make seed-demo
# Demo credentials: demo@spendwise.app / demo1234
```

---

## 5. Development & Testing Commands

```bash
# Run backend (pytest) and frontend (vitest) test suites
make test

# Run mobile viewport E2E tests (Playwright)
make e2e

# Run all linters and type-checkers (ruff, mypy --strict, eslint, tsc)
make lint

# Stream Docker container logs
make logs

# Stop all containers
make down
```

---

## 6. Testing on iPhone Hardware (PWA & Web Push)

Because Service Workers and iOS Web Push require **HTTPS**:
1. Run a quick Cloudflare Tunnel:
   ```bash
   cloudflared tunnel --url http://localhost:5173
   ```
2. Open the generated HTTPS URL in **Safari on your iPhone**.
3. Tap the **Share** button → Tap **Add to Home Screen**.
4. Launch SpendWise from your Home Screen in standalone native mode.
5. In Settings, tap **Enable Reminders** to test native iOS Web Push notifications.

---

## 7. License & Data Ownership

SpendWise is open-source software. All personal financial records belong 100% to the individual user. SpendWise contains zero third-party behavioral trackers or advertisements.
