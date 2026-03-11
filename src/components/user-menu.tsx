// Client dropdown for user settings and sync
// Shows avatar, refresh, full refresh, sign out

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function consumeSSE(url: string, syncToast: string | number, router: ReturnType<typeof useRouter>) {
  return fetch(url).then(async (response) => {
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
            toast.success(`${data.name}: +${data.additions} / -${data.deletions}`, { duration: 3000 });
            router.refresh();
            break;
          case "done":
            toast.success(`Sync complete: ${data.commits} commits, +${data.additions} / -${data.deletions}`, { id: syncToast, duration: 4000 });
            router.refresh();
            break;
          case "error":
            toast.error(data.message, { id: syncToast });
            break;
        }
      }
    }
  });
}

export default function UserMenu({
  name,
  image,
  username,
}: {
  name: string;
  image?: string;
  username: string;
}) {
  const [syncing, setSyncing] = useState(false);
  const router = useRouter();

  async function handleSync(mode: "incremental" | "full") {
    setSyncing(true);
    const syncToast = toast.loading(mode === "full" ? "Starting full sync..." : "Starting sync...");
    try {
      await consumeSSE(`/api/sync?mode=${mode}`, syncToast, router);
    } catch {
      toast.error("Sync failed", { id: syncToast });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="outline-none">
        <Avatar className="h-7 w-7 cursor-pointer">
          <AvatarImage src={image} />
          <AvatarFallback className="text-xs">{name?.[0] ?? "?"}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <div className="px-2 py-1.5">
          <p className="text-sm font-medium">{name}</p>
          <p className="text-xs text-muted-foreground">@{username}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push(`/profile/${username}`)}>
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleSync("incremental")} disabled={syncing}>
          {syncing ? "Syncing..." : "Refresh Data"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleSync("full")} disabled={syncing}>
          Full Refresh (1 Year)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            window.location.href = "/api/auth/signout";
          }}
        >
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
