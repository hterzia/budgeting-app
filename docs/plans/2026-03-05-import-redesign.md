# Import Feature Redesign Implementation Plan

> **⚠️ Historical Plan:** This plan was written before the app migrated to a backend API architecture. References to Dexie and IndexedDB are no longer applicable — the app now uses an Express + PostgreSQL backend with no browser-side database.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move the import feature from a static card at the top of the page to a modal triggered by a navbar "Import" button, with inline account creation.

**Architecture:** A new `Modal` shared primitive wraps the refactored `ImportCSV` component. `App.tsx` owns `isImportOpen` state, renders the Import button in the navbar, and passes `onClose` to `ImportCSV`. Account creation is handled inline within `ImportCSV` via a new `createAccount()` repo function.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Dexie (IndexedDB), Vitest + Testing Library

---

### Task 1: Add `createAccount` to accountsRepo

**Files:**

- Modify: `src/database/repos/accountsRepo.ts`
- Test: `src/database/repos/accountsRepo.test.ts`

**Step 1: Write the failing test**

Add to `src/database/repos/accountsRepo.test.ts` (create the file — it doesn't exist yet):

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "../db";
import { createAccount, getAccounts } from "./accountsRepo";

describe("accountsRepo", () => {
  beforeEach(async () => {
    await db.accounts.clear();
  });

  it("creates an account with the given name and type", async () => {
    const account = await createAccount("Chase Checking", "checking");
    expect(account.name).toBe("Chase Checking");
    expect(account.type).toBe("checking");
  });

  it("assigns a non-empty string id", async () => {
    const account = await createAccount("Savings", "savings");
    expect(typeof account.id).toBe("string");
    expect(account.id.length).toBeGreaterThan(0);
  });

  it("persists the account so getAccounts returns it", async () => {
    await createAccount("Chase Checking", "checking");
    const all = await getAccounts();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe("Chase Checking");
  });
});
```

**Step 2: Run the test to confirm it fails**

```bash
npx vitest run src/database/repos/accountsRepo.test.ts
```

Expected: FAIL — `createAccount is not exported from './accountsRepo'`

**Step 3: Add `createAccount` to accountsRepo**

Add to the bottom of `src/database/repos/accountsRepo.ts`:

```ts
import { Account, AccountType } from "../types";

export async function createAccount(
  name: string,
  type: AccountType,
): Promise<Account> {
  const id = crypto.randomUUID();
  const account: Account = { id, name, type };
  await db.accounts.add(account);
  return account;
}
```

Note: `Account` and `AccountType` may already be imported at the top of the file — check first and only add what's missing.

**Step 4: Run the test to confirm it passes**

```bash
npx vitest run src/database/repos/accountsRepo.test.ts
```

Expected: PASS — all 3 tests green

**Step 5: Commit**

```bash
git add src/database/repos/accountsRepo.ts src/database/repos/accountsRepo.test.ts
git commit -m "feat: add createAccount to accountsRepo"
```

---

### Task 2: Add `Modal` shared primitive

**Files:**

- Create: `src/shared/ui/Modal.tsx`
- Modify: `src/shared/ui/index.ts`
- Test: `src/shared/ui/Modal.test.tsx`

**Step 1: Write the failing tests**

Create `src/shared/ui/Modal.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Modal } from "./Modal";

