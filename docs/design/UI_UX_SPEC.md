# SpendWise — User Interface & User Experience (UI/UX) Specification

## 1. Design Philosophy & Mobile-First Principles

SpendWise is designed from the ground up for the **iPhone** as an installed Progressive Web App (PWA). Rather than shrinking a desktop dashboard down to mobile dimensions, every interaction, gesture, typography choice, and touch target is optimized for one-handed mobile ergonomics.

### 1.1 Core UX Directives
1. **Entry Speed Above All:** The primary user action—logging an expense—must be complete in **5–10 seconds** and within **≤ 3 taps** after typing the amount.
2. **High-Contrast Financial Clarity:** Numbers must be instantly legible in bright sunlight or dark environments. Monospaced tabular numerals (`tabular-nums`) prevent visual jumping during dynamic updates.
3. **No Phantom Keyboard Latency:** The Quick Add screen features an embedded custom 3×4 numeric keypad. The OS virtual keyboard is never invoked for amount entry, eliminating layout reflows and input lag.
4. **Honest Empty States:** Live production dashboards never render simulated sample transactions. When a new user logs in, they are welcomed with a clean, encouraging empty state inviting their first expense.
5. **Touch Ergonomics:** Every interactive element satisfies Apple's Human Interface Guidelines with a minimum hit area of **44 × 44 points**.

---

## 2. Viewports, Layout & Responsive Breakpoints

- **Primary Target Canvas:** iPhone 14/15/16/17 class viewport: **390 × 844 points** (Logical Viewport).
- **Safe Area Insets:** Strict enforcement of `env(safe-area-inset-top)` for status bar padding and `env(safe-area-inset-bottom)` for the iOS Home Indicator bar.
- **Full Viewport Sizing:** Mobile layouts utilize `100dvh` (dynamic viewport height) to prevent clipping caused by mobile address bars.
- **Overscroll Behavior:** `overscroll-behavior-y: none` on fixed containers to eliminate rubber-band bouncing on iOS standalone PWA windows.
- **Desktop Adaptation (≥ 1024 px):**
  - The bottom 5-slot TabBar is replaced with a clean, fixed left sidebar (width 260 px).
  - Main content is centered within a maximum width of `960 px`.
  - The Quick Add screen transforms from a full-screen mobile sheet into a centered modal dialog.

---

## 3. Design System Tokens & Theming

SpendWise implements a semantic design token system using CSS custom properties with native dark mode support (`class` strategy):

### 3.1 Color Palette
| Token | Light Theme | Dark Theme | Purpose |
|---|---|---|---|
| `--bg` | `#F8FAFC` (Slate 50) | `#0B0B12` (Deep Void) | Main canvas background |
| `--surface` | `#FFFFFF` (Pure White) | `#161622` (Card Dark) | Cards, bottom sheets, list containers |
| `--surface-2` | `#F1F5F9` (Slate 100) | `#222234` (Elevated Surface) | Keypad keys, input boxes, chip backgrounds |
| `--text` | `#0F172A` (Slate 900) | `#F8FAFC` (Slate 50) | High-contrast headings and primary labels |
| `--muted` | `#64748B` (Slate 500) | `#94A3B8` (Slate 400) | Secondary metadata, dates, descriptions |
| `--primary` | `#4F46E5` (Indigo 600) | `#6366F1` (Indigo 500) | Primary action buttons, selected chips, active tab |
| `--success` | `#16A34A` (Green 600) | `#22C55E` (Green 500) | Budget OK status, savings indicators |
| `--warning` | `#D97706` (Amber 600) | `#F59E0B` (Amber 500) | Budget warning state (≥80%), pending sync |
| `--danger` | `#DC2626` (Red 600) | `#EF4444` (Red 500) | Budget exceeded (≥100%), delete actions |

### 3.2 Category Color Palette (Seeded from PostgreSQL)
- **Food & Dining:** `#F97316` (Orange)
- **Transportation:** `#3B82F6` (Blue)
- **Groceries:** `#22C55E` (Green)
- **Shopping:** `#A855F7` (Purple)
- **Bills:** `#EAB308` (Yellow)
- **Housing:** `#14B8A6` (Teal)
- **Entertainment:** `#EC4899` (Pink)
- **Healthcare:** `#EF4444` (Red)
- **Travel:** `#06B6D4` (Cyan)
- **Others:** `#64748B` (Slate)

