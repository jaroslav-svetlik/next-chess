import { GameStatus, GameVisibility } from "@prisma/client";

import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const encoder = new TextEncoder();
  let lastSnapshot = "";
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let watcher: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode("event: ready\ndata: connected\n\n"));

      heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": heartbeat\n\n"));
      }, 15_000);

      watcher = setInterval(async () => {
        const summary = await db.game.aggregate({
          where: {
            status: GameStatus.WAITING,
            visibility: GameVisibility.PUBLIC
          },
          _count: {
            id: true
          },
          _max: {
            updatedAt: true
          }
        });

        const snapshot = JSON.stringify({
          count: summary._count.id,
          updatedAt: summary._max.updatedAt?.toISOString() ?? null
        });

        if (snapshot !== lastSnapshot) {
          lastSnapshot = snapshot;
          controller.enqueue(encoder.encode(`event: lobby\ndata: ${snapshot}\n\n`));
        }
      }, 1000);
    },
    cancel() {
      if (heartbeat) {
        clearInterval(heartbeat);
      }
      if (watcher) {
        clearInterval(watcher);
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream"
    }
  });
}
