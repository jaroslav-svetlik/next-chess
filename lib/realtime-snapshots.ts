import { GameVisibility, ModerationStatus, PlayerColor, Prisma } from "@prisma/client";

import {
  getCapturedPieces,
  getPositionFlags,
  serializeBoard
} from "./chess-engine.ts";
import { db } from "./db.ts";
import { formatCategoryLabel, formatControl } from "./game-config.ts";
import { OPENING_WINDOW_MS } from "./game-timing.ts";
import { getUserRatingByCategory } from "./rating.ts";

const participantUserSelect = {
  id: true,
  email: true,
  name: true,
  displayName: true,
  ratingRapid: true,
  ratingBlitz: true,
  ratingBullet: true
} satisfies Prisma.UserSelect;

const participantGuestSelect = {
  id: true,
  email: true,
  name: true
} satisfies Prisma.GuestIdentitySelect;

const gamePlayerSelect = {
  id: true,
  userId: true,
  guestIdentityId: true,
  color: true,
  timeRemainingMs: true,
  isConnected: true,
  joinedAt: true,
  user: {
    select: participantUserSelect
  },
  guestIdentity: {
    select: participantGuestSelect
  }
} satisfies Prisma.GamePlayerSelect;

const gameSummarySelect = {
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
      displayName: true
    }
  },
  createdByGuest: {
    select: {
      name: true
    }
  },
  players: {
    select: gamePlayerSelect
  }
} satisfies Prisma.GameSelect;

