# SpendWise — REST API Specification

## 1. Global Conventions & Standards

- **Base Path:** `/api/v1`
- **Protocol:** HTTPS (strictly enforced in production)
- **Data Exchange Format:** `application/json` (except file uploads and binary exports)
- **Date & Time Format:** ISO-8601 strings in UTC (`YYYY-MM-DDTHH:mm:ssZ`)
- **Monetary Attributes:** Always integer paise (`amount_minor` as an integer; ₹150.00 = `15000`)
- **Authentication:** `Authorization: Bearer <access_jwt>` on all protected endpoints.
- **Shortcuts Authentication:** `POST /shortcuts/transactions` accepts either user JWT or personal API token with format `Authorization: Bearer sw_<token>`.
- **User Scoping:** Every authenticated query implicitly filters data to the current authenticated tenant.

---

## 2. Standard Envelopes & HTTP Status Codes

### 2.1 Standard Error Envelope
All `4xx` and `5xx` error responses strictly adhere to the following JSON envelope:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Amount must be greater than 0",
    "fields": {
      "amount_minor": "must be > 0"
    }
  }
}
```

#### Standard Error Codes:
| Code | HTTP Status | Meaning |
|---|---|---|
| `validation_error` | 422 | Request body or query parameters failed Pydantic schema validation. |
| `unauthorized` | 401 | Missing, malformed, or expired access token. |
| `forbidden` | 403 | Insufficient permissions or token scope. |
| `not_found` | 404 | Requested entity does not exist or belongs to another user. |
| `conflict` | 409 | Resource uniqueness violation or category deletion blocked by transactions. |
| `rate_limited` | 429 | Rate limit exceeded (10/min on auth, 120/min on general endpoints). |
| `server_error` | 500 | Unhandled internal server exception. |

### 2.2 Cursor-Based Pagination Contract
All paginated collection endpoints support cursor navigation:
- **Request Parameters:** `?limit=50&cursor=<opaque_base64_string>`
- **Defaults:** Default limit = 50, Maximum limit = 200.
- **Cursor Construction:** Base64-encoded tuple of `(occurred_at, id)`.
- **Response Format:**
```json
{
  "items": [ ... ],
  "next_cursor": "ZXlKaGJHY2lPaUpTVXpVeE1p..."
}
```
If there are no further pages, `next_cursor` is `null`.

### 2.3 Mutation Idempotency
- `POST /transactions` accepts an optional `client_id` (UUIDv4).
- If a client replays an identical `client_id` (e.g., during offline queue sync), the backend returns the **existing transaction record with `200 OK`** instead of raising a `409 Conflict`.

---

## 3. Authentication & User Management

### 3.1 `POST /auth/register`
- **Purpose:** Registers a new individual user account and seeds default categories and rules.
- **Auth:** None (Public).
- **Request Body:**
```json
{
  "email": "priya@example.com",
  "password": "Password123!",
  "name": "Priya Sharma"
}
```
- **Response (201 Created):**
```json
{
  "user": {
    "id": "c1f7a228-4b72-4b24-9b16-56f8f17e3f81",
    "email": "priya@example.com",
    "name": "Priya Sharma",
    "timezone": "Asia/Kolkata",
    "currency": "INR",
    "week_start": 1,
    "month_start_day": 1,
    "default_payment_method": "upi",
    "reminder_enabled": true,
    "reminder_time": "21:00:00",
    "theme": "system"
  },
  "access_token": "eyJhbGciOiJIUzI1Ni...",
  "refresh_token": "e5b871922c069b1d..."
}
```

### 3.2 `POST /auth/login`
- **Purpose:** Authenticates user credentials and issues token pair.
- **Auth:** None (Public). Rate limited to 10 attempts/minute/IP.
- **Request Body:**
```json
{
  "email": "priya@example.com",
  "password": "Password123!"
}
```
- **Response (200 OK):** Same payload structure as `/auth/register`.

### 3.3 `POST /auth/refresh`
- **Purpose:** Rotates refresh token and issues a fresh 15-minute access JWT.
- **Auth:** None.
- **Request Body:**
```json
{
  "refresh_token": "e5b871922c069b1d..."
}
```
- **Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1Ni...",
  "refresh_token": "99df2b89a1c4310a..."
}
```
*Note: The old refresh token is marked revoked immediately. If a revoked token is presented, all refresh tokens for that user are revoked (reuse detection).*

