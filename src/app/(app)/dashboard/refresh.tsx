// Refresh button to manually sync user data
// Calls /api/sync and reloads the page

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function RefreshButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSync() {
    setLoading(true);
    try {
      await fetch("/api/sync", { method: "POST" });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="secondary" size="sm" onClick={handleSync} disabled={loading} className="text-xs">
      {loading ? "Syncing..." : "Refresh Data"}
    </Button>
  );
}
