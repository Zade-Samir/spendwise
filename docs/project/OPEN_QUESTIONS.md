# SpendWise — Open Questions & Technical Ambiguities

This document tracks genuinely unresolved requirements, product edge cases, and future decision points. Settled decisions are explicitly excluded.

---

## Active Open Questions

### OQ-001: Category Rule Learning Conflict Resolution
- **Description:** The categorization engine automatically upserts a "learned" rule when a normalized merchant has been saved ≥ 2 times with the same category within the last 90 days. If the user subsequently saves that same merchant with a *different* category (e.g., "Amazon" saved under "Groceries" instead of "Shopping"), how should the learned rule update?
- **Why Clarification is Needed:** Prevents rule oscillation and ensures predictable auto-categorization behavior.
- **Impact:** `CategorizationService` logic and `category_rules` table updates.
- **Related Documents:** [EXPENSE_MANAGEMENT.md](../features/EXPENSE_MANAGEMENT.md), [DATABASE.md](../technical/DATABASE.md), `SPENDWISE_SPEC.md` §10.1.
- **Proposed Options:**
  1. *Immediate Overwrite:* The most recent 2 consecutive identical assignments overwrite any prior learned rule.
  2. *Frequency Threshold:* Keep existing rule until the new category has at least 3 occurrences.
  3. *Prompt User:* When a conflict occurs twice, prompt the user: *"Would you like to update your auto-categorization rule for Amazon?"*
- **Current Working Assumption:** Option 1 (2 consecutive identical assignments overwrite existing learned rules).
- **Resolution Status:** `OPEN`

---

### OQ-002: CSV Statement Rows with Future Dates
- **Description:** `SPENDWISE_SPEC.md` enforces that individual manual transactions cannot have an `occurred_at` timestamp greater than current UTC time + 5 minutes. Some credit card or bank statements list future "Value Dates" or post-dated clearing entries. How should the CSV import wizard handle rows where the transaction date is in the future?
- **Why Clarification is Needed:** Prevent import preview failures or silent data rejection.
- **Impact:** `CSVImportService` preview and validation logic.
- **Related Documents:** [IMPORT_EXPORT.md](../features/IMPORT_EXPORT.md), [API_SPEC.md](../technical/API_SPEC.md).
- **Proposed Options:**
  1. *Strict Reject:* Flag future-dated rows with an error in the review table, disabling their import.
  2. *Clamp to Current Date:* Automatically clamp the date to the current date and display an informational note.
  3. *Allow Import:* Permit future dates exclusively for imported bank statements, exempting them from the manual +5 min validator.
- **Current Working Assumption:** Option 1 (Flag as error in review table with checkbox unchecked, allowing user to manually correct or skip).
- **Resolution Status:** `OPEN`

---

### OQ-003: Push Subscription Expiration & Pruning Strategy
- **Description:** When Apple APNs or Google FCM revokes an expired push endpoint, `pywebpush` receives a `410 Gone` or `404 Not Found` response.
- **Why Clarification is Needed:** Prevent persistent delivery attempts to dead push endpoints.
- **Impact:** `ReminderService` and `push_subscriptions` database maintenance.
- **Related Documents:** [NOTIFICATIONS.md](../features/NOTIFICATIONS.md), [DATABASE.md](../technical/DATABASE.md).
- **Proposed Options:**
  1. *Immediate Deletion:* Delete the row from `push_subscriptions` on first receipt of `404` or `410`.
  2. *Soft Flagging:* Mark `active = false` and prune via a monthly background job.
- **Current Working Assumption:** Option 1 (Immediate deletion from `push_subscriptions`).
- **Resolution Status:** `RESOLVED (Working Rule)`
