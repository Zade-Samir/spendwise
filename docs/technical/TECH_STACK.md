# SpendWise — Technology Stack Specification

This document provides a comprehensive inventory of all technologies, runtimes, frameworks, and libraries utilized within the SpendWise project. Every technology choice is settled and pinned. Substitutions are strictly prohibited without an approved Architecture Decision Record (ADR).

---

## 1. Frontend Technologies

### 1.1 Core Platform & Framework
- **React**
  - **Version:** `18.3.1`
  - **Responsibility:** Declarative component-based user interface rendering, virtual DOM management, state coordination.
  - **Why Selected:** Mature ecosystem, robust concurrent rendering capabilities, universal developer familiarity.
  - **Where Used:** `frontend/src/` (Entire client application).
  - **Key Dependencies:** `react-dom`.
  - **Configuration:** Initialized via Vite template with Strict Mode enabled (`<React.StrictMode>`).

- **TypeScript**
  - **Version:** `5.4.5`
  - **Responsibility:** Static type checking, compile-time safety, strict contract enforcement.
  - **Why Selected:** Eliminates runtime type errors, guarantees API payload consistency, enables precise interface contracts for monetary units.
  - **Where Used:** `frontend/src/**/*.ts`, `frontend/src/**/*.tsx`.
  - **Configuration:** `tsconfig.json` with `"strict": true`, `"noUncheckedIndexedAccess": true`, `"noImplicitAny": true`.

- **Vite**
  - **Version:** `5.2.11`
  - **Responsibility:** Fast development server (ESM-based HMR), production asset bundler (Rollup).
  - **Why Selected:** Near-instantaneous server startup (<300 ms), optimized ES module bundling, first-class PWA plugin support.
  - **Where Used:** `frontend/vite.config.ts`.
  - **Configuration:** Configured with `@vitejs/plugin-react` and `vite-plugin-pwa`.

### 1.2 Styling & User Interface
- **Tailwind CSS**
  - **Version:** `3.4.3`
  - **Responsibility:** Utility-first responsive design, mobile layout management, design system tokenization.
  - **Why Selected:** Fast styling without stylesheet bloat, effortless dark mode support, seamless responsive breakpoint handling.
  - **Where Used:** `frontend/tailwind.config.ts`, `frontend/src/index.css`.
  - **Configuration:** `darkMode: 'class'`, semantic CSS variable tokens (`--bg`, `--surface`, `--primary`), custom 390px mobile viewport defaults.

- **Lucide React**
  - **Version:** `0.378.0`
  - **Responsibility:** Clean, lightweight SVG iconography across category chips, navigation tab bar, and action buttons.
  - **Why Selected:** Consistent icon grid (24×24), minimal bundle overhead, tree-shakeable.
  - **Where Used:** Category picker, tab bar, transaction list rows, toast alerts.

### 1.3 Routing & Navigation
- **React Router DOM**
  - **Version:** `6.23.1`
  - **Responsibility:** Client-side SPA routing, deep linking, URL parameter synchronization, route protection guards.
  - **Why Selected:** Declarative routing, seamless navigation state management, clean URL history integration.
  - **Where Used:** `frontend/src/app/router.tsx`.
  - **Configuration:** Configured with `createBrowserRouter` and nested layout routes.

### 1.4 State Management & Data Fetching
- **TanStack React Query**
  - **Version:** `5.36.0` (`@tanstack/react-query`)
  - **Responsibility:** Server-state caching, optimistic mutations, automatic background refetching, query invalidation.
  - **Why Selected:** Eliminates redundant network requests, provides declarative loading/error states, supports offline persistence.
  - **Where Used:** Custom hooks across all feature modules (`useTransactions`, `useSummary`, etc.).
  - **Configuration:** `staleTime` tuned per domain (Categories: 5m, Summary: 30s, Transactions: 15s).

- **TanStack Query Persist Client**
  - **Version:** `5.36.0` (`@tanstack/react-query-persist-client`)
  - **Responsibility:** Serializing React Query cache to local IndexedDB for immediate offline UI hydration.
  - **Where Used:** `frontend/src/lib/queryClient.ts`.

