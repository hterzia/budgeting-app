# Budgeting App API

This document provides a comprehensive reference for the Budgeting App REST API.

## Base URL

```
http://localhost:3001
```

## Authentication

Currently, this application uses a simple user ID system. All requests that require authentication should include a `userId` in the request body.

In production, this should be replaced with proper JWT or OAuth2 authentication.

## Rate Limiting

Rate limiting is enabled to prevent abuse. Current limits:
- 100 requests per minute per user
- 1000 requests per hour per user

## Response Format

All responses use the following structure:

```json
{
  "status": "success",
  "data": {}
}
```

Error responses use:

```json
{
  "error": "Error message",
  "details": "Optional details"
}
```

## Endpoints

### Health Check

#### `GET /health`

Returns the current status of the server.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-03-11T12:00:00.000Z"
}
```

---

### Import Management

#### `POST /imports`

Upload a CSV file and start an import batch.

**Request:**
```json
{
  "file": "CSV content as string",
  "userId": "uuid",
  "accountId": "uuid (optional)",
  "invertAmountSign": false (optional)
}
```

**Response (202 Accepted):**
```json
{
  "importId": "uuid",
  "status": "uploaded",
  "totalRows": 100,
  "template": "Chase Credit Card"
}
```

**Errors:**
- `400`: Invalid request (missing file, invalid userId, etc.)
- `500`: Internal server error

---

#### `GET /imports/:id`

Get the status of an import batch.

**Response:**
```json
{
  "id": "uuid",
  "userId": "uuid",
  "status": "completed",
  "totalRows": 100,
  "embeddedRows": 95,
  "autoCategorizedRows": 80,
  "needsReviewRows": 5,
  "errorMessage": null,
  "createdAt": "2026-03-11T12:00:00.000Z",
  "completedAt": "2026-03-11T12:05:00.000Z"
}
```

**Errors:**
- `404`: Import batch not found

---

#### `POST /imports/:id/process`

Trigger embedding generation and categorization for an uploaded import.

**Response:**
```json
{
  "status": "completed",
  "result": {
    "total": 100,
    "ruleMatched": 50,
    "knnMatched": 25,
    "llmMatched": 5,
    "needsReview": 20
  }
}
```

**Errors:**
- `404`: Import batch not found
- `400`: Batch is already being processed

---

#### `GET /imports/:id/review-queue`

Get a paginated list of transactions that need review.

**Query Parameters:**
- `limit`: Number of results (default: 100, max: 1000)
- `offset`: Pagination offset (default: 0)

**Response:**
```json
{
  "transactions": [
    {
      "id": 123,
      "merchant_clean": "Starbucks",
      "amount_cents": 550,
      "posted_at": "2026-03-10",
      "category_source": "unknown",
      "category_confidence": null,
      "category_id": null
    }
  ],
  "totalCount": 1
}
```

---

#### `GET /imports/:id/transactions`

Get all transactions for a specific import batch.

**Query Parameters:**
- `limit`: Number of results (default: 50, max: 1000)
- `offset`: Pagination offset (default: 0)

**Response:**
```json
{
  "transactions": [
    {
      "id": 123,
      "merchant_clean": "Starbucks",
      "amount_cents": 550,
      "posted_at": "2026-03-10",
      "currency": "USD",
      "category_id": "dining",
      "category_source": "rule",
      "needs_review": false
    }
  ],
  "totalCount": 1
}
```

---

#### `DELETE /imports/:id`

Delete an import batch and all associated data.

**Response:**
```json
{
  "status": "deleted",
  "importId": "uuid"
}
```

---

#### `GET /imports`

Get a list of all import batches for the current user.

**Response:**
```json
{
  "imports": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "status": "completed",
      "total_rows": 100,
      "embedded_rows": 95,
      "auto_categorized_rows": 80,
      "needs_review_rows": 5,
      "error_message": null,
      "created_at": "2026-03-11T12:00:00.000Z",
      "completed_at": "2026-03-11T12:05:00.000Z"
    }
  ],
  "totalCount": 1
}
```

---

### Transaction Management

#### `GET /transactions`

Get all transactions with optional filtering.

**Query Parameters:**
- `all`: If "true", returns all rows without pagination
- `limit`: Number of results (default: 100, max: 1000)
- `offset`: Pagination offset (default: 0)
- `start`: Start date (YYYY-MM-DD)
- `end`: End date (YYYY-MM-DD)

**Response:**
```json
[
  {
    "id": "123",
    "date": "2026-03-10",
    "merchant": "Starbucks",
    "amount": 5.50,
    "type": "expense",
    "categoryId": "dining",
    "accountId": "uuid",
    "importedAt": "2026-03-11T12:00:00.000Z",
    "createdAt": "2026-03-11T12:00:00.000Z",
    "isIgnored": false
  }
]
```

---

#### `POST /transactions/:id/toggle-ignore`

Toggle whether a transaction is ignored.

**Response:**
```json
{
  "id": "123",
  "isIgnored": true
}
```

---

#### `POST /transactions/:id/category`

Update the category for a transaction with edit learning.

**Request:**
```json
{
  "categoryId": "dining",
  "applyToMerchant": true,
  "applyToPast": false
}
```

**Response:**
```json
{
  "status": "updated",
  "transactionId": "123",
  "categoryId": "dining",
  "ruleApplied": true
}
```

**Errors:**
- `400`: Category type doesn't match transaction type
- `404`: Transaction not found

---

### Account Management

#### `GET /accounts`

Get all accounts for the current user.

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "Checking Account",
    "type": "checking"
  }
]
```

