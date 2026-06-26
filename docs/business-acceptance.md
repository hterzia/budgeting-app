# Business Acceptance Criteria

This document defines the business acceptance criteria for the Budgeting App. Each feature area lists the acceptance criteria that must be satisfied for the feature to be considered complete and production-ready.

---

## 1. CSV Import

### 1.1 File Upload

- [ ] User can open the import modal from the navbar "Import" button
- [ ] User can upload a `.csv` file via click-to-browse file picker
- [ ] User can upload a `.csv` file via drag-and-drop onto the drop zone
- [ ] Only `.csv` files are accepted; other file types are rejected
- [ ] Drop zone shows visual feedback (color/border change) when a file is dragged over it
- [ ] After selecting a file, the file name is displayed in the upload area

### 1.2 Bank Template Auto-Detection

- [ ] The system automatically detects the bank template from the CSV headers
- [ ] Supported templates: Chase Credit Card, Chase Checking, Amex Credit Card, Bank of America Credit Card, Bank of America Checking/Savings, Revolut, Wells Fargo, Standard CSV
- [ ] When a template is detected, the template name is displayed as a badge/pill in the upload area
- [ ] When multiple templates match the headers, the most specific match (most headers) is selected
- [ ] When no template matches, the system falls back to generic column name matching (Date, Amount, Description, etc.)
- [ ] Template detection occurs immediately upon file selection, before the user clicks Import

### 1.3 Account Selection

- [ ] User must select an account before importing
- [ ] A dropdown lists all existing accounts with their type in parentheses (e.g., "Main Checking (Checking)")
- [ ] User can create a new account inline via the "+ Create new account" link
- [ ] Account creation requires a non-empty name; the add button is disabled for empty names
- [ ] Account type is selectable via segmented toggle: Checking, Savings, Credit Card
- [ ] If no accounts exist, the account creation form is shown automatically
- [ ] Newly created accounts appear immediately in the dropdown and are auto-selected

### 1.4 Import Processing

- [ ] The Import button is disabled until both an account and file are selected
- [ ] The Import button shows "Importing..." text and is disabled during import
- [ ] Zero-amount rows in the CSV are filtered out and not imported
- [ ] Completely empty rows in the CSV are filtered out
- [ ] Negative amounts in the CSV are stored as positive values with type `expense`
- [ ] Positive amounts in the CSV are stored with type `income`
- [ ] All imported transactions default to category `uncategorized`
- [ ] A success toast displays the count of transactions added and skipped
- [ ] An error toast is displayed if the import fails
- [ ] The modal closes automatically on successful import

### 1.5 Deduplication

- [ ] Importing the same CSV file twice to the same account does not create duplicate transactions
- [ ] Deduplication is based on a fingerprint of: account ID, date, merchant (case-insensitive, trimmed), and amount
- [ ] The success toast shows the number of skipped (duplicate) transactions separately from added transactions
- [ ] Importing the same CSV to a different account creates new transactions (deduplication is account-scoped)

### 1.6 Date Parsing

- [ ] Dates in `MM/DD/YYYY` format are parsed correctly
- [ ] Dates in `YYYY-MM-DD` format are parsed correctly
- [ ] If a date cannot be parsed, the current date is used as a fallback

---

## 2. Dashboard Overview

### 2.1 Layout

- [ ] The dashboard displays on a single page with no routing/navigation required
- [ ] A sticky top navigation bar shows the app title, Import button, and date range selector
- [ ] Below the nav bar: a row of three summary cards, a two-column grid (category chart + trends chart), and a full-width transaction table
- [ ] A loading spinner with "Loading budget data..." text is shown while data is being fetched from the database

### 2.2 Date Range Filtering

- [ ] All dashboard components (summary cards, charts, transaction table) reflect the currently selected date range
- [ ] The nav bar displays a human-readable label for the selected date range (e.g., "Mar 1, 2026 - Mar 31, 2026")
- [ ] When no transactions exist in the selected range, "No data" is displayed in the date range label

