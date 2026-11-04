# SpendWise — Feature Specification: Recurring Expenses Engine

## 1. Overview & Business Objective

Recurring Expenses automate the tracking of regular financial obligations (house rent, electricity, Wi-Fi broadband, insurance premiums, SIPs, and digital subscriptions). SpendWise supports two operational modes: **Auto-Add** (silent transaction creation on the due date) and **Remind Me** (interactive confirmation card on the Dashboard).

---

## 2. User Stories

- **US-REC-01:** As a user paying monthly house rent on the 5th, I want SpendWise to automatically log this transaction so that I don't have to enter it manually every month.
- **US-REC-02:** As a user with variable electricity bills, I want a reminder on the due date so that I can confirm the exact amount before logging it.
- **US-REC-03:** As a user reviewing my upcoming commitments, I want to see a list of scheduled recurring payments on my dashboard so that I can budget for upcoming cash outflows.
- **US-REC-04:** As a user whose server was temporarily powered off, I want the system to catch up on missed recurring payments without creating duplicates.

---

## 3. Recurring Execution Lifecycle

```mermaid
flowchart TD
    Scheduler[APScheduler: Hourly Cron Trigger] --> QueryRules[Query active recurring_rules WHERE next_due_date <= CURRENT_DATE]
    QueryRules --> Loop{Iterate over due rules}
    
    Loop --> ModeCheck{Rule Execution Mode}
    
    ModeCheck -->|auto_create| AutoExec[Generate client_id = uuid5(rule_id, due_date)]
    AutoExec --> InsertTxn[INSERT INTO transactions source='recurring']
    InsertTxn --> AdvanceDate[Calculate next_due_date]
    AdvanceDate --> UpdateRule[UPDATE recurring_rules]
    
    ModeCheck -->|remind| RemindExec[Check notification_log for recurring_due]
    RemindExec -->|Not Notified| SendPush[Send Web Push & Show Dashboard Card]
    SendPush --> AwaitUser{User Action on Dashboard}
    AwaitUser -->|Confirm| ConfirmAction[POST /recurring/{id}/confirm -> Create Txn & Advance Date]
    AwaitUser -->|Skip| SkipAction[POST /recurring/{id}/skip -> Advance Date Only]
```

---

## 4. Functional Requirements & Business Logic

### 4.1 Frequency & Day Clamping Math
- Supported frequencies: `daily`, `weekly`, `monthly`, `yearly` with configurable `interval_count` (e.g., every 3 months for quarterly bills).
- **Day Clamping Rule:** For monthly rules set on the 29th, 30th, or 31st, `compute_next_due` automatically clamps to the maximum valid calendar day of the target month:
  - Day 31 in February evaluates to **Feb 28** (or **Feb 29** in leap years).
  - Day 31 in April evaluates to **Apr 30**.

### 4.2 Automated Catch-Up & Idempotency
- If the SpendWise server was offline for several days or weeks, the background scheduler executes a catch-up loop upon restart.
- To prevent infinite loops, catch-up is capped at a maximum of **12 cycles per run**.
- Every auto-generated transaction uses an idempotent client identifier:
  $$\text{client\_id} = \text{uuid5}(\text{rule\_id}, \text{iso\_due\_date})$$
  Ensuring that even if the job runs multiple times simultaneously, PostgreSQL enforces uniqueness on `(user_id, client_id)` without duplicating records.

### 4.3 Confirmation & Skip Workflows (`remind` Mode)
- Rules in `remind` mode populate `GET /api/v1/recurring/due`.
- **Confirm (`POST /recurring/{id}/confirm`):** Allows optional override of the exact amount or date. Generates a transaction with `source = 'recurring'` and advances `next_due_date`.
- **Skip (`POST /recurring/{id}/skip`):** Advances `next_due_date` without creating any transaction record (e.g., if a subscription was paused).

---

## 5. Data & API Dependencies

- **Database Entities:** [DATABASE.md](../technical/DATABASE.md) — `recurring_rules`, `transactions`, `notification_log`.
- **API Endpoints:** [API_SPEC.md](../technical/API_SPEC.md) —
  - `GET /api/v1/recurring`
  - `POST /api/v1/recurring`
  - `PATCH /api/v1/recurring/{id}`
  - `DELETE /api/v1/recurring/{id}`
  - `GET /api/v1/recurring/due`
  - `POST /api/v1/recurring/{id}/confirm`
  - `POST /api/v1/recurring/{id}/skip`

---

## 6. Testing Scenarios & Acceptance Criteria

1. **February Day Clamping:** Create a monthly rule with `day_of_month = 31` starting in January. Trigger advancement; verify `next_due_date` evaluates to `2027-02-28`.
2. **Auto-Create Idempotency:** Execute the recurring runner twice for the same due rule; verify exactly 1 transaction is inserted into the database.
3. **Dashboard Due Card:** Verify that a rule in `remind` mode with `next_due_date <= today` renders on the Dashboard with functional Confirm and Skip triggers.
