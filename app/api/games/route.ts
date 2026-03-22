import { normalizeGameSetup } from "@/lib/game-config";
import { createGame } from "@/lib/games";
import { getRequestActor } from "@/lib/request-actor";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const actor = await getRequestActor(request);

    if (!actor) {
      return Response.json(
        {
          error: "Sign in is required to create a game."
        },
        {
          status: 401
        }
      );
    }

    const payload = (await request.json()) as {
      format?: string;
      control?: string;
      visibility?: string;
      initialMinutes?: number;
      incrementSeconds?: number;
    };
    const setup = normalizeGameSetup(payload);
    const game = await createGame(actor, setup);

    return Response.json({
      game
    });
  } catch (error) {
    console.error("Failed to create game", error);

    const message = error instanceof Error ? error.message : "";
    const status =
      message === "ACCOUNT_RESTRICTED"
        ? 403
        : message === "LIVE_GAME_ALREADY_OPEN"
          ? 409
          : 500;

    return Response.json(
      {
        error:
          message === "ACCOUNT_RESTRICTED"
            ? "This account is restricted from creating games."
            : message === "LIVE_GAME_ALREADY_OPEN"
              ? "You already have another live table open. Return to it or cancel it before creating a new one."
            : "Game creation failed."
      },
      {
        status
      }
    );
  }
}
