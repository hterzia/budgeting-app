import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { formatCurrency } from "../../../shared/lib/format";

const formatCurrencyValue = (value: number) => formatCurrency(value);

export interface LineTemplateProps {
  data: Array<{ [key: string]: unknown }>;
  series: Array<{ key: string; color: string; label: string }>;
  xAxisKey: string;
  height?: number | string;
}

export function LineTemplate({ data, series, xAxisKey, height = 300 }: LineTemplateProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 30, right: 30, left: 20, bottom: 60 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="currentColor"
          className="text-gray-200/60"
        />
        <XAxis
          dataKey={xAxisKey}
          angle={-45}
          textAnchor="end"
          height={60}
          tick={{ fontSize: 12, fill: "#6b7280" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 12, fill: "#6b7280" }}
          tickFormatter={formatCurrencyValue}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(value: number) => formatCurrencyValue(value)}
          labelFormatter={(label: string) => `Date: ${label}`}
          contentStyle={{
            backgroundColor: "#fff",
            borderRadius: "12px",
            border: "1px solid rgba(229, 231, 235, 0.6)",
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
          }}
          itemStyle={{ color: "#374151", fontSize: "12px" }}
          labelStyle={{ color: "#374151", fontWeight: 500, fontSize: "12px" }}
        />
        <Legend
          iconType="line"
          wrapperStyle={{ fontSize: "12px", color: "#6b7280", paddingTop: "12px" }}
        />
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            stroke={s.color}
            name={s.label}
            strokeWidth={2.5}
            dot={{ r: 3, fill: s.color, strokeWidth: 2 }}
            activeDot={{ r: 5, fill: s.color }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
