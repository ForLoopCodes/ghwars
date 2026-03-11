// Refresh button to manually sync user data
// Calls /api/sync and reloads the page

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function RefreshButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const router = useRouter();

  async function handleSync() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setResult(`Error: ${data.error ?? res.statusText}`);
      } else {
        setResult(`Synced ${data.repos} repos, ${data.commits} commits today`);
        router.refresh();
      }
    } catch (e) {
      setResult(`Failed: ${e instanceof Error ? e.message : "unknown error"}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {result && <span className="text-xs text-muted-foreground">{result}</span>}
      <Button
        variant="secondary"
        size="sm"
        onClick={handleSync}
        disabled={loading}
        className="text-xs"
      >
        {loading ? "Syncing..." : "Refresh Data"}
      </Button>
    </div>
  );
}
