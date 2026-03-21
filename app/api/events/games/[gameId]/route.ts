import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
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
        const game = await db.game.findUnique({
          where: {
            id: gameId
          },
          select: {
            id: true,
            updatedAt: true,
            status: true
          }
        });

        const snapshot = JSON.stringify({
          id: game?.id ?? gameId,
          updatedAt: game?.updatedAt.toISOString() ?? null,
          status: game?.status ?? "MISSING"
        });

        if (snapshot !== lastSnapshot) {
          lastSnapshot = snapshot;
          controller.enqueue(encoder.encode(`event: game\ndata: ${snapshot}\n\n`));
        }
      }, 700);
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
