# SpendWise — Engineering & Coding Standards

This document establishes the mandatory engineering standards, coding conventions, architectural boundaries, and code quality expectations for all contributors and autonomous AI coding agents working on the SpendWise codebase.

---

## 1. General Principles

1. **SOLID Design:** Single responsibility per module, open for extension, interface segregation, and dependency inversion.
2. **DRY (Don't Repeat Yourself):** Reusable business logic (e.g., date boundary math, money formatting) must be written once in core utilities and shared everywhere.
3. **Explicit over Clever:** Write readable, self-documenting code. Avoid opaque abstractions, metaclass trickery, or convoluted type gymnastics.
4. **Strict Typing Everywhere:** Both backend (Python with `mypy --strict`) and frontend (TypeScript with `"strict": true`) enforce full type coverage. No `any` in TypeScript; no untyped functions in Python.
5. **No Hardcoded Secrets or Magical Numbers:** All configurable thresholds (e.g., alert percentage 80%, access token TTL 15 mins, max CSV rows 5000) must be defined as named constants or environment settings.
6. **Component Size Limit:** Keep React components under 250 lines. Decompose large components into focused subcomponents or custom hooks.

---

## 2. Backend Standards (Python 3.12 / FastAPI)

### 2.1 Typing & Static Analysis
- **Strict Typing:** All function arguments and return types must be fully annotated.
- **Tools:** Checked via `mypy --strict` and `ruff check`.
- **Modern Syntax:** Use Python 3.12 union syntax (`int | None` instead of `Optional[int]`, `list[str]` instead of `List[str]`).
- **Pydantic Types:** Use `Annotated` with Pydantic constraints for request validation:
  ```python
  from typing import Annotated
  from pydantic import BaseModel, Field

  class TransactionCreate(BaseModel):
      amount_minor: Annotated[int, Field(gt=0, le=1_000_000_000, description="Amount in paise")]
      category_id: uuid.UUID
      merchant: str | None = Field(default=None, max_length=100)
  ```

### 2.2 Layered Architecture & Separation of Concerns
1. **API Router Layer (`app/api/v1/`):**
   - Must be **thin**.
   - Responsible strictly for HTTP parameter parsing, invoking dependency injection (`deps.py`), passing validated models to the service layer, and returning response envelopes.
   - **PROHIBITED:** Writing raw SQL queries, executing direct database commits, or implementing business calculations inside router functions.
2. **Service Layer (`app/services/`):**
   - Contains all business logic (budget alerts, category suggestions, recurring date math).
   - Functions accept plain Python primitives, Pydantic schemas, or SQLAlchemy models.
   - **PROHIBITED:** Importing `fastapi`, `Request`, or `Response` inside service modules.
3. **Persistence Layer (`app/models/`):**
   - Declarative SQLAlchemy 2.0 models.
   - Explicit column constraints, indexes, and relationship definitions.

### 2.3 SQLAlchemy 2.0 Async Conventions
- Use the modern 2.0 `select()` syntax exclusively. Avoid legacy 1.x `query()` constructs.
- Always execute queries asynchronously using `await session.execute(...)` or `await session.scalars(...)`.
- Avoid lazy loading in async contexts (which triggers `MissingGreenlet` errors). Explicitly specify eager joins using `selectinload` or `joinedload`:
  ```python
  stmt = (
      select(Transaction)
      .options(selectinload(Transaction.category), selectinload(Transaction.subcategory))
      .where(Transaction.user_id == user_id, Transaction.deleted_at.is_(None))
  )
  ```
- All database mutations (`INSERT`, `UPDATE`, `DELETE`) must be committed via explicit session transactions.

### 2.4 Dependency Injection (`deps.py`)
- Standard dependencies:
  - `get_db`: Yields an `AsyncSession` scoped to the request lifecycle with automatic rollback on unhandled exceptions.
  - `get_current_user`: Validates the `Authorization: Bearer <token>` header, decodes JWT, and returns the authenticated `User` record.
  - `get_shortcut_user`: Accepts either a user JWT or a personal API token (`sw_...`) for iOS Shortcut routes.

### 2.5 Naming Conventions (Python)
- **Files & Packages:** `snake_case.py` (e.g., `csv_import.py`, `transactions.py`).
- **Classes:** `PascalCase` (e.g., `TransactionService`, `BudgetPeriodEnum`).
- **Functions & Variables:** `snake_case` (e.g., `calculate_budget_status`, `amount_minor`).
- **Constants:** `UPPER_SNAKE_CASE` (e.g., `DEFAULT_TIMEZONE = "Asia/Kolkata"`).

---

## 3. Frontend Standards (React 18 / TypeScript / Tailwind)

### 3.1 TypeScript & Type Safety
- `"strict": true` in `tsconfig.json`.
- Never use `any`. If a type is genuinely unknown (e.g., external CSV rows), use `unknown` and narrow with type guards or Zod schemas.
- Explicitly type React component props using interfaces or type aliases:
  ```typescript
  interface KeypadProps {
    value: string;
    onChange: (nextValue: string) => void;
    onSave: () => void;
    disabled?: boolean;
  }
  ```

### 3.2 Component Responsibilities & Ergonomics
- **UI Components (`src/components/`):** Pure presentation components (e.g., `Button`, `Keypad`, `Chip`, `Sheet`). They must not make direct API calls or import TanStack Query hooks.
- **Feature Modules (`src/features/`):** Domain containers coordinating business state, calling custom query hooks, and assembling UI components.
- **Accessibility:**
  - Every interactive element must provide an accessible name (`aria-label` or visible text).
  - Minimum touch target: **44 × 44 pixels** on mobile.
  - Form inputs must have matching `<label>` elements or `aria-label` tags.

### 3.3 Data Fetching & TanStack React Query Conventions
- Wrap all network operations in custom hooks inside `features/<domain>/use<Entity>.ts`:
  ```typescript
  export function useTransactions(filters: TransactionFilters) {
    return useQuery({
      queryKey: ['transactions', filters],
      queryFn: () => api.transactions.list(filters),
      staleTime: 15_000,
    });
  }
  ```
- **Query Invalidation:** Any mutation (`useCreateTransaction`, `useDeleteTransaction`) must invalidate affected queries:
  ```typescript
  queryClient.invalidateQueries({ queryKey: ['transactions'] });
  queryClient.invalidateQueries({ queryKey: ['summary'] });
  queryClient.invalidateQueries({ queryKey: ['analytics'] });
  ```

### 3.4 Styling & Design System (Tailwind CSS)
- Style strictly with Tailwind utility classes and predefined design tokens. Avoid arbitrary ad-hoc inline styles (`style={{ ... }}`).
- Use CSS variables for semantic theme colors (`bg-surface`, `text-primary`, `border-muted`).
- Ensure all text and borders support dark mode via the `dark:` variant or CSS variables.

### 3.5 Naming Conventions (Frontend)
- **Component Files:** `PascalCase.tsx` (e.g., `Keypad.tsx`, `TransactionRow.tsx`).
- **Utility & Hook Files:** `camelCase.ts` (e.g., `useTransactions.ts`, `money.ts`, `api.ts`).
- **Components:** `PascalCase` (e.g., `function QuickAddSheet()`).
- **Functions & Variables:** `camelCase` (e.g., `formatINR`, `selectedCategoryId`).
- **Types & Interfaces:** `PascalCase` (e.g., `Transaction`, `BudgetStatus`).

---

## 4. Financial Calculation Hygiene

To prevent financial drift and calculation bugs:
1. **Never use floats:**
   - Prohibited in Python: `float(amount) / 100`
   - Allowed in Python: `amount_minor // 100` (for rupees), `amount_minor % 100` (for paise)
2. **Frontend Monetary Conversion:**
   - User inputs `"150.50"` → `parseRupeesToMinor("150.50")` produces `15050`.
   - Stored paise `15050` → `formatINR(15050)` produces `"₹150.50"`.
3. **Automated Grep Enforcement:**
   - The test suite includes an automated grep test that scans backend `services/` and rejects the usage of `float` in financial calculation paths.

---

## 5. Git & Version Control Hygiene

- **Branching:** Work in feature branches (`feat/quick-add`, `fix/import-dates`).
- **Commit Messages:** Follow the Conventional Commits specification:
  - `feat: implement custom numeric keypad for quick add`
  - `fix: clamp monthly recurring dates to month length`
  - `test: add user isolation tests for budget endpoints`
  - `docs: update API spec for transaction pagination`
- **Milestone Commits:** Every completed development milestone must be tagged with a clean commit referencing the milestone ID (e.g., `release: milestone M1 - database and auth complete`).
