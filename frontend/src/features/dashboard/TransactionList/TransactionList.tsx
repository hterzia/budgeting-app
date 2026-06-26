import { useState, useMemo, useEffect, useRef, useCallback, memo, useLayoutEffect } from "react";
import { Transaction, Category } from "../../../types";
import { formatCurrency } from "../../../shared/lib/format";
import {
  toggleIgnoreTransaction,
  updateTransactionCategory,
} from "../../import/api";
import { useBudget } from "../../../app/providers/BudgetProvider";
import { AddCategoryModal } from "../../categories/AddCategoryModal";
import { CategorySelectCell } from "../../categories/components";
import { MobileTransactionList } from "./MobileTransactionList";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 25;

type SortDirection = "asc" | "desc" | null;
type SortColumn = "date" | "merchant" | "category" | "amount" | "type" | null;
type ColumnId = SortColumn | "ignore";

interface Props {
  transactions: Transaction[];
  categories: Category[];
}

const COLUMNS: {
  id: ColumnId;
  label: string;
  align?: "left" | "right" | "center";
}[] = [
  { id: "date", label: "Date", align: "left" },
  { id: "merchant", label: "Merchant", align: "left" },
  { id: "category", label: "Category", align: "left" },
  { id: "amount", label: "Amount", align: "right" },
  { id: "type", label: "Type", align: "center" },
  { id: "ignore", label: "", align: "center" },
];

const sortTransactions = (
  transactions: Transaction[],
  column: SortColumn,
  direction: SortDirection,
) => {
  if (direction === null) return transactions;

  const multiplier = direction === "asc" ? 1 : -1;

  return [...transactions].sort((a, b) => {
    let comparison = 0;

    switch (column) {
      case "date":
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
        break;
      case "merchant":
        comparison = a.merchant.localeCompare(b.merchant);
        break;
      case "category":
        comparison = a.categoryId.localeCompare(b.categoryId);
        break;
      case "amount":
        comparison = a.amount - b.amount;
        break;
      case "type":
        comparison = a.type.localeCompare(b.type);
        break;
    }

    return comparison * multiplier;
  });
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const typeBadge = (type: string) => {
  switch (type) {
    case "income":
      return "bg-gray-50 text-gray-700 border border-gray-200/60";
    case "expense":
      return "bg-gray-50 text-gray-700 border border-gray-200/60";
    case "transfer":
      return "bg-amber-50/50 text-amber-700 border border-amber-100";
    case "refund":
      return "bg-green-50/50 text-green-700 border border-green-100";
    case "ignored":
      return "bg-gray-50 text-gray-400 border border-gray-200/40";
    default:
      return "bg-gray-50 text-gray-600 border border-gray-200/60";
  }
};

interface TransactionRowProps {
  txn: Transaction;
  categories: Category[];
  isEditing: boolean;
  containerRef: React.RefObject<HTMLDivElement>;
  onToggleEdit: (id: string) => void;
  onCategoryChange: (txnId: string, categoryId: string) => void;
  onToggleIgnored: (txn: Transaction) => void;
  onAddCategory: (txnId: string, txnType: Transaction["type"]) => void;
}

const TransactionRow = memo(function TransactionRow({
  txn,
  categories,
  isEditing,
  containerRef,
  onToggleEdit,
  onCategoryChange,
  onToggleIgnored,
  onAddCategory,
}: TransactionRowProps) {
  return (
    <tr
      className={`group transition-all duration-300 ${
        txn.isIgnored ? "bg-gray-50/30 opacity-60" : "hover:bg-amber-50/20"
      }`}
    >
      <td className="px-6 py-4 text-sm font-medium text-gray-600">
        {formatDate(txn.date)}
      </td>
      <td className="px-6 py-4 text-sm font-medium text-gray-900">
        {txn.merchant}
      </td>
      <td className="px-6 py-4 text-sm text-gray-600 relative">
        <CategorySelectCell
          txn={txn}
          categories={categories}
          isEditing={isEditing}
          containerRef={containerRef}
          onToggleEdit={onToggleEdit}
          onCategoryChange={onCategoryChange}
          onAddCategory={onAddCategory}
        />
      </td>
      <td className="px-6 py-4 text-sm text-right font-serif">
        <span className={txn.type === "income" ? "text-[#2e8b57]" : txn.type === "expense" ? "text-[#b04a4a]" : "text-gray-900"}>
          {txn.type === "income" ? "+" : txn.type === "expense" ? "-" : ""}{formatCurrency(Math.abs(txn.amount))}
        </span>
      </td>
      <td className="px-6 py-4 text-center">
        <span
          className={`inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-full border ${
            typeBadge(txn.type)
          }`}
        >
          {txn.type}
        </span>
      </td>
      <td className="px-6 py-4 text-center">
        <button
          onClick={() => onToggleIgnored(txn)}
          className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900 transition-all duration-300"
          title={txn.isIgnored ? "Click to unignore" : "Click to ignore"}
        >
          {txn.isIgnored ? "Unignore" : "Ignore"}
        </button>
      </td>
    </tr>
  );
});

// Hook to detect if we're on mobile
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useLayoutEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return isMobile;
}