---

#### `POST /accounts`

Create a new account.

**Request:**
```json
{
  "name": "New Account",
  "type": "checking"
}
```

**Response (201 Created):**
```json
{
  "id": "uuid",
  "name": "New Account",
  "type": "checking"
}
```

**Errors:**
- `400`: Invalid request (missing name or type)

---

#### `PUT /accounts/:id`

Update an account.

**Request:**
```json
{
  "name": "Updated Account Name",
  "type": "checking"
}
```

**Response:**
```json
{
  "id": "uuid",
  "name": "Updated Account Name",
  "type": "checking"
}
```

---

#### `DELETE /accounts/:id`

Delete an account.

**Response:** `204 No Content`

---

### Category Management

#### `GET /categories`

Get all categories for the current user.

**Response:**
```json
[
  {
    "id": "dining",
    "name": "Dining",
    "type": "expense",
    "color": "#ff5733",
    "icon": "restaurant"
  }
]
```

---

#### `POST /categories`

Create a new category.

**Request:**
```json
{
  "name": "New Category",
  "type": "expense",
  "color": "#ff5733",
  "icon": "tag"
}
```

**Response (201 Created):**
```json
{
  "id": "new-category",
  "name": "New Category",
  "type": "expense",
  "color": "#ff5733",
  "icon": "tag"
}
```

**Errors:**
- `400`: Invalid request
- `409`: Category already exists

---

#### `PUT /categories/:id`

Update a category.

**Request:**
```json
{
  "name": "Updated Category Name",
  "type": "expense",
  "color": "#ff5733",
  "icon": "tag"
}
```

**Response:**
```json
{
  "id": "new-category",
  "name": "Updated Category Name",
  "type": "expense",
  "color": "#ff5733",
  "icon": "tag"
}
```

---

#### `DELETE /categories/:id`

Delete a category.

**Response:** `204 No Content`

---

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid parameters or data |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Resource already exists |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

## Data Models

### Transaction

```typescript
interface Transaction {
  id: string;
  date: string;              // YYYY-MM-DD
  merchant: string;
  amount: number;            // In dollars (not cents)
  type: 'income' | 'expense' | 'transfer' | 'refund' | 'ignored';
  categoryId: string;
  accountId: string;
  importedAt: string;        // ISO 8601 datetime
  createdAt: string;         // ISO 8601 datetime
  isIgnored?: boolean;
}
```

### Account

```typescript
interface Account {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'credit_card';
}
```

### Category

```typescript
interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense' | 'transfer';
  color: string;             // Hex color (#rrggbb)
  icon?: string;
}
```

### Import Batch

```typescript
interface ImportBatch {
  id: string;
  userId: string;
  status: 'uploaded' | 'parsing' | 'embedding' | 'categorizing' | 'completed' | 'failed';
  totalRows: number;
  embeddedRows: number;
  autoCategorizedRows: number;
  needsReviewRows: number;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}
```
