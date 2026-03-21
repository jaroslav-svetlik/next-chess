import { listOpenGames } from "@/lib/games";
import { getRequestActor } from "@/lib/request-actor";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const actor = await getRequestActor(request);
    const games = await listOpenGames(actor);

    return Response.json({
      games,
      actor
    });
  } catch (error) {
    console.error("Failed to load lobby", error);

    return Response.json(
      {
        error: "Lobby is currently unavailable."
      },
      {
        status: 500
      }
    );
  }
}
