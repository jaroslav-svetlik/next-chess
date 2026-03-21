import { updateGamePresence } from "@/lib/game-presence";
import { getRequestActor } from "@/lib/request-actor";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ gameId: string }> }
) {
  try {
    const actor = await getRequestActor(request);

    if (!actor) {
      return Response.json(
        {
          error: "Sign in is required."
        },
        {
          status: 401
        }
      );
    }

    const { gameId } = await context.params;
    const payload = (await request.json()) as {
      connected?: boolean;
      reason?: string;
    };

    await updateGamePresence({
      gameId,
      actor,
      connected: Boolean(payload.connected),
      reason: typeof payload.reason === "string" ? payload.reason : "unknown"
    });

    return Response.json({
      ok: true
    });
  } catch (error) {
    console.error("Failed to update game presence", error);

    return Response.json(
      {
        error: "Unable to update game presence."
      },
      {
        status: 500
      }
    );
  }
}