### 1.5 Forms & Schema Validation
- **React Hook Form**
  - **Version:** `7.51.4`
  - **Responsibility:** Performant, un-rendered form state management for settings, category editing, and filters.
  - **Where Used:** Settings, category management, filter sheet.

- **Zod**
  - **Version:** `3.23.8`
  - **Responsibility:** Runtime client-side schema validation for form inputs, URL query parameters, and API responses.
  - **Where Used:** `frontend/src/lib/validation/`, shared types.

### 1.6 Data Visualization
- **Recharts**
  - **Version:** `2.12.7`
  - **Responsibility:** Interactive SVG charting: Category Donut (`PieChart`), Daily Trends (`AreaChart`, `BarChart`).
  - **Why Selected:** Composable React components, responsive SVG scaling, accessibility support.
  - **Where Used:** `frontend/src/features/dashboard/`, `frontend/src/features/analytics/`.
  - **Configuration:** Lazily loaded; category colors injected dynamically from PostgreSQL seed data.

### 1.7 Offline Storage & PWA Runtime
- **idb**
  - **Version:** `8.0.0`
  - **Responsibility:** Promise-based wrapper around browser IndexedDB API.
  - **Why Selected:** Lightweight (<2 KB), robust transaction handling, simplifies offline queue management.
  - **Where Used:** `frontend/src/lib/offlineQueue.ts` (`pending_transactions` store).

- **vite-plugin-pwa & Workbox**
  - **Version:** `0.20.0`
  - **Responsibility:** Service worker compilation, static asset precaching, web manifest generation.
  - **Why Selected:** Seamless Vite integration, supports `injectManifest` strategy for custom push event handling.
  - **Where Used:** `frontend/vite.config.ts`, `frontend/src/sw.ts`.

### 1.8 Utilities
- **date-fns & date-fns-tz**
  - **Version:** `3.6.0` / `3.0.1`
  - **Responsibility:** Date parsing, formatting, relative time calculation, timezone shifts (`Asia/Kolkata`).
  - **Where Used:** `frontend/src/lib/dates.ts`.

- **PapaParse**
  - **Version:** `5.4.1`
  - **Responsibility:** In-browser parsing of uploaded CSV files for instant client-side preview in the import wizard.
  - **Where Used:** `frontend/src/features/import-export/`.

---

## 2. Backend Technologies

### 2.1 Runtime & Framework
- **Python**
  - **Version:** `3.12.3`
  - **Responsibility:** Backend programming language runtime.
  - **Why Selected:** Native performance improvements in 3.12, robust async event loop, advanced typing syntax.
  - **Where Used:** `backend/`.

- **FastAPI**
  - **Version:** `0.111.0`
  - **Responsibility:** ASGI web API framework, routing, request validation, dependency injection.
  - **Why Selected:** High performance, native `async/await`, automatic OpenAPI documentation generation.
  - **Where Used:** `backend/app/main.py`, `backend/app/api/`.

- **Uvicorn**
  - **Version:** `0.29.0` (with `uvloop` and `httptools`)
  - **Responsibility:** Asynchronous ASGI web server implementation.
  - **Where Used:** Docker container command, development server.

### 2.2 Data Validation & Settings
- **Pydantic & pydantic-settings**
  - **Version:** `2.7.1` / `2.2.1`
  - **Responsibility:** Request/response serialization, strict type validation, environment variable ingestion.
  - **Why Selected:** High-speed Rust-based parsing core (v2), declarative schema contracts.
  - **Where Used:** `backend/app/schemas/`, `backend/app/core/config.py`.

### 2.3 Database Connectivity & ORM
- **SQLAlchemy**
  - **Version:** `2.0.30`
  - **Responsibility:** Object-Relational Mapping (ORM), query construction, connection pooling.
  - **Why Selected:** Modern 2.0-style query syntax, complete async engine support, transactional safety.
  - **Where Used:** `backend/app/models/`, `backend/app/core/db.py`, `backend/app/services/`.

- **asyncpg**
  - **Version:** `0.29.0`
  - **Responsibility:** High-performance asynchronous PostgreSQL database driver for Python.
  - **Why Selected:** Fastest Python PostgreSQL driver, binary protocol efficiency.
  - **Where Used:** Database connection URI (`postgresql+asyncpg://`).

