// Client component for leaderboard period filter
// Toggles between today, week, month, all-time

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

const periods = [
  { key: "today", label: "Today" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "alltime", label: "All Time" },
] as const;

export default function PeriodFilter({ current }: { current: string }) {
  const router = useRouter();

  return (
    <div className="flex gap-1">
      {periods.map((p) => (
        <Button
          key={p.key}
          variant={current === p.key ? "default" : "ghost"}
          size="sm"
          className="text-xs"
          onClick={() => router.push(`/leaderboard?period=${p.key}`)}
        >
          {p.label}
        </Button>
      ))}
    </div>
  );
}