describe("Modal", () => {
  it("renders children when open", () => {
    render(
      <Modal open={true} onClose={vi.fn()} title="Test Modal">
        <p>Modal content</p>
      </Modal>,
    );
    expect(screen.getByText("Modal content")).toBeInTheDocument();
    expect(screen.getByText("Test Modal")).toBeInTheDocument();
  });

  it("renders nothing when closed", () => {
    render(
      <Modal open={false} onClose={vi.fn()} title="Test Modal">
        <p>Modal content</p>
      </Modal>,
    );
    expect(screen.queryByText("Modal content")).not.toBeInTheDocument();
  });

  it("calls onClose when the backdrop is clicked", () => {
    const onClose = vi.fn();
    render(
      <Modal open={true} onClose={onClose} title="Test Modal">
        <p>content</p>
      </Modal>,
    );
    // The backdrop is the first child of the fixed container
    fireEvent.click(screen.getByTestId("modal-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <Modal open={true} onClose={onClose} title="Test Modal">
        <p>content</p>
      </Modal>,
    );
    fireEvent.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
```

**Step 2: Run the test to confirm it fails**

```bash
npx vitest run src/shared/ui/Modal.test.tsx
```

Expected: FAIL — `Modal` not found

**Step 3: Create `src/shared/ui/Modal.tsx`**

```tsx
import { useEffect } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        data-testid="modal-backdrop"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
```

**Step 4: Export from `src/shared/ui/index.ts`**

Add to the end of `src/shared/ui/index.ts`:

```ts
export * from "./Modal";
```

**Step 5: Run the test to confirm it passes**

```bash
npx vitest run src/shared/ui/Modal.test.tsx
```

Expected: PASS — all 4 tests green

**Step 6: Commit**

```bash
git add src/shared/ui/Modal.tsx src/shared/ui/Modal.test.tsx src/shared/ui/index.ts
git commit -m "feat: add Modal shared primitive"
```

---

### Task 3: Rewrite `ImportCSV` as modal content

**Files:**

- Modify: `src/components/ImportCSV/ImportCSV.tsx`
- Test: `src/components/ImportCSV/ImportCSV.test.tsx`

**Step 1: Write failing tests**

Create `src/components/ImportCSV/ImportCSV.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ImportCSV } from "./ImportCSV";
import { Account } from "../../database/types";

const mockAccounts: Account[] = [
  { id: "acct-1", name: "Chase Checking", type: "checking" },
  { id: "acct-2", name: "Amex CC", type: "credit_card" },
];

describe("ImportCSV", () => {
  it("shows the account dropdown when accounts exist", () => {
    render(<ImportCSV accounts={mockAccounts} onClose={vi.fn()} />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByText("Chase Checking (Checking)")).toBeInTheDocument();
  });

  it("shows the inline create form directly when no accounts exist", () => {
    render(<ImportCSV accounts={[]} onClose={vi.fn()} />);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("Account name")).toBeInTheDocument();
  });

  it('shows the create form when "+ Create new account" is clicked', () => {
    render(<ImportCSV accounts={mockAccounts} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("+ Create new account"));
    expect(screen.getByPlaceholderText("Account name")).toBeInTheDocument();
  });

  it("hides the create form when its cancel link is clicked", () => {
    render(<ImportCSV accounts={mockAccounts} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("+ Create new account"));
    fireEvent.click(screen.getByText("Cancel"));
    expect(
      screen.queryByPlaceholderText("Account name"),
    ).not.toBeInTheDocument();
  });

  it("renders the drop zone", () => {
    render(<ImportCSV accounts={mockAccounts} onClose={vi.fn()} />);
    expect(screen.getByText(/Drop your CSV here/i)).toBeInTheDocument();
  });

  it("renders the Cancel and Import buttons", () => {
    render(<ImportCSV accounts={mockAccounts} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /import/i })).toBeInTheDocument();
  });

  it("Import button is disabled when no file is selected", () => {
    render(<ImportCSV accounts={mockAccounts} onClose={vi.fn()} />);
    const importBtn = screen.getByRole("button", { name: /import/i });
    expect(importBtn).toBeDisabled();
  });

  it("calls onClose when Cancel is clicked", () => {
    const onClose = vi.fn();
    render(<ImportCSV accounts={mockAccounts} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
```

**Step 2: Run the test to confirm it fails**

```bash
npx vitest run src/components/ImportCSV/ImportCSV.test.tsx
```

Expected: FAIL — `onClose` prop doesn't exist yet, various missing UI elements

**Step 3: Rewrite `src/components/ImportCSV/ImportCSV.tsx`**

Replace the entire file with:

```tsx
import React, { useRef, useState, useMemo } from "react";
import { Account, AccountType, Transaction } from "../../database/types";
import {
  parseCSV,
  BankTemplate,
  ParsedTransaction,
} from "../../features/import/parseCSV";
import { useToast } from "../../shared/ui";
import { addTransactionsDedup } from "../../database/repos/transactionsRepo";
import { createAccount } from "../../database/repos/accountsRepo";

type Preview = {
  total: number;
  expenses: number;
  income: number;
  transfers: number;
  refunds: number;
};

interface Props {
  accounts: Account[];
  onClose: () => void;
}

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: "checking", label: "Checking" },
  { value: "savings", label: "Savings" },
  { value: "credit_card", label: "Credit Card" },
];

function accountTypeLabel(type: AccountType): string {
  return ACCOUNT_TYPES.find((t) => t.value === type)?.label ?? type;
}

export function ImportCSV({ accounts, onClose }: Props) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const availableAccounts = useMemo(() => {
    const seenIds = new Set<string>();
    return accounts
      .filter(
        (acct) =>
          acct.id !== undefined &&
          acct.id !== null &&
          typeof acct.type === "string",
      )
      .map((acct) => ({ ...acct, id: String(acct.id) }))
      .filter((acct) => {
        if (!acct.id || seenIds.has(acct.id)) return false;
        seenIds.add(acct.id);
        return true;
      });
  }, [accounts]);

  // File + parse state
  const [file, setFile] = useState<File | null>(null);
  const [template, setTemplate] = useState<BankTemplate | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [parsed, setParsed] = useState<ParsedTransaction[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Account selection state
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    availableAccounts[0]?.id ?? "",
  );

  // Inline account creation state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<AccountType>("checking");
  const [creating, setCreating] = useState(false);

  const selectedAccount =
    availableAccounts.find((a) => a.id === selectedAccountId) ?? null;

  // ─── file processing ───────────────────────────────────────────────────────

  const processFile = async (f: File, account: Account | null) => {
    if (!account) return;
    setFile(f);
    setTemplate(null);
    setError(null);
    setPreview(null);
    setParsed(null);
    try {
      const result = await parseCSV(f, account.type, String(account.id));
      setTemplate(result.template);
      setPreview(result.preview);
      setParsed(result.transactions);
    } catch {
      setError(
        "Failed to parse CSV file. Make sure it is a supported bank export.",
      );
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f, selectedAccount);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f?.name.toLowerCase().endsWith(".csv")) {
      processFile(f, selectedAccount);
    }
  };

  const handleAccountChange = async (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const id = e.target.value;
    setSelectedAccountId(id);
    if (file) {
      const account = availableAccounts.find((a) => a.id === id) ?? null;
      if (account) processFile(file, account);
    }
  };

  // ─── account creation ──────────────────────────────────────────────────────

  const handleCreateAccount = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const newAcct = await createAccount(newName.trim(), newType);
      setSelectedAccountId(newAcct.id);
      setShowCreateForm(false);
      setNewName("");
      setNewType("checking");
    } finally {
      setCreating(false);
    }
  };

  const handleCancelCreate = () => {
    setShowCreateForm(false);
    setNewName("");
    setNewType("checking");
  };

  // ─── import ────────────────────────────────────────────────────────────────

  const handleImport = async () => {
    if (!parsed || !selectedAccount) return;
    setImporting(true);
    setError(null);
    try {
      const categorized: Transaction[] = parsed.map((txn) => ({
        ...txn,
        categoryId: txn.categoryId || "uncategorized",
        createdAt: new Date().toISOString(),
      }));
      const { added, skipped } = await addTransactionsDedup(categorized);
      toast.push(
        `Imported ${added} transactions${skipped ? ` (${skipped} skipped as duplicates)` : ""}`,
        "success",
      );
      onClose();
    } catch {
      setError("Import failed. Please try again.");
      toast.push("Import failed", "error");
    } finally {
      setImporting(false);
    }
  };

  // ─── derived ───────────────────────────────────────────────────────────────

  const noAccounts = availableAccounts.length === 0;
  const showCreateFormVisible = noAccounts || showCreateForm;
  const canImport = !!selectedAccountId && !!parsed && !importing;

  // ─── render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Account section */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Account
        </label>

        {!noAccounts && !showCreateForm && (
          <>
            <select
              value={selectedAccountId}
              onChange={handleAccountChange}
              className="block w-full rounded-lg border border-gray-300 shadow-sm text-sm py-2 px-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            >
              {availableAccounts.map((acct) => (
                <option key={acct.id} value={acct.id}>
                  {acct.name} ({accountTypeLabel(acct.type)})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowCreateForm(true)}
              className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              + Create new account
            </button>
          </>
        )}

        {showCreateFormVisible && (
          <div className="rounded-lg border border-gray-200 p-4 space-y-3">
            {!noAccounts && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  New account
                </span>
                <button
                  type="button"
                  onClick={handleCancelCreate}
                  className="text-sm text-gray-400 hover:text-gray-600"
                >
                  Cancel
                </button>
              </div>
            )}
            <input
              type="text"
              placeholder="Account name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 text-sm py-2 px-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
            <div className="flex rounded-lg border border-gray-300 overflow-hidden">
              {ACCOUNT_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setNewType(t.value)}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    newType === t.value
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleCreateAccount}
              disabled={!newName.trim() || creating}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {creating ? "Adding..." : "Add account"}
            </button>
          </div>
        )}
      </div>

      {/* Divider */}
      <hr className="border-gray-100" />

      {/* File upload section */}
      <div>
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragging
              ? "border-blue-400 bg-blue-50"
              : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
          }`}
        >
          <svg
            className="mx-auto w-8 h-8 text-gray-400 mb-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <p className="text-sm text-gray-500">
            Drop your CSV here or{" "}
            <span className="text-blue-600 font-medium">browse</span>
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {file && (
          <div className="mt-3 space-y-2">
            <p className="text-sm text-gray-600">
              <span className="font-medium">{file.name}</span>
              {template && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                  {template.name}
                </span>
              )}
            </p>
            {preview && (
              <div className="flex flex-wrap gap-2">
                {preview.expenses > 0 && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 text-xs font-medium">
                    {preview.expenses} expenses
                  </span>
                )}
                {preview.income > 0 && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-green-100 text-green-800 text-xs font-medium">
                    {preview.income} income
                  </span>
                )}
                {preview.transfers > 0 && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-gray-200 text-gray-700 text-xs font-medium">
                    {preview.transfers} transfers
                  </span>
                )}
                {preview.refunds > 0 && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-medium">
                    {preview.refunds} refunds
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-gray-600 hover:text-gray-800 font-medium"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleImport}
          disabled={!canImport}
          className="bg-blue-600 text-white py-2 px-5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {importing
            ? "Importing..."
            : preview
              ? `Import ${preview.total} transactions`
              : "Import"}
        </button>
      </div>
    </div>
  );
}
```

