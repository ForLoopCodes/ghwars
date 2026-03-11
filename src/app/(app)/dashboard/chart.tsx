// Activity chart with grouping and type toggles
// Supports day/week/month/year and bar/line modes

"use client";

import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type ChartEntry = {
  date: string;
  additions: number;
  deletions: number;
  newStars: number;
  newPrsRaised: number;
  newPrsMerged: number;
};
type Grouping = "day" | "week" | "month" | "year";
type ChartType = "bar" | "line";

function fillDays(data: ChartEntry[]): ChartEntry[] {
  if (data.length === 0) return [];
  const map = new Map(data.map((d) => [d.date, d]));
  const start = new Date(data[0].date);
  const end = new Date(data[data.length - 1].date);
  const filled: ChartEntry[] = [];
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().split("T")[0];
    filled.push(
      map.get(key) ?? {
        date: key,
        additions: 0,
        deletions: 0,
        newStars: 0,
        newPrsRaised: 0,
        newPrsMerged: 0,
      },
    );
  }
  return filled;
}

function groupData(data: ChartEntry[], grouping: Grouping): ChartEntry[] {
  if (grouping === "day") return data;
  const buckets = new Map<
    string,
    {
      additions: number;
      deletions: number;
      newStars: number;
      newPrsRaised: number;
      newPrsMerged: number;
    }
  >();
  for (const d of data) {
    const dt = new Date(d.date);
    let key: string;
    if (grouping === "week") {
      const day = dt.getDay();
      const monday = new Date(dt);
      monday.setDate(dt.getDate() - ((day + 6) % 7));
      key = monday.toISOString().split("T")[0];
    } else if (grouping === "month") {
      key = d.date.slice(0, 7);
    } else {
      key = d.date.slice(0, 4);
    }
    const existing = buckets.get(key) ?? {
      additions: 0,
      deletions: 0,
      newStars: 0,
      newPrsRaised: 0,
      newPrsMerged: 0,
    };
    existing.additions += d.additions;
    existing.deletions += d.deletions;
    existing.newStars += d.newStars;
    existing.newPrsRaised += d.newPrsRaised;
    existing.newPrsMerged += d.newPrsMerged;
    buckets.set(key, existing);
  }
  return Array.from(buckets, ([date, v]) => ({ date, ...v }));
}

function formatLabel(date: string, grouping: Grouping): string {
  if (grouping === "year") return date;
  if (grouping === "month") return date;
  return date.slice(5);
}

export default function StatsChart({
  data,
  period,
}: {
  data: ChartEntry[];
  period?: string;
}) {
  const defaultGrouping: Grouping =
    period === "today"
      ? "day"
      : period === "7d"
        ? "week"
        : period === "30d"
          ? "week"
          : period === "1y"
            ? "month"
            : "month";
  const [grouping, setGrouping] = useState<Grouping>(defaultGrouping);
  const [chartType, setChartType] = useState<ChartType>("bar");

  const processed = useMemo(
    () => groupData(fillDays(data), grouping),
    [data, grouping],
  );

  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No activity data yet
      </p>
    );
  }

  const sharedProps = {
    data: processed,
    margin: { top: 0, right: 0, left: 0, bottom: 0 },
  };

  const xAxisProps = {
    dataKey: "date" as const,
    tick: { fontSize: 10, fill: "#888" },
    tickFormatter: (d: string) => formatLabel(d, grouping),
    axisLine: false,
    tickLine: false,
  };

  const yAxisProps = {
    tick: { fontSize: 10, fill: "#888" },
    axisLine: false,
    tickLine: false,
  };

  const tooltipProps = {
    cursor: false as const,
    contentStyle: {
      background: "#0a0a0a",
      border: "1px solid #222",
      fontSize: 12,
    },
    labelStyle: { color: "#888" },
  };

  return (
    <div>
      <div className="mb-3 flex gap-3">
        <div className="flex gap-1">
          {(["day", "week", "month", "year"] as Grouping[]).map((g) => (
            <button
              key={g}
              onClick={() => setGrouping(g)}
              className={`rounded px-2 py-0.5 text-xs ${grouping === g ? "bg-white text-black" : "text-muted-foreground hover:text-white"}`}
            >
              {g[0].toUpperCase() + g.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {(["bar", "line"] as ChartType[]).map((t) => (
            <button
              key={t}
              onClick={() => setChartType(t)}
              className={`rounded px-2 py-0.5 text-xs ${chartType === t ? "bg-white text-black" : "text-muted-foreground hover:text-white"}`}
            >
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={250}>
        {chartType === "bar" ? (
          <BarChart {...sharedProps}>
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps} />
            <Tooltip {...tooltipProps} />
            <Bar dataKey="additions" fill="#ffffff" radius={[4, 4, 0, 0]} />
            <Bar dataKey="deletions" fill="#555555" radius={[4, 4, 0, 0]} />
            <Bar
              dataKey="newStars"
              fill="#aaaaaa"
              radius={[4, 4, 0, 0]}
              name="Stars"
            />
            <Bar
              dataKey="newPrsRaised"
              fill="#777777"
              radius={[4, 4, 0, 0]}
              name="PRs Raised"
            />
            <Bar
              dataKey="newPrsMerged"
              fill="#333333"
              radius={[4, 4, 0, 0]}
              name="PRs Merged"
            />
          </BarChart>
        ) : (
          <LineChart {...sharedProps}>
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps} />
            <Tooltip {...tooltipProps} />
            <Line
              type="monotone"
              dataKey="additions"
              stroke="#ffffff"
              dot={false}
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="deletions"
              stroke="#555555"
              dot={false}
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="newStars"
              stroke="#aaaaaa"
              dot={false}
              strokeWidth={2}
              name="Stars"
            />
            <Line
              type="monotone"
              dataKey="newPrsRaised"
              stroke="#777777"
              dot={false}
              strokeWidth={2}
              name="PRs Raised"
            />
            <Line
              type="monotone"
              dataKey="newPrsMerged"
              stroke="#333333"
              dot={false}
              strokeWidth={2}
              name="PRs Merged"
            />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
