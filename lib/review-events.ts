import { GameStatus, Prisma } from "@prisma/client";

import { buildAntiCheatReview, type FullGameForAntiCheat } from "./anti-cheat.ts";
import { isGuestEmail } from "./guest-accounts.ts";

const antiCheatGameInclude = {
  players: {
    include: {
      user: true,
      guestIdentity: true
    }
  },
  moves: {
    orderBy: {
      ply: "asc"
    }
  }
} satisfies Prisma.GameInclude;

function getParticipantEmail(participant: {
  user?: { email: string } | null;
  guestIdentity?: { email: string | null } | null;
}) {
  return participant.user?.email ?? participant.guestIdentity?.email ?? null;
}

function gameHasGuestPlayers(
  game: Pick<FullGameForAntiCheat, "players">
) {
  return game.players.some(
    (player) => Boolean(player.guestIdentity) || isGuestEmail(getParticipantEmail(player))
  );
}

export async function createAntiCheatReviewEvent(
  tx: Prisma.TransactionClient,
  gameId: string
) {
  const existingReview = await tx.gameEvent.findFirst({
    where: {
      gameId,
      type: "anti_cheat_review"
    },
    select: {
      id: true
    }
  });

  if (existingReview) {
    return null;
  }

  const finishedGame = await tx.game.findUnique({
    where: {
      id: gameId
    },
    include: antiCheatGameInclude
  });

  if (!finishedGame || finishedGame.status !== GameStatus.FINISHED) {
    return null;
  }

  if (gameHasGuestPlayers(finishedGame)) {
    return null;
  }

  const review = buildAntiCheatReview(finishedGame);

  if (!review) {
    return null;
  }

  await tx.gameEvent.create({
    data: {
      gameId,
      type: "anti_cheat_review",
      payload: review
    }
  });

  return review;
}
