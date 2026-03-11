// Sync progress panel with progress bars and log
// Shows real-time sync status via SSE streaming

"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";

type SyncState = {
  active: boolean;
  phase: string;
  repoTotal: number;
  repoDone: number;
  logs: string[];
};

const MAX_LOGS = 50;

function appendLog(logs: string[], entry: string) {
  const next = [...logs, entry];
  return next.length > MAX_LOGS ? next.slice(-MAX_LOGS) : next;
}

export default function SyncPanel({ mode }: { mode: "incremental" | "full" }) {
  const [state, setState] = useState<SyncState>({
    active: true, phase: "Starting sync...", repoTotal: 0, repoDone: 0, logs: [],
  });
  const logRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    runSync(ctrl.signal);
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [state.logs]);

  async function runSync(signal: AbortSignal) {
    try {
      const response = await fetch(`/api/sync?mode=${mode}`, { signal });
      if (response.status === 429) {
        const data = await response.json();
        setState((s) => ({ ...s, active: false, phase: data.error || "Rate limit reached" }));
        return;
      }
      if (!response.ok || !response.body) {
        setState((s) => ({ ...s, active: false, phase: "Sync failed" }));
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (!signal.aborted) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";

        for (const block of blocks) {
          const eventMatch = block.match(/event: (\w[\w-]*)/);
          const dataMatch = block.match(/data: (.+)/);
          if (!eventMatch || !dataMatch) continue;

          const event = eventMatch[1];
          const data = JSON.parse(dataMatch[1]);

          setState((prev) => {
            switch (event) {
              case "status":
                return { ...prev, phase: data.message };
              case "repos":
                return { ...prev, phase: "Syncing data...", logs: appendLog(prev.logs, `Repositories: ${data.count} synced`) };
              case "repo-done":
                return {
                  ...prev,
                  repoDone: data.index ?? prev.repoDone + 1,
                  repoTotal: data.total ?? prev.repoTotal,
                  logs: appendLog(prev.logs, `${data.name}: +${data.additions} / -${data.deletions} (${data.commits} commits)`),
                };
              case "done":
                return {
                  ...prev, active: false, phase: "Sync complete",
                  logs: appendLog(prev.logs, `Done: ${data.commits} commits, +${data.additions} / -${data.deletions}`),
                };
              case "error":
                return { ...prev, active: false, phase: "Sync failed", logs: appendLog(prev.logs, `Error: ${data.message}`) };
              default:
                return prev;
            }
          });

          if (event === "done") router.refresh();
        }
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        setState((s) => ({ ...s, active: false, phase: "Sync failed" }));
      }
    }
  }

  const pct = state.repoTotal > 0 ? Math.round((state.repoDone / state.repoTotal) * 100) : 0;

  return (
    <Card className="mt-4">
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">{state.phase}</span>
          {state.active && <span className="text-xs text-muted-foreground animate-pulse">syncing</span>}
        </div>

        {state.repoTotal > 0 && (
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Repositories</span>
              <span>{state.repoDone}/{state.repoTotal} ({pct}%)</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-white transition-all duration-300 rounded-full"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        {state.logs.length > 0 && (
          <div ref={logRef} className="max-h-40 overflow-y-auto rounded border border-border bg-black/50 p-2 text-xs font-mono space-y-0.5">
            {state.logs.map((log, i) => (
              <div key={i} className="text-muted-foreground">{log}</div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
