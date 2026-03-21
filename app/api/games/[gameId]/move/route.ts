import { getRequestActor } from "@/lib/request-actor";
import { submitMove } from "@/lib/games";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const actor = await getRequestActor(request);

    if (!actor) {
      return Response.json(
        {
          error: "Sign in is required to move."
        },
        {
          status: 401
        }
      );
    }

    const { gameId } = await params;
    const payload = (await request.json()) as {
      from: string;
      to: string;
      promotion?: string;
      clientThinkTimeMs?: number;
      turnBlurCount?: number;
      focusLossDurationMs?: number;
    };
    const game = await submitMove(gameId, actor, payload);

    return Response.json({
      game
    });
  } catch (error) {
    console.error("Failed to submit move", error);

    const message = error instanceof Error ? error.message : "";
    const statusMap: Record<string, number> = {
      GAME_NOT_FOUND: 404,
      GAME_NOT_ACTIVE: 409,
      PLAYER_NOT_IN_GAME: 403,
      ACCOUNT_RESTRICTED: 403,
      NOT_YOUR_TURN: 409,
      INVALID_MOVE: 422,
      INVALID_MOVE_PAYLOAD: 400,
      MOVE_STATE_CONFLICT: 409
    };

    return Response.json(
      {
        error:
          message === "GAME_NOT_FOUND"
            ? "Game not found."
            : message === "GAME_NOT_ACTIVE"
              ? "Game is not active."
              : message === "PLAYER_NOT_IN_GAME"
                ? "You are not seated in this game."
                : message === "ACCOUNT_RESTRICTED"
                  ? "This account is restricted from playing moves."
                : message === "NOT_YOUR_TURN"
                  ? "It is not your turn."
                  : message === "INVALID_MOVE"
                    ? "That move is not legal."
                    : message === "INVALID_MOVE_PAYLOAD"
                      ? "Move data was invalid. Refresh and try again."
                    : message === "MOVE_STATE_CONFLICT"
                      ? "Board state changed while the move was being sent. Try again."
                    : "Move submission failed."
      },
      {
        status: statusMap[message] ?? 500
      }
    );
  }
}
