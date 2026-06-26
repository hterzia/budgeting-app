import React, { useRef, useState, useMemo } from "react";
import { Account, AccountType } from "../../types";
import { uploadCSV, triggerProcess, createAccount } from "./api";
import { useToast } from "../../shared/ui";
import { useBudget } from "../../app/providers/BudgetProvider";

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
  const { refresh } = useBudget();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [localAccounts, setLocalAccounts] = useState<Account[]>([]);

  const availableAccounts = useMemo(() => {
    const merged = [...accounts, ...localAccounts];
    const seenIds = new Set<string>();
    return merged.filter((acct) => {
      if (!acct.id || seenIds.has(acct.id)) return false;
      seenIds.add(acct.id);
      return true;
    });
  }, [accounts, localAccounts]);

  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [invertAmountSign, setInvertAmountSign] = useState(false);

  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    availableAccounts[0]?.id ?? "",
  );

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<AccountType>("checking");
  const [creating, setCreating] = useState(false);

  const selectedAccount =
    availableAccounts.find((a) => a.id === selectedAccountId) ?? null;

  const processFile = (f: File, account: Account | null) => {
    if (!account) return;
    setFile(f);
    setError(null);
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
  };

  const handleCreateAccount = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const newAcct = await createAccount(newName.trim(), newType);
      await refresh();
      setLocalAccounts((prev) => [...prev, newAcct]);
      setSelectedAccountId(newAcct.id);
      setShowCreateForm(false);
      setNewName("");
      setNewType("checking");
    } catch {
      setError("Failed to create account. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const handleCancelCreate = () => {
    setShowCreateForm(false);
    setNewName("");
    setNewType("checking");
  };

  const handleImport = async () => {
    if (!file || !selectedAccount) return;
    setImporting(true);
    setError(null);

    try {
      const response = await uploadCSV(
        file,
        "00000000-0000-0000-0000-000000000000",
        String(selectedAccount.id),
        invertAmountSign,
      );

      try {
        await triggerProcess(response.importId);
      } catch {
        // Processing might fail if vLLM not available, but import still succeeded
      }

      toast.push(`Imported ${response.totalRows} transactions`, "success");
      await refresh();
      onClose();
    } catch (err: any) {
      setError(err.message || "Import failed. Please try again.");
      toast.push("Import failed", "error");
    } finally {
      setImporting(false);
    }
  };

  const noAccounts = availableAccounts.length === 0;
  const showCreateFormVisible = noAccounts || showCreateForm;
  const canImport = !!selectedAccountId && !!file && !importing;

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
              className="block w-full rounded-lg border border-gray-300 text-sm py-2 px-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
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
            data-testid="csv-file-input"
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
          <span>
            Invert amount sign (treat positive as expense and negative as income/refund)
          </span>
        </label>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2">
        {!showCreateForm && (
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-gray-600 hover:text-gray-800 font-medium"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={handleImport}
          disabled={!canImport}
          className="bg-blue-600 text-white py-2 px-5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {importing ? "Importing..." : "Import"}
        </button>
      </div>
    </div>
  );
}
