import { resignGame } from "@/lib/games";
import { getRequestActor } from "@/lib/request-actor";

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
          error: "Sign in is required to resign."
        },
        {
          status: 401
        }
      );
    }

    const { gameId } = await params;
    const game = await resignGame(gameId, actor);

    return Response.json({
      game
    });
  } catch (error) {
    console.error("Failed to resign game", error);

    const message = error instanceof Error ? error.message : "";
    const statusMap: Record<string, number> = {
      GAME_NOT_FOUND: 404,
      GAME_NOT_ACTIVE: 409,
      PLAYER_NOT_IN_GAME: 403,
      ACCOUNT_RESTRICTED: 403
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
                  ? "This account is restricted from playing games."
                : "Resign request failed."
      },
      {
        status: statusMap[message] ?? 500
      }
    );
  }
}
