// SSE streaming sync endpoint with rate limiting
// Full sync: 1/day, Incremental: 10/day, admins exempt

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { syncUserData } from "@/lib/sync";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response("unauthorized", { status: 401 });
    }

    const mode = new URL(request.url).searchParams.get("mode") === "full" ? "full" : "incremental";
    const userId = session.user.id;

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return new Response("user not found", { status: 404 });

    const today = new Date().toISOString().split("T")[0];

    if (!user.isAdmin) {
      const isNewDay = user.syncCountDate !== today;
      const incCount = isNewDay ? 0 : user.incrementalSyncs;
      const fullCount = isNewDay ? 0 : user.fullSyncs;

      if (mode === "full" && fullCount >= 1) {
        return new Response(JSON.stringify({ error: "Full sync limit reached (1/day)" }), {
          status: 429, headers: { "Content-Type": "application/json" },
        });
      }
      if (mode === "incremental" && incCount >= 10) {
        return new Response(JSON.stringify({ error: "Refresh limit reached (10/day)" }), {
          status: 429, headers: { "Content-Type": "application/json" },
        });
      }

      await db.update(users).set({
        syncCountDate: today,
        incrementalSyncs: isNewDay ? (mode === "incremental" ? 1 : 0) : incCount + (mode === "incremental" ? 1 : 0),
        fullSyncs: isNewDay ? (mode === "full" ? 1 : 0) : fullCount + (mode === "full" ? 1 : 0),
      }).where(eq(users.id, userId));
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        try {
          await syncUserData(userId, mode, send);
        } catch (err) {
          send("error", { message: err instanceof Error ? err.message : "sync failed" });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch {
    return new Response("error", { status: 500 });
  }
}
