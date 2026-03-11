// Refresh button with live sync progress toasts
// Connects to SSE endpoint and shows per-repo notifications

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function RefreshButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSync() {
    setLoading(true);
    const syncToast = toast.loading("Starting sync...");

    try {
      const response = await fetch("/api/sync");
      if (!response.ok || !response.body) {
        toast.error("Sync failed", { id: syncToast });
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const block of lines) {
          const eventMatch = block.match(/event: (\w[\w-]*)/);
          const dataMatch = block.match(/data: (.+)/);
          if (!eventMatch || !dataMatch) continue;

          const event = eventMatch[1];
          const data = JSON.parse(dataMatch[1]);

          switch (event) {
            case "status":
              toast.loading(data.message, { id: syncToast });
              break;
            case "repos":
              toast.success(data.message, { duration: 2000 });
              break;
            case "repo":
              toast.loading(data.message, { id: syncToast });
              break;
            case "repo-done":
              toast.success(
                `${data.name}: +${data.additions} / -${data.deletions}`,
                { duration: 3000 },
              );
              router.refresh();
              break;
            case "done":
              toast.success(
                `Sync complete: ${data.commits} commits, +${data.additions} / -${data.deletions}`,
                { id: syncToast, duration: 4000 },
              );
              router.refresh();
              break;
            case "error":
              toast.error(data.message, { id: syncToast });
              break;
          }
        }
      }
    } catch {
      toast.error("Sync failed", { id: syncToast });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={handleSync}
      disabled={loading}
      className="text-xs"
    >
      {loading ? "Syncing..." : "Refresh Data"}
    </Button>
  );
}
