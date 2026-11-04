# SpendWise — Feature Specification: Spending Analytics

## 1. Overview & Business Objective

Spending Analytics provides users with instant, transparent visibility into their spending patterns. By converting raw transaction ledgers into structured visual reports, SpendWise helps users understand exactly where their money goes without requiring spreadsheet manipulation.

---

## 2. User Stories

- **US-ANA-01:** As a user opening the app, I want to immediately see how much I spent today, this week, and this month so that I maintain constant financial awareness.
- **US-ANA-02:** As a user reviewing my monthly expenses, I want a visual donut chart showing category distribution so that I can identify which categories consume the largest portions of my income.
- **US-ANA-03:** As a user monitoring my habits, I want to see a daily spending trend chart across the month with zero-filled empty days to spot unusual spikes.
- **US-ANA-04:** As a salaried professional receiving income on the 25th of each month, I want my monthly analytics to align with my salary cycle rather than the calendar month.
- **US-ANA-05:** As a visually impaired user, I want an accessible tabular alternative to all graphical charts.

---

## 3. User Flow

```mermaid
flowchart TD
    User([Navigate to Dashboard or /analytics]) --> Fetch[GET /analytics/summary & /analytics/by-category]
    Fetch --> TimeEngine[Backend Core Time Engine]
    TimeEngine --> EvaluateBounds[Compute [start, end) using user timezone & month_start_day]
    EvaluateBounds --> QueryDB[Execute PostgreSQL Aggregations]
    QueryDB --> ZeroFill[Zero-fill missing calendar dates]
    ZeroFill --> RenderUI[Render Donut, Trend, and Summary Cards]
    RenderUI --> TabSwitch{User switches tab?}
    TabSwitch -->|Categories| DrillDown[Show ranked categories + subcategory breakdown]
    TabSwitch -->|Trends| Heatmap[Render daily spending heatmap + period compare]
```

---

## 4. Functional Requirements & Business Logic

### 4.1 Temporal Boundaries & Timezones
- All analytical aggregations are evaluated relative to the user's localized timezone (`users.timezone`, default: `Asia/Kolkata`).
- Reporting ranges use half-open intervals: `[start_utc, end_utc)`.
- If `month_start_day ≠ 1` (e.g., `25`), the monthly aggregation anchors from day 25 of the previous month to day 24 of the current month.

### 4.2 Recharts Visualizations
1. **Category Donut Chart (`PieChart`):**
   - Displays top 5 categories by total spend.
   - Remaining categories are aggregated into an "Others" slice if total categories exceed 6.
   - Slices styled using the database-assigned hex colors.
2. **Daily Trend Chart (`AreaChart` / `BarChart`):**
   - Displays every day in the selected period.
   - Missing days with 0 transactions are **zero-filled** with `{date: "...", sum_minor: 0, count: 0}`.
   - The current day is highlighted with a distinct indicator dot.
3. **Calendar Heatmap:**
   - Visual grid of the active month with cell color intensity scaled logarithmically based on daily spend.

### 4.3 Same-Elapsed-Days Period Comparison
- When comparing "This Month" to "Last Month", the comparison compares **identical elapsed day counts** (e.g., Nov 1–12 vs. Oct 1–12), preventing premature false-negative warnings early in the month.

---

## 5. Data & API Dependencies

- **Database Entities:** [DATABASE.md](../technical/DATABASE.md) — `transactions`, `categories`, `users`.
- **API Endpoints:** [API_SPEC.md](../technical/API_SPEC.md) —
  - `GET /api/v1/analytics/summary`
  - `GET /api/v1/analytics/by-category`
  - `GET /api/v1/analytics/trend`
  - `GET /api/v1/analytics/by-payment-method`
  - `GET /api/v1/analytics/top-merchants`
  - `GET /api/v1/analytics/compare`
  - `GET /api/v1/analytics/heatmap`

---

## 6. Mathematical Invariants & Reconciliations

1. **Sum Reconciliation:**
   $$\text{Summary Total} = \sum (\text{Category Totals}) = \sum (\text{Daily Trend Totals})$$
   Any discrepancy between the dashboard hero number and the sum of transactions is treated as a critical bug.
2. **Paise Accuracy:** All calculations are performed in integer paise. Rupee division occurs strictly at the display formatting layer.

---

## 7. Error Cases & Edge Cases

- **Zero Transactions in Range:** The UI renders an engaging empty state with an "Add Expense" call to action. Charts render neutral empty placeholder rings without throwing NaN errors.
- **Single-Day Spikes:** Extreme outliers (e.g., a one-time ₹85,000 electronics purchase) scale the chart Y-axis gracefully with compact Indian unit labels (`₹5k`, `₹1.2L`).

---

## 8. Testing Scenarios & Acceptance Criteria

1. **Reconciliation Test:** Seed 100 transactions; verify `summary.month.sum_minor` equals the sum of `by-category.items.sum_minor`.
2. **Zero-Fill Test:** Query trend for a 30-day month with transactions on only 3 days; assert response contains exactly 30 data points.
3. **Scalability Benchmark:** Verify all analytics queries return in < 300ms (p95) on a 50,000 transaction dataset.