---

## 3. Date Range Selector

### 3.1 Preset Ranges

- [ ] Quick-select presets are available: Current Month, Last 30 Days, Last 90 Days, Last 6 Months, All Time
- [ ] The active preset is visually highlighted (blue background)
- [ ] Selecting a preset immediately filters all dashboard data
- [ ] "Current Month" returns data from the first day to the last day of the current calendar month
- [ ] "Last 30 Days" returns data from 30 days ago to today
- [ ] "Last 90 Days" returns data from 90 days ago to today
- [ ] "Last 6 Months" returns data from 6 months ago to today
- [ ] "All Time" returns all data (from Jan 1, 2000 to now)
- [ ] Default selection on app load is "Current Month"

### 3.2 Custom Calendar Range

- [ ] A full month calendar is displayed within the date range dropdown
- [ ] Navigation arrows allow moving between months (previous/next)
- [ ] Clicking a day sets it as the start date of a custom range
- [ ] Clicking a second day sets it as the end date
- [ ] The start date is shown with a blue circle (rounded left), the end date with a blue circle (rounded right)
- [ ] Days between start and end are shown with a light blue background
- [ ] If the second click is on or before the start date, the selection resets and starts from the new date
- [ ] Single-day ranges (less than 24 hours) are not allowed; the Apply button does nothing
- [ ] An "Apply" button appears only when both start and end dates are selected
- [ ] The selected range section shows the formatted dates and the number of days in the period
- [ ] When only a start date is selected, a hint is shown: "Click another date to complete the selection"
- [ ] Selecting a preset clears any custom calendar selection
- [ ] Clicking outside the dropdown (on the overlay) closes it

---

## 4. Spending Summary Cards

### 4.1 Income Card

- [ ] Displays total income (sum of all transactions with type `income`) formatted as USD currency
- [ ] Shown in green
- [ ] Ignored transactions are excluded from the total

### 4.2 Expenses Card

- [ ] Displays net expenses (expenses minus refunds) formatted as USD currency
- [ ] Shown in red
- [ ] If refunds exist, shows a parenthetical note: "(after $X in refunds)"
- [ ] Ignored transactions are excluded from the total

### 4.3 Savings Card

- [ ] Displays savings (income minus net expenses) formatted as USD currency
- [ ] Shown in blue if savings is positive, red if negative
- [ ] Displays the savings rate as a percentage below the amount (savings / income \* 100)
- [ ] If income is zero, savings rate displays as 0%
- [ ] Ignored transactions are excluded from the calculation

---

## 5. Spending by Category Chart

### 5.1 Data Rules

- [ ] Displays a horizontal bar chart of expenses grouped by category
- [ ] Ignored transactions are excluded
- [ ] Transfer-type transactions are excluded
- [ ] Refunds subtract from their respective category total
- [ ] Categories with a net total of zero or less are not displayed
- [ ] Categories are sorted by amount descending (largest spending category first)

### 5.2 Display

- [ ] Category names are resolved from the categories database; falls back to raw category ID if not found
- [ ] Amounts on the X-axis and in tooltips are formatted as USD currency
- [ ] The chart subtitle shows the active date range preset label (e.g., "Current Month")
- [ ] Amounts are rounded to the nearest integer for display

---

## 6. Trends Chart

### 6.1 Granularity Selection

- [ ] For date ranges under 90 days, the chart uses daily granularity (one data point per day)
- [ ] For date ranges of 90 days or more, the chart uses monthly granularity (one data point per month)
- [ ] Granularity selection is automatic based on the date range; no manual toggle

### 6.2 Line Data

- [ ] Three lines are plotted: Income (green), Expenses (red), Net (blue)
- [ ] Net is calculated as Income minus Expenses for each data point
- [ ] Ignored transactions are excluded from all lines
- [ ] Transfer-type transactions are excluded from all lines
- [ ] Refunds subtract from expenses (not added to income)
- [ ] Every day/month in the range has a data point, even if there are no transactions (cumulative carry-forward)

