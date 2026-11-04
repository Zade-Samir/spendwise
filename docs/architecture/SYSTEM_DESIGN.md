# SpendWise — Detailed System Design & Interaction Models

## 1. System Context Diagram (C4 Level 1)

The system context diagram illustrates SpendWise in relation to its users, external operating platforms, and notification infrastructure:

```mermaid
C4Context
    title System Context Diagram for SpendWise

    Person(user, "SpendWise User", "Individual tracking daily personal expenses, budgets, and spending habits.")
    
    System(spendwise, "SpendWise PWA & API", "Enables rapid expense logging, integer paise tracking, visual analytics, budgets, and CSV import/export.")
    
    System_Ext(ios_shortcuts, "iOS Shortcuts", "Triggers Quick Add screen or sends headless transactions via personal API tokens.")
    System_Ext(webpush, "Web Push Service", "Apple APNs / Google FCM delivering daily reminders and budget threshold notifications.")
    System_Ext(bank_csv, "Bank & UPI Statements", "CSV statement exports from HDFC, SBI, ICICI, Google Pay, Paytm, etc.")

    Rel(user, spendwise, "Logs expenses, views dashboard, configures budgets", "HTTPS / PWA")
    Rel(user, ios_shortcuts, "Configures automation when payment apps close")
    Rel(ios_shortcuts, spendwise, "Mode A: Deep Link / Mode B: POST /api/v1/shortcuts/transactions", "HTTPS / JSON")
    Rel(spendwise, webpush, "Dispatches encrypted VAPID push payloads", "HTTPS / Web Push Protocol")
    Rel(webpush, user, "Displays mobile push notifications on iPhone")
    Rel(user, bank_csv, "Downloads statement files")
    Rel(bank_csv, spendwise, "Uploads CSV for automated mapping & import", "HTTPS / Multipart Form")
```

---

## 2. Container Diagram (C4 Level 2)

```mermaid
C4Container
    title Container Diagram for SpendWise

    Person(user, "User", "iPhone Safari / Desktop user")

    Container_Boundary(c1, "SpendWise Platform") {
        Container(spa, "Single-Page Application (PWA)", "React 18, TypeScript, Tailwind CSS, Vite", "Provides the responsive mobile-first UI, custom keypad, Recharts visual analytics, and offline cache.")
        Container(sw, "Service Worker", "Workbox injectManifest", "Precaches static assets, handles background push notifications, and intercepts navigation requests.")
        ContainerDb(idb, "Client Database", "IndexedDB (idb wrapper)", "Stores offline transaction queue (pending_transactions) and persisted TanStack Query cache.")
        
        Container(api, "API Application Server", "Python 3.12, FastAPI, Pydantic v2", "Exposes REST endpoints (/api/v1), validates requests, enforces user isolation, and executes financial calculations.")
        Container(scheduler, "Background Scheduler", "APScheduler (AsyncIOScheduler)", "Executes hourly recurring expense generation and 15-minute reminder evaluations.")
        
        ContainerDb(db, "Primary Database", "PostgreSQL 16", "Stores users, categories, transactions, budgets, recurring rules, tokens, and notification logs.")
    }

    Rel(user, spa, "Interacts with UI", "Touch / Keyboard")
    Rel(spa, sw, "Registers & communicates", "PostMessage")
    Rel(spa, idb, "Reads/writes offline transactions and cache", "IndexedDB API")
    Rel(spa, api, "Queries and mutates data", "JSON / HTTPS")
    Rel(api, db, "Reads and writes relational data", "SQLAlchemy 2.0 / asyncpg")
    Rel(scheduler, db, "Evaluates rules and persists generated transactions", "SQLAlchemy 2.0 / asyncpg")
    Rel(scheduler, api, "Shares service layer modules", "In-Process Python Calls")
```

---

## 3. Core Interaction & Sequence Diagrams

### 3.1 User Registration & Default Seed Lifecycle
When a new user registers, the system must atomically create the user account and seed default categories along with predefined merchant auto-categorization rules:

```mermaid
sequenceDiagram
    autonumber
    actor Client as PWA Client
    participant Auth as AuthRouter (/auth/register)
    participant Sec as SecurityService
    participant Cat as CategoryService
    participant DB as PostgreSQL

    Client->>Auth: POST /api/v1/auth/register {email, password, name}
    Auth->>Auth: Validate password (min 8 chars, reject common 1000)
    Auth->>Sec: Hash password with Argon2id
    Auth->>DB: Begin Database Transaction
    Auth->>DB: INSERT INTO users (id, email, password_hash, timezone='Asia/Kolkata', ...)
    Auth->>Cat: seed_default_categories(user_id)
    Cat->>DB: Bulk INSERT 10 Categories & 25 Subcategories
    Cat->>DB: Bulk INSERT 9 Default CategoryRules (uber->Transport, zomato->Food, etc.)
    Auth->>DB: Commit Transaction
    Auth->>Sec: Generate JWT Access Token (15m) & Refresh Token (30d)
    Auth->>DB: INSERT INTO refresh_tokens (hash, user_id, expires_at)
    Auth-->>Client: 201 Created {user, access_token, refresh_token}
```

