// SSE streaming sync endpoint for live progress
// Streams repo-by-repo progress via Server-Sent Events

import { auth } from "@/lib/auth";
import { syncUserData } from "@/lib/sync";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response("unauthorized", { status: 401 });
    }

    const userId = session.user.id;
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        try {
          await syncUserData(userId, send);
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
