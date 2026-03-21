import { cancelWaitingGame, getGame } from "@/lib/games";
import { getRequestActor } from "@/lib/request-actor";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const actor = await getRequestActor(request);
    const game = await getGame(gameId, actor ?? null);

    if (!game) {
      return Response.json(
        {
          error: "Game not found."
        },
        {
          status: 404
        }
      );
    }

    return Response.json({
      game,
      actor
    });
  } catch (error) {
    console.error("Failed to load game", error);

    return Response.json(
      {
        error: "Game could not be loaded."
      },
      {
        status: 500
      }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const actor = await getRequestActor(request);

    if (!actor) {
      return Response.json(
        {
          error: "Sign in is required to cancel matchmaking."
        },
        {
          status: 401
        }
      );
    }

    const { gameId } = await params;
    const game = await cancelWaitingGame(gameId, actor);

    return Response.json({
      game
    });
  } catch (error) {
    console.error("Failed to cancel game", error);

    const message = error instanceof Error ? error.message : "";
    const statusMap: Record<string, number> = {
      GAME_NOT_FOUND: 404,
      GAME_NOT_WAITING: 409,
      PLAYER_NOT_IN_GAME: 403
    };

    return Response.json(
      {
        error:
          message === "GAME_NOT_FOUND"
            ? "Game not found."
            : message === "GAME_NOT_WAITING"
              ? "Game is no longer waiting."
              : message === "PLAYER_NOT_IN_GAME"
                ? "You cannot cancel this search."
                : "Game could not be cancelled."
      },
      {
        status: statusMap[message] ?? 500
      }
    );
  }
}
