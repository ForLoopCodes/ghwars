// Dashboard period filter for date range selection
// Toggles between today, 7d, 30d, 1y views

"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const periods = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
  { key: "1y", label: "1 Year" },
  { key: "lifetime", label: "Lifetime" },
] as const;

export default function DashboardFilter({ current }: { current: string }) {
  const router = useRouter();

  return (
    <div className="flex gap-1">
      {periods.map((p) => (
        <Button
          key={p.key}
          variant={current === p.key ? "default" : "ghost"}
          size="sm"
          className="text-xs"
          onClick={() => router.push(`/dashboard?period=${p.key}`)}
        >
          {p.label}
        </Button>
      ))}
    </div>
  );
}
