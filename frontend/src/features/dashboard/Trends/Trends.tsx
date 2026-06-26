import { useState, memo } from "react";
import { Transaction } from "../../../types";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatCurrency } from "../../../shared/lib/format";
import {
  buildMonthlyTrend,
  buildDailyTrend,
  selectTrendGranularity,
} from "../../transactions/aggregations";
import { Card } from "../../../shared/ui";
import { DateRangeBounds } from "../../date-range/model/dateRange";
import { CumulativeToggle } from "./CumulativeToggle";

export const Trends = memo(function Trends({
  transactions,
  bounds,
}: {
  transactions: Transaction[];
  bounds: DateRangeBounds;
}) {
  const [mode, setMode] = useState<"calendar" | "running">("calendar");
  const granularity = selectTrendGranularity(bounds);
  const data =
    granularity === "day"
      ? buildDailyTrend(transactions, bounds, mode)
      : buildMonthlyTrend(transactions, bounds, mode);
  const xAxisKey = granularity;
  const title = "Trend Chart";

  return (
    <Card className="h-full">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3 px-6 pt-6">
        <h3 className="text-lg font-serif text-gray-900 font-medium">{title}</h3>
        <CumulativeToggle mode={mode} onChange={setMode} />
      </div>
      <div className="h-[280px] sm:h-[320px] px-4 sm:px-6 pb-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(0,0,0,0.06)"
            />
            <XAxis
              dataKey={xAxisKey}
              tick={{ fontSize: 11, fill: '#6b7280' }}
              minTickGap={20}
              interval={0}
              axisLine={{ stroke: 'rgba(0,0,0,0.08)' }}
              tickLine={{ stroke: 'rgba(0,0,0,0.08)' }}
            />
            <YAxis
              tickFormatter={(value: number) =>
                formatCurrency(value, { compact: true })
              }
              tick={{ fontSize: 11, fill: '#6b7280' }}
              axisLine={{ stroke: 'rgba(0,0,0,0.08)' }}
              tickLine={{ stroke: 'rgba(0,0,0,0.08)' }}
            />
            <Tooltip
              contentStyle={{
                fontSize: "12px",
                backgroundColor: "rgba(255,255,255,0.98)",
                borderRadius: "8px",
                border: "1px solid rgba(0,0,0,0.08)",
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
              }}
              itemStyle={{ fontSize: "12px" }}
              labelStyle={{ fontSize: "12px", fontWeight: "500", color: "#374151" }}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              iconType="circle"
              wrapperStyle={{ fontSize: "11px", color: "#6b7280" }}
            />
            <Line
              type="monotone"
              dataKey="income"
              stroke="#92400e"
              strokeWidth={3}
              name="Income"
              dot={{ r: 4, fill: "#92400e", strokeWidth: 0 }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="expense"
              stroke="#7f1d1d"
              strokeWidth={3}
              name="Expenses"
              dot={{ r: 4, fill: "#7f1d1d", strokeWidth: 0 }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="net"
              stroke="#1e3a8a"
              strokeWidth={3}
              name="Net"
              dot={{ r: 4, fill: "#1e3a8a", strokeWidth: 0 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
});
