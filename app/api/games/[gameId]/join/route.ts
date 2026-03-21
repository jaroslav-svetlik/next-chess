import { joinGame } from "@/lib/games";
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
          error: "Sign in is required to join a game."
        },
        {
          status: 401
        }
      );
    }

    const { gameId } = await params;
    const game = await joinGame(gameId, actor);

    return Response.json({
      game
    });
  } catch (error) {
    console.error("Failed to join game", error);

    const message = error instanceof Error ? error.message : "";
    const status =
      message === "GAME_NOT_FOUND"
        ? 404
        : message === "ACCOUNT_RESTRICTED"
          ? 403
          : message === "RATED_DISABLED_FOR_ACCOUNT"
            ? 403
          : message === "GAME_POOL_MISMATCH"
            ? 403
          : message === "GAME_UNAVAILABLE" || message === "RATED_REQUIRES_ACCOUNT"
          ? 409
          : 500;

    return Response.json(
      {
        error:
          status === 404
            ? "Game not found."
            : message === "ACCOUNT_RESTRICTED"
              ? "This account is restricted from joining games."
              : message === "RATED_DISABLED_FOR_ACCOUNT"
                ? "This account can only join casual games right now."
              : message === "GAME_POOL_MISMATCH"
                ? "Guest players can only join guest games, and registered accounts can only join registered-account games."
            : message === "RATED_REQUIRES_ACCOUNT"
              ? "Rated games require a signed-in account."
              : status === 409
              ? "Game is no longer available."
              : "Join request failed."
      },
      {
        status
      }
    );
  }
}
