import { GameStatus } from "@prisma/client";

import {
  BACKGROUND_JOB_TYPES,
  getWaitingRoomJobKey,
  scheduleBackgroundJob
} from "./background-jobs";
import { db } from "./db";
import { serializeLobbyGameSnapshot } from "./games";
import {
  WAITING_ROOM_DISCONNECT_GRACE_MS,
  WAITING_ROOM_HOST_GRACE_MS
} from "./game-timing";
import type { RequestActor } from "./request-actor";
import { publishGameUpdate, publishLobbyUpdate } from "./realtime";
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
  const heartbeatAt = new Date();
  const player = await db.gamePlayer.findUnique({
    where: getActorPresenceWhere(input.actor, input.gameId),
    select: {
      id: true,
      color: true,
      isConnected: true,
      lastSeenAt: true,
      game: {
        select: {
          id: true,
          status: true,
          visibility: true,
          rated: true,
          timeCategory: true,
          initialTimeMs: true,
          incrementMs: true,
          createdAt: true,
          createdByUserId: true,
          createdByGuestId: true,
          createdBy: {
            select: {
              name: true,
              displayName: true,
              moderationStatus: true
            }
          },
          createdByGuest: {
            select: {
              name: true
            }
          },
          players: {
            select: {
              id: true,
              userId: true,
              guestIdentityId: true,
              color: true,
              isConnected: true,
              lastSeenAt: true,
              timeRemainingMs: true,
              joinedAt: true,
              user: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                  displayName: true,
                  ratingRapid: true,
                  ratingBlitz: true,
                  ratingBullet: true
                }
              },
              guestIdentity: {
                select: {
                  id: true,
                  email: true,
                  name: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!player) {
    return {
      updated: false
    };
  }

  const connectionChanged = player.isConnected !== input.connected;

  await db.gamePlayer.update({
    where: {
      id: player.id
    },
    data: {
      isConnected: input.connected,
      lastSeenAt: heartbeatAt
    }
  });

  const updatedGame = {
    ...player.game,
    players: player.game.players.map((entry) => {
      const isCurrentActor =
        input.actor.actorType === "user"
          ? entry.userId === input.actor.id
          : entry.guestIdentityId === input.actor.id;

      return isCurrentActor
        ? {
            ...entry,
            isConnected: input.connected,
            lastSeenAt: heartbeatAt
          }
        : entry;
    })
  };

  const waitingHost =
    updatedGame.status === GameStatus.WAITING &&
    (input.actor.actorType === "user"
      ? updatedGame.createdByUserId === input.actor.id
      : updatedGame.createdByGuestId === input.actor.id);

  if (waitingHost) {
    const graceMs = input.connected
      ? WAITING_ROOM_HOST_GRACE_MS
      : WAITING_ROOM_DISCONNECT_GRACE_MS;

    await scheduleBackgroundJob({
      type: BACKGROUND_JOB_TYPES.waitingRoomExpiry,
      key: getWaitingRoomJobKey(input.gameId),
      runAt: new Date(heartbeatAt.getTime() + graceMs),
      payload: {
        gameId: input.gameId
      },
      maxAttempts: 20
    });

    if (connectionChanged) {
      if (input.connected) {
        void publishLobbyUpdate("waiting_host_reconnected", {
          gameId: input.gameId,
          patch: {
            kind: "ops",
            ops: [
              {
                type: "upsert",
                game: serializeLobbyGameSnapshot(updatedGame)
              }
            ]
          }
        });
      } else {
        void publishLobbyUpdate("waiting_host_disconnected", {
          gameId: input.gameId,
          patch: {
            kind: "ops",
            ops: [
              {
                type: "remove",
                gameId: input.gameId
              }
            ]
          }
        });
      }
    }
  }

  if (connectionChanged) {
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
  }

  logInfo("games.presence_changed", {
    gameId: input.gameId,
    actorId: input.actor.id,
    actorType: input.actor.actorType,
    color: player.color,
    connected: input.connected,
    previousConnected: player.isConnected,
    waitingHost,
    reason: input.reason
  });

  return {
    updated: connectionChanged
  };
}
