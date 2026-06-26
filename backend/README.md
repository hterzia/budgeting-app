# Budgeting Backend

Node/TS backend service for the Budgeting App with Postgres/pgvector.

## Setup

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your database credentials
```

## Database Setup

```bash
# Create database (if not exists)
createdb budgeting

# Run migrations
npm run migration:up
```

## Development

```bash
# Start development server
npm run dev

# Type checking
npm run type-check
```

## Database Commands

```bash
# Run pending migrations
npm run migration:up

# Rollback migrations
npm run migration:down

# Generate new migration file
npm run migration:generate <migration_name>
```

## API Endpoints

### Health Check
- `GET /health` - Returns server status

### Import Management
- `POST /imports` - Upload CSV and start import process
  - Body: `{ file: string (base64), userId: string, accountId: string, invertAmountSign?: boolean }`
  - Returns: `{ importId: string, status: string, totalRows: number }`

- `GET /imports/:id` - Get import batch status
  - Returns: Import batch details with progress counters

- `POST /imports/:id/process` - Trigger embedding and categorization
  - Returns: Processing results

- `GET /imports/:id/review-queue` - Get transactions needing review

### Transaction Management
- `POST /transactions/:id/category` - Update transaction category
  - Body: `{ categoryId: string, applyToMerchant: boolean, applyToPast: boolean }`
  - Returns: Update confirmation

## Architecture

```
Backend/
├── src/
│   ├── db/           # Database config, queries, migrations
│   ├── routes/       # Express route handlers
│   ├── services/     # Business logic (KNN, embeddings, categorization)
│   ├── types/        # TypeScript type definitions
│   └── server.ts     # Main entry point
└── migrations/       # SQL migration files
```

## Data Models

- `import_batches` - Track async import state
- `transactions` - Store import data + category state
- `transaction_embeddings` - Vector embeddings for KNN
- `transaction_labels` - Audit trail for user edits
- `category_rules` - Deterministic fast-path rules

## Flow

1. Upload CSV → create import batch
2. Parse CSV → insert transactions with `text_for_embedding`
3. Generate embeddings → store in `transaction_embeddings`
4. Categorize using rules → update `category_source='rule'`
5. Categorize using KNN → update `category_source='knn'`
6. Transactions without category → `needs_review=true`