### 3.3 Typography & Sizing
- **Font Stack:** `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", Inter, system-ui, sans-serif`.
- **Numerical Figures:** `font-variant-numeric: tabular-nums` for all transaction amounts, dates, and budget counters.
- **Scale:**
  - Hero Display: `36px` (Font weight: `700`, line height: `44px`)
  - Screen Titles: `22px` (Font weight: `600`)
  - Section Headings: `17px` (Font weight: `600`)
  - Body Text: `15px` (Font weight: `400`)
  - Captions / Metadata: `13px` (Font weight: `400`)
  - Keypad Digits: `26px` (Font weight: `500`)

### 3.4 Elevation & Border Radius
- **Cards & Sheets:** `border-radius: 1.25rem` (`rounded-2xl` = 20 px).
- **Chips & Buttons:** `border-radius: 0.75rem` (`rounded-xl` = 12 px).
- **Keypad Buttons:** `border-radius: 0.875rem` (`rounded-xl` = 14 px).
- **Shadows:** Subtle ambient elevation (`box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.05)` in light mode; subtle borders in dark mode).

---

## 4. Navigation & App Shell Architecture

### 4.1 Bottom TabBar (5 Slots)
The primary navigation anchor on mobile devices is the fixed bottom `TabBar`:
1. **Home (`/`):** Lucide `layout-dashboard` icon. Displays executive spending summaries, charts, and recent activity.
2. **History (`/transactions`):** Lucide `receipt` icon. Searchable, filterable ledger grouped by calendar day.
3. **＋ Add (`/add`):** Prominent, elevated circular button in the center slot with high-contrast primary background (`#4F46E5`). Launches Quick Add full-screen sheet.
4. **Analytics (`/analytics`):** Lucide `pie-chart` icon. Multi-tab analytical breakdown (Overview, Categories, Trends).
5. **More (`/more`):** Lucide `menu` icon. Navigation drawer for Budgets, Recurring, Statement Import, Settings, and Shortcuts.

#### TabBar Visibility Rules:
- **Hidden on:** Quick Add screen (`/add`), authentication screens (`/login`, `/register`), and whenever a native input focuses on desktop.
- **Safe Area Padding:** Extends padding beneath icons using `padding-bottom: env(safe-area-inset-bottom, 16px)`.

---

## 5. Screen Specifications (15 Screens)

### Screen 1: Login (`/login`)
- Clean, focused form centered on the mobile canvas.
- Brand logo: SpendWise minimal wallet/spark glyph.
- Input fields: Email (HTML5 `type="email"`, auto-capitalize none) and Password (with reveal toggle icon).
- Primary button: "Sign In" with active loading spinner.
- Navigation link: "Don't have an account? Sign Up".

### Screen 2: Registration (`/register`)
- Fields: Full Name (optional), Email, Password (with live helper text: minimum 8 characters).
- Primary button: "Create Account".
- Disclaimers: Clear statement stating that SpendWise never reads bank SMS or asks for banking credentials.

### Screen 3: Dashboard (`/`)
- **Top Row:** Personalized greeting ("Good evening, Priya"), active month label ("November 2026"), and month navigation chevron triggers.
- **Hero Card:**
  - Big Monthly Expenses display: `₹18,450`.
  - Sub-row: If a monthly budget is configured, renders a sleek `ProgressBar` indicating `"72% used · ₹5,600 remaining"`. If no budget exists, displays a subtle `"Set a monthly budget"` button.
- **Stat Row (2 Equal Cards):**
  - Today: `₹530` (3 transactions). Tap navigates to History filtered by today.
  - This Week: `₹3,250`. Tap navigates to History filtered by this week.
- **Due Recurring Card (Conditional):** Renders if `/recurring/due` has items. Lists due bills (e.g., "Airtel Broadband · ₹999 due today") with immediate **Confirm** and **Skip** touch triggers.
- **Where is the Money Going? (Category Donut):**
  - Donut chart rendered with Recharts (`innerRadius: 60`, `outerRadius: 85`).
  - Legend below: Top 5 categories with color dot, icon, category name, formatted paise amount, and percentage share.
  - Tapping a category row navigates directly to History filtered by that category.
