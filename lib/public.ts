import { GameStatus, ModerationStatus, PlayerColor, TimeCategory } from "@prisma/client";

import { db } from "@/lib/db";
import { formatCategoryLabel, formatControl } from "@/lib/game-config";
import { GUEST_EMAIL_DOMAIN, isGuestEmail } from "@/lib/guest-accounts";
import { getCapturedPieces, getPositionFlags, serializeBoard } from "@/lib/chess-engine";

export type LeaderboardCategory = "bullet" | "blitz" | "rapid";
export type PlayerHistoryCategoryFilter = "all" | "bullet" | "blitz" | "rapid" | "custom";
export type PlayerHistoryModeFilter = "all" | "rated" | "casual";

const PLAYER_HISTORY_PAGE_SIZE = 12;

type PublicUserIdentity = {
  id: string;
  name: string;
  username: string | null;
  displayName: string | null;
};

type PublicGuestIdentity = {
  id: string;
  name: string;
};

function getPublicUserName(user: PublicUserIdentity) {
  return user.username?.trim() || user.displayName?.trim() || user.name.trim() || "NextChess Player";
}

function getPublicUserSlug(user: Pick<PublicUserIdentity, "id" | "username">) {
  return user.username?.trim() || user.id;
}

function getRatingField(category: LeaderboardCategory) {
  if (category === "bullet") {
    return "ratingBullet";
  }

  if (category === "blitz") {
    return "ratingBlitz";
  }

  return "ratingRapid";
}

function getCategoryMeta(category: LeaderboardCategory) {
  if (category === "bullet") {
    return {
      label: "Bullet",
      description: "Fastest pool. One sharp mistake usually decides the game."
    };
  }

  if (category === "blitz") {
    return {
      label: "Blitz",
      description: "Main competitive ladder for fast practical online chess."
    };
  }

  return {
    label: "Rapid",
    description: "Longer games with a cleaner quality signal and steadier rating movement."
  };
}

function isLeaderboardCategory(value: string | null | undefined): value is LeaderboardCategory {
  return value === "bullet" || value === "blitz" || value === "rapid";
}

function isPlayerHistoryCategoryFilter(
  value: string | null | undefined
): value is PlayerHistoryCategoryFilter {
  return value === "all" || value === "bullet" || value === "blitz" || value === "rapid" || value === "custom";
}

function isPlayerHistoryModeFilter(value: string | null | undefined): value is PlayerHistoryModeFilter {
  return value === "all" || value === "rated" || value === "casual";
}

