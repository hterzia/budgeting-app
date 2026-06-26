# Import Feature Redesign

**Date:** 2026-03-05
**Status:** Approved

## Summary

Move the import feature from a static card always visible at the top of the page to a modal triggered by a navbar button. The modal includes inline account selection and lightweight account creation.

---

## Trigger: Navbar Button

- Add an "Import" button to the right side of the existing navbar, next to the DateRangeSelector.
- Outlined style with an upload icon, using the existing `blue-600` color.
- Remove the `<ImportCSV>` card from the main content area entirely.

---

## Modal

A centered overlay modal (`max-w-lg`, `bg-white`, `rounded-xl`, `shadow-xl`) with a semi-transparent backdrop (`bg-black/40`). Single scrollable body — no explicit step wizard.

### Header

- Title: "Import Bank Statement"
- Close button (×) top-right. Clicking it or the backdrop dismisses the modal and resets all state.

### Account Section

- A `<select>` dropdown listing all existing accounts (label: `{name} ({type})`).
- Default: first account if any exist.
- Below the dropdown: a small `+ Create new account` text link.
  - Clicking expands an inline mini-form (smooth height transition):
    - Text input: "Account name"
    - 3-option toggle: Checking | Savings | Credit Card
    - "Add account" button — saves to the DB via a new `createAccount()` repo function, auto-selects the new account, and collapses the form.
  - Clicking `+ Create new account` again while open collapses the form without saving.
- **No existing accounts:** skip the dropdown entirely, show the inline create form open by default.

### File Upload Section

Separated from the account section by a subtle horizontal rule.

- Dashed-border drop zone with a cloud-upload icon and label "Drop your CSV here or click to browse".
- Clicking the zone opens the native file picker (`.csv` only).
- Drag-and-drop supported.
- After file is selected:
  - Show filename + detected bank template as a small badge below the drop zone.
  - Show color-coded transaction preview badges (same patterns as today):
    - Red: expenses, Green: income, Gray: transfers, Amber: refunds.

### Footer

- Left: "Cancel" ghost button — dismisses modal, resets state.
- Right: "Import {n} transactions" primary button (`blue-600`).
  - Disabled until both an account is selected/created and a file is parsed.
  - Shows "Importing…" with a spinner during async operation.
  - On success: dismisses modal, resets state, fires the existing success toast.

---

## Account Creation Repo Change

Add `createAccount(name: string, type: AccountType): Promise<Account>` to `accountsRepo.ts`. Generates a UUID for the id, inserts into `db.accounts`, and returns the new account.

---

## State Reset

When the modal closes (cancel, backdrop click, ×, or successful import), all local state resets: selected file, parsed transactions, inline create form, any errors.

---

## Files Affected

| File                                     | Change                                                                              |
| ---------------------------------------- | ----------------------------------------------------------------------------------- |
| `src/components/ImportCSV/ImportCSV.tsx` | Rewrite as modal content                                                            |
| `src/database/repos/accountsRepo.ts`     | Add `createAccount()`                                                               |
| `App.tsx`                                | Remove `<ImportCSV>` from main content; add navbar Import button + modal open state |
| `src/shared/ui/` (optional)              | May add a `Modal.tsx` primitive if reuse is anticipated                             |