### 6.3 Cumulative Toggle

- [ ] A toggle switch allows the user to switch between "Monthly" (calendar) and "Running" cumulative mode
- [ ] The current mode label ("Monthly" or "Running") is displayed next to the toggle
- [ ] **Calendar mode (daily):** Cumulative totals reset at each month boundary
- [ ] **Calendar mode (monthly):** Each month shows its standalone totals (no accumulation)
- [ ] **Running mode (daily):** Totals accumulate continuously across the entire date range without resetting
- [ ] **Running mode (monthly):** Totals accumulate across months

---

## 7. Transaction List

### 7.1 Table Columns

- [ ] The table displays columns: Date, Merchant, Category, Amount, Type, and an action column (Ignore/Unignore)
- [ ] Dates are formatted as "Mon DD, YYYY" (e.g., "Mar 6, 2026")
- [ ] Amounts are shown as absolute values formatted as USD currency
- [ ] Categories are displayed as colored pill badges using the category's stored color with white text
- [ ] Transaction type is displayed as a colored badge: green (income), red (expense), gray (transfer), amber (refund), gray (ignored)

### 7.2 Sorting

- [ ] Default sort is by date descending (newest first)
- [ ] Clicking any column header sorts by that column
- [ ] First click on a new column sorts ascending; clicking the same column toggles between ascending and descending
- [ ] Sort direction indicators (arrows) are shown on column headers
- [ ] The action column (Ignore) is not sortable

### 7.3 Ignore/Unignore

- [ ] Each transaction row has an "Ignore" button
- [ ] Clicking "Ignore" marks the transaction as ignored and the button changes to "Unignore"
- [ ] Ignored rows appear with a gray background and reduced opacity (60%)
- [ ] Ignored transactions are excluded from all financial calculations (summary cards, category chart, trends)
- [ ] The ignore state persists across browser sessions (stored in the backend database)

### 7.4 Empty State

- [ ] When no transactions exist in the selected date range, the message "No transactions yet. Import a CSV to get started." is displayed

---

## 8. Account Management

### 8.1 Account Types

- [ ] Three account types are supported: Checking, Savings, Credit Card
- [ ] A default "Main Checking" account is seeded on first use (database v4 migration)

### 8.2 Account Persistence

- [ ] Accounts are fetched from the backend API and persisted in the Postgres database
- [ ] Each account has a unique UUID identifier

---

## 9. Auto-Categorization Pipeline (Backend)

### 9.1 Import Pipeline

- [ ] CSV upload creates an `import_batches` record with status `uploaded`
- [ ] The CSV is parsed and rows are inserted into the `transactions` table with `needs_review = true`
- [ ] A `text_for_embedding` string is built for each transaction using merchant, description, amount bucket (small/medium/large), and domain hints
- [ ] Amount buckets: small (<$10), medium ($10-$99.99), large ($100+)
- [ ] All amounts are stored as absolute cents (BIGINT)

### 9.2 Embedding Generation

- [ ] Embeddings are generated via a vLLM-compatible API (nvidia/llama-embed-nemotron-8b, 4096 dimensions)
- [ ] Embeddings are stored in PostgreSQL using pgvector
- [ ] Batch processing handles up to 256 transactions per API call

### 9.3 Rule-Based Categorization

- [ ] Rules are applied before KNN (deterministic fast-path)
- [ ] Three rule match types are supported: `merchant_clean` (exact match), `contains` (substring), `regex` (pattern)
- [ ] Rules are evaluated in priority order (lower number = higher priority)
- [ ] Rule matches result in confidence = 0.98
- [ ] Regex matching is tested against both `merchant_clean` and `description_raw`
- [ ] All matching is case-insensitive
- [ ] Invalid regex patterns fail silently (no crash)

### 9.4 KNN Categorization