- **Alembic**
  - **Version:** `1.13.1`
  - **Responsibility:** Relational database schema migration management and version control.
  - **Where Used:** `backend/alembic/`, `backend/alembic.ini`.

### 2.4 Cryptography & Authentication
- **argon2-cffi**
  - **Version:** `23.1.0`
  - **Responsibility:** Password hashing utilizing the Argon2id memory-hard algorithm.
  - **Why Selected:** Winner of the Password Hashing Competition; highly resistant to GPU/ASIC brute-force attacks.
  - **Where Used:** `backend/app/core/security.py`.

- **PyJWT**
  - **Version:** `2.8.0` (with `cryptography`)
  - **Responsibility:** Generation and cryptographic verification of HS256 JSON Web Tokens.
  - **Where Used:** `backend/app/core/security.py`.

### 2.5 Scheduling & Background Jobs
- **APScheduler**
  - **Version:** `3.10.4`
  - **Responsibility:** In-process asynchronous task scheduling for recurring expenses and push reminders.
  - **Why Selected:** Runs directly on the AsyncIO event loop; requires no external broker (Redis/RabbitMQ).
  - **Where Used:** `backend/app/jobs/scheduler.py`.

### 2.6 Notifications & Export Engines
- **pywebpush**
  - **Version:** `1.14.0`
  - **Responsibility:** RFC 8291 / RFC 8292 compliant Web Push encryption and transmission via VAPID keys.
  - **Where Used:** `backend/app/services/reminders.py`.

- **openpyxl**
  - **Version:** `3.1.2`
  - **Responsibility:** Generating formatted, multi-sheet Excel workbooks (`.xlsx`) for financial exports.
  - **Where Used:** `backend/app/services/exports.py`.

---

## 3. Database & Storage

- **PostgreSQL**
  - **Version:** `16.2`
  - **Responsibility:** Relational data persistence, ACID transactions, relational constraints, foreign keys.
  - **Why Selected:** World-class reliability, rich indexing capabilities, native extension ecosystem (`citext`, `pg_trgm`).
  - **Extensions Used:**
    - `citext`: Case-insensitive text fields for email uniqueness.
    - `pg_trgm`: Trigram-based fuzzy substring searching across descriptions and merchants.

---

## 4. Testing Frameworks & Tooling

### 4.1 Backend Testing
- **pytest** (`8.2.0`) & **pytest-asyncio** (`0.23.6`): Async test runner.
- **httpx** (`0.27.0`): Asynchronous HTTP client for testing FastAPI endpoints (`AsyncClient`).
- **testcontainers** (`4.4.0`): Programmatic spin-up of isolated PostgreSQL 16 Docker containers for integration test suites.

### 4.2 Frontend Testing
- **Vitest** (`1.6.0`): Fast Vite-native unit test runner.
- **@testing-library/react** (`15.0.7`): React DOM component testing targeting user behavior.
- **jsdom** (`24.0.0`): Headless DOM implementation for Vitest.

### 4.3 End-to-End Testing
- **Playwright** (`1.44.0`): Cross-browser E2E automation configured specifically with iPhone mobile viewport (390×844) and network offline simulation.

---

## 5. Code Quality & Formatting Tooling

- **Ruff** (`0.4.4`): Blazing-fast Python linter and formatter replacing Black, Flake8, and isort.
- **mypy** (`1.10.0`): Strict static type checker for Python (`--strict`).
- **ESLint** (`8.57.0`): Pluggable JavaScript/TypeScript linter with React Hooks rules.
- **Prettier** (`3.2.5`): Opinionated code formatter for TS, TSX, CSS, and JSON.

---

## 6. Infrastructure & Deployment Tools

- **Docker & Docker Compose** (Engine `26.x`, Compose `v2.x`): Containerized local development and staging orchestration (`db`, `api`, `web`).
- **GNU Make**: Developer workflow automation (`make up`, `make migrate`, `make test`, `make lint`).
- **Cloudflare Tunnel / ngrok**: Optional HTTPS tunneling for testing PWA installation and Web Push directly on physical iPhone hardware during local development.
