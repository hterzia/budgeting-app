import { useState } from "react";
import { useInsightsState } from "../../features/insights/useInsightsState";
import { WIDGET_REGISTRY } from "../../features/insights/registry";
import { WidgetCard } from "../../features/insights/WidgetCard";
import { WidgetPicker } from "../../features/insights/WidgetPicker";
import { WidgetInstanceGridSpan } from "../../features/insights/types";
import { Button } from "../../shared/ui/Button";
import clsx from "clsx";

type GridSpan = WidgetInstanceGridSpan & {
  md?: 1 | 2 | 3;
  lg?: 1 | 2 | 3;
  rowMd?: 1 | 2 | 3;
  rowLg?: 1 | 2 | 3;
};

export function InsightsPage() {
  const { widgets, addWidget, removeWidget, updateWidgetFilters, updateWidgetConfig } = useInsightsState();
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-900/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="flex items-center justify-between flex-wrap gap-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-serif text-gray-900 tracking-tight">Insights</h1>
              <p className="mt-2 text-xs tracking-widest text-gray-500 uppercase font-medium">
                Customize your financial dashboard
              </p>
            </div>
            <Button
              onClick={() => setIsPickerOpen(true)}
              className={clsx(
                "px-5 py-2.5 rounded-xl",
                "bg-amber-700 text-white",
                "hover:bg-amber-800",
                "transition-all duration-300",
                "text-sm sm:text-base font-medium"
              )}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4 sm:w-5 sm:h-5 mr-2"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                  clipRule="evenodd"
                />
              </svg>
              Add Widget
            </Button>
          </div>
        </div>
      </div>

      {/* Widget Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {widgets.length === 0 ? (
          <div className="text-center py-16 sm:py-24">
            <div className="mx-auto h-20 w-20 sm:h-28 sm:w-28 text-amber-200">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-20 w-20 sm:h-28 sm:w-28"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <h3 className="mt-4 text-lg font-serif text-gray-900">No widgets yet</h3>
            <p className="mt-2 text-sm text-gray-500">Get started by adding your first widget.</p>
            <div className="mt-8">
              <Button
                onClick={() => setIsPickerOpen(true)}
                className={clsx(
                  "px-6 py-3 rounded-xl",
                  "bg-amber-700 text-white",
                  "hover:bg-amber-800",
                  "transition-all duration-300",
                  "text-base font-medium"
                )}
              >
                Add Widget
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 auto-rows-min">
            {widgets.map((widget) => {
              const definition = WIDGET_REGISTRY[widget.type];
              if (!definition) return null;

              // Merge definition gridSpan with instance overrides (instance takes precedence)
              const mergedGridSpan: GridSpan = {
                ...definition.gridSpan,
                ...widget.gridSpan,
              };

              const spanClass = [
                mergedGridSpan.md === 1 ? "sm:col-span-1" : "",
                mergedGridSpan.md === 2 ? "sm:col-span-2" : "",
                mergedGridSpan.md === 3 ? "sm:col-span-3" : "",
                mergedGridSpan.lg === 1 ? "lg:col-span-1" : "",
                mergedGridSpan.lg === 2 ? "lg:col-span-2" : "",
                mergedGridSpan.lg === 3 ? "lg:col-span-3" : "",
                mergedGridSpan.rowMd === 1 ? "sm:row-span-1" : "",
                mergedGridSpan.rowMd === 2 ? "sm:row-span-2" : "",
                mergedGridSpan.rowMd === 3 ? "sm:row-span-3" : "",
                mergedGridSpan.rowLg === 1 ? "lg:row-span-1" : "",
                mergedGridSpan.rowLg === 2 ? "lg:row-span-2" : "",
                mergedGridSpan.rowLg === 3 ? "lg:row-span-3" : "",
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <div
                  key={widget.id}
                  className={["h-full", spanClass].filter(Boolean).join(" ")}
                >
                  <WidgetCard
                    instance={widget}
                    definition={definition}
                    onRemove={() => removeWidget(widget.id)}
                    onFilterChange={(updates) => updateWidgetFilters(widget.id, updates)}
                    onConfigChange={(updates) => updateWidgetConfig(widget.id, updates)}
                    className="h-full"
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Widget Picker Modal */}
      <WidgetPicker
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onAdd={(key, title, description) => addWidget(key, title, description)}
      />
    </div>
  );
}