### 3.4 `POST /auth/logout`
- **Purpose:** Revokes the provided refresh token.
- **Auth:** Optional / Public with token payload.
- **Request Body:**
```json
{
  "refresh_token": "99df2b89a1c4310a..."
}
```
- **Response:** `204 No Content`.

### 3.5 `GET /users/me`
- **Purpose:** Fetches the current user profile and settings.
- **Auth:** Bearer Access Token.
- **Response (200 OK):** `User` object.

### 3.6 `PATCH /users/me`
- **Purpose:** Updates preferences (timezone, week start, salary start day, theme).
- **Auth:** Bearer Access Token.
- **Request Body (Partial):**
```json
{
  "month_start_day": 25,
  "theme": "dark",
  "reminder_time": "21:30:00"
}
```
- **Response (200 OK):** Updated `User` object.

### 3.7 `POST /users/me/change-password`
- **Purpose:** Updates user password after verifying current credentials.
- **Auth:** Bearer Access Token.
- **Request Body:**
```json
{
  "current_password": "Password123!",
  "new_password": "NewSecretPassword456!"
}
```
- **Response:** `204 No Content`.

### 3.8 `DELETE /users/me`
- **Purpose:** Hard-deletes the user account and cascades deletion across all transactions, categories, budgets, and tokens.
- **Auth:** Bearer Access Token.
- **Request Body:**
```json
{
  "password": "Password123!"
}
```
- **Response:** `204 No Content`.

---

## 4. Categories Endpoints

### 4.1 `GET /categories`
- **Purpose:** Returns the complete 2-level category tree with 30-day usage counts.
- **Query Parameters:** `?include_archived=false` (boolean, default false)
- **Response (200 OK):**
```json
[
  {
    "id": "e4b6d391-72a3-4a12-8e12-32a101b44011",
    "name": "Food & Dining",
    "icon": "utensils",
    "color": "#F97316",
    "sort_order": 0,
    "is_default": true,
    "archived_at": null,
    "usage_count_30d": 42,
    "children": [
      {
        "id": "f5c7e492-83b4-5b23-9f23-43b202c55122",
        "name": "Restaurant",
        "icon": "utensils",
        "color": "#F97316",
        "sort_order": 0,
        "is_default": true,
        "archived_at": null,
        "usage_count_30d": 18
      }
    ]
  }
]
```

### 4.2 `POST /categories`
- **Purpose:** Creates a new custom category or subcategory (depth ≤ 2).
- **Request Body:**
```json
{
  "name": "Gym & Fitness",
  "icon": "dumbbell",
  "color": "#10B981",
  "parent_id": null
}
```
- **Response (201 Created):** Created Category object.

### 4.3 `PATCH /categories/{id}`
- **Purpose:** Renames, re-colors, re-orders, or archives a category.
- **Request Body:** Partial Category fields.
- **Response (200 OK):** Updated Category object.

### 4.4 `DELETE /categories/{id}`
- **Purpose:** Deletes an unused custom category, or reassigns transactions before deleting.
- **Query Parameters:** `?reassign_to=<target_category_uuid>`
- **Errors:** Returns `409 Conflict` if transactions reference this category and `reassign_to` is omitted. Default seeded categories cannot be deleted; they return `400 Bad Request` suggesting archival.

### 4.5 `GET /categories/suggest`
- **Purpose:** Resolves category suggestions for a given merchant string.
- **Query Parameters:** `?merchant=uber`
- **Response (200 OK):**
```json
{
  "category_id": "b2c3d4e5-6789-40ab-cdef-0123456789ab",
  "subcategory_id": "c3d4e5f6-789a-41bc-def0-123456789abc",
  "confidence": "rule"
}
```
*Note: Confidence can be `"rule"`, `"history"`, or `null`.*

---

## 5. Transactions Endpoints

