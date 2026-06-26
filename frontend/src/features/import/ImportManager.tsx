import React, { useState, useEffect, useMemo } from 'react';
import { useBudget } from '../../app/providers/BudgetProvider';
import { useToast } from '../../shared/ui';
import {
  getImports,
  deleteImport,
  ImportStatus,
  uploadCSV,
  triggerProcess,
  getImportTransactions,
} from './api';
import { formatCurrency } from '../../utils/format';

interface ImportStats {
  totalImports: number;
  totalTransactions: number;
  importsNeedingReview: number;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).format(date);
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    uploaded: 'bg-gray-500',
    parsing: 'bg-blue-500',
    embedding: 'bg-indigo-500',
    categorizing: 'bg-purple-500',
    completed: 'bg-green-500',
    failed: 'bg-red-500',
  };
  return colors[status] || 'bg-gray-500';
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    uploaded: 'Uploaded',
    parsing: 'Parsing',
    embedding: 'Embedding',
    categorizing: 'Categorizing',
    completed: 'Completed',
    failed: 'Failed',
  };
  return labels[status] || status;
}

export function ImportManager() {
  const toast = useToast();
  const { accounts, refresh } = useBudget();
  const [imports, setImports] = useState<ImportStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedImportId, setExpandedImportId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Record<string, any[]>>({});
  const [showImportForm, setShowImportForm] = useState(false);

  const stats = useMemo<ImportStats>(() => {
    return imports.reduce(
      (acc, imp) => {
        acc.totalImports += 1;
        acc.totalTransactions += Number(imp.totalRows || 0);
        if (Number(imp.needsReviewRows || 0) > 0) acc.importsNeedingReview += 1;
        return acc;
      },
      { totalImports: 0, totalTransactions: 0, importsNeedingReview: 0 }
    );
  }, [imports]);

  useEffect(() => {
    fetchImports();
  }, []);

  const fetchImports = async () => {
    try {
      const data = await getImports();
      setImports(data.imports);
    } catch (err: any) {
      toast.push('Failed to load imports', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async (importId: string) => {
    if (transactions[importId]) return;

    try {
      const data = await getImportTransactions(importId, 50, 0);
      setTransactions((prev) => ({ ...prev, [importId]: data.transactions }));
    } catch (err: any) {
      toast.push('Failed to load transactions', 'error');
    }
  };

  const handleDelete = async (importId: string) => {
    if (!window.confirm('This will permanently delete this import and all its transactions. Continue?')) {
      return;
    }

    setDeletingId(importId);
    try {
      await deleteImport(importId);
      toast.push('Import deleted successfully', 'success');
      await refresh();
      setImports((prev) => prev.filter((i) => i.id !== importId));
      setExpandedImportId(null);
    } catch (err: any) {
      toast.push('Failed to delete import', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const toggleExpand = (importId: string) => {
    if (expandedImportId === importId) {
      setExpandedImportId(null);
    } else {
      setExpandedImportId(importId);
      fetchTransactions(importId);
    }
  };

  const getAccountName = (accountId: string | null): string => {
    if (!accountId) return 'Unknown';
    const account = accounts.find((a) => a.id === accountId);
    return account?.name || 'Unknown';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Imports</h1>
        <p className="text-gray-500 mt-1">View and manage your CSV imports</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-500">Total Imports</div>
          <div className="text-2xl font-semibold text-gray-900">{stats.totalImports}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-500">Total Transactions</div>
          <div className="text-2xl font-semibold text-gray-900">{stats.totalTransactions}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-500">Needs Review</div>
          <div className="text-2xl font-semibold text-gray-900">{stats.importsNeedingReview}</div>
        </div>
      </div>

      {/* Import Form Toggle */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <button
          onClick={() => setShowImportForm(!showImportForm)}
          className="w-full px-6 py-4 text-left font-medium text-gray-700 hover:bg-gray-50 flex items-center justify-between"
        >
          <span>+ Import New CSV</span>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${showImportForm ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showImportForm && (
          <div className="border-t border-gray-200 p-6">
            <ImportCSVForm
              accounts={accounts}
              onCancel={() => setShowImportForm(false)}
            />
          </div>
        )}
      </div>

      {/* Imports List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Import History</h2>
        </div>

        {imports.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500">
            <svg
              className="mx-auto h-12 w-12 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="mt-2">No imports yet. Upload a CSV to get started.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {imports.map((imp) => (
              <div key={imp.id} className="hover:bg-gray-50 transition-colors">
                {/* Summary Row */}
                <div
                  className="px-6 py-4 cursor-pointer flex items-center justify-between"
                  onClick={() => toggleExpand(imp.id)}
                >
                  <div className="flex items-center space-x-4">
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(imp.status)}`}></div>
                    <div>
                      <div className="flex items-center space-x-3">
                        <span className="text-sm font-medium text-gray-900">
                          Import #{imp.id.slice(0, 8)}...
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatDate(imp.createdAt)}
                        </span>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            imp.status === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : imp.status === 'failed'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {getStatusLabel(imp.status)}
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-gray-500">
                        {Number(imp.totalRows || 0).toLocaleString()} rows |
                        {Number(imp.embeddedRows || 0).toLocaleString()} embedded |
                        {Number(imp.autoCategorizedRows || 0).toLocaleString()} auto-categorized |
                        {Number(imp.needsReviewRows || 0).toLocaleString()} needs review
                      </div>
                      <div className="mt-1 text-xs text-gray-400">
                        Account: {getAccountName(imp.accountId || null)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(imp.id);
                      }}
                      className="p-2 text-gray-400 hover:text-gray-600"
                    >
                      <svg
                        className={`w-5 h-5 transition-transform ${expandedImportId === imp.id ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(imp.id);
                      }}
                      disabled={deletingId === imp.id}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                    >
                      {deletingId === imp.id ? (
                        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedImportId === imp.id && transactions[imp.id] && (
                  <div className="px-6 pb-4 border-t border-gray-200">
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Recent Transactions</h4>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Merchant</th>
                              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {transactions[imp.id].slice(0, 10).map((tx: any) => (
                              <tr key={tx.id}>
                                <td className="px-3 py-2 text-sm text-gray-500">{tx.posted_at}</td>
                                <td className="px-3 py-2 text-sm text-gray-900">{tx.merchant_clean || '-'}</td>
                                <td className="px-3 py-2 text-sm text-gray-900 text-right">
                                  {formatCurrency(tx.amount_cents / 100, { currency: tx.currency || 'USD' })}
                                </td>
                                <td className="px-3 py-2 text-sm text-gray-500">
                                  {tx.category_id ? 'Categorized' : 'Uncategorized'}
                                </td>
                                <td className="px-3 py-2 text-sm text-gray-500">
                                  {tx.category_source || 'unknown'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {transactions[imp.id].length > 10 && (
                        <p className="text-xs text-gray-500 mt-2">
                          Showing 10 of {transactions[imp.id].length} transactions
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Separate ImportCSVForm component
interface ImportCSVFormProps {
  accounts: any[];
  onCancel: () => void;
}

function ImportCSVForm({ accounts, onCancel }: ImportCSVFormProps) {
  const toast = useToast();
  const { refresh } = useBudget();
  const [file, setFile] = useState<File | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string>(accounts[0]?.id ?? '');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [invertAmountSign, setInvertAmountSign] = useState(false);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) ?? null;

  const processFile = (f: File) => {
    setFile(f);
    setError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f?.name.toLowerCase().endsWith('.csv')) {
      processFile(f);
    }
  };

  const handleImport = async () => {
    if (!file || !selectedAccount) return;
    setImporting(true);
    setError(null);

    try {
      const response = await uploadCSV(
        file,
        '00000000-0000-0000-0000-000000000000',
        selectedAccountId,
        invertAmountSign
      );

      try {
        await triggerProcess(response.importId);
      } catch {
        // Processing might fail if vLLM not available
      }

      toast.push(`Imported ${response.totalRows} transactions`, 'success');
      await refresh();
      onCancel();
    } catch (err: any) {
      setError(err.message || 'Import failed. Please try again.');
      toast.push('Import failed', 'error');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Account</label>
        <select
          value={selectedAccountId}
          onChange={(e) => setSelectedAccountId(e.target.value)}
          className="block w-full rounded-lg border border-gray-300 text-sm py-2 px-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
        >
          {accounts.map((acct) => (
            <option key={acct.id} value={acct.id}>
              {acct.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div
          onClick={() => document.getElementById('file-input')?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragging
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
          }`}
        >
          <svg className="mx-auto w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-sm text-gray-500">
            Drop your CSV here or <span className="text-blue-600 font-medium">browse</span>
          </p>
          <input
            id="file-input"
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {file && (
          <div className="mt-3">
            <p className="text-sm text-gray-600">
              <span className="font-medium">{file.name}</span>
            </p>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
        <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={invertAmountSign}
            onChange={(e) => setInvertAmountSign(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span>Invert amount sign (treat positive as expense and negative as income/refund)</span>
        </label>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>
      )}

      <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-gray-600 hover:text-gray-800 font-medium"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleImport}
          disabled={!file || importing}
          className="bg-blue-600 text-white py-2 px-5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {importing ? 'Importing...' : 'Import'}
        </button>
      </div>
    </div>
  );
}
