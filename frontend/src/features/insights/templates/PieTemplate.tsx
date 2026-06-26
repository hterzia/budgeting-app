import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "../../../shared/lib/format";

const COLORS = [
  "#d97706", // amber-600
  "#2563eb", // blue-600
  "#b45309", // amber-700
  "#dc2626", // red-600
  "#7c3aed", // violet-600
  "#db2777", // pink-600
  "#0d9488", // teal-600
  "#15803d", // green-600
];

export interface PieTemplateProps {
  data: Array<{ [key: string]: unknown }>;
  dataKey: string;
  nameKey: string;
  height?: number | string;
}

export function PieTemplate({ data, dataKey, nameKey, height = 300 }: PieTemplateProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey={dataKey}
          nameKey={nameKey}
          cx="50%"
          cy="50%"
          outerRadius={110}
          innerRadius={60}
          paddingAngle={3}
        >
          {data.map((_, index) => (
            <Cell
              key={`cell-${index}`}
              fill={COLORS[index % COLORS.length]}
              stroke="white"
              strokeWidth={1}
            />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number) => formatCurrency(value)}
          contentStyle={{
            backgroundColor: "#fff",
            borderRadius: "12px",
            border: "1px solid rgba(229, 231, 235, 0.6)",
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
          }}
          itemStyle={{ color: "#374151", fontSize: "12px" }}
        />
        <Legend
          layout="vertical"
          verticalAlign="middle"
          align="right"
          wrapperStyle={{ fontSize: "12px", color: "#6b7280" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
