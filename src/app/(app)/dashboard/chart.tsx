// Client-side bar chart for daily code stats
// Renders additions and deletions with Recharts

"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type ChartEntry = { date: string; additions: number; deletions: number };

export default function StatsChart({ data }: { data: ChartEntry[] }) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No activity data yet
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data}>
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: "#888" }}
          tickFormatter={(d: string) => d.slice(5)}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "#888" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            background: "#0a0a0a",
            border: "1px solid #222",
            fontSize: 12,
          }}
          labelStyle={{ color: "#888" }}
        />
        <Bar dataKey="additions" fill="#ffffff" radius={[2, 2, 0, 0]} />
        <Bar dataKey="deletions" fill="#555555" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
