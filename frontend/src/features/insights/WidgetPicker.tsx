import { useEffect, useState } from "react";
import { WIDGET_REGISTRY } from "./registry";
import { Modal } from "../../shared/ui/Modal";
import { Button } from "../../shared/ui/Button";
import { FilterPill } from "../../shared/ui/FilterPill";
import clsx from "clsx";

export interface WidgetPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (definitionKey: string, title?: string, description?: string) => void;
}

export function WidgetPicker({ isOpen, onClose, onAdd }: WidgetPickerProps) {
  const [selectedWidget, setSelectedWidget] = useState<string | null>(null);
  const [customTitle, setCustomTitle] = useState("");
  const [customDescription, setCustomDescription] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setSelectedWidget(null);
      setCustomTitle("");
      setCustomDescription("");
      setSearchTerm("");
    }
  }, [isOpen]);

  const filteredWidgets = Object.entries(WIDGET_REGISTRY).filter(([_, def]) =>
    def.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    def.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAdd = () => {
    if (selectedWidget) {
      onAdd(selectedWidget, customTitle || undefined, customDescription || undefined);
      setSelectedWidget(null);
      setCustomTitle("");
      setCustomDescription("");
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <Modal open={isOpen} onClose={onClose} title="Add Widget">
      <div className="space-y-6">
        {/* Search */}
        <div>
          <label className="block text-sm font-serif text-gray-700 mb-2">
            Search widgets
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg
                className="h-5 w-5 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Find a widget..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border-gray-300 bg-gray-50 focus:bg-white focus:border-amber-600 focus:ring-amber-600/20 transition-all sm:text-sm"
            />
          </div>
        </div>

        {/* Widget Selection */}
        <div>
          <label className="block text-sm font-serif text-gray-700 mb-3">
            Select a widget to add
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
            {filteredWidgets.map(([key, definition]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedWidget(key)}
                className={clsx(
                  "text-left p-4 rounded-xl border-2 transition-all duration-200",
                  selectedWidget === key
                    ? "border-amber-700 bg-amber-50/50"
                    : "border-gray-200 hover:border-amber-300 hover:bg-amber-50/30"
                )}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-serif text-gray-900">{definition.label}</h4>
                    <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                      {definition.description}
                    </p>
                  </div>
                  <span
                    className={clsx(
                      "ml-2 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                      selectedWidget === key
                        ? "bg-amber-700 text-white"
                        : "bg-gray-100 text-gray-500"
                    )}
                  >
                    {definition.template}
                  </span>
                </div>
                {definition.gridSpan && (
                  <div className="mt-2 flex items-center gap-1">
                    {(definition.gridSpan.md === 2 || definition.gridSpan.md === 3) && (
                      <span className="text-[9px] text-gray-400">Wide</span>
                    )}
                    {definition.gridSpan.rowMd === 2 && (
                      <span className="text-[9px] text-gray-400">Tall</span>
                    )}
                    {definition.gridSpan.rowMd === 3 && (
                      <span className="text-[9px] text-gray-400">Extra Tall</span>
                    )}
                  </div>
                )}
              </button>
            ))}
            {filteredWidgets.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <p className="text-sm">No widgets found</p>
              </div>
            )}
          </div>
        </div>

        {/* Custom Title (Optional) */}
        {selectedWidget && (
          <div className="bg-gray-50/50 rounded-xl p-4 border border-gray-200 space-y-3">
            <div>
              <label className="block text-sm font-serif text-gray-900 mb-2">
                Widget Title (optional)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder={`e.g., ${WIDGET_REGISTRY[selectedWidget].label}`}
                  className="w-full px-4 py-2.5 rounded-lg border-gray-300 focus:border-amber-600 focus:ring-amber-600/20 sm:text-sm transition-colors"
                />
                <div className="absolute right-3 top-2.5">
                  <FilterPill
                    label="Optional"
                    selected={false}
                    onClick={() => {}}
                  />
                </div>
              </div>
              <p className="mt-1.5 text-xs text-gray-500">
                If left blank, will use the default title.
              </p>
            </div>

            <div>
              <label className="block text-sm font-serif text-gray-900 mb-2">
                Widget Description (optional)
              </label>
              <div className="relative">
                <textarea
                  value={customDescription}
                  onChange={(e) => setCustomDescription(e.target.value)}
                  placeholder={`e.g., ${WIDGET_REGISTRY[selectedWidget].description}`}
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-lg border-gray-300 focus:border-amber-600 focus:ring-amber-600/20 sm:text-sm transition-colors resize-none"
                />
              </div>
              <p className="mt-1.5 text-xs text-gray-500">
                If left blank, will use the default description.
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 px-4 py-2 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <Button
            variant="primary"
            onClick={handleAdd}
            disabled={!selectedWidget}
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
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add Widget
          </Button>
        </div>
      </div>
    </Modal>
  );
}
