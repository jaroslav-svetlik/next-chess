import { db } from "./db";
import type { RequestActor } from "./request-actor";
import { publishGameUpdate } from "./realtime";
import { logInfo } from "./observability";

function getActorPresenceWhere(actor: RequestActor, gameId: string) {
  return actor.actorType === "user"
    ? {
        gameId_userId: {
          gameId,
          userId: actor.id
        }
      }
    : {
        gameId_guestIdentityId: {
          gameId,
          guestIdentityId: actor.id
        }
      };
}

export async function updateGamePresence(input: {
  gameId: string;
  actor: RequestActor;
  connected: boolean;
  reason: string;
}) {
  const player = await db.gamePlayer.findUnique({
    where: getActorPresenceWhere(input.actor, input.gameId),
    select: {
      id: true,
      color: true,
      isConnected: true
    }
  });

  if (!player || player.isConnected === input.connected) {
    return {
      updated: false
    };
  }

  await db.gamePlayer.update({
    where: {
      id: player.id
    },
    data: {
      isConnected: input.connected
    }
  });

  void publishGameUpdate(input.gameId, input.connected ? "player_connected" : "player_disconnected", {
    patch: {
      playerPresence: [
        {
          playerId: player.id,
          isConnected: input.connected
        }
      ]
    }
  });

  logInfo("games.presence_changed", {
    gameId: input.gameId,
    actorId: input.actor.id,
    actorType: input.actor.actorType,
    color: player.color,
    connected: input.connected,
    reason: input.reason
  });

  return {
    updated: true
  };
}
