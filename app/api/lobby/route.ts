import { GameStatus, PlayerColor } from "@prisma/client";

import { listOpenGames } from "@/lib/games";
import { db } from "@/lib/db";
import { getRequestActor } from "@/lib/request-actor";

export const dynamic = "force-dynamic";

const ONLINE_WINDOW_MS = 90_000;

async function getLobbyStats() {
  const activeSince = new Date(Date.now() - ONLINE_WINDOW_MS);
  const [
    recentSessionUsers,
    recentGuests,
    connectedGameUsers,
    connectedGameGuests,
    gamesInProgress
  ] = await Promise.all([
    db.session.findMany({
      where: {
        expiresAt: {
          gt: new Date()
        },
        updatedAt: {
          gte: activeSince
        }
      },
      distinct: ["userId"],
      select: {
        userId: true
      }
    }),
    db.guestIdentity.findMany({
      where: {
        updatedAt: {
          gte: activeSince
        }
      },
      select: {
        id: true
      }
    }),
    db.gamePlayer.findMany({
      where: {
        isConnected: true,
        lastSeenAt: {
          gte: activeSince
        },
        game: {
          status: {
            in: [GameStatus.WAITING, GameStatus.ACTIVE]
          }
        }
      },
      distinct: ["userId"],
      select: {
        userId: true
      }
    }),
    db.gamePlayer.findMany({
      where: {
        guestIdentityId: {
          not: null
        },
        isConnected: true,
        lastSeenAt: {
          gte: activeSince
        },
        game: {
          status: {
            in: [GameStatus.WAITING, GameStatus.ACTIVE]
          }
        }
      },
      distinct: ["guestIdentityId"],
      select: {
        guestIdentityId: true
      }
    }),
    db.game.count({
      where: {
        status: GameStatus.ACTIVE,
        startedAt: {
          not: null
        },
        endedAt: null,
        players: {
          some: {
            color: PlayerColor.WHITE
          }
        },
        AND: [
          {
            players: {
              some: {
                color: PlayerColor.BLACK
              }
            }
          }
        ]
      }
    })
  ]);

  const userIds = new Set<string>();
  const guestIds = new Set<string>();

  for (const entry of recentSessionUsers) {
    if (entry.userId) {
      userIds.add(entry.userId);
    }
  }

  for (const entry of recentGuests) {
    guestIds.add(entry.id);
  }

  for (const entry of connectedGameUsers) {
    if (entry.userId) {
      userIds.add(entry.userId);
    }
  }

  for (const entry of connectedGameGuests) {
    if (entry.guestIdentityId) {
      guestIds.add(entry.guestIdentityId);
    }
  }

  return {
    onlinePlayers: userIds.size + guestIds.size,
    gamesInProgress
  };
}

export async function GET(request: Request) {
  try {
    const actor = await getRequestActor(request);
    const [games, stats, ratings] = await Promise.all([
      listOpenGames(actor),
      getLobbyStats(),
      actor?.actorType === "user"
        ? db.user.findUnique({
            where: {
              id: actor.id
            },
            select: {
              ratingBullet: true,
              ratingBlitz: true,
              ratingRapid: true
            }
          })
        : Promise.resolve(null)
    ]);

    return Response.json({
      games,
      actor: actor
        ? {
            ...actor,
            ratings: ratings
              ? {
                  bullet: ratings.ratingBullet,
                  blitz: ratings.ratingBlitz,
                  rapid: ratings.ratingRapid
                }
              : null
          }
        : null,
      stats
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
