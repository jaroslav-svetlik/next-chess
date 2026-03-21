import { getPgPool } from "@/lib/pg";
import { logError } from "@/lib/observability";

export const ARENA_CHAT_NOTIFY_CHANNEL = "chess_realtime_chat";

export async function publishArenaChatRealtime(payload: Record<string, unknown>) {
  const message = JSON.stringify({
    at: new Date().toISOString(),
    channel: "arena-chat",
    ...payload
  });

  try {
    await getPgPool().query("SELECT pg_notify($1, $2)", [
      ARENA_CHAT_NOTIFY_CHANNEL,
      JSON.stringify({
        channel: "arena-chat",
        message
      })
    ]);
  } catch (error) {
    logError("arena_chat.publish_failed", {
      message: error instanceof Error ? error.message : "Unknown arena chat publish failure."
    });
    throw error;
  }
}
