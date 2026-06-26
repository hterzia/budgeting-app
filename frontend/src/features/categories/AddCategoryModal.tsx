import { useState, useCallback, useEffect } from "react";
import { Modal } from "../../shared/ui/Modal";
import { createCategory } from "../import/api";
import { Category } from "../../types";

const COLOR_PALETTE = [
  { hex: "#22c55e", label: "Green" },
  { hex: "#f97316", label: "Orange" },
  { hex: "#3b82f6", label: "Blue" },
  { hex: "#8b5cf6", label: "Purple" },
  { hex: "#ec4899", label: "Pink" },
  { hex: "#ef4444", label: "Red" },
  { hex: "#a855f7", label: "Violet" },
  { hex: "#0ea5e9", label: "Sky" },
  { hex: "#14b8a6", label: "Teal" },
  { hex: "#84cc16", label: "Lime" },
  { hex: "#f59e0b", label: "Amber" },
  { hex: "#6366f1", label: "Indigo" },
  { hex: "#16a34a", label: "Dark Green" },
  { hex: "#94a3b8", label: "Slate" },
  { hex: "#6b7280", label: "Gray" },
  { hex: "#9ca3af", label: "Cool Gray" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (category: Category) => void;
  defaultType?: "income" | "expense" | "transfer";
}

export function AddCategoryModal({
  open,
  onClose,
  onCreated,
  defaultType = "expense",
}: Props) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"expense" | "income" | "transfer">(
    defaultType,
  );
  const [color, setColor] = useState(COLOR_PALETTE[0].hex);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setName("");
    setType(defaultType as "expense" | "income" | "transfer");
    setColor(COLOR_PALETTE[0].hex);
    setError(null);
    setIsSubmitting(false);
  }, [defaultType]);

  // Re-sync type to defaultType whenever the modal opens
  useEffect(() => {
    if (open) setType(defaultType as "expense" | "income" | "transfer");
  }, [open, defaultType]);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = name.trim();
      if (!trimmed) {
        setError("Name is required.");
        return;
      }
      setIsSubmitting(true);
      setError(null);
      try {
        const category = await createCategory(trimmed, type, color);
        reset();
        onCreated(category);
      } catch (err: any) {
        setError(err.message ?? "Failed to create category.");
        setIsSubmitting(false);
      }
    },
    [name, type, color, reset, onCreated],
  );

  return (
    <Modal open={open} onClose={handleClose} title="New category">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Name */}
        <div>
          <label
            htmlFor="cat-name"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Name
          </label>
          <input
            id="cat-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Pet Care"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
            autoFocus
            disabled={isSubmitting}
          />
        </div>

        {/* Type */}
        <div>
          <span className="block text-sm font-medium text-gray-700 mb-1">
            Type
          </span>
          <div className="flex gap-2">
            {(["expense", "transfer", "income"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                disabled={isSubmitting}
                className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors capitalize
                  ${
                    type === t
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                  }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Color */}
        <div>
          <span className="block text-sm font-medium text-gray-700 mb-2">
            Color
          </span>
          <div className="flex flex-wrap gap-2">
            {COLOR_PALETTE.map(({ hex, label }) => (
              <button
                key={hex}
                type="button"
                title={label}
                onClick={() => setColor(hex)}
                disabled={isSubmitting}
                className={`w-7 h-7 rounded-full transition-transform focus:outline-none
                  ${color === hex ? "ring-2 ring-offset-2 ring-gray-500 scale-110" : "hover:scale-110"}`}
                style={{ backgroundColor: hex }}
                aria-label={label}
                aria-pressed={color === hex}
              />
            ))}
          </div>
          {/* Preview */}
          <div className="mt-3 flex items-center gap-2">
            <span
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
              style={{ backgroundColor: color }}
            >
              {name.trim() || "Preview"}
            </span>
            <span className="text-xs text-gray-400">{color}</span>
          </div>
        </div>

        {/* Error */}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !name.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Creating…" : "Create category"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