function formatResultReason(result: string | null) {
  if (!result) {
    return "No result";
  }

  return result
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getPlayerOutcome(
  winnerUserId: string | null,
  userId: string
): "win" | "loss" | "draw" {
  if (!winnerUserId) {
    return "draw";
  }

  return winnerUserId === userId ? "win" : "loss";
}

function getOpponentName(
  players: Array<{
    userId: string | null;
    guestIdentityId?: string | null;
    user: PublicUserIdentity | null;
    guestIdentity?: PublicGuestIdentity | null;
  }>,
  userId: string
) {
  const opponent = players.find((player) => player.userId !== userId);

  return opponent
    ? {
        id:
          opponent.user && opponent.userId
            ? getPublicUserSlug(opponent.user)
            : opponent.userId ?? opponent.guestIdentityId ?? null,
        name: opponent.user ? getPublicUserName(opponent.user) : opponent.guestIdentity?.name ?? "Anonymous"
      }
    : {
        id: null,
        name: "Unknown"
      };
}

function getTimeCategoryFilterValue(filter: PlayerHistoryCategoryFilter) {
  if (filter === "bullet") {
    return TimeCategory.BULLET;
  }

  if (filter === "blitz") {
    return TimeCategory.BLITZ;
  }

  if (filter === "rapid") {
    return TimeCategory.RAPID;
  }

  if (filter === "custom") {
    return TimeCategory.CUSTOM;
  }

  return null;
}

function buildPlayerHistoryWhere(
  userId: string,
  category: PlayerHistoryCategoryFilter,
  mode: PlayerHistoryModeFilter
) {
  return {
    status: GameStatus.FINISHED,
    players: {
      some: {
        userId
      }
    },
    ...(category !== "all"
      ? {
          timeCategory: getTimeCategoryFilterValue(category) ?? undefined
        }
      : {}),
    ...(mode === "rated" ? { rated: true } : mode === "casual" ? { rated: false } : {})
  };
}

function mapPublicGameHistoryEntry(
  game: {
    id: string;
    result: string | null;
    winnerUserId: string | null;
    rated: boolean;
    timeCategory: TimeCategory;
    initialTimeMs: number;
    incrementMs: number;
    endedAt: Date | null;
    players: Array<{
      userId: string | null;
      guestIdentityId: string | null;
      color: PlayerColor;
      user: PublicUserIdentity | null;
      guestIdentity: PublicGuestIdentity | null;
    }>;
    _count?: {
      moves: number;
    };
  },
  userId: string
) {
  const self = game.players.find((player) => player.userId === userId);
  const opponent = getOpponentName(game.players, userId);
  const outcome = getPlayerOutcome(game.winnerUserId, userId);

  return {
    id: game.id,
    opponentId: opponent.id,
    opponentName: opponent.name,
    color: self?.color ?? PlayerColor.WHITE,
    format: formatCategoryLabel(game.timeCategory),
    timeCategory: game.timeCategory,
    control: formatControl(game.initialTimeMs, game.incrementMs),
    rated: game.rated,
    outcome,
    resultReason: formatResultReason(game.result),
    endedAt: game.endedAt?.toISOString() ?? null,
    movesCount: game._count?.moves ?? null
  };
}

export function normalizeLeaderboardCategory(
  value: string | string[] | undefined
): LeaderboardCategory {
  const raw = Array.isArray(value) ? value[0] : value;
  return isLeaderboardCategory(raw) ? raw : "blitz";
}

export async function getLeaderboardData(category: LeaderboardCategory) {
  const ratingField = getRatingField(category);
  const meta = getCategoryMeta(category);

  const players = await db.user.findMany({
    where: {
      email: {
        not: {
          endsWith: GUEST_EMAIL_DOMAIN
        }
      },
      moderationStatus: {
        not: ModerationStatus.RESTRICTED
      }
    },
    orderBy: {
      [ratingField]: "desc"
    },
    select: {
      id: true,
      name: true,
      username: true,
      displayName: true,
      ratingBullet: true,
      ratingBlitz: true,
      ratingRapid: true,
      createdAt: true
    },
    take: 50
  });

  return {
    category,
    label: meta.label,
    description: meta.description,
    players: players.map((player, index) => ({
      id: player.id,
      slug: getPublicUserSlug(player),
      rank: index + 1,
      name: getPublicUserName(player),
      ratings: {
        bullet: player.ratingBullet,
        blitz: player.ratingBlitz,
        rapid: player.ratingRapid
      },
      rating: player[ratingField],
      joinedAt: player.createdAt.toISOString()
    }))
  };
}

export async function getPlayerProfileData(profileSlug: string) {
  return getPlayerProfileDataWithHistory(profileSlug, {
    page: 1,
    category: "all",
    mode: "all"
  });
}

export async function getPlayerProfileDataWithHistory(
  profileSlug: string,
  options?: {
    page?: number;
    category?: PlayerHistoryCategoryFilter;
    mode?: PlayerHistoryModeFilter;
  }
) {
  const userSelect = {
    id: true,
    name: true,
    username: true,
    displayName: true,
    email: true,
    createdAt: true,
    moderationStatus: true,
    ratingBullet: true,
    ratingBlitz: true,
    ratingRapid: true
  } as const;

  const user =
    (await db.user.findUnique({
      where: {
        username: profileSlug
      },
      select: userSelect
    })) ??
    (await db.user.findUnique({
      where: {
        id: profileSlug
      },
      select: userSelect
    }));

  if (!user) {
    return null;
  }

  if (isGuestEmail(user.email)) {
    return null;
  }

  const userId = user.id;

  const page = Math.max(1, options?.page ?? 1);
  const category = options?.category ?? "all";
  const mode = options?.mode ?? "all";
  const historyWhere = buildPlayerHistoryWhere(userId, category, mode);

  const [totalGames, ratedGames, wins, draws, recentGames, betterBullet, betterBlitz, betterRapid] =
    await Promise.all([
      db.gamePlayer.count({
        where: {
          userId,
          game: {
            status: GameStatus.FINISHED
          }
        }
      }),
      db.gamePlayer.count({
        where: {
          userId,
          game: {
            status: GameStatus.FINISHED,
            rated: true
          }
        }
      }),
      db.gamePlayer.count({
        where: {
          userId,
          game: {
            status: GameStatus.FINISHED,
            winnerUserId: userId
          }
        }
      }),
      db.gamePlayer.count({
        where: {
          userId,
          game: {
            status: GameStatus.FINISHED,
            winnerUserId: null
          }
        }
      }),
      Promise.all([
        db.game.count({
          where: historyWhere
        }),
        db.game.findMany({
          where: historyWhere,
          orderBy: {
            endedAt: "desc"
          },
          skip: (page - 1) * PLAYER_HISTORY_PAGE_SIZE,
          take: PLAYER_HISTORY_PAGE_SIZE,
          select: {
            id: true,
            result: true,
            winnerUserId: true,
            rated: true,
            timeCategory: true,
            initialTimeMs: true,
            incrementMs: true,
            endedAt: true,
            _count: {
              select: {
                moves: true
              }
            },
            players: {
              select: {
                userId: true,
                guestIdentityId: true,
                color: true,
                user: {
                  select: {
                    id: true,
                    name: true,
                    username: true,
                    displayName: true
                  }
                },
                guestIdentity: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            }
          }
        })
      ]),
      user.moderationStatus === ModerationStatus.RESTRICTED
        ? Promise.resolve(null)
        : db.user.count({
            where: {
              email: {
                not: {
                  endsWith: GUEST_EMAIL_DOMAIN
                }
              },
              moderationStatus: {
                not: ModerationStatus.RESTRICTED
              },
              ratingBullet: {
                gt: user.ratingBullet
              }
            }
          }),
      user.moderationStatus === ModerationStatus.RESTRICTED
        ? Promise.resolve(null)
        : db.user.count({
            where: {
              email: {
                not: {
                  endsWith: GUEST_EMAIL_DOMAIN
                }
              },
              moderationStatus: {
                not: ModerationStatus.RESTRICTED
              },
              ratingBlitz: {
                gt: user.ratingBlitz
              }
            }
          }),
      user.moderationStatus === ModerationStatus.RESTRICTED
        ? Promise.resolve(null)
        : db.user.count({
            where: {
              email: {
                not: {
                  endsWith: GUEST_EMAIL_DOMAIN
                }
              },
              moderationStatus: {
                not: ModerationStatus.RESTRICTED
              },
              ratingRapid: {
                gt: user.ratingRapid
              }
            }
          })
    ]);

  const [historyTotal, historyGames] = recentGames;
  const losses = Math.max(0, totalGames - wins - draws);
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

  return {
    user: {
      id: user.id,
      slug: getPublicUserSlug(user),
      username: user.username,
      name: getPublicUserName(user),
      createdAt: user.createdAt.toISOString(),
      moderationStatus: user.moderationStatus,
      ratings: {
        bullet: user.ratingBullet,
        blitz: user.ratingBlitz,
        rapid: user.ratingRapid
      },
      ranks: {
        bullet: betterBullet === null ? null : betterBullet + 1,
        blitz: betterBlitz === null ? null : betterBlitz + 1,
        rapid: betterRapid === null ? null : betterRapid + 1
      }
    },
    overview: {
      totalGames,
      ratedGames,
      wins,
      draws,
      losses,
      winRate
    },
    history: {
      page,
      pageSize: PLAYER_HISTORY_PAGE_SIZE,
      totalGames: historyTotal,
      totalPages: Math.max(1, Math.ceil(historyTotal / PLAYER_HISTORY_PAGE_SIZE)),
      category,
      mode,
      games: historyGames.map((game) => mapPublicGameHistoryEntry(game, userId))
    }
  };
}

export function normalizePlayerHistoryCategory(
  value: string | string[] | undefined
): PlayerHistoryCategoryFilter {
  const raw = Array.isArray(value) ? value[0] : value;
  return isPlayerHistoryCategoryFilter(raw) ? raw : "all";
}

export function normalizePlayerHistoryMode(
  value: string | string[] | undefined
): PlayerHistoryModeFilter {
  const raw = Array.isArray(value) ? value[0] : value;
  return isPlayerHistoryModeFilter(raw) ? raw : "all";
}

export function normalizeHistoryPage(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export function getPlayerHistoryCategoryOptions() {
  return [
    { value: "all" as const, label: "All formats" },
    { value: "bullet" as const, label: "Bullet" },
    { value: "blitz" as const, label: "Blitz" },
    { value: "rapid" as const, label: "Rapid" },
    { value: "custom" as const, label: "Custom" }
  ];
}

export function getPlayerHistoryModeOptions() {
  return [
    { value: "all" as const, label: "All games" },
    { value: "rated" as const, label: "Rated" },
    { value: "casual" as const, label: "Casual" }
  ];
}

export async function getPublicGameReplayData(gameId: string) {
  const game = await db.game.findUnique({
    where: {
      id: gameId
    },
    select: {
      id: true,
      status: true,
      rated: true,
      visibility: true,
      timeCategory: true,
      initialTimeMs: true,
      incrementMs: true,
      result: true,
      pgn: true,
      winnerUserId: true,
      createdAt: true,
      endedAt: true,
      fen: true,
      players: {
        orderBy: {
          joinedAt: "asc"
        },
        select: {
          id: true,
          userId: true,
          guestIdentityId: true,
          color: true,
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              username: true,
              displayName: true,
              ratingBullet: true,
              ratingBlitz: true,
              ratingRapid: true
            }
          },
          guestIdentity: {
            select: {
              id: true,
              name: true
            }
          }
        }
      },
      moves: {
        orderBy: {
          ply: "asc"
        },
        select: {
          id: true,
          ply: true,
          san: true,
          uci: true,
          createdAt: true
        }
      }
    }
  });

  if (!game || (game.status !== GameStatus.FINISHED && game.status !== GameStatus.CANCELLED)) {
    return null;
  }

  const board = serializeBoard(game.fen);
  const { inCheck, turnColor } = getPositionFlags(game.fen);

  return {
    id: game.id,
    status: game.status,
    rated: game.rated,
    visibility: game.visibility,
    format: formatCategoryLabel(game.timeCategory),
    control: formatControl(game.initialTimeMs, game.incrementMs),
    timeCategory: game.timeCategory,
    result: game.result,
    resultReason: formatResultReason(game.result),
    pgn: game.pgn ?? "",
    winnerUserId: game.winnerUserId,
    createdAt: game.createdAt.toISOString(),
    endedAt: game.endedAt?.toISOString() ?? null,
    finalFen: game.fen,
    finalPosition: {
      board,
      inCheck,
      turnColor,
      captured: getCapturedPieces(board)
    },
    players: game.players.map((player) => ({
      id: player.id,
      userId: player.userId,
      guestIdentityId: player.guestIdentityId,
      color: player.color,
      name: player.user ? getPublicUserName(player.user) : player.guestIdentity?.name ?? "Anonymous",
      profileId:
        player.user && !isGuestEmail(player.user.email) ? getPublicUserSlug(player.user) : null,
      rating:
        player.user && player.color === PlayerColor.WHITE
          ? getCategoryRating(player.user, game.timeCategory)
          : player.user
            ? getCategoryRating(player.user, game.timeCategory)
            : null
    })),
    moves: game.moves.map((move) => ({
      id: move.id,
      ply: move.ply,
      san: move.san,
      uci: move.uci,
      from: move.uci.slice(0, 2),
      to: move.uci.slice(2, 4),
      promotion: move.uci.length > 4 ? move.uci[4] : null,
      createdAt: move.createdAt.toISOString()
    }))
  };
}

function getCategoryRating(
  user: {
    ratingBullet: number;
    ratingBlitz: number;
    ratingRapid: number;
  },
  timeCategory: TimeCategory
) {
  if (timeCategory === TimeCategory.BULLET) {
    return user.ratingBullet;
  }

  if (timeCategory === TimeCategory.BLITZ) {
    return user.ratingBlitz;
  }

  return user.ratingRapid;
}

export function getLeaderboardCategoryOptions() {
  return (["bullet", "blitz", "rapid"] as const).map((category) => ({
    value: category,
    ...getCategoryMeta(category)
  }));
}

export function getTimeCategoryAccent(timeCategory: TimeCategory) {
  if (timeCategory === TimeCategory.BULLET) {
    return "bullet";
  }

  if (timeCategory === TimeCategory.BLITZ) {
    return "blitz";
  }

  return "rapid";
}