**Step 4: Run the tests to confirm they pass**

```bash
npx vitest run src/components/ImportCSV/ImportCSV.test.tsx
```

Expected: PASS — all 8 tests green

**Step 5: Commit**

```bash
git add src/components/ImportCSV/ImportCSV.tsx src/components/ImportCSV/ImportCSV.test.tsx
git commit -m "feat: rewrite ImportCSV as modal content with inline account creation"
```

---

### Task 4: Wire up `App.tsx` — navbar button + modal

**Files:**

- Modify: `src/App.tsx`

No new test file needed — this is wiring/layout only and tested manually.

**Step 1: Update `src/App.tsx`**

Make these three changes:

**a) Add `isImportOpen` state and `Modal` import at the top:**

```tsx
// Add to imports:
import { Spinner, Modal } from "./shared/ui";

// Add inside the App component, near the other useState calls:
const [isImportOpen, setIsImportOpen] = useState(false);
```

**b) Add the Import button to the navbar** — find the `<div className="flex flex-wrap items-center space-x-4">` block and add the button before the DateRangeSelector divider:

```tsx
<div className="flex flex-wrap items-center gap-3">
  <button
    onClick={() => setIsImportOpen(true)}
    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-600 text-blue-600 text-sm font-medium hover:bg-blue-50 transition-colors"
  >
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
      />
    </svg>
    Import
  </button>
  <span className="text-sm text-gray-500">{formatDateRange()}</span>
  <div className="h-6 w-px bg-gray-300"></div>
  <DateRangeSelector
    selectedRange={dateRange}
    onSelect={setDateRange}
    customRange={customDateRange ?? undefined}
    onCustomRangeSelect={setCustomDateRange}
  />
</div>
```

**c) Remove the static ImportCSV block from `<main>` and add the modal** — find and remove:

```tsx
<div className="mb-8">
  <ImportCSV accounts={accounts} />
</div>
```

Then add the modal just before the closing `</div>` of the root `<div className="min-h-screen bg-gray-50">`:

```tsx
<Modal
  open={isImportOpen}
  onClose={() => setIsImportOpen(false)}
  title="Import Bank Statement"
>
  <ImportCSV accounts={accounts} onClose={() => setIsImportOpen(false)} />
</Modal>
```

**Step 2: Run the full test suite**

```bash
npx vitest run
```

Expected: all tests pass, no regressions

**Step 3: Smoke test in the browser**

```bash
npm run dev
```

Verify:

- The static import card is gone from the main content area
- The "Import" button appears in the navbar
- Clicking it opens the modal
- The × button, backdrop click, and Cancel button all close the modal
- With no accounts: create form is shown directly; creating an account auto-selects it
- With accounts: dropdown shows; "+ Create new account" toggles the inline form
- Dropping or selecting a CSV parses it and shows the preview badges
- The Import button label shows the count and clicking it imports and closes the modal

**Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: move import to navbar button and modal"
```
