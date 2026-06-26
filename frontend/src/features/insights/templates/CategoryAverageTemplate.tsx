import { formatCurrency } from "../../../shared/lib/format";

export interface CategoryAverageData {
  categoryId: string;
  total: number;
  average: number;
  months: number;
}

export interface CategoryAverageTemplateProps {
  data: CategoryAverageData[];
  categories: Array<{ id: string; name: string; color: string }>;
  height?: number | string;
}

export function CategoryAverageTemplate({
  data,
  categories,
  height,
}: CategoryAverageTemplateProps) {
  // Create a map of category id to category info for color lookup
  const categoryMap = new Map(
    categories.map((cat) => [cat.id, { name: cat.name, color: cat.color }])
  );

  // Filter out categories that don't exist in the category list
  const validData = data.filter((item) => categoryMap.has(item.categoryId));

  // If no valid data, show empty state
  if (validData.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        No category spending data available for the selected period.
      </div>
    );
  }

  // Sort by average spending (descending)
  const sortedData = [...validData].sort((a, b) => b.average - a.average);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" style={{ height }}>
      {sortedData.map((item) => {
        const category = categoryMap.get(item.categoryId);
        const color = category?.color || "#9ca3af"; // Default to gray-400 if no color
        const textColor = textColorFromColor(color);
        const bgColor = bgColorFromColor(color);

        return (
          <div
            key={item.categoryId}
            className={`p-4 rounded-xl border ${bgColor} bg-opacity-10 transition-all duration-200`}
            style={{ borderColor: color }}
          >
            <div className="flex items-center justify-between mb-2">
              <h4
                className="font-semibold text-base"
                style={{ color: color }}
              >
                {category?.name || item.categoryId}
              </h4>
              <span
                className="px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ backgroundColor: `${color}20`, color }}
              >
                {item.months} mo
              </span>
            </div>

            <div className="flex items-baseline gap-2 mb-1">
              <span
                className="text-2xl font-bold tracking-tight"
                style={{ color }}
              >
                {formatCurrency(item.average)}
              </span>
              <span className="text-xs text-gray-500 font-medium">/mo</span>
            </div>

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
              <span className="text-xs text-gray-500">Total spent</span>
              <span
                className="text-sm font-semibold"
                style={{ color: textColor }}
              >
                {formatCurrency(item.total)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Helper function to determine text color based on background color brightness
function textColorFromColor(hex: string): string {
  // Remove # if present
  const color = hex.replace("#", "");
  const r = parseInt(color.substr(0, 2), 16);
  const g = parseInt(color.substr(2, 2), 16);
  const b = parseInt(color.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;

  return brightness > 125 ? "#1f2937" : "#ffffff";
}

// Helper to get background color class (unused for now, but kept for future extensibility)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function bgColorFromColor(_hex: string): string {
  // This is a simplified version - in production you might want to generate opacity variants
  return "border-gray-100";
}