- [ ] KNN uses cosine similarity on pgvector embeddings against user-labeled transactions
- [ ] K = 20 nearest neighbors are retrieved
- [ ] Weighted voting is used (weight = similarity score)
- [ ] A category is assigned only if:
  - Confidence >= 0.80 (80% of weighted vote share)
  - Weighted similarity sum >= 6.0
- [ ] If thresholds are not met, the transaction remains as `needs_review = true`
- [ ] Only the latest label per transaction is used (via `DISTINCT ON ... ORDER BY created_at DESC`)
- [ ] If no labeled transactions exist, KNN returns null (no training data available)

### 9.5 Import Batch Status Lifecycle

- [ ] Status progression: `uploaded` -> `parsing` -> `embedding` -> `categorizing` -> `completed`
- [ ] On failure at any stage, status is set to `failed` with an error message
- [ ] Processing can only be triggered when batch status is `uploaded` (prevents reprocessing)
- [ ] Import status is queryable via `GET /imports/:id`

---

## 10. Edit Learning (Backend)

### 10.1 Manual Category Assignment

- [ ] User can assign a category to any transaction via `POST /transactions/:id/category`
- [ ] The transaction is updated with `category_source = 'manual'`, `category_confidence = 1.0`, `needs_review = false`
- [ ] An audit record is created in `transaction_labels` capturing old and new category
- [ ] The `categoryId` field is required; a 400 error is returned if missing

### 10.2 Merchant Rule Creation

- [ ] When `applyToMerchant = true`, a `category_rules` entry is created with `match_type = 'merchant_clean'` and `priority = 100`
- [ ] If a rule already exists for the same merchant/category, it is re-enabled (not duplicated)
- [ ] Rules created via edit learning are marked with `created_from = 'edit_learning'`

### 10.3 Retroactive Application

- [ ] When `applyToPast = true`, all of the user's transactions with the same merchant that are currently uncategorized (`category_id IS NULL`) are updated
- [ ] Retroactive updates set `category_source = 'rule'` and `category_confidence = 0.98`
- [ ] Transactions that already have a category (from KNN, rules, or manual) are not overwritten
- [ ] Both `applyToMerchant` and `applyToPast` can be used simultaneously

### 10.4 Learning Loop

- [ ] Labels inserted into `transaction_labels` are used by KNN for future categorization without re-embedding
- [ ] Each new manual label improves future categorization accuracy for similar transactions

---

## 11. Review Queue (Backend)

- [ ] Transactions needing review are queryable via `GET /imports/:id/review-queue`
- [ ] Results are paginated with `limit` (default 100) and `offset` (default 0) query parameters
- [ ] Each returned transaction includes: id, merchant, amount (cents), date, category source, confidence, and category ID

---

## 12. Data Integrity

### 12.1 Transaction Storage

- [ ] Amounts are stored as positive numbers with a separate `type` field for direction
- [ ] Dates are stored as ISO strings for persistence and converted to `Date` objects for computation
- [ ] Transaction IDs are string UUIDs (frontend) / BIGSERIAL (backend)
- [ ] All data mutations go through the backend API; the frontend re-fetches via BudgetProvider context (no manual cache invalidation needed)

### 12.2 Database Migrations

- [ ] The backend database (PostgreSQL) uses file-based SQL migrations tracked in a `schema_migrations` table
- [ ] Migrations run sequentially in alphabetical filename order

### 12.3 Multi-User Isolation (Backend)

- [ ] All backend queries are scoped by `user_id`
- [ ] Category rules, transaction labels, and embeddings are per-user
- [ ] One user's data and categorization model does not affect another user's

---

## 13. Transaction Type Classification

### 13.1 Supported Types

- [ ] Five transaction types: `income`, `expense`, `transfer`, `refund`, `ignored`
- [ ] Transfers and ignored transactions are excluded from all financial calculations
- [ ] Refunds are subtracted from expenses (not added to income)

### 13.2 Transfer Detection

