// Frontend CSV import helper - uses backend API for parsing

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  (window as any).electronAPI?.apiBaseUrl ||
  `${window.location.protocol}//${window.location.hostname}:3001`;

import { Transaction, Account, AccountType, Category } from '../../types';

export interface ImportResponse {
  importId: string;
  status: string;
  totalRows: number;
  template: string;
}

export interface ImportStatus {
  id: string;
  userId: string;
  status: string;
  totalRows: number;
  embeddedRows: number;
  autoCategorizedRows: number;
  needsReviewRows: number;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
  accountId?: string | null;
}

/**
 * Upload CSV file to backend for parsing and import.
 * Returns importId for polling status.
 */
export async function uploadCSV(
  file: File,
  userId: string,
  accountId: string,
  invertAmountSign: boolean = false,
): Promise<ImportResponse> {
  const content = await file.text();

  const response = await fetch(`${BACKEND_URL}/imports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      file: content,
      userId,
      accountId,
      invertAmountSign,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Failed to upload CSV");
  }

  return response.json();
}

/**
 * Get import batch status.
 */
export async function getImportStatus(importId: string): Promise<ImportStatus> {
  const response = await fetch(`${BACKEND_URL}/imports/${importId}`);
  if (!response.ok) {
    throw new Error("Failed to fetch import status");
  }
  return response.json();
}

export async function getTransactions(): Promise<Transaction[]> {
  const response = await fetch(`${BACKEND_URL}/transactions?all=true`);
  if (!response.ok) throw new Error('Failed to fetch transactions');
  return response.json();
}

export async function getAccounts(): Promise<Account[]> {
  const response = await fetch(`${BACKEND_URL}/accounts`);
  if (!response.ok) throw new Error('Failed to fetch accounts');
  return response.json();
}

export async function createAccount(name: string, type: AccountType): Promise<Account> {
  const response = await fetch(`${BACKEND_URL}/accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, type }),
  });
  if (!response.ok) throw new Error('Failed to create account');
  return response.json();
}

export async function getCategories(): Promise<Category[]> {
  const response = await fetch(`${BACKEND_URL}/categories`);
  if (!response.ok) throw new Error('Failed to fetch categories');
  return response.json();
}

export async function createCategory(
  name: string,
  type: 'income' | 'expense' | 'transfer',
  color: string,
  icon?: string
): Promise<Category> {
  const response = await fetch(`${BACKEND_URL}/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, type, color, icon }),
  });
  if (response.status === 409) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'A category with that name already exists');
  }
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create category');
  }
  return response.json();
}

export async function triggerProcess(importId: string): Promise<void> {
  const response = await fetch(`${BACKEND_URL}/imports/${importId}/process`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to process import');
}

export async function toggleIgnoreTransaction(id: string): Promise<Transaction> {
  const response = await fetch(`${BACKEND_URL}/transactions/${id}/toggle-ignore`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to toggle ignore');
  return response.json();
}

export async function updateTransactionCategory(id: string, categoryId: string, applyToMerchant: boolean = true): Promise<void> {
  const response = await fetch(`${BACKEND_URL}/transactions/${id}/category`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ categoryId, applyToMerchant }),
  });
  if (!response.ok) throw new Error('Failed to update transaction category');
}

export async function getImports(): Promise<{ imports: ImportStatus[]; totalCount: number }> {
  const response = await fetch(`${BACKEND_URL}/imports`);
  if (!response.ok) throw new Error('Failed to fetch imports');
  return response.json();
}

export async function getImportTransactions(
  importId: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ transactions: any[]; totalCount: number }> {
  const response = await fetch(
    `${BACKEND_URL}/imports/${importId}/transactions?limit=${limit}&offset=${offset}`
  );
  if (!response.ok) throw new Error('Failed to fetch import transactions');
  return response.json();
}

export async function deleteImport(importId: string): Promise<{ status: string; importId: string }> {
  const response = await fetch(`${BACKEND_URL}/imports/${importId}`, { method: 'DELETE' });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to delete import');
  }
  return response.json();
}