### 5.1 `POST /transactions`
- **Purpose:** Creates a new expenditure record.
- **Request Body:**
```json
{
  "amount_minor": 15000,
  "category_id": "e4b6d391-72a3-4a12-8e12-32a101b44011",
  "subcategory_id": "f5c7e492-83b4-5b23-9f23-43b202c55122",
  "merchant": "Saravana Bhavan",
  "description": "Lunch with team",
  "notes": "Paid via GPay split",
  "payment_method": "upi",
  "occurred_at": "2026-11-02T13:30:00Z",
  "client_id": "550e8400-e29b-41d4-a716-446655440000",
  "source": "manual"
}
```
- **Validation:**
  - `amount_minor` must be > 0 and ≤ 1,000,000,000 paise (₹10 crore).
  - `occurred_at` cannot be > current UTC time + 5 minutes.
  - `subcategory_id` must have `parent_id == category_id`.
- **Response:** `201 Created` (or `200 OK` on idempotent `client_id` replay).

### 5.2 `GET /transactions`
- **Purpose:** Fetches cursor-paginated transactions matching filter parameters.
- **Query Parameters:**
  - `q`: Search string (trigram match against merchant, description, notes).
  - `from`: Start date (`YYYY-MM-DD`, user timezone, inclusive).
  - `to`: End date (`YYYY-MM-DD`, user timezone, inclusive).
  - `category_id`: Top-level category filter.
  - `subcategory_id`: Specific child category filter.
  - `payment_method`: Repeatable filter (`?payment_method=upi&payment_method=cash`).
  - `min_amount_minor`: Minimum paise.
  - `max_amount_minor`: Maximum paise.
  - `source`: Transaction source enum.
  - `sort`: `date_desc` (default), `date_asc`, `amount_desc`, `amount_asc`.
  - `cursor`: Opaque pagination token.
  - `limit`: Integer (1–200, default 50).
- **Response (200 OK):**
```json
{
  "items": [
    {
      "id": "7b8e192c-829d-4819-bf91-9281a8b172a3",
      "amount_minor": 15000,
      "category": {
        "id": "e4b6d391-72a3-4a12-8e12-32a101b44011",
        "name": "Food & Dining",
        "icon": "utensils",
        "color": "#F97316"
      },
      "subcategory": {
        "id": "f5c7e492-83b4-5b23-9f23-43b202c55122",
        "name": "Restaurant"
      },
      "merchant": "Saravana Bhavan",
      "description": "Lunch with team",
      "notes": null,
      "payment_method": "upi",
      "occurred_at": "2026-11-02T13:30:00Z",
      "source": "manual",
      "client_id": "550e8400-e29b-41d4-a716-446655440000",
      "created_at": "2026-11-02T13:30:05Z",
      "updated_at": "2026-11-02T13:30:05Z"
    }
  ],
  "next_cursor": "ZXlKaGJHY2lPaUpTVXp...",
  "totals": {
    "count": 142,
    "sum_minor": 3284500
  }
}
```

### 5.3 `GET /transactions/{id}`
- **Response (200 OK):** Single `Transaction` entity.

### 5.4 `PATCH /transactions/{id}`
- **Purpose:** Updates amount, category, merchant, description, notes, or payment method.
- **Response (200 OK):** Updated `Transaction` entity.

### 5.5 `DELETE /transactions/{id}`
- **Purpose:** Soft-deletes a transaction setting `deleted_at = now()`.
- **Response:** `204 No Content`.

### 5.6 `POST /transactions/{id}/restore`
- **Purpose:** Reverses soft-deletion, setting `deleted_at = null` (used by Undo toast).
- **Response (200 OK):** Restored `Transaction` entity.

### 5.7 `POST /transactions/bulk-delete`
- **Purpose:** Soft-deletes up to 200 transactions simultaneously.
- **Request Body:** `{"ids": ["uuid-1", "uuid-2"]}`
- **Response (200 OK):** `{"deleted": 2}`