- **Daily Spending Trend:**
  - Responsive Area/Bar chart illustrating daily spending over the month. Current day is highlighted with a distinct indicator dot and tooltip.
- **Insights Carousel:**
  - Horizontally swipeable carousel containing up to 3 high-priority insights cards (e.g., "Weekend spending is 1.8× higher than weekdays").
- **Recent Transactions:** Last 5 logged transactions with a "View All" footer link.

### Screen 4: Quick Add (`/add`) — The Critical Screen
Designed to fit an **844 px height canvas completely without vertical scrolling**:
```text
┌──────────────────────────────────────────────┐
│  ✕ Close            Add Expense    [Today ▾] │
│                                              │
│                  ₹ 150                       │
│                                              │
│  [Food & Dining*] [Transport] [Shopping] [+] │
│  (Optional subcategory chips: Delivery Cafe) │
│                                              │
│  [ UPI ]  [ Cash ]  [ Card ]  [ NetBanking ] │
│                                              │
│  ▸ + Details (Merchant, Notes)               │
│                                              │
│  ┌─────────┬─────────┬─────────┐             │
│  │    1    │    2    │    3    │             │
│  ├─────────┼─────────┼─────────┤             │
│  │    4    │    5    │    6    │             │
│  ├─────────┼─────────┼─────────┤             │
│  │    7    │    8    │    9    │             │
│  ├─────────┼─────────┼─────────┤             │
│  │    .    │    0    │    ⌫    │             │
│  └─────────┴─────────┴─────────┘             │
│                                              │
│  [             Save ₹150                   ] │
└──────────────────────────────────────────────┘
```
1. **Header:** Left `✕` dismiss button; Title: "Add Expense"; Right Date chip (default: "Today, 2:30 PM"; tapping opens custom date/time picker sheet).
2. **AmountDisplay:** Large prominent amount (`₹150`) with blinking cursor.
3. **Category Chips:** Horizontal scrolling row of top-5 categories ordered by rolling 30-day frequency + a trailing `+` "More" chip. Selected chip receives solid background and icon highlight.
4. **Subcategory Chips (Animated):** Smoothly expand when a parent category with subcategories is tapped.
5. **Payment Method Control:** Segmented control: `UPI` (default) · `Cash` · `Card` · `Bank`.
6. **Collapsible Details:** Expandable drawer for optional merchant text (with autocomplete chips from recent merchants) and notes.
7. **Custom Keypad:** 3×4 grid (`1–9`, `.`, `0`, `⌫`). Long-press on `⌫` clears amount.
8. **Save Button:** Full-width primary button dynamically labeled `Save ₹150`. Disabled when amount is 0 or no category is chosen.

### Screen 5: Transaction History (`/transactions`)
- **Sticky Header:** Search bar with live trigram search input + Filter button with badge indicating active filter count.
- **Filter Sheet:** Bottom sheet containing date range presets (Today, Yesterday, This Week, This Month, Last Month, Custom), category multi-select, payment method filters, and amount range sliders.
- **Day-Grouped List:** Grouped by calendar day with localized headers ("Monday, 2 November · ₹530").
- **Transaction Row:** Category icon, merchant/description (falls back to category name), payment tag, formatted right-aligned amount.
- **Gestures:** Swipe left reveals red "Delete" action. Tapping row opens Detail/Edit sheet.
- **Footer Counter:** Sticky subtle bar showing `"42 transactions · ₹18,450 total"`.

### Screen 6: Transaction Details & Edit (`/transactions/:id`)
- Bottom sheet dialog displaying complete transaction metadata.
- Allows editing: Amount, Category, Subcategory, Merchant, Description, Notes, Payment Method, and Timestamp.
- "Delete Transaction" button at bottom with confirmation dialog.

### Screen 7: Analytics (`/analytics`)
- **Period Filter Bar:** Segmented control: `Week` · `Month` · `Last Month` · `Custom`.
- **Three Core Tabs:**
  1. **Overview:** Total spend, daily average, highest spend day, transaction count, projected month-end spend, payment method breakdown donut, top merchants list.
  2. **Categories:** Ranked category list with spend progress bars; tap expands subcategories and 30-day mini sparkline.
  3. **Trends:** Daily spend bars across month, calendar heatmap of daily expenses, and grouped comparison bars vs. previous period.
