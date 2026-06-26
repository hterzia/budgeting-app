import { useState, useEffect } from "react";
import { WidgetInstanceGridSpan } from "./types";
import { WIDGET_REGISTRY } from "./registry";
import { Modal } from "../../shared/ui/Modal";
import { Button } from "../../shared/ui/Button";
import clsx from "clsx";

export interface WidgetConfigurationModalProps {
  isOpen: boolean;
  onClose: () => void;
  widgetType: string;
  currentTitle?: string;
  currentDescription?: string;
  currentGridSpan?: WidgetInstanceGridSpan;
  onSave: (updates: { title?: string; description?: string; gridSpan?: WidgetInstanceGridSpan }) => void;
}

export function WidgetConfigurationModal({
  isOpen,
  onClose,
  widgetType,
  currentTitle,
  currentDescription,
  currentGridSpan,
  onSave,
}: WidgetConfigurationModalProps) {
  const [title, setTitle] = useState(currentTitle ?? "");
  const [description, setDescription] = useState(currentDescription ?? "");

  const definition = WIDGET_REGISTRY[widgetType];
  const defaultGridSpan = definition.gridSpan;

  // Initialize grid values from current, falling back to definition defaults
  // These are never null - they always have a value (from instance or default)
  const [gridMd, setGridMd] = useState<1 | 2 | 3>(currentGridSpan?.md ?? defaultGridSpan?.md ?? 1);
  const [gridLg, setGridLg] = useState<1 | 2 | 3>(currentGridSpan?.lg ?? defaultGridSpan?.lg ?? 1);
  const [gridRowMd, setGridRowMd] = useState<1 | 2 | 3>(currentGridSpan?.rowMd ?? defaultGridSpan?.rowMd ?? 1);
  const [gridRowLg, setGridRowLg] = useState<1 | 2 | 3>(currentGridSpan?.rowLg ?? defaultGridSpan?.rowLg ?? 1);

  // Reset form when modal opens - use definition defaults as baseline
  useEffect(() => {
    if (isOpen) {
      setTitle(currentTitle ?? "");
      setDescription(currentDescription ?? "");
      // Use merged value (instance overrides + definition defaults)
      setGridMd(currentGridSpan?.md ?? defaultGridSpan?.md ?? 1);
      setGridLg(currentGridSpan?.lg ?? defaultGridSpan?.lg ?? 1);
      setGridRowMd(currentGridSpan?.rowMd ?? defaultGridSpan?.rowMd ?? 1);
      setGridRowLg(currentGridSpan?.rowLg ?? defaultGridSpan?.rowLg ?? 1);
    }
  }, [isOpen, currentTitle, currentDescription, currentGridSpan, defaultGridSpan]);

  const handleSave = () => {
    const gridSpan: WidgetInstanceGridSpan = { md: gridMd, lg: gridLg, rowMd: gridRowMd, rowLg: gridRowLg };

    onSave({
      title: title.trim() || undefined,
      description: description.trim() || undefined,
      gridSpan,
    });

    onClose();
  };

  const resetToDefaults = () => {
    setTitle("");
    setDescription("");
    setGridMd(defaultGridSpan?.md ?? 1);
    setGridLg(defaultGridSpan?.lg ?? 1);
    setGridRowMd(defaultGridSpan?.rowMd ?? 1);
    setGridRowLg(defaultGridSpan?.rowLg ?? 1);
  };

  if (!isOpen || !definition) return null;

  return (
    <Modal open={isOpen} onClose={onClose} title="Configure Widget">
      <div className="space-y-6">
        {/* Title */}
        <div>
          <label className="block text-sm font-serif text-gray-900 mb-2">
            Widget Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={definition.label}
            className="w-full px-4 py-2.5 rounded-xl border-gray-200 bg-gray-50 focus:bg-white focus:border-amber-600 focus:ring-amber-600/20 transition-all sm:text-sm"
          />
          <p className="mt-1.5 text-xs text-gray-500">
            Leave empty to use the default title: "{definition.label}"
          </p>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-serif text-gray-900 mb-2">
            Widget Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={definition.description}
            rows={3}
            className="w-full px-4 py-2.5 rounded-xl border-gray-200 bg-gray-50 focus:bg-white focus:border-amber-600 focus:ring-amber-600/20 transition-all sm:text-sm resize-none"
          />
          <p className="mt-1.5 text-xs text-gray-500">
            Leave empty to use the default description: "{definition.description}"
          </p>
        </div>

        {/* Size Configuration */}
        <div className="pt-4 border-t border-gray-200">
          <label className="block text-sm font-serif text-gray-900 mb-3">
            Widget Size
          </label>

          {/* Grid Width */}
          <div className="space-y-2">
            <span className="text-xs font-medium text-gray-700">Width</span>
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => { setGridMd(1); setGridLg(1); }}
                className={clsx(
                  "flex items-center justify-center px-3 py-2 rounded-lg text-sm font-medium transition-all",
                  gridMd === 1
                    ? "bg-amber-700 text-white"
                    : "bg-white border border-gray-200 text-gray-700 hover:border-amber-300 hover:bg-amber-50/50"
                )}
              >
                <div className="w-8 h-8 border-2 border-current rounded flex items-center justify-center">
                  <div className="w-3 h-3 bg-current rounded-sm"></div>
                </div>
                <span className="ml-2">1</span>
              </button>
              <button
                type="button"
                onClick={() => { setGridMd(2); setGridLg(2); }}
                className={clsx(
                  "flex items-center justify-center px-3 py-2 rounded-lg text-sm font-medium transition-all",
                  gridMd === 2
                    ? "bg-amber-700 text-white"
                    : "bg-white border border-gray-200 text-gray-700 hover:border-amber-300 hover:bg-amber-50/50"
                )}
              >
                <div className="w-8 h-8 border-2 border-current rounded flex items-center justify-center">
                  <div className="w-6 h-3 bg-current rounded-sm"></div>
                </div>
                <span className="ml-2">2</span>
              </button>
              <button
                type="button"
                onClick={() => { setGridMd(3); setGridLg(3); }}
                className={clsx(
                  "flex items-center justify-center px-3 py-2 rounded-lg text-sm font-medium transition-all",
                  gridMd === 3
                    ? "bg-amber-700 text-white"
                    : "bg-white border border-gray-200 text-gray-700 hover:border-amber-300 hover:bg-amber-50/50"
                )}
              >
                <div className="w-8 h-8 border-2 border-current rounded flex items-center justify-center">
                  <div className="w-8 h-3 bg-current rounded-sm"></div>
                </div>
                <span className="ml-2">3</span>
              </button>
            </div>
            <p className="text-xs text-gray-500">
              How many columns wide
            </p>
          </div>

          {/* Row Height */}
          <div className="space-y-2 mt-4">
            <span className="text-xs font-medium text-gray-700">Height (Rows)</span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => { setGridRowMd(1); setGridRowLg(1); }}
                className={clsx(
                  "flex items-center justify-center px-3 py-2 rounded-lg text-sm font-medium transition-all",
                  gridRowMd === 1
                    ? "bg-amber-700 text-white"
                    : "bg-white border border-gray-200 text-gray-700 hover:border-amber-300 hover:bg-amber-50/50"
                )}
              >
                <div className="flex flex-col items-center">
                  <div className="w-3 h-3 border-2 border-current rounded-sm mb-0.5"></div>
                  <span className="text-[9px]">1</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => { setGridRowMd(2); setGridRowLg(2); }}
                className={clsx(
                  "flex items-center justify-center px-3 py-2 rounded-lg text-sm font-medium transition-all",
                  gridRowMd === 2
                    ? "bg-amber-700 text-white"
                    : "bg-white border border-gray-200 text-gray-700 hover:border-amber-300 hover:bg-amber-50/50"
                )}
              >
                <div className="flex flex-col items-center">
                  <div className="w-3 h-3 border-2 border-current rounded-sm mb-0.5"></div>
                  <div className="w-3 h-3 border-2 border-current rounded-sm -mt-0.5"></div>
                  <span className="text-[9px]">2</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => { setGridRowMd(3); setGridRowLg(3); }}
                className={clsx(
                  "flex items-center justify-center px-3 py-2 rounded-lg text-sm font-medium transition-all",
                  gridRowMd === 3
                    ? "bg-amber-700 text-white"
                    : "bg-white border border-gray-200 text-gray-700 hover:border-amber-300 hover:bg-amber-50/50"
                )}
              >
                <div className="flex flex-col items-center">
                  <div className="w-3 h-3 border-2 border-current rounded-sm mb-0.5"></div>
                  <div className="w-3 h-3 border-2 border-current rounded-sm -mt-0.5"></div>
                  <div className="w-3 h-3 border-2 border-current rounded-sm -mt-0.5"></div>
                  <span className="text-[9px]">3</span>
                </div>
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Number of rows the widget should span
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={resetToDefaults}
            className="text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 px-4 py-2 rounded-lg transition-colors"
          >
            Reset
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 px-4 py-2 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <Button
              variant="primary"
              onClick={handleSave}
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Save Configuration
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