### 5.8 `GET /transactions/recent-merchants`
- **Purpose:** Returns up to 10 distinct recently logged merchants with last used category.
- **Response (200 OK):**
```json
[
  {
    "merchant": "Swiggy",
    "last_category_id": "e4b6d391-72a3-4a12-8e12-32a101b44011",
    "last_subcategory_id": "f5c7e492-83b4-5b23-9f23-43b202c55122"
  }
]
```

---

## 6. Analytics Endpoints

*Note: All analytical aggregations evaluate temporal bounds within the user's localized timezone and `month_start_day`.*

### 6.1 `GET /analytics/summary`
- **Purpose:** Supplies the primary executive dashboard summary cards.
- **Response (200 OK):**
```json
{
  "today": { "sum_minor": 53000, "count": 3 },
  "week": { "sum_minor": 325000, "count": 14 },
  "month": { "sum_minor": 1845000, "count": 68 },
  "month_budget": {
    "amount_minor": 2500000,
    "spent_minor": 1845000,
    "remaining_minor": 655000,
    "pct_used": 73.8
  },
  "avg_daily_minor": 61500,
  "projected_month_minor": 2240000
}
```

### 6.2 `GET /analytics/by-category`
- **Query Parameters:** `?period=month` (or `?from=...&to=...`)
- **Response (200 OK):**
```json
{
  "total_minor": 1845000,
  "items": [
    {
      "category_id": "e4b6d391-72a3-4a12-8e12-32a101b44011",
      "name": "Food & Dining",
      "icon": "utensils",
      "color": "#F97316",
      "sum_minor": 620000,
      "count": 28,
      "pct": 33.6,
      "children": [
        {
          "subcategory_id": "f5c7e492-83b4-5b23-9f23-43b202c55122",
          "name": "Delivery",
          "sum_minor": 380000,
          "pct": 61.3
        }
      ]
    }
  ]
}
```

### 6.3 `GET /analytics/trend`
- **Query Parameters:** `?granularity=day&from=2026-11-01&to=2026-11-30`
- **Response (200 OK):**
```json
{
  "points": [
    { "date": "2026-11-01", "sum_minor": 120000, "count": 4 },
    { "date": "2026-11-02", "sum_minor": 53000, "count": 3 },
    { "date": "2026-11-03", "sum_minor": 0, "count": 0 }
  ]
}
```
*Note: Missing calendar days are automatically zero-filled.*

### 6.4 `GET /analytics/by-payment-method`
- **Response (200 OK):**
```json
{
  "items": [
    { "payment_method": "upi", "sum_minor": 1420000, "count": 55, "pct": 77.0 },
    { "payment_method": "card", "sum_minor": 325000, "count": 6, "pct": 17.6 },
    { "payment_method": "cash", "sum_minor": 100000, "count": 7, "pct": 5.4 }
  ]
}
```

### 6.5 `GET /analytics/top-merchants`
- **Query Parameters:** `?limit=5`
- **Response (200 OK):**
```json
{
  "items": [
    { "merchant": "Swiggy", "sum_minor": 245000, "count": 12 },
    { "merchant": "Blinkit", "sum_minor": 182000, "count": 8 }
  ]
}
```

### 6.6 `GET /analytics/compare`
- **Query Parameters:** `?period=month`
- **Response (200 OK):**
```json
{
  "current_minor": 1845000,
  "previous_minor": 1620000,
  "delta_minor": 225000,
  "delta_pct": 13.9,
  "by_category": [
    {
      "category_id": "e4b6d391-72a3-4a12-8e12-32a101b44011",
      "name": "Food & Dining",
      "current_minor": 620000,
      "previous_minor": 525400,
      "delta_minor": 94600,
      "delta_pct": 18.0
    }
  ]
}
```

---

## 7. Budgets Endpoints

### 7.1 `GET /budgets`
- **Purpose:** Fetches all active budgets with live spending status.
- **Response (200 OK):**
```json
[
  {
    "id": "18a72b3c-9418-491a-b182-9a81c19b2831",
    "category": null,
    "period": "monthly",
    "amount_minor": 2000000,
    "spent_minor": 1440000,
    "remaining_minor": 560000,
    "pct_used": 72.0,
    "status": "ok",
    "alert_threshold_pct": 80,
    "days_left": 18,
    "safe_daily_minor": 31111
  }
]
```