- Accessible "Show as Table" button switches view to WCAG-compliant HTML data tables.

### Screen 8: Budgets (`/budgets`)
- **Overall Monthly Budget Card:** Circular progress ring or heavy bar showing spent vs. remaining, percentage, and safe daily spend recommendation (`max(remaining, 0) / days_left`).
- **Category Budgets:** List of category budgets with status badges:
  - `ok` (Green): Spend < alert threshold.
  - `warning` (Amber): Spend ≥ alert threshold.
  - `exceeded` (Red): Spend ≥ 100%.
- Floating action button: "Add Budget" opening category picker, limit amount, and alert threshold slider (50–100%).

### Screen 9: Recurring Expenses (`/recurring`)
- Tabbed list of active rules and upcoming schedule.
- Each rule card shows: Rule name, scheduled amount, recurrence frequency ("Monthly on the 5th"), mode badge (`Auto-Add` vs `Remind Me`), and next due date.
- "+ Add Recurring Rule" bottom sheet supporting common presets (Rent, Electricity, Mobile, Netflix, EMI).

### Screen 10: CSV Statement Import (`/import`)
- 4-step guided wizard:
  1. **Upload:** Drag-and-drop zone on desktop, native file picker on mobile. Supports files ≤ 2 MB.
  2. **Mapping:** Column mapping dropdowns (Date, Narration, Withdrawal/Debit, Deposit/Credit) with live 3-row sample preview.
  3. **Review:** Interactive table showing parsed transactions, suggested category tags, and duplicate detection badges.
  4. **Commit:** Success summary with transaction counts and an immediate "Undo Import" button.

### Screen 11: Export Data (`/import` or `/settings`)
- Export card providing date range selection and format choice:
  - Download Clean CSV (UTF-8 with Excel BOM).
  - Download Multi-Sheet Excel (`.xlsx`) containing Transactions, Category Summary, and Monthly Summary sheets.

### Screen 12: Categories Management (`/settings/categories`)
- Visual category hierarchy tree with drag-and-drop reordering or up/down order buttons.
- Category editor: Name input, Lucide icon selector grid (30+ icons), and curated hex color palette picker.
- "Merchant Rules" sub-panel allowing users to create pattern-based auto-categorization mappings (e.g., `blinkit` → Groceries).

### Screen 13: Settings (`/settings`)
- Profile preferences: Display name, default payment method, timezone selector (searchable IANA list), salary month start day slider (1–28), and week start day (Monday/Sunday).
- Interface: Theme switcher (`System`, `Light`, `Dark`).
- Reminders: Daily logging reminder toggle and time picker (`reminder_time`).
- Account Security: Change Password sheet.
- Danger Zone: "Delete Account" button requiring explicit confirmation dialog.

### Screen 14: Notifications Management (`/settings` or Modal)
- Web Push permission banner: "Enable daily expense reminders on your iPhone".
- Includes interactive "Send Test Notification" trigger to verify device APNs subscription.

### Screen 15: iOS Shortcuts Setup (`/settings/shortcuts`)
- Guided walkthrough for creating an iOS Personal Automation.
- Copyable URL snippets for Mode A prefilled deep links (`https://app.spendwise.in/add?source=shortcut`).
- Mode B Personal API Token generator with single-view token display and copy button.

---

## 6. Feedback & Interaction Micro-Patterns

- **Undo Toast Pattern:** When a transaction is saved or deleted, a floating toast appears at the bottom (above the TabBar) for 5 seconds:
  ```text
  ┌────────────────────────────────────────────────────────┐
  │  ✓ ₹150 added to Food & Dining            [ UNDO ]     │
  └────────────────────────────────────────────────────────┘
  ```
  Tapping **UNDO** immediately rolls back the action via the API or removes the item from the offline queue.
- **Offline / Sync Status Banner:** If connectivity is lost, a persistent, subtle amber banner appears at the very top of the app shell:
  ```text
  ┌────────────────────────────────────────────────────────┐
  │  ⚡ Offline Mode — 2 expenses pending automatic sync   │
  └────────────────────────────────────────────────────────┘
  ```