- [ ] Credit card payments from checking accounts are classified as `transfer` (e.g., keywords: "credit card", "chase credit", "amex", "capital one")
- [ ] Payment credits on credit card statements are classified as `transfer` (e.g., keywords: "payment", "autopay", "ach payment")

### 13.3 Refund Detection

- [ ] Transactions matching refund keywords are classified as `refund` (e.g., "refund", "return", "rebate", "credit adj", "reversal", "dispute", "chargeback")

---

## 14. API Endpoints

### 14.1 Health Check

- [ ] `GET /health` returns `{ status: "ok", timestamp: "<ISO>" }`
- [ ] The endpoint confirms the backend process is alive

### 14.2 CSV Import

- [ ] `POST /imports` accepts `{ file, userId }` in JSON body (file as raw CSV text)
- [ ] Returns 202 with `{ importId, status, totalRows, template }`
- [ ] Returns 400 if `file` or `userId` is missing
- [ ] Returns 400 if zero valid rows after filtering blank rows
- [ ] JSON body size limit is 10 MB

### 14.3 Import Status

- [ ] `GET /imports/:id` returns the full batch status including row counts for embedded, categorized, and needs-review
- [ ] Returns 404 if import batch is not found

### 14.4 Process Import

- [ ] `POST /imports/:id/process` triggers embedding generation and categorization
- [ ] Returns 404 if batch not found
- [ ] Returns 400 if batch status is not `uploaded`
- [ ] Returns result with counts: total, ruleMatched, knnMatched, needsReview

### 14.5 Update Category

- [ ] `POST /transactions/:id/category` accepts `{ categoryId, applyToMerchant?, applyToPast? }`
- [ ] Returns 400 if `categoryId` is missing
- [ ] Returns 404 if transaction not found
- [ ] Returns `{ status: "updated", transactionId, categoryId, ruleApplied }`

---

## 15. UI/UX Standards

### 15.1 Notifications

- [ ] Success operations show a green toast notification (auto-dismisses after 4 seconds)
- [ ] Error operations show a red toast notification (auto-dismisses after 4 seconds)
- [ ] Informational messages show a blue toast notification (auto-dismisses after 4 seconds)
- [ ] Toasts stack in the bottom-right corner of the screen

### 15.2 Modal Behavior

- [ ] Modals display a full-screen overlay with a backdrop
- [ ] Clicking the backdrop closes the modal
- [ ] Pressing the Escape key closes the modal
- [ ] Modals have a title bar with an X close button
- [ ] Modal content is scrollable
- [ ] Modals use `role="dialog"` and `aria-modal="true"` for accessibility

### 15.3 Currency Formatting

- [ ] All monetary values are formatted as USD using `Intl.NumberFormat` with 2 decimal places
- [ ] Compact notation is available (e.g., "$1.2K") where appropriate

### 15.4 Empty States

- [ ] The transaction table shows "No transactions yet. Import a CSV to get started." when empty
- [ ] The date range label shows "No data" when there are no transactions in the selected range

---

## 16. Non-Functional Requirements

### 16.1 Performance

- [ ] The frontend fetches all data from the backend API via BudgetProvider; UI updates when data is re-fetched after mutations
- [ ] Trend calculations use O(n) algorithms with hash-map lookups for daily bucketing
- [ ] The backend embedding API call has a 30-second timeout

### 16.2 Data Privacy

- [ ] All backend data is scoped per user (no cross-user data leakage)
- [ ] Category rules and learned labels are private to each user
- [ ] Financial data is stored in the backend Postgres database; the frontend does not persist any financial data in the browser

### 16.3 Resilience

- [ ] Backend embedding batch failures are logged and skipped (the pipeline continues with remaining batches)
- [ ] KNN errors are caught and logged; the transaction is left for manual review rather than crashing the pipeline
- [ ] Invalid regex patterns in category rules fail silently without crashing
- [ ] The frontend gracefully handles database loading states with a spinner
- [ ] Database read errors in the BudgetProvider are caught and stored in an error state
