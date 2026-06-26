# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Start

```bash
# Run frontend dev server
npm run dev

# Run tests
npm test

# Type check
npm run type-check

# Build
npm run build

# Backend dev server (separate process)
cd backend && npm run dev
```

## Architecture Overview

### Frontend (React + Vite)
- **State Management**: `BudgetProvider` fetches all data from the backend API on load; `useBudget()` hook exposes reactive state via React context
- **Context**: `BudgetProvider` wraps app, exposes `transactions`, `categories`, `accounts` via `useBudget()` hook
- **Components**:
  - `Trends` - Cumulative income/expense charts with daily/monthly granularity switch
  - `SpendingByCategory` - Vertical bar chart of expenses by category
  - `SpendingSummary` - Income/expense/savings cards
  - `TransactionList` - Filterable transaction table
  - `ImportCSV` - File upload with template auto-detection

### Backend (Express + Postgres)
- **Purpose**: Auto-categorization pipeline using NLP embeddings (vLLM) + KNN
- **Database**: PostgreSQL with `pgvector` extension (4096-dim embeddings)
- **Key Tables**:
  - `import_batches` - Tracks async import state
  - `transactions` - Raw import data + category state
  - `transaction_embeddings` - Vector embeddings
  - `transaction_labels` - Audit trail for user edits
  - `category_rules` - Deterministic fast-path rules

### Categorization Pipeline (Backend)
1. CSV upload creates `import_batches` record
2. Parse CSV → insert `transactions` with `text_for_embedding`
3. Generate embeddings via vLLM API → store in `transaction_embeddings`
4. Apply `category_rules` (exact/contains/regex matches)
5. KNN query on trusted `transaction_labels` with cosine similarity
6. Unassigned transactions flagged as `needs_review=true`

### Edit Learning
When user edits category:
1. Update transaction: `category_source='manual'`
2. Insert row into `transaction_labels`
3. Optionally create `category_rules` for future matching
4. Labels used directly for KNN without re-embedding

## Tech Stack

**Frontend**: React 18, Vite, Recharts, Tailwind CSS, Vitest
**Backend**: Express, PostgreSQL, pgvector, vLLM embeddings
**TypeScript**: Strict mode, ES2020 target, bundler module resolution

## Important File Paths

```
src/
├── App.tsx                                    # Slim router shell
├── app/
│   ├── Layout.tsx                             # Navbar + layout chrome
│   └── DashboardContext.tsx                    # Date range + filtered transactions state
├── context/BudgetProvider.tsx                  # API data context
├── features/
│   ├── dashboard/
│   │   ├── DashboardPage.tsx                  # Main dashboard grid layout
│   │   ├── Trends/                            # Cumulative trends with granularity switch
│   │   ├── SpendingSummary/                   # Income/expense/savings cards
│   │   ├── SpendingByCategory/                # Category bar chart
│   │   └── TransactionList/                   # Transaction table
│   ├── insights/
│   │   ├── InsightsPage.tsx                   # Widget grid page
│   │   ├── WidgetCard.tsx                     # Individual widget container
│   │   ├── templates/                         # Generic chart templates (Line/Bar/Pie/Summary)
│   │   ├── registry.ts                        # Widget definitions
│   │   ├── useWidgetData.ts                   # Widget data hook
│   │   └── useInsightsState.ts                # Widget CRUD state
│   ├── import/
│   │   ├── api.ts                             # Backend API calls
│   │   ├── ImportCSV.tsx                      # CSV import UI
│   │   └── csvParser.ts                       # Bank template detection
│   ├── categories/AddCategoryModal.tsx         # Category CRUD modal
│   ├── date-range/
│   │   ├── dateRange.ts                       # Date range utilities
│   │   └── DateRangeSelector/                 # Date range dropdown component
│   └── transactions/aggregations.ts            # Trend calculations
├── shared/ui/                                  # Reusable UI primitives
└── utils/format.ts                             # Currency formatting

backend/
├── src/
│   ├── server.ts                    # Express entry point
│   ├── routes/imports.ts            # Import + transaction endpoints
│   ├── services/
│   │   ├── categorize.ts            # Rules + KNN categorization
│   │   ├── embeddings.ts            # vLLM embedding generation
│   │   └── knn.ts                   # pgvector KNN queries
│   ├── db/                          # Query helpers + migrations
│   └── utils/csv.ts                 # Shared CSV utilities
└── migrations/0001_init.sql         # Database schema
```

## Key Patterns

- **Date handling**: ISO strings for storage, `new Date()` for computation
- **Amount storage**: Cents as `BIGINT` in backend, `number` in frontend
- **Transaction types**: `income`, `expense`, `transfer`, `refund`, `ignored`
- **Cumulative trends**: Two modes - "calendar" (resets at month boundary) or "running" (continues)
- **Granularity selection**: Daily < 90 days, monthly >= 90 days

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/imports` | POST | Upload CSV, start import batch |
| `/imports/:id` | GET | Get import status |
| `/imports/:id/process` | POST | Trigger embedding + categorization |
| `/imports/:id/review-queue` | GET | Get transactions needing review |
| `/transactions/:id/category` | POST | Update category with edit learning |
| `/health` | GET | Backend health check |
