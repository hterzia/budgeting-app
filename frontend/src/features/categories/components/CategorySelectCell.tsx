import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { Category, Transaction } from "../../../types";
import { CategoryBadge } from "./CategoryBadge";

interface CategorySelectCellProps {
  txn: Transaction;
  categories: Category[];
  isEditing: boolean;
  containerRef: RefObject<HTMLDivElement>;
  onToggleEdit: (id: string) => void;
  onCategoryChange: (txnId: string, categoryId: string) => void;
  onAddCategory: (txnId: string, txnType: Transaction["type"]) => void;
}

export function CategorySelectCell({
  txn,
  categories,
  isEditing,
  containerRef,
  onToggleEdit,
  onCategoryChange,
  onAddCategory,
}: CategorySelectCellProps) {
  const category = categories.find((c) => c.id === txn.categoryId);
  const bg = category?.color ?? "#e5e7eb";
  const triggerRef = useRef<HTMLDivElement>(null);
  const [openUpward, setOpenUpward] = useState(false);

  useEffect(() => {
    if (isEditing && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setOpenUpward(window.innerHeight - rect.bottom < 280);
    }
  }, [isEditing]);

  // Filter categories by transaction type
  const categoryType: "income" | "expense" | "transfer" | null =
    txn.type === "income"
      ? "income"
      : txn.type === "expense" || txn.type === "refund"
        ? "expense"
        : txn.type === "transfer"
          ? "transfer"
          : null;

  const filteredCategories = categoryType
    ? categories.filter(
        (c) => c.type === categoryType && c.id !== txn.categoryId && c.id !== 'uncategorized',
      )
    : [];

  return (
    <div ref={isEditing ? containerRef : null} className="relative inline-block">
      <div ref={triggerRef}>
        <CategoryBadge
          label={category?.name ?? "Uncategorized"}
          color={bg}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleEdit(txn.id);
          }}
        />
      </div>
      {isEditing && (
        <div
          className={`absolute left-0 w-48 bg-white border border-gray-200 rounded-lg z-10 py-1 max-h-60 overflow-y-auto ${
            openUpward ? "bottom-full mb-1" : "top-full mt-1"
          }`}
        >
          {filteredCategories.map((c) => (
            <button
              key={c.id}
              onClick={() => onCategoryChange(txn.id, c.id)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors text-left"
            >
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: c.color }}
              />
              {c.name}
            </button>
          ))}
          {/* Add category button only if there's a matching category type */}
          {categoryType ? (
            <div className="border-t border-gray-100 mt-1 pt-1">
              <button
                onClick={() => onAddCategory(txn.id, txn.type)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 transition-colors text-left font-medium"
              >
                <span className="w-3 h-3 rounded-full flex-shrink-0 border-2 border-indigo-400 flex items-center justify-center text-[8px] font-bold leading-none">
                  +
                </span>
                Add category
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
