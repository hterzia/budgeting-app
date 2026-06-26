# Maintainability Plan: classifyTransaction Function

## Context

The `classifyTransaction` function in `backend/src/utils/csv.ts` is a critical utility that determines transaction types (income, expense, transfer, refund, ignored) based on merchant name, amount, account type, and optional type column.

**Why this needs attention:**
- The function has 4 distinct code paths (nested conditionals)
- Multiple keyword arrays defined inline
- Hard-coded logic for specific banks (Chase, Amex, BoA)
- Tests cover basic cases but edge cases may be missed
- Future developers may struggle to add new rules without breaking existing logic

## Current Structure Analysis

### Code Path Complexity

```
classifyTransaction()
├── Credit Card with Type Column (lines 208-222)
│   └── checks: PAYMENT → transfer, RETURN/REFUND → refund, SALE/PURCHASE → expense
├── Checking/Savings with Type Column (lines 224-243)
│   ├── known checking transfers → transfer
│   ├── CREDIT → income (or refund if refund keywords)
│   └── DEBIT → expense (or transfer if CC keywords)
├── Credit Card without Type Column (lines 245-262)
│   └── amount < 0 → transfer (or refund based on keywords)
└── Checking/Savings without Type Column (lines 264-275)
    └── amount < 0 → expense (or transfer if CC keywords)
```

### Maintainability Concerns

1. **Keyword sprawl**: 3 separate keyword arrays (TRANSFER_KEYWORDS_CHECKING, TRANSFER_KEYWORDS_CREDIT_CARD, REFUND_KEYWORDS) with overlapping logic

2. **Template-specific special cases**: Hard-coded strings like:
   - `"online transfer from sav"`
   - `"bk of amer vi/mc online pmt"`

3. **Nested conditionals**: Deep nesting makes it hard to trace logic (e.g., lines 248-261)

4. **Order dependency**: The `if` chain order matters - early branches can prevent later ones from executing

5. **Missing coverage**: No explicit handling for "ignored" transaction type

## Simplification Strategy

### Option 1: Data-Driven Rules (Recommended)

Replace the if-chain with a rules array that can be iterated:

```typescript
interface ClassificationRule {
  match: (merchant: string, amount: number, accountType: string, typeColumn?: string) => boolean;
  result: TransactionType;
}

const CLASSIFICATION_RULES: ClassificationRule[] = [
  // High-priority: Type column overrides
  { match: isCreditCardPaymentWithRefundKeyword, result: 'refund' },
  { match: isCreditCardPayment, result: 'transfer' },
  { match: isCreditCardRefund, result: 'refund' },
  { match: isCreditCardPurchase, result: 'expense' },
  { match: isCheckingCreditWithRefundKeyword, result: 'refund' },
  { match: isCheckingCredit, result: 'income' },
  { match: isCheckingDebitWithTransferKeyword, result: 'transfer' },
  { match: isCheckingDebit, result: 'expense' },
  { match: isCreditCardNegative, result: 'transfer' },
  { match: isCreditCardPositive, result: 'expense' },
  { match: isCheckingNegativeWithTransferKeyword, result: 'transfer' },
  { match: isCheckingNegative, result: 'expense' },
  { match: isCheckingPositive, result: 'income' },
  // Fallback
  { match: always, result: amount < 0 ? 'expense' : 'income' },
];
```

### Option 2: Decision Table

Create a matrix of accountType × typeColumn × amount sign × keywords:

| Account Type | Type Column | Amount | Keywords | Result |
|-------------|-------------|--------|----------|--------|
| credit_card | PAYMENT | any | refund keywords | refund |
| credit_card | PAYMENT | any | - | transfer |
| credit_card | RETURN/REFUND | any | - | refund |
| credit_card | SALE/PURCHASE | any | - | expense |
| checking/savings | CREDIT | > 0 | refund keywords | refund |
| checking/savings | CREDIT | > 0 | - | income |
| checking/savings | DEBIT | < 0 | transfer keywords | transfer |
| checking/savings | DEBIT | < 0 | - | expense |
| credit_card | - | < 0 | refund keywords | refund |
| credit_card | - | < 0 | payment keywords | transfer |
| credit_card | - | < 0 | - | transfer |
| credit_card | - | >= 0 | - | expense |
| checking/savings | - | < 0 | transfer keywords | transfer |
| checking/savings | - | < 0 | - | expense |
| checking/savings | - | >= 0 | - | income |

### Option 3: Refactor to Helper Functions

Keep structure but extract keyword checks:

```typescript
function hasRefundKeyword(merchant: string): boolean {
  return REFUND_KEYWORDS.some(kw => merchant.includes(kw));
}

function hasTransferKeyword(merchant: string, accountType: string): boolean {
  const keywords = accountType === 'credit_card'
    ? TRANSFER_KEYWORDS_CREDIT_CARD
    : TRANSFER_KEYWORDS_CHECKING;
  return keywords.some(kw => merchant.includes(kw));
}

function isKnownTransfer(merchant: string): boolean {
  const lower = merchant.toLowerCase();
  return lower.includes('online transfer from sav') ||
         lower.includes('bk of amer vi/mc online pmt');
}
```

## Implementation Plan

1. **Phase 1: Extract helper functions** (low risk)
   - Create keyword check helpers
   - Extract known transfer checks
   - Add unit tests for helpers

2. **Phase 2: Add typeColumn to AccountType** (type safety)
   - Update types to use union instead of string
   - Update all call sites

3. **Phase 3: Refactor to data-driven rules**
   - Create classification rules array
   - Iterate and return first match
   - Add comprehensive tests

4. **Phase 4: Document edge cases**
   - Document ambiguous scenarios
   - Add test for each bank's specific patterns

## Testing Strategy

### Current Test Coverage (8 tests)
- Credit card payment/transfer
- Refund detection
- Purchase/expense detection
- Checking credit/debit
- Transfer keyword detection
- Amount-based classification

### Missing Test Cases
- Empty/whitespace merchant names
- Special characters in merchant names
- All caps, all lowercase, mixed case
- Unicode characters
- Empty typeColumn (empty string vs undefined)
- Zero amount
- Very large amounts
- Bank-specific patterns (BoA, Wells Fargo, Revolut)

## Files to Modify

1. `backend/src/utils/csv.ts` - Main refactoring target
2. `backend/tests/csv.test.ts` - Add comprehensive tests
3. `docs/plans/future-maintenance-plan.md` - This document

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing classification | High | Run all existing tests, verify import pipeline |
| Performance degradation | Low | String matching is O(n) where n is keyword count (~20) |
| New edge cases | Medium | Add regression tests for each bank template |

## Success Criteria

1. All existing tests pass
2. Test coverage increases from 8 to 20+ tests
3. Add new test case for each bank template in `bankTemplates`
4. Code review confirms logic is clearer
5. Documentation updated

## Future Enhancements

- Add amount-aware categorization: allow rules (and eventual KNN/LLM hints) to key off exact or bucketed amounts so repeated Zelle transfers of a specific amount map to the same category/merchant normalization.
