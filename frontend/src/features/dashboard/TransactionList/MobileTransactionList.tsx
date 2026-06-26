import { useState, memo, useCallback, useRef, useEffect } from "react";
import { Transaction, Category } from "../../../types";
import { formatCurrency } from "../../../shared/lib/format";
import { Card } from "../../../shared/ui/Card";
import { CategoryBadge } from "../../../features/categories/components/CategoryBadge";
import {
  toggleIgnoreTransaction,
  updateTransactionCategory,
} from "../../import/api";
import { useBudget } from "../../../app/providers/BudgetProvider";
import { AddCategoryModal } from "../../categories/AddCategoryModal";

interface Props {
  transactions: Transaction[];
  categories: Category[];
}

export const MobileTransactionList = memo(function MobileTransactionList({
  transactions,
  categories,
}: Props) {
  const { updateTransaction, addCategory } = useBudget();
  const [expandedTxn, setExpandedTxn] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
    null,
  );
  const [addingCategoryForTxn, setAddingCategoryForTxn] = useState<{
    id: string;
    type: Transaction["type"];
  } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const toggleExpand = (id: string) => {
    setExpandedTxn(expandedTxn === id ? null : id);
  };

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

  const handleCategoryEdit = useCallback(
    (txnId: string) => {
      setEditingCategoryId((prev) => (prev === txnId ? null : txnId));
    },
    []
  );

  const handleCategoryChange = useCallback(
    async (txnId: string, categoryId: string) => {
      setEditingCategoryId(null);
      await updateTransactionCategory(txnId, categoryId, true);
      updateTransaction(txnId, { categoryId });
    },
    [updateTransaction]
  );

  const handleToggleIgnored = useCallback(
    async (txn: Transaction) => {
      const updated = await toggleIgnoreTransaction(txn.id);
      updateTransaction(txn.id, updated);
    },
    [updateTransaction]
  );

  const handleAddCategory = useCallback(
    (txnId: string, txnType: Transaction["type"]) => {
      setEditingCategoryId(null);
      setAddingCategoryForTxn({ id: txnId, type: txnType });
    },
    []
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
    [addCategory, updateTransaction, addingCategoryForTxn]
  );

  const getCategoryName = (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId);
    return category?.name || "Uncategorized";
  };

  const getCategoryType = (txnType: string): "income" | "expense" | "transfer" | null => {
    if (txnType === "income") return "income";
    if (txnType === "expense" || txnType === "refund") return "expense";
    if (txnType === "transfer") return "transfer";
    return null;
  };

  const getTypeStyles = (type: string) => {
    const styles: Record<string, string> = {
      income: "bg-gray-50 text-gray-700 border border-gray-200/60",
      expense: "bg-gray-50 text-gray-700 border border-gray-200/60",
      transfer: "bg-amber-50/50 text-amber-700 border border-amber-100",
      refund: "bg-green-50/50 text-green-700 border border-green-100",
      ignored: "bg-gray-50 text-gray-400 border border-gray-200/40",
    };
    return styles[type] || "bg-gray-50 text-gray-600 border border-gray-200/60";
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-4">
      {transactions.length === 0 ? (
        <div className="text-center py-12">
          <div className="mx-auto w-16 h-16 rounded-full bg-gray-100/50 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-500">No transactions yet</p>
          <p className="text-xs text-gray-400 mt-2 max-w-xs mx-auto">Import a CSV file to begin tracking your finances with elegant simplicity.</p>
        </div>
      ) : (
        transactions.map((txn) => (
          <Card key={txn.id} className="overflow-hidden transition-all duration-300">
            <div
              className="p-5 cursor-pointer active:bg-gray-50 transition-colors"
              onClick={() => toggleExpand(txn.id)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {txn.merchant}
                  </p>
                  <p className="text-xs text-gray-500 mt-1 font-medium">
                    {formatDate(txn.date)}
                  </p>
                </div>
                <div className="text-right min-w-[90px]">
                  <p
                    className={`font-serif ${
                      txn.type === "income" ? "text-[#2e8b57]" : txn.type === "expense" ? "text-[#b04a4a]" : "text-gray-900"
                    }`}
                  >
                    {txn.type === "income" ? "+" : txn.type === "expense" ? "-" : ""}{formatCurrency(Math.abs(txn.amount))}
                  </p>
                  <span className="text-xs text-gray-500 mt-1 block font-medium">
                    {getCategoryName(txn.categoryId)}
                  </span>
                </div>
              </div>

              {/* Type row */}
              <div className="px-5 pb-3 pt-0 border-t border-gray-100/50">
                <span
                  className={`text-[10px] px-2.5 py-1.5 uppercase font-medium rounded-full border ${
                    getTypeStyles(txn.type)
                  }`}
                >
                  {txn.type}
                </span>
              </div>
            </div>

            {/* Category dropdown when expanded */}
            {expandedTxn === txn.id && (
              <div ref={dropdownRef} className="border-t border-gray-100/50 bg-gray-50/50 p-4 relative">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Category</span>
                  <CategoryBadge
                    label={getCategoryName(txn.categoryId)}
                    color={categories.find((c) => c.id === txn.categoryId)?.color ?? "#e5e7eb"}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleCategoryEdit(txn.id);
                    }}
                  />
                </div>
                {editingCategoryId === txn.id && (
                  <div
                    className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-900/5 rounded-xl z-20 py-1 max-h-60 overflow-y-auto"
                  >
                    {getCategoryType(txn.type)
                      ? categories
                          .filter(
                            (c) =>
                              c.type === getCategoryType(txn.type) &&
                              c.id !== txn.categoryId &&
                              c.id !== "uncategorized",
                          )
                          .map((c) => (
                            <button
                              key={c.id}
                              onClick={() => handleCategoryChange(txn.id, c.id)}
                              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-amber-50/50 transition-all duration-200 text-left"
                            >
                              <span
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: c.color }}
                              />
                              {c.name}
                            </button>
                          ))
                      : null}
                    <div className="border-t border-gray-100/50 mt-1 pt-1">
                      <button
                        onClick={() => handleAddCategory(txn.id, txn.type)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-amber-700 hover:bg-amber-50/50 transition-all duration-200 text-left font-medium"
                      >
                        <span className="w-3 h-3 rounded-full flex-shrink-0 border-2 border-amber-400 flex items-center justify-center text-[8px] font-bold leading-none">
                          +
                        </span>
                        Add category
                      </button>
                    </div>
                  </div>
                )}
                {/* Ignore button below dropdown */}
                <button
                  className="w-full mt-3 py-2.5 px-4 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:border-gray-300 hover:text-gray-900 transition-all duration-300"
                  onClick={async (e) => {
                    e.stopPropagation();
                    await handleToggleIgnored(txn);
                  }}
                >
                  {txn.isIgnored ? "Unignore" : "Ignore"}
                </button>
              </div>
            )}
          </Card>
        ))
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
});