const gameDetailSelect = {
  ...gameSummarySelect,
  updatedAt: true,
  fen: true,
  pgn: true,
  result: true,
  inviteCode: true,
  turnColor: true,
  turnStartedAt: true,
  startedAt: true,
  endedAt: true,
  moves: {
    orderBy: {
      ply: "asc"
    },
    take: 20,
    select: {
      id: true,
      ply: true,
      san: true,
      uci: true,
      createdAt: true
    }
  },
  events: {
    where: {
      type: "rating_applied"
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 1,
    select: {
      payload: true
    }
  }
} satisfies Prisma.GameSelect;

type GameSummaryRecord = Prisma.GameGetPayload<{
  select: typeof gameSummarySelect;
}>;

type GameDetailRecord = Prisma.GameGetPayload<{
  select: typeof gameDetailSelect;
}>;

function getParticipantName(participant: {
  user?: { displayName: string | null; name: string } | null;
  guestIdentity?: { name: string } | null;
}) {
  if (participant.user) {
    return participant.user.displayName ?? participant.user.name;
  }

  if (participant.guestIdentity) {
    return participant.guestIdentity.name;
  }

  return "Unknown";
}

function getGameCreatorName(game: {
  createdBy?: { displayName: string | null; name: string } | null;
  createdByGuest?: { name: string } | null;
}) {
  if (game.createdBy) {
    return game.createdBy.displayName ?? game.createdBy.name;
  }

  if (game.createdByGuest) {
    return game.createdByGuest.name;
  }

  return "Unknown";
}

function getGamePoolType(game: {
  createdByUserId?: string | null;
  createdByGuestId?: string | null;
}) {
  if (game.createdByUserId) {
    return "user" as const;
  }

  if (game.createdByGuestId) {
    return "guest" as const;
  }

  return null;
}

function getOpeningWindowEndsAt(turnStartedAt: Date | null) {
  if (!turnStartedAt) {
    return null;
  }

  return new Date(turnStartedAt.getTime() + OPENING_WINDOW_MS).toISOString();
}

function serializeLobbyGameSnapshot(game: GameSummaryRecord) {
  const host = game.players.find((player) => player.color === PlayerColor.WHITE) ?? game.players[0];

  return {
    id: game.id,
    host: host ? getParticipantName(host) : getGameCreatorName(game),
    hostId: game.createdByUserId ?? game.createdByGuestId ?? null,
    poolType: getGamePoolType(game),
    status: game.status,
    visibility: game.visibility,
    rated: game.rated,
    timeCategory: game.timeCategory,
    format: formatCategoryLabel(game.timeCategory),
    control: formatControl(game.initialTimeMs, game.incrementMs),
    seatsFilled: game.players.length,
    createdAt: game.createdAt.toISOString()
  };
}

function serializeGameSnapshot(game: GameDetailRecord) {
  const { inCheck, turnColor } = getPositionFlags(game.fen);
  const board = serializeBoard(game.fen);
  const ratingEvent = game.events[0] ?? null;
  const ratingPayload =
    ratingEvent && ratingEvent.payload && typeof ratingEvent.payload === "object"
      ? (ratingEvent.payload as {
          whiteDelta?: number;
          blackDelta?: number;
          whiteAfter?: number;
          blackAfter?: number;
        })
      : null;
  const players = game.players.map((player) => ({
    id: player.id,
    userId: player.userId ?? null,
    guestIdentityId: player.guestIdentityId ?? null,
    color: player.color,
    timeRemainingMs: player.timeRemainingMs,
    isConnected: player.isConnected,
    name: getParticipantName(player),
    rating: player.user ? getUserRatingByCategory(player.user, game.timeCategory) : null,
    ratingDelta:
      player.color === PlayerColor.WHITE
        ? (ratingPayload?.whiteDelta ?? null)
        : (ratingPayload?.blackDelta ?? null),
    ratingAfter:
      player.color === PlayerColor.WHITE
        ? (ratingPayload?.whiteAfter ?? null)
        : (ratingPayload?.blackAfter ?? null)
  }));
  const lastMove = game.moves.at(-1) ?? null;

  return {
    id: game.id,
    version: game.updatedAt.toISOString(),
    status: game.status,
    visibility: game.visibility,
    rated: game.rated,
    inviteCode: game.visibility === GameVisibility.PRIVATE ? game.inviteCode : null,
    timeCategory: game.timeCategory,
    format: formatCategoryLabel(game.timeCategory),
    control: formatControl(game.initialTimeMs, game.incrementMs),
    initialTimeMs: game.initialTimeMs,
    incrementMs: game.incrementMs,
    fen: game.fen,
    pgn: game.pgn,
    createdAt: game.createdAt.toISOString(),
    startedAt: game.startedAt?.toISOString() ?? null,
    endedAt: game.endedAt?.toISOString() ?? null,
    turnStartedAt: game.turnStartedAt?.toISOString() ?? null,
    openingWindowEndsAt:
      game.status === "ACTIVE" && game.moves.length < 2
        ? getOpeningWindowEndsAt(game.turnStartedAt)
        : null,
    openingMovesRequired: game.status === "ACTIVE" && game.moves.length < 2 ? 1 : 0,
    hostId: game.createdByUserId ?? game.createdByGuestId ?? null,
    poolType: getGamePoolType(game),
    hostName: getGameCreatorName(game),
    turnColor,
    inCheck,
    result: game.result,
    board,
    captured: getCapturedPieces(board),
    lastMove: lastMove
      ? {
          from: lastMove.uci.slice(0, 2),
          to: lastMove.uci.slice(2, 4),
          san: lastMove.san
        }
      : null,
    players,
    moves: game.moves.map((move) => ({
      id: move.id,
      ply: move.ply,
      san: move.san,
      uci: move.uci,
      from: move.uci.slice(0, 2),
      to: move.uci.slice(2, 4),
      createdAt: move.createdAt.toISOString()
    }))
  };
}

export async function listLobbyRealtimeSnapshots() {
  const games = await db.game.findMany({
    where: {
      status: "WAITING",
      visibility: "PUBLIC",
      OR: [
        {
          createdByUserId: null
        },
        {
          createdBy: {
            moderationStatus: {
              not: ModerationStatus.RESTRICTED
            }
          }
        }
      ]
    },
    select: gameSummarySelect,
    orderBy: {
      createdAt: "desc"
    },
    take: 24
  });

  return games.map(serializeLobbyGameSnapshot);
}

export async function fetchGameRealtimeSnapshot(gameId: string) {
  const game = await db.game.findUnique({
    where: {
      id: gameId
    },
    select: gameDetailSelect
  });

  if (!game) {
    return null;
  }

  return serializeGameSnapshot(game);
}