---

### 3.2 Quick Expense Creation Flow (Online Path)
```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as Quick Add UI (/add)
    participant Suggest as /categories/suggest
    participant API as /api/v1/transactions
    participant Service as TransactionService
    participant Rule as CategorizationService
    participant DB as PostgreSQL

    User->>UI: Types "1 5 0" on Custom Keypad
    User->>UI: Types merchant "swiggy"
    UI->>Suggest: GET /api/v1/categories/suggest?merchant=swiggy
    Suggest-->>UI: {category_id: "food_id", subcategory_id: "delivery_id", confidence: "rule"}
    UI->>UI: Auto-highlights "Food & Dining" chip with "Suggested" badge
    User->>UI: Taps "Save ₹150"
    UI->>UI: Generate client_id = UUIDv4
    UI->>API: POST /api/v1/transactions {amount_minor: 15000, category_id, merchant: "swiggy", client_id}
    API->>Service: create_transaction(user_id, data)
    Service->>Service: Validate amount_minor > 0 and occurred_at <= now + 5 min
    Service->>DB: INSERT INTO transactions ... RETURNING id
    Service->>Rule: record_merchant_learning(user_id, "swiggy", category_id)
    Service->>Service: check_budget_alerts(user_id)
    Service-->>API: Transaction entity
    API-->>UI: 201 Created {transaction}
    UI-->>User: Show Toast "₹150 added to Food & Dining · Undo"
```

---

### 3.3 Offline Expense Synchronization & Conflict Resolution
```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as PWA Interface
    participant Queue as IndexedDB (pending_transactions)
    participant Sync as Background Sync Handler
    participant API as FastAPI Server
    participant DB as PostgreSQL

    Note over User, UI: Device is in airplane mode / subway
    User->>UI: Create ₹80 Auto Expense (client_id: C-123)
    UI->>Queue: Store {client_id: "C-123", payload: {...}, created_at}
    UI->>UI: Optimistically add C-123 to local transaction list with Clock Badge
    UI-->>User: Toast: "Saved offline · Will sync when connected"

    Note over UI, Sync: Network Restored (window 'online' event fires)
    Sync->>Queue: Fetch pending items ORDER BY created_at ASC
    Queue-->>Sync: [ {client_id: "C-123", ...} ]
    
    Sync->>API: POST /api/v1/transactions {..., client_id: "C-123"}
    API->>DB: INSERT INTO transactions (..., client_id) VALUES (..., 'C-123')
    
    alt Standard First Sync
        DB-->>API: 201 Created (id: T-999)
        API-->>Sync: 201 Created
        Sync->>Queue: DELETE WHERE client_id = "C-123"
        Sync->>UI: Invalidate ['transactions'] & ['summary'] queries
        UI->>UI: Replace C-123 with T-999 (remove Clock Badge)
    else Network Glitch Caused Duplicate POST Replay
        DB-->>API: Unique constraint violation on (user_id, client_id)
        API->>DB: SELECT * FROM transactions WHERE user_id=:u AND client_id='C-123'
        DB-->>API: Existing Transaction Record
        API-->>Sync: 200 OK {existing_transaction} (Idempotent Success)
        Sync->>Queue: DELETE WHERE client_id = "C-123"
    end
```

---

### 3.4 3-Step CSV Statement Import & Deduplication Flow
```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Wizard as Import Wizard UI (/import)
    participant API as ImportRouter (/api/v1/imports)
    participant Parser as CSVImportService
    participant DB as PostgreSQL

    %% Step 1: Upload
    User->>Wizard: Select bank_statement.csv (≤ 2 MB)
    Wizard->>API: POST /api/v1/imports (multipart/form-data)
    API->>Parser: Sniff delimiter, encoding, date_format
    API->>Parser: Parse sample rows & generate column mapping suggestions
    API->>DB: INSERT INTO import_batches (status='uploaded', raw_rows, column_mapping)
    API-->>Wizard: 200 OK {batch_id, headers, sample_rows, suggested_mapping, detected}

    %% Step 2: Preview
    User->>Wizard: Confirms mapping: Date=Col 0, Amount=Col 3, Description=Col 2
    Wizard->>API: POST /api/v1/imports/{id}/preview {mapping, date_format, amount_mode}
    API->>Parser: Process raw_rows with mapping
    loop For each row
        Parser->>Parser: Parse date & amount (strip ₹, commas, Dr/Cr)
        Parser->>Parser: Compute dedupe_hash = sha256(user|date|amount|norm_desc)
        Parser->>DB: Check if dedupe_hash exists in non-deleted transactions
        Parser->>Parser: Suggest category via auto-categorization engine
    end
    API-->>Wizard: 200 OK {rows: [...], stats: {total, valid, duplicates, errors}}

    %% Step 3: Commit
    User->>Wizard: Reviews table (unchecks invalid rows) -> Clicks "Commit Import"
    Wizard->>API: POST /api/v1/imports/{id}/commit {rows: [...], skip_duplicates: true}
    API->>DB: Begin Atomic Database Transaction
    API->>DB: Bulk INSERT INTO transactions (source='csv_import', import_batch_id)
    API->>DB: UPDATE import_batches SET status='committed', committed_at=now()
    API->>DB: Commit Transaction
    API-->>Wizard: 200 OK {imported: 42, skipped: 3, duplicates: 5}
```