### 7.2 `PUT /budgets`
- **Purpose:** Upserts an overall or category-specific budget.
- **Request Body:**
```json
{
  "category_id": null,
  "period": "monthly",
  "amount_minor": 2500000,
  "alert_threshold_pct": 80
}
```
- **Response (200 OK):** Upserted Budget entity.

### 7.3 `DELETE /budgets/{id}`
- **Response:** `204 No Content`.

---

## 8. Recurring Expenses Endpoints

### 8.1 `GET /recurring`
- **Purpose:** Returns all recurring expense rules.
- **Response (200 OK):** Array of RecurringRule objects with `next_due_date` and upcoming dates.

### 8.2 `POST /recurring`
- **Purpose:** Creates a recurring expense rule.
- **Request Body:**
```json
{
  "name": "Airtel Fiber Broadband",
  "amount_minor": 99900,
  "category_id": "eab30800-0000-0000-0000-000000000000",
  "frequency": "monthly",
  "interval_count": 1,
  "day_of_month": 15,
  "start_date": "2026-11-01",
  "mode": "remind"
}
```
- **Response (201 Created):** Created RecurringRule object.

### 8.3 `GET /recurring/due`
- **Purpose:** Returns recurring rules in `remind` mode where `next_due_date <= today` (drives the Dashboard action card).

### 8.4 `POST /recurring/{id}/confirm`
- **Purpose:** Confirms payment, creating a transaction and advancing `next_due_date`.
- **Request Body:** `{"amount_minor": 99900, "occurred_at": "2026-11-15T10:00:00Z"}`
- **Response (201 Created):** Created Transaction object.

### 8.5 `POST /recurring/{id}/skip`
- **Purpose:** Skips the current cycle without creating a transaction, advancing `next_due_date`.
- **Response (200 OK):** Updated RecurringRule object.

---

## 9. Statement Import & Export Endpoints

### 9.1 `POST /imports`
- **Purpose:** Uploads a CSV statement file (≤ 2 MB, ≤ 5,000 rows).
- **Request Content-Type:** `multipart/form-data` (form field: `file`)
- **Response (200 OK):**
```json
{
  "batch_id": "a918b2c3-4d5e-6f70-8192-a1b2c3d4e5f6",
  "filename": "hdfc_nov2026.csv",
  "headers": ["Date", "Narration", "Chq/Ref No", "Value Dt", "Withdrawal Amt", "Deposit Amt", "Closing Balance"],
  "sample_rows": [
    ["02/11/2026", "UPI-SWIGGY-123456@icici", "6308129", "02/11/2026", "240.00", "", "48200.50"]
  ],
  "suggested_mapping": {
    "date": "Date",
    "description": "Narration",
    "amount": null,
    "debit": "Withdrawal Amt",
    "credit": "Deposit Amt"
  },
  "detected": {
    "delimiter": ",",
    "encoding": "utf-8",
    "date_format": "DD/MM/YYYY"
  }
}
```

### 9.2 `POST /imports/{id}/preview`
- **Purpose:** Evaluates parsed rows against mapped columns, auto-suggests categories, and flags duplicate transactions.
- **Request Body:**
```json
{
  "mapping": {
    "date": "Date",
    "description": "Narration",
    "debit": "Withdrawal Amt",
    "credit": "Deposit Amt"
  },
  "date_format": "DD/MM/YYYY",
  "amount_mode": "debit_credit",
  "skip_credits": true
}
```
- **Response (200 OK):**
```json
{
  "rows": [
    {
      "row_no": 1,
      "date": "2026-11-02",
      "amount_minor": 24000,
      "description": "UPI-SWIGGY-123456@icici",
      "payment_method": "upi",
      "suggested_category_id": "e4b6d391-72a3-4a12-8e12-32a101b44011",
      "suggested_subcategory_id": "f5c7e492-83b4-5b23-9f23-43b202c55122",
      "is_duplicate": false,
      "duplicate_of_txn_id": null,
      "error": null
    }
  ],
  "stats": {
    "total": 45,
    "valid": 42,
    "duplicates": 3,
    "errors": 0
  }
}
```