export function TransactionList({ transactions, categories }: Props) {
  const isMobile = useIsMobile();
  const { updateTransaction, addCategory } = useBudget();
  const [sortState, setSortState] = useState<[SortColumn, SortDirection]>([
    "date",
    "desc",
  ]);
  const [sortColumn, sortDirection] = sortState;
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Reset to page 0 only when transactions array length changes or filter changes
  // Not on individual transaction updates (like category changes)
  const prevTransactionsRef = useRef<Transaction[]>([]);

  useEffect(() => {
    if (prevTransactionsRef.current.length !== transactions.length) {
      setCurrentPage(0);
    }
    prevTransactionsRef.current = transactions;
  }, [transactions]);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
    null,
  );
  const [addingCategoryForTxn, setAddingCategoryForTxn] = useState<{
    id: string;
    type: Transaction["type"];
  } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editingCategoryId) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setEditingCategoryId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [editingCategoryId]);

  const sortedTransactions = useMemo(() => {
    if (sortColumn === null) return transactions;
    return sortTransactions(transactions, sortColumn, sortDirection);
  }, [transactions, sortColumn, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedTransactions.length / pageSize));
  const paginatedTransactions = useMemo(() => {
    const start = currentPage * pageSize;
    return sortedTransactions.slice(start, start + pageSize);
  }, [sortedTransactions, currentPage, pageSize]);

  const handleToggleIgnored = useCallback(
    async (txn: Transaction) => {
      const updated = await toggleIgnoreTransaction(txn.id);
      updateTransaction(txn.id, updated);
    },
    [updateTransaction],
  );

  const handleCategoryChange = useCallback(
    async (txnId: string, categoryId: string) => {
      setEditingCategoryId(null);
      await updateTransactionCategory(txnId, categoryId, true);
      updateTransaction(txnId, { categoryId });
    },
    [updateTransaction],
  );

  const handleToggleEdit = useCallback((txnId: string) => {
    setEditingCategoryId((prev) => (prev === txnId ? null : txnId));
  }, []);

  const handleAddCategory = useCallback(
    (txnId: string, txnType: Transaction["type"]) => {
      setEditingCategoryId(null);
      setAddingCategoryForTxn({ id: txnId, type: txnType });
    },
    [],
  );

  const handleCategoryCreated = useCallback(
    async (category: Category) => {
      const txnId = addingCategoryForTxn?.id ?? null;
      setAddingCategoryForTxn(null);
      addCategory(category);
      if (txnId) {
        await updateTransactionCategory(txnId, category.id, true);
        updateTransaction(txnId, { categoryId: category.id });
      }
    },
    [addCategory, updateTransaction, addingCategoryForTxn],
  );

  const handleSort = useCallback((column: ColumnId) => {
    if (column === "ignore") return;
    setSortState((current) => {
      const [currentColumn, currentDirection] = current;
      if (currentColumn !== column) return [column, "asc"];
      if (currentDirection === "asc") return [column, "desc"];
      return [column, "asc"];
    });
    setCurrentPage(0);
  }, []);

  // Render mobile view on mobile devices
  if (isMobile) {
    return (
      <MobileTransactionList
        transactions={transactions}
        categories={categories}
      />
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-900/5 overflow-hidden transition-all duration-300">
      <table className="w-full">
        <thead className="bg-gray-50/80 border-b border-gray-200/50">
          <tr>
            {COLUMNS.map((col) => (
              <th
                key={col.id}
                onClick={() => handleSort(col.id)}
                className={`px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-widest cursor-pointer transition-all duration-300 hover:text-amber-700 hover:bg-amber-50/30 ${
                  col.align === "right"
                    ? "text-right"
                    : col.align === "center"
                      ? "text-center"
                      : "text-left"
                }`}
              >
                <div
                  className={`flex items-center ${col.align === "right" ? "justify-end" : col.align === "center" ? "justify-center" : "justify-start"}`}
                >
                  <span className="font-serif">{col.label}</span>
                  <span
                    className={`ml-2 transition-all duration-300 ${
                      sortColumn === col.id ? "opacity-100 text-amber-700" : "opacity-30 text-gray-400"
                    }`}
                  >
                    {sortColumn === col.id
                      ? sortDirection === "asc"
                        ? "↑"
                        : "↓"
                      : "↕"}
                  </span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100/50">
          {sortedTransactions.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-6 py-16 text-center">
                <div className="space-y-4">
                  <div className="mx-auto w-16 h-16 rounded-full bg-gray-100/50 flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-500 font-medium">No transactions yet</p>
                  <p className="text-xs text-gray-400 max-w-xs mx-auto">Import a CSV file to begin tracking your finances with elegant simplicity.</p>
                </div>
              </td>
            </tr>
          ) : (
            paginatedTransactions.map((txn) => (
              <TransactionRow
                key={txn.id}
                txn={txn}
                categories={categories}
                isEditing={editingCategoryId === txn.id}
                containerRef={dropdownRef}
                onToggleEdit={handleToggleEdit}
                onCategoryChange={handleCategoryChange}
                onToggleIgnored={handleToggleIgnored}
                onAddCategory={handleAddCategory}
              />
            ))
          )}
        </tbody>
      </table>
      {sortedTransactions.length > 0 && (
        <div className="flex items-center justify-between px-6 py-5 bg-gray-50/40 border-t border-gray-200/50 text-sm text-gray-600">
          <div className="flex items-center gap-6">
            <span className="text-sm font-medium text-gray-700">
              Showing <span className="font-serif text-gray-900">{currentPage * pageSize + 1}</span>–<span className="font-serif text-gray-900">{Math.min((currentPage + 1) * pageSize, sortedTransactions.length)}</span> of <span className="font-serif text-gray-900">{sortedTransactions.length}</span>
            </span>
            <div className="h-6 w-px bg-gray-200/60" />
            <label className="flex items-center gap-2 group cursor-pointer">
              <span className="text-sm text-gray-500 uppercase tracking-widest">Per page</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(0);
                }}
                className="border border-gray-300/60 rounded-lg px-3 py-1.5 bg-white text-gray-700 text-sm font-medium cursor-pointer hover:border-amber-400 hover:text-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500/10 focus:border-amber-500 transition-all duration-300"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:border-gray-400 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white transition-all duration-300"
            >
              ← Previous
            </button>
            <span className="px-3 py-1.5 text-sm font-medium text-gray-500 font-serif">
              Page <span className="text-gray-900">{currentPage + 1}</span> of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage >= totalPages - 1}
              className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:border-gray-400 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white transition-all duration-300"
            >
              Next →
            </button>
          </div>
        </div>
      )}
      <AddCategoryModal
        open={addingCategoryForTxn !== null}
        onClose={() => setAddingCategoryForTxn(null)}
        onCreated={handleCategoryCreated}
        defaultType={
          addingCategoryForTxn?.type === "income" ? "income" :
          addingCategoryForTxn?.type === "transfer" ? "transfer" :
          "expense"
        }
      />
    </div>
  );
}