---

### 3.5 Timezone-Aware Analytics Aggregation Pipeline
All analytical queries must respect the user's localized timezone (`users.timezone`, default `Asia/Kolkata`) and custom salary cycle start day (`users.month_start_day`).

```mermaid
flowchart TD
    Req[GET /api/v1/analytics/summary?period=month] --> Deps[Authenticate & Load User Profile]
    Deps --> TimeHelper[backend/app/core/time.py: month_bounds]
    
    subgraph BoundaryLogic ["Time Boundary Calculation"]
        TimeHelper --> CalcStart["Find start date: If today < month_start_day, previous month start day, else current month start day"]
        CalcStart --> TZConvert["Convert localized period start (00:00:00) & end (23:59:59.999) to UTC Range [start_utc, end_utc)"]
    end
    
    TZConvert --> Query[SQL Execution with Half-Open Range Filter]
    
    subgraph SQLExec ["PostgreSQL Aggregation Query"]
        Query --> Filter["WHERE user_id = :uid AND deleted_at IS NULL AND occurred_at >= :start_utc AND occurred_at < :end_utc"]
        Filter --> Sums["SELECT SUM(amount_minor), COUNT(*)"]
        Filter --> GroupByDay["SELECT date_trunc('day', occurred_at AT TIME ZONE :tz) as day, SUM(amount_minor) GROUP BY 1"]
    end

    GroupByDay --> ZeroFill["AnalyticsService: Zero-fill missing calendar days"]
    Sums --> Reconcile["Verify: Overall Sum == Sum of Category Groups"]
    Reconcile --> Res[Return 200 OK JSON Envelope]
```

---

### 3.6 Budget Evaluation & Overspend Alert Dispatch
```mermaid
sequenceDiagram
    autonumber
    participant Txn as TransactionService
    participant Budget as BudgetService
    participant Log as notification_log
    participant Push as WebPushEngine (pywebpush)
    participant Client as User Device

    Txn->>Budget: check_budget_alerts(user_id)
    Budget->>Budget: Query active budgets (overall + category-specific)
    Budget->>Budget: Calculate spend_minor within current period
    
    loop For each budget
        Budget->>Budget: Calculate pct_used = (spent_minor / amount_minor) * 100
        alt pct_used >= 100% (Budget Exceeded)
            Budget->>Log: Check if log exists for (kind='budget_exceeded', dedupe_key=id+period+100)
            opt No log exists
                Budget->>Log: INSERT INTO notification_log (kind='budget_exceeded', dedupe_key)
                Budget->>Push: Send push: "Budget Exceeded! You have spent 105% of Dining budget"
                Push-->>Client: Display High-Priority Notification
            end
        else pct_used >= alert_threshold_pct (Warning Threshold)
            Budget->>Log: Check if log exists for (kind='budget_warning', dedupe_key=id+period+threshold)
            opt No log exists
                Budget->>Log: INSERT INTO notification_log (kind='budget_warning', dedupe_key)
                Budget->>Push: Send push: "Budget Warning: Dining budget is at 82%"
                Push-->>Client: Display Warning Notification
            end
        end
    end
```

---

### 3.7 Recurring Expense Scheduler & Catch-Up Logic
```mermaid
sequenceDiagram
    autonumber
    participant Cron as APScheduler (AsyncIO)
    participant Job as RecurringJob (Hourly)
    participant Recur as RecurringService
    participant DB as PostgreSQL

    Cron->>Job: Trigger hourly execution
    Job->>DB: Query active recurring_rules WHERE next_due_date <= CURRENT_DATE (user tz)
    DB-->>Job: [ Rule 1 (auto_create), Rule 2 (remind) ]

    %% Rule 1: Auto-create
    Job->>Recur: Process Rule 1 (Rent ₹15,000, auto_create)
    Recur->>Recur: Generate idempotent client_id = uuid5(rule_id, next_due_date)
    Recur->>DB: INSERT INTO transactions (amount_minor: 1500000, source='recurring', client_id)
    Recur->>Recur: Calculate new_next_due = compute_next_due(rule, current_due)
    Recur->>DB: UPDATE recurring_rules SET next_due_date = new_next_due

    %% Rule 2: Remind
    Job->>Recur: Process Rule 2 (Internet ₹999, remind)
    Recur->>DB: Check notification_log for (kind='recurring_due', dedupe_key=rule_id+next_due)
    opt Not yet notified
        Recur->>DB: INSERT INTO notification_log ...
        Recur->>DB: Surface in GET /api/v1/recurring/due
    end
```
