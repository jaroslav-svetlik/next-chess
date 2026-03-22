import { normalizeGameSetup } from "@/lib/game-config";
import { quickPairGame } from "@/lib/games";
import { getRequestActor } from "@/lib/request-actor";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const actor = await getRequestActor(request);

    if (!actor) {
      return Response.json(
        {
          error: "Sign in is required to enter matchmaking."
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
    const setup = normalizeGameSetup({
      ...payload,
      visibility: "PUBLIC"
    });
    const game = await quickPairGame(actor, setup);

    return Response.json({
      game
    });
  } catch (error) {
    console.error("Failed to quick pair", error);

    const message = error instanceof Error ? error.message : "";
    const status =
      message === "ACCOUNT_RESTRICTED"
        ? 403
        : message === "MATCHMAKING_ALREADY_QUEUED"
          ? 409
          : 500;

    return Response.json(
      {
        error:
          message === "ACCOUNT_RESTRICTED"
            ? "This account is restricted from entering matchmaking."
            : message === "MATCHMAKING_ALREADY_QUEUED"
              ? "You already have another live game or open seek. Cancel it first or return to that room."
            : "Matchmaking request failed."
      },
      {
        status
      }
    );
  }
}
