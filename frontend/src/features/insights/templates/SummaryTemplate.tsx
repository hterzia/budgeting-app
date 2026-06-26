import { formatCurrency } from "../../../shared/lib/format";
import clsx from "clsx";

export interface SummaryTemplateProps {
  data: {
    income: number;
    expenses: number;
    refunds: number;
    savings: number;
    savingsRate: number;
  } | Record<string, number>;
  keys?: string[];
  labels?: Record<string, string>;
}

// Default cards for the original spending summary
const DEFAULT_CARDS = [
  {
    label: "Total Income",
    valueKey: "income",
    format: "currency",
  },
  {
    label: "Total Expenses",
    valueKey: "expenses",
    format: "currency",
  },
  {
    label: "Refunds",
    valueKey: "refunds",
    format: "currency",
  },
  {
    label: "Net Savings",
    valueKey: "savings",
    format: "currency",
  },
  {
    label: "Savings Rate",
    valueKey: "savingsRate",
    format: "percent",
  },
];

export function SummaryTemplate({ data, keys, labels }: SummaryTemplateProps) {
  // Determine which cards to show
  const cards = keys && keys.length > 0
    ? (keys as string[]).map((key) => {
        const value = (data as Record<string, number>)[key] as number;
        const label = labels?.[key] ?? key;
        const isPercent = label.includes("%") || key.toLowerCase().includes("percent") || key.toLowerCase().includes("rate");

        // Handle undefined values gracefully
        if (value === undefined || value === null) {
          return {
            label,
            value: "N/A",
            isPercent: false,
            color: "text-gray-600",
            bg: "bg-gray-50/50",
            border: "border-gray-200",
          };
        }

        return {
          label,
          value: isPercent
            ? `${value.toFixed(1)}%`
            : Math.abs(value) >= 1000
              ? formatCurrency(value)
              : formatCurrency(value),
          isPercent,
          color: getValueColor(key, value),
          bg: getValueBg(key, value),
          border: getValueBorder(key, value),
        };
      })
    : DEFAULT_CARDS.map((card) => {
        const val = (data as any)[card.valueKey] as number;
        const value = val ?? 0;

        return {
          label: card.label,
          value: card.format === "percent"
            ? `${value.toFixed(1)}%`
            : formatCurrency(value),
          isPercent: card.format === "percent",
          color: getDefaultValueColor(card.valueKey, value),
          bg: getDefaultValueBg(card.valueKey, value),
          border: getDefaultValueBorder(card.valueKey, value),
        };
      });

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className={clsx(
            "p-5 rounded-2xl border",
            card.border,
            card.bg,
            "hover:border-amber-200/50 transition-all duration-300"
          )}
        >
          <p className="text-xs tracking-widest text-gray-500 uppercase font-medium mb-1">
            {card.label}
          </p>
          <p className={clsx("text-2xl font-serif font-medium", card.color)}>
            {card.value}
          </p>
        </div>
      ))}
    </div>
  );
}

// Helper functions for card styling based on key name
function getValueColor(key: string, value: number): string {
  const keyLower = key.toLowerCase();
  if (keyLower.includes("income") || keyLower.includes("savings") || keyLower.includes("runway")) {
    return value >= 0 ? "text-amber-900" : "text-red-800";
  }
  if (keyLower.includes("expense") || keyLower.includes("debt") || keyLower.includes("essential")) {
    return "text-red-800";
  }
  if (keyLower.includes("unknown")) {
    return "text-amber-800";
  }
  if (keyLower.includes("percent") || keyLower.includes("rate")) {
    return "text-indigo-900";
  }
  return "text-gray-900";
}

function getValueBg(key: string, _value: number): string {
  const keyLower = key.toLowerCase();
  if (keyLower.includes("income") || keyLower.includes("savings") || keyLower.includes("runway")) {
    return "bg-amber-50/60";
  }
  if (keyLower.includes("expense") || keyLower.includes("debt") || keyLower.includes("essential")) {
    return "bg-red-50/60";
  }
  if (keyLower.includes("unknown")) {
    return "bg-amber-50/60";
  }
  if (keyLower.includes("percent") || keyLower.includes("rate")) {
    return "bg-indigo-50/60";
  }
  return "bg-gray-50/50";
}

function getValueBorder(key: string, _value: number): string {
  const keyLower = key.toLowerCase();
  if (keyLower.includes("income") || keyLower.includes("savings") || keyLower.includes("runway")) {
    return "border-amber-100/80";
  }
  if (keyLower.includes("expense") || keyLower.includes("debt") || keyLower.includes("essential")) {
    return "border-red-100/80";
  }
  if (keyLower.includes("unknown")) {
    return "border-amber-100/80";
  }
  if (keyLower.includes("percent") || keyLower.includes("rate")) {
    return "border-indigo-100/80";
  }
  return "border-gray-200";
}

// Helper functions for default card styling
function getDefaultValueColor(key: string, value: number): string {
  if (key === "income") {
    return value >= 0 ? "text-amber-900" : "text-red-800";
  }
  if (key === "expenses") {
    return "text-red-800";
  }
  if (key === "refunds") {
    return "text-blue-800";
  }
  if (key === "savings") {
    return value >= 0 ? "text-amber-900" : "text-red-800";
  }
  if (key === "savingsRate") {
    return "text-indigo-900";
  }
  return "text-gray-900";
}

function getDefaultValueBg(key: string, _value: number): string {
  if (key === "income") {
    return "bg-amber-50/60";
  }
  if (key === "expenses") {
    return "bg-red-50/60";
  }
  if (key === "refunds") {
    return "bg-blue-50/60";
  }
  if (key === "savings") {
    return "bg-amber-50/60";
  }
  if (key === "savingsRate") {
    return "bg-indigo-50/60";
  }
  return "bg-gray-50/50";
}

function getDefaultValueBorder(key: string, _value: number): string {
  if (key === "income") {
    return "border-amber-100/80";
  }
  if (key === "expenses") {
    return "border-red-100/80";
  }
  if (key === "refunds") {
    return "border-blue-100/80";
  }
  if (key === "savings") {
    return "border-amber-100/80";
  }
  if (key === "savingsRate") {
    return "border-indigo-100/80";
  }
  return "border-gray-200";
}
