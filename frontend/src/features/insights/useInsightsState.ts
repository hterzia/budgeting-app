import { useState, useEffect } from "react";
import { WidgetInstance } from "./types";
import { createDefaultWidgets, createWidgetId, WIDGET_REGISTRY } from "./registry";
import { normalizeDateRangeSelection } from "../date-range/model/dateRange";

// Storage key for widget state
const STORAGE_KEY = "budget-insights-widgets";

// Type for the state stored in localStorage
interface StoredState {
  widgets: WidgetInstance[];
}

function isValidWidgetType(type: string): boolean {
  return Object.prototype.hasOwnProperty.call(WIDGET_REGISTRY, type);
}

/**
 * Load stored widgets from localStorage
 */
function loadStoredWidgets(): WidgetInstance[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed: StoredState = JSON.parse(stored);
      return (parsed.widgets ?? [])
        .filter((widget) => isValidWidgetType(widget.type))
        .map((widget) => ({
          ...widget,
          filters: widget.filters
            ? {
                ...widget.filters,
                dateRange:
                  widget.filters.dateRange !== undefined
                    ? normalizeDateRangeSelection(widget.filters.dateRange)
                    : undefined,
              }
            : widget.filters,
        }));
    }
  } catch (e) {
    console.error("Failed to load widget state from localStorage:", e);
  }
  return [];
}

/**
 * Save widgets to localStorage
 */
function saveWidgets(widgets: WidgetInstance[]) {
  try {
    const state: StoredState = { widgets };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Failed to save widget state to localStorage:", e);
  }
}

/**
 * Hook for managing widget state with localStorage persistence
 */
export function useInsightsState() {
  const [widgets, setWidgets] = useState<WidgetInstance[]>(() => {
    const stored = loadStoredWidgets();
    // Use registry defaults if no stored widgets
    return stored.length > 0 ? stored : createDefaultWidgets();
  });

  // Persist to localStorage on change
  useEffect(() => {
    saveWidgets(widgets);
  }, [widgets]);

  /**
   * Add a new widget to the page
   */
  function addWidget(
    definitionKey: string,
    title?: string,
    description?: string,
    gridSpan?: WidgetInstance["gridSpan"]
  ) {
    if (!isValidWidgetType(definitionKey)) {
      return;
    }
    const definition = WIDGET_REGISTRY[definitionKey];
    setWidgets((prev) => [
      ...prev,
      {
        id: createWidgetId(),
        type: definitionKey,
        title,
        description,
        filters: {},
        gridSpan: gridSpan ?? definition.gridSpan,
      },
    ]);
  }

  /**
   * Remove a widget by ID
   */
  function removeWidget(widgetId: string) {
    setWidgets((prev) => prev.filter((w) => w.id !== widgetId));
  }

  /**
   * Update a widget's filters
   */
  function updateWidgetFilters(
    widgetId: string,
    updates: Partial<WidgetInstance["filters"]>
  ) {
    setWidgets((prev) =>
      prev.map((w) => {
        if (w.id !== widgetId) return w;
        return {
          ...w,
          filters: {
            ...w.filters,
            ...updates,
          },
        };
      })
    );
  }

  /**
   * Update a widget's title
   */
  function updateWidgetTitle(widgetId: string, title: string) {
    setWidgets((prev) =>
      prev.map((w) => {
        if (w.id !== widgetId) return w;
        return { ...w, title };
      })
    );
  }

  /**
   * Update a widget's configuration (title, description, gridSpan)
   */
  function updateWidgetConfig(
    widgetId: string,
    updates: Partial<Pick<WidgetInstance, "title" | "description" | "gridSpan">>
  ) {
    setWidgets((prev) =>
      prev.map((w) => {
        if (w.id !== widgetId) return w;
        return { ...w, ...updates };
      })
    );
  }

  /**
   * Reset to default widgets
   */
  function resetToDefaults() {
    setWidgets(createDefaultWidgets());
  }

  return {
    widgets,
    addWidget,
    removeWidget,
    updateWidgetFilters,
    updateWidgetTitle,
    updateWidgetConfig,
    resetToDefaults,
  };
}
