# SpendWise — Architectural Decision Records (ADR)

This document records the foundational architectural decisions made for the SpendWise project. Each record details the context, problem statement, evaluated options, chosen approach, rationale, and associated trade-offs.

---

## Index of Architectural Decisions

- [ADR-0001: Integer Paise Accounting (BIGINT) vs. Floating-Point Decimals](#adr-0001-integer-paise-accounting-bigint-vs-floating-point-decimals)
- [ADR-0002: Progressive Web App (PWA) on iOS Safari vs. Native iOS Application](#adr-0002-progressive-web-app-pwa-on-ios-safari-vs-native-ios-application)
- [ADR-0003: Python 3.12 + FastAPI + SQLAlchemy 2.0 Async vs. Node.js or Django](#adr-0003-python-312--fastapi--sqlalchemy-20-async-vs-nodejs-or-django)
- [ADR-0004: React 18 + Vite 5 SPA vs. Next.js SSR](#adr-0004-react-18--vite-5-spa-vs-nextjs-ssr)
- [ADR-0005: IndexedDB Offline Queue with Client-Generated UUID (client_id) Idempotency](#adr-0005-indexeddb-offline-queue-with-client-generated-uuid-client_id-idempotency)
- [ADR-0006: In-Process APScheduler vs. External Distributed Queue (Celery/Redis)](#adr-0006-in-process-apscheduler-vs-external-distributed-queue-celeryredis)
- [ADR-0007: Deterministic Rule-Based Insights vs. Large Language Model (LLM) Integration in v1](#adr-0007-deterministic-rule-based-insights-vs-large-language-model-llm-integration-in-v1)
- [ADR-0008: JWT Access Tokens + Rotating Refresh Tokens Stored in localStorage](#adr-0008-jwt-access-tokens--rotating-refresh-tokens-stored-in-localstorage)
- [ADR-0009: iOS Shortcuts Integration Model (Mode A Deep-Link & Mode B Headless API)](#adr-0009-ios-shortcuts-integration-model-mode-a-deep-link--mode-b-headless-api)
- [ADR-0010: Trigram Substring Search (pg_trgm) vs. Dedicated Search Engine (Elasticsearch)](#adr-0010-trigram-substring-search-pg_trgm-vs-dedicated-search-engine-elasticsearch)
- [ADR-0011: Timezone Anchoring to Asia/Kolkata with Configurable Salary Cycles](#adr-0011-timezone-anchoring-to-asiakolkata-with-configurable-salary-cycles)

---

### ADR-0001: Integer Paise Accounting (BIGINT) vs. Floating-Point Decimals
- **Status:** Accepted (Settled)
- **Date:** 2026-11-02
- **Context:** Financial applications handling currency require absolute mathematical precision. In India, currency is denominated in Indian Rupees (INR ₹) where 1 Rupee = 100 Paise.
- **Problem:** Floating-point representations (`float` in Python, standard `Number` in JavaScript, `FLOAT`/`REAL` in SQL) suffer from binary representation inaccuracies (e.g., `0.1 + 0.2 = 0.30000000000000004`), causing rounding errors, reconciliation discrepancies, and audit failures.
- **Options Considered:**
  1. Standard IEEE 754 floating point numbers (`float`).
  2. Fixed-point decimal types (`DECIMAL`/`NUMERIC(12, 2)`).
  3. 64-bit integer storing minor currency units (paise) (`BIGINT` / `int`).
- **Chosen Approach:** Store and manipulate all monetary figures as integer paise (`amount_minor` as `BIGINT` in PostgreSQL and `int` in Python/TypeScript).
- **Reasoning:** Integer arithmetic is immune to rounding drift, exhibits superior query performance in PostgreSQL aggregations (`SUM`, `AVG`), and prevents serialization ambiguity in JSON payloads.
- **Trade-offs:** Requires client-side translation layers (`parseRupeesToMinor` and `formatINR`) when accepting user input or rendering numbers in the UI.

---

### ADR-0002: Progressive Web App (PWA) on iOS Safari vs. Native iOS Application
- **Status:** Accepted (Settled)
- **Date:** 2026-11-02
- **Context:** The primary device profile is modern iPhones (iOS 16.4+ / Safari).
- **Problem:** Building a native iOS application requires Swift/SwiftUI, Apple Developer Program enrollment, App Store review friction, and delays in releasing bug fixes.
- **Options Considered:**
  1. Native Swift / SwiftUI application.
  2. Cross-platform hybrid framework (React Native or Flutter).
  3. Mobile-first Progressive Web App (PWA) with Apple Touch / Home Screen installation support.
- **Chosen Approach:** Mobile-first PWA using Vite, Workbox (`injectManifest`), and modern iOS PWA capabilities (standalone display, Web Push via VAPID, local caching).
- **Reasoning:** Zero App Store distribution friction, instant deployments, unified codebase for mobile and desktop, while delivering 95% of native app ergonomics for personal expense tracking.
- **Trade-offs:** An iOS PWA cannot run background processes to monitor SMS or auto-read Google Pay/PhonePe transactions. This platform limitation must be clearly communicated in product copy.

---

### ADR-0003: Python 3.12 + FastAPI + SQLAlchemy 2.0 Async vs. Node.js or Django
- **Status:** Accepted (Settled)
- **Date:** 2026-11-02
- **Context:** Backend services require high I/O throughput, robust data validation, type safety, and efficient relational database connectivity.
- **Problem:** Selecting a backend runtime that balances asynchronous execution speed, type safety, and rich analytical libraries.
- **Options Considered:**
  1. Node.js with Express or NestJS.
  2. Python Django with Django REST Framework.
  3. Python 3.12 with FastAPI, Pydantic v2, and SQLAlchemy 2.0 (asyncpg).
- **Chosen Approach:** Python 3.12 + FastAPI + SQLAlchemy 2.0 (async).
- **Reasoning:** FastAPI delivers native async execution, automatic OpenAPI schema generation, and deep integration with Pydantic v2 (Rust-backed validation). Python enables effortless future expansion into mathematical intelligence, forecasting, and data science pipelines.
- **Trade-offs:** Asynchronous SQLAlchemy 2.0 requires disciplined session and relationship management to prevent lazy-loading errors.

---

### ADR-0004: React 18 + Vite 5 SPA vs. Next.js SSR
- **Status:** Accepted (Settled)
- **Date:** 2026-11-02
- **Context:** SpendWise is an authenticated personal finance utility, not a public-facing content site requiring search engine optimization (SEO).
- **Problem:** Evaluating whether Server-Side Rendering (SSR) via Next.js is warranted over a Single-Page Application (SPA).
- **Options Considered:**
  1. Next.js (App Router / SSR).
  2. React 18 SPA built with Vite 5.
- **Chosen Approach:** React 18 SPA built with Vite 5 and static asset hosting.
- **Reasoning:** A personal expense tracker demands full offline operation, which is naturally suited to an SPA cached via Service Worker. Next.js SSR adds unnecessary server runtime complexity, increases hosting costs, and provides no SEO benefit for authenticated private dashboards.
- **Trade-offs:** Initial load requires downloading the client JS bundle; mitigated by strict bundle splitting (initial gzipped bundle ≤ 250 KB).

---

### ADR-0005: IndexedDB Offline Queue with Client-Generated UUID (client_id) Idempotency
- **Status:** Accepted (Settled)
- **Date:** 2026-11-02
- **Context:** Users frequently log payments in areas with weak cellular reception (basements, remote vendor kiosks).
- **Problem:** Ensuring transactions created offline are persisted reliably on the device and synchronized with the backend without risk of duplication upon network restoration.
- **Options Considered:**
  1. Block expense creation when `navigator.onLine === false`.
  2. Store offline items in `localStorage` without idempotency tokens.
  3. Store offline mutations in IndexedDB (`idb`), generate a client UUID (`client_id`), and enforce backend partial uniqueness on `(user_id, client_id)`.
- **Chosen Approach:** IndexedDB `pending_transactions` store with client UUIDs. The backend `POST /transactions` returns `200 OK` with the existing entity if a duplicate `client_id` is replayed.
- **Reasoning:** Provides a completely frictionless offline user experience. Guarantees safe idempotent replay during flaky network reconnects.
- **Trade-offs:** Offline scope in v1 is restricted to expense creation; editing and deleting existing records requires active internet connectivity.

---

### ADR-0006: In-Process APScheduler vs. External Distributed Queue (Celery/Redis)
- **Status:** Accepted (Settled)
- **Date:** 2026-11-02
- **Context:** SpendWise needs to process recurring expenses hourly and evaluate daily reminder notifications every 15 minutes.
- **Problem:** Evaluating background processing architecture without overcomplicating initial infrastructure.
- **Options Considered:**
  1. Celery or ARQ with Redis / RabbitMQ.
  2. External system cron executing curl requests to protected API endpoints.
  3. In-process `AsyncIOScheduler` from APScheduler running inside the FastAPI ASGI lifespan.
- **Chosen Approach:** APScheduler (`AsyncIOScheduler`) running within the FastAPI application process.
- **Reasoning:** Eliminates the operational overhead of running Redis or Celery worker daemons on a small single-node deployment. The workload (hourly recurring checks and reminder checks) is lightweight and I/O-bound.
- **Trade-offs:** If the API service scales horizontally across multiple container replicas in the future, jobs would duplicate unless coordinated via database distributed locks. Documented for Phase 3 review.

---

### ADR-0007: Deterministic Rule-Based Insights vs. Large Language Model (LLM) Integration in v1
- **Status:** Accepted (Settled)
- **Date:** 2026-11-02
- **Context:** The product requires spending insights (e.g., weekend spending spikes, category leaps, logging streaks).
- **Problem:** Assessing whether to invoke an LLM (e.g., OpenAI or Anthropic API) to generate spending observations.
- **Options Considered:**
  1. Pass monthly transactions to an external LLM API to generate natural language summaries.
  2. Build a deterministic Python rule evaluation engine (`InsightService`) with 11 statistical heuristics.
- **Chosen Approach:** Deterministic rule engine in Python/SQL without LLM integration in v1.
- **Reasoning:** Deterministic rules are fast (sub-10ms), free of external API costs, private (no user transaction data sent to third-party LLMs), and 100% mathematically verifiable with zero risk of hallucinations.
- **Trade-offs:** Insights are constrained to predefined heuristic templates rather than conversational prose.

---

### ADR-0008: JWT Access Tokens + Rotating Refresh Tokens Stored in localStorage
- **Status:** Accepted (Settled)
- **Date:** 2026-11-02
- **Context:** Mobile users expect long-lived login sessions (30+ days) while maintaining robust security against token theft.
- **Problem:** iOS Safari standalone PWAs frequently purge or isolate `httpOnly` cookies across app relaunches, causing premature user logouts.
- **Options Considered:**
  1. `httpOnly` secure cookies for both access and refresh tokens.
  2. Single long-lived JWT stored in `localStorage`.
  3. Short-lived in-memory JWT access token (15 mins) paired with a 30-day rotating refresh token stored in `localStorage`.
- **Chosen Approach:** Short-lived access JWT in memory + rotating refresh token in `localStorage`. Reuse of a revoked refresh token immediately invalidates all active sessions for that user.
- **Reasoning:** Guarantees session persistence across iOS PWA cold starts while mitigating XSS exposure through token rotation and automatic reuse-detection revocation.
- **Trade-offs:** Requires an automatic refresh-and-retry interceptor in the client API client (`lib/api.ts`).

---

### ADR-0009: iOS Shortcuts Integration Model (Mode A Deep-Link & Mode B Headless API)
- **Status:** Accepted (Settled)
- **Date:** 2026-11-02
- **Context:** Reducing transaction entry friction on iPhone devices when completing UPI payments.
- **Problem:** An iOS PWA cannot independently read payment app notifications or intercept clipboard data.
- **Options Considered:**
  1. Attempt native iOS URL schemes to intercept other apps (not permitted by iOS).
  2. Two-mode integration: Mode A via URL scheme deep-links with prefill query params; Mode B via headless API tokens (`POST /api/v1/shortcuts/transactions`).
- **Chosen Approach:** Support both Mode A (URL deep links) and Mode B (scoped personal API tokens).
- **Reasoning:** Mode A requires zero configuration for casual users. Mode B empowers advanced iOS Shortcuts power-users to trigger headless Siri or Automation logging workflows without opening the browser.
- **Trade-offs:** Requires maintaining dedicated API token management UI and strict rate-limiting on shortcut endpoints.

---

### ADR-0010: Trigram Substring Search (pg_trgm) vs. Dedicated Search Engine (Elasticsearch)
- **Status:** Accepted (Settled)
- **Date:** 2026-11-02
- **Context:** Users need to quickly search transaction history by merchant name, description, or notes (e.g., searching "uber" or "swiggy").
- **Problem:** Implementing fuzzy, typo-tolerant search across text fields without inflating infrastructure footprint.
- **Options Considered:**
  1. Standard SQL `LIKE '%query%'` (sequential table scans).
  2. Dedicated search container (Elasticsearch, Meilisearch, or Typesense).
  3. PostgreSQL native `pg_trgm` extension with GIN indexes on `(merchant || ' ' || description)`.
- **Chosen Approach:** PostgreSQL `pg_trgm` extension with GIN trigram indexes.
- **Reasoning:** Supports sub-50ms fuzzy substring searches across tens of thousands of rows entirely inside PostgreSQL, avoiding an additional search cluster.
- **Trade-offs:** GIN index updates add slight write overhead during transaction creation (negligible for single-user scale).

---

### ADR-0011: Timezone Anchoring to Asia/Kolkata with Configurable Salary Cycles
- **Status:** Accepted (Settled)
- **Date:** 2026-11-02
- **Context:** Financial analytics (daily, weekly, monthly totals) depend on precise temporal boundaries.
- **Problem:** Many Indian salaried professionals receive their income on the 25th or 28th of the month, making standard calendar month boundaries (1st to 31st) misaligned with actual cash-flow cycles.
- **Options Considered:**
  1. Hardcode calendar months in UTC.
  2. Client-calculated date ranges passed as query parameters.
  3. Centralized Python `time.py` engine evaluating user timezone (`Asia/Kolkata`) and user-configured `month_start_day` (1–28).
- **Chosen Approach:** Centralized server-side `time.py` utilizing the user's stored timezone and `month_start_day`. All ranges are half-open: `[start_inclusive, end_exclusive)`.
- **Reasoning:** Enforces consistent reporting across mobile PWA and desktop clients. Adapts gracefully to user salary cycles.
- **Trade-offs:** Analytical SQL queries must utilize `AT TIME ZONE` transformations and explicit UTC boundary parameters.
