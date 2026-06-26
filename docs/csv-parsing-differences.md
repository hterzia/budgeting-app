# CSV Parsing Differences Audit

**Date:** 2026-03-05
**Files compared:**
- `src/parsers/csvParser.ts` (frontend - legacy)
- `src/features/import/parseCSV.ts` (frontend - wrapper)
- `backend/src/utils/csv.ts` (backend - utilities)
- `backend/src/routes/imports.ts` (backend - import route)

---

## Code Duplication Status

### Found: `backend/src/utils/csv.ts` ALREADY EXISTS

The backend has a copy of CSV utilities that is **nearly identical** to the frontend's `src/parsers/csvParser.ts`. This was likely created as an intermediate step but not fully integrated.

### Frontend Parsing Architecture

The frontend has a **3-layer** structure:

```
src/parsers/csvParser.ts (legacy - core parsing logic)
         ↓
src/features/import/parseCSV.ts (wrapper - adds preview counts)
         ↓
src/components/ImportCSV/ImportCSV.tsx (React component - UI + import)
```

---

## Detailed Comparison

### 1. Template Definitions

| Location | Status |
|--|--|
| `src/parsers/csvParser.ts` | Full 8 templates |
| `backend/src/utils/csv.ts` | Full 8 templates (identical) |
| `src/features/import/parseCSV.ts` | Exports from legacy |

**Finding:** Templates are duplicated. Backend already has them.

---

### 2. `detectTemplate()` Function

| Location | Status |
|--|--|
| `src/parsers/csvParser.ts` | Present (lines 89-104) |
| `backend/src/utils/csv.ts` | Present (lines 92-107) |
| `src/features/import/parseCSV.ts` | Not present (imports) |

**Finding:** Duplicated. Backend already has implementation.

---

### 3. `getField()` Helper

| Location | Status |
|--|--|
| `src/parsers/csvParser.ts` | Present (lines 238-245), not exported |
| `backend/src/utils/csv.ts` | Present (lines 109-116), not exported |
| `backend/src/routes/imports.ts` | Duplicate present (lines 25-32) |

**Finding:** Duplicated in 3 places! Backend route has its own copy even though `csv.ts` exists.

---

### 4. `normalizeDate()` Function

| Location | Status |
|--|--|
| `src/parsers/csvParser.ts` | Present (lines 247-262), not exported |
| `backend/src/utils/csv.ts` | Present (lines 118-133), exported |
| `backend/src/routes/imports.ts` | Uses imported version |

**Finding:** Backend utilities have it exported, route uses it correctly.

---

### 5. `parseAmount()` Function

| Location | Status |
|--|--|
| `src/parsers/csvParser.ts` | Present (lines 264-269), not exported |
| `backend/src/utils/csv.ts` | Present (lines 135-140), exported |
| `backend/src/routes/imports.ts` | Uses imported version |

**Finding:** Backend utilities have it exported, route uses it correctly.

---

### 6. `classifyTransaction()` Function

| Location | Status |
|--|--|
| `src/parsers/csvParser.ts` | Present (lines 154-236), not exported |
| `backend/src/utils/csv.ts` | MISSING |
| `backend/src/routes/imports.ts` | MISSING |

**Finding:** This is a BIG GAP. The backend import route does NOT classify transactions.

---

### 7. `parseCSV()` Main Function

| Location | Status |
|--|--|
| `src/parsers/csvParser.ts` | Present (lines 282-370) |
| `backend/src/utils/csv.ts` | MISSING |
| `backend/src/routes/imports.ts` | Inline implementation (lines 48-113) |

**Finding:** Backend has inline CSV parsing logic in the route handler.

---

## Key Differences Summary

| Aspect | Frontend (src/parsers/csvParser.ts) | Backend (current) |
|--|--|
| Template definitions | 8 templates | 8 templates (same) |
| `getField()` | Present (not exported) | 2 copies |
| `normalizeDate()` | Present (not exported) | Present (exported) |
| `parseAmount()` | Present (not exported) | Present (exported) |
| `classifyTransaction()` | Present (not exported) | **MISSING** |
| Main parsing logic | `parseCSV()` function | Inline in route handler |
| Transaction classification | Full logic | None (all 'unknown') |

---

## Critical Gap: Missing Classification in Backend

The backend does NOT classify transactions during import:

**Frontend logic (src/parsers/csvParser.ts lines 154-236):**
- Detects transfers (credit card payments, account transfers)
- Detects refunds (based on keywords and Type column)
- Handles Chase Checking debits/credits
- Handles Amex-style negative amounts
- Account-type-aware logic

**Backend current behavior:**
- All imported transactions get `categorySource: 'unknown'`
- `needsReview: true` is set
- No attempt to auto-classify during import

---

## Minimal Backend API Surface (for frontend)

The frontend currently needs from backend:
1. **POST /imports** - Upload CSV file (as base64 or raw string)
2. **Response should include:**
   - `importId` - for polling status
   - `totalRows` - number of rows parsed
   - `template` - detected template name (for UI feedback)

The frontend should NOT parse - it should send the raw file and receive parsed results.

---

## Recommendations

### Priority 1: Backend Enhancement
1. **Add `classifyTransaction()` to backend** - Export from csv.ts or duplicate logic
2. **Update import route** to use csv.ts utilities (already partially doing this)
3. **Apply classification during import** - Set proper type, reduce needs_review

### Priority 2: Frontend Simplification
1. **Remove parsing logic** - Keep only template definitions for UI hints
2. **Use backend for all parsing** - Send raw file, receive parsed transactions
3. **Update UI to display backend results** - Use `template` from response

### Priority 3: Remove Duplication
1. **Delete `src/parsers/csvParser.ts`** - Keep only template definitions if needed for UI
2. **Delete `src/features/import/parseCSV.ts`** - No longer needed
3. **Use `backend/src/utils/csv.ts` as single source of truth**

---

## Git Command for Committing This Audit

```bash
git add docs/csv-parsing-differences.md
git commit -m "docs: audit CSV parsing differences"
```