### 9.3 `POST /imports/{id}/commit`
- **Purpose:** Atomically commits chosen rows to the `transactions` table.
- **Request Body:**
```json
{
  "rows": [
    {
      "row_no": 1,
      "category_id": "e4b6d391-72a3-4a12-8e12-32a101b44011",
      "subcategory_id": "f5c7e492-83b4-5b23-9f23-43b202c55122",
      "include": true
    }
  ],
  "skip_duplicates": true
}
```
- **Response (200 OK):**
```json
{
  "imported": 42,
  "skipped": 3,
  "duplicates": 3
}
```

### 9.4 `DELETE /imports/{id}`
- **Purpose:** Reverses an import batch, soft-deleting all associated transactions.
- **Response:** `204 No Content`.

### 9.5 `GET /exports/transactions.csv` & `GET /exports/transactions.xlsx`
- **Purpose:** Downloads transaction history in CSV or multi-sheet Excel format. Supports all filter query parameters from `GET /transactions`.
- **Response:** Binary download with appropriate `Content-Disposition: attachment`.

---

## 10. Rule-Based Insights Endpoints

### 10.1 `GET /insights`
- **Purpose:** Evaluates 11 deterministic spending rules and returns prioritized insights.
- **Response (200 OK):**
```json
{
  "items": [
    {
      "id": "top_category",
      "kind": "category_distribution",
      "severity": "info",
      "title": "Top Spending Category",
      "body": "Food & Dining is your biggest category this month: ₹6,200 (34%).",
      "data": { "category_id": "...", "amount_minor": 620000, "pct": 34.0 },
      "generated_for": "2026-11"
    },
    {
      "id": "weekend_spike",
      "kind": "spending_pattern",
      "severity": "warning",
      "title": "Weekend Spending Spike",
      "body": "You spend 1.8× more per day on weekends compared to weekdays.",
      "data": { "multiplier": 1.8 },
      "generated_for": "2026-11"
    }
  ]
}
```

---

## 11. Push Notifications, API Tokens & iOS Shortcuts

### 11.1 `GET /push/vapid-public-key`
- **Response (200 OK):** `{"public_key": "BEl62iUYgUivxIkv..."}`

### 11.2 `POST /push/subscribe`
- **Request Body:**
```json
{
  "endpoint": "https://web.push.apple.com/QCp1...",
  "keys": {
    "p256dh": "BNcRdreHz...",
    "auth": "tB3rL5..."
  }
}
```
- **Response (201 Created):** Subscription confirmation.

### 11.3 `POST /push/test`
- **Purpose:** Sends an immediate test notification to the user's registered devices.
- **Response (200 OK):** `{"sent": 1, "failed": 0}`

### 11.4 `GET /api-tokens` & `POST /api-tokens`
- **POST Request Body:** `{"name": "iPhone 17 Shortcut"}`
- **Response (201 Created):**
```json
{
  "id": "89ab12cd-34ef-5678-90ab-cdef12345678",
  "name": "iPhone 17 Shortcut",
  "token": "sw_a7b9c8d1e2f3a4b5c6d7e8f901234567",
  "last4": "4567",
  "scopes": ["transactions:create"],
  "created_at": "2026-11-02T14:00:00Z"
}
```
*Note: The plaintext `token` is shown **only once** upon creation.*

### 11.5 `POST /shortcuts/transactions`
- **Purpose:** High-velocity endpoint designed for headless iOS Shortcuts logging.
- **Auth:** `Authorization: Bearer sw_<api_token>` or standard user JWT.
- **Request Body:**
```json
{
  "amount": "150",
  "category": "Food & Dining",
  "merchant": "Saravana Bhavan",
  "payment_method": "upi",
  "note": "Breakfast"
}
```
- **Response (201 Created):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "message": "₹150 added to Food & Dining"
}
```

---

## 12. Health Check

### 12.1 `GET /health`
- **Auth:** Public.
- **Response (200 OK):**
```json
{
  "status": "ok",
  "db": "ok"
}
```
