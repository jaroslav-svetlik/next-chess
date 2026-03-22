import { Chess, type PieceSymbol, type Square } from "chess.js";
import { GameStatus, GameVisibility, ModerationStatus, PlayerColor, Prisma, TimeCategory } from "@prisma/client";

import {
  normalizeMoveTelemetry,
  type MoveTelemetryInput
} from "./anti-cheat.ts";
import {
  BACKGROUND_JOB_TYPES,
  cancelBackgroundJob,
  getWaitingRoomJobKey,
  scheduleBackgroundJob
} from "./background-jobs.ts";
import {
  chessColorToPlayerColor,
  getCapturedPieces,
  getPositionFlags,
  resolveOutcomeFromFen,
  serializeBoard
} from "./chess-engine.ts";
import { cancelGameDeadlineJob, maybeEnforceExpiredGameDeadline, syncGameDeadlineJob } from "./game-deadline.ts";
import { db } from "./db.ts";
import { scheduleEngineReview } from "./engine-analysis.ts";
import { formatCategoryLabel, formatControl } from "./game-config.ts";
import type { NormalizedGameSetup } from "./game-config.ts";
import { isGuestEmail } from "./guest-accounts.ts";
import {
  OPENING_WINDOW_MS,
  WAITING_ROOM_DISCONNECT_GRACE_MS,
  WAITING_ROOM_HOST_GRACE_MS
} from "./game-timing.ts";
import { maybeAutoRaiseObserveForGame } from "./moderation-policy.ts";
import { logInfo, logWarn } from "./observability.ts";
import { applyRatingAdjustment, getRatingField, getUserRatingByCategory } from "./rating.ts";
import type { RequestActor } from "./request-actor.ts";
import { publishGameUpdate, publishLobbyUpdate } from "./realtime.ts";
import { createAntiCheatReviewEvent } from "./review-events.ts";

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
  lastSeenAt: true,
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

const gameTransactionSelect = {
  id: true,
  status: true,
  rated: true,
  timeCategory: true,
  incrementMs: true,
  initialTimeMs: true,
  fen: true,
  pgn: true,
  result: true,
  winnerUserId: true,
  turnColor: true,
  turnStartedAt: true,
  startedAt: true,
  endedAt: true,
  updatedAt: true,
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
    select: gamePlayerSelect
  },
  _count: {
    select: {
      moves: true
    }
  }
} satisfies Prisma.GameSelect;

export type GameSummaryRecord = Prisma.GameGetPayload<{
  select: typeof gameSummarySelect;
}>;

export type GameDetailRecord = Prisma.GameGetPayload<{
  select: typeof gameDetailSelect;
}>;

type GameTransactionRecord = Prisma.GameGetPayload<{
  select: typeof gameTransactionSelect;
}>;

type WaitingRoomJobResult =
  | {
      status: "noop";
      reason: string;
    }
  | {
      status: "reschedule";
      runAt: Date;
      reason: string;
    }
  | {
      status: "completed";
      reason: string;
    };

export type SubmitMoveInput = {
  from: string;
  to: string;
  promotion?: string;
} & MoveTelemetryInput;

const MOVE_TRANSACTION_RETRY_LIMIT = 2;

function isRetryableMoveConflict(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2034";
  }

  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes("P2034") ||
    error.message.includes("write conflict") ||
    error.message.includes("deadlock") ||
    error.message.includes("TransactionWriteConflict")
  );
}

function isMoveStateConflict(error: unknown) {
  if (isRetryableMoveConflict(error)) {
    return true;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2002" || error.code === "P2025";
  }

  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes("Unique constraint") ||
    error.message.includes("Record to update not found") ||
    error.message.includes("Transaction already closed")
  );
}

function getOpeningWindowEndsAt(turnStartedAt: Date | null) {
  if (!turnStartedAt) {
    return null;
  }

  return new Date(turnStartedAt.getTime() + OPENING_WINDOW_MS).toISOString();
}

function isRatedGameEligible(actor: RequestActor, timeCategory: TimeCategory) {
  return (
    !actor.isDemo &&
    actor.moderationStatus !== ModerationStatus.WATCH &&
    actor.moderationStatus !== ModerationStatus.REVIEW &&
    getRatingField(timeCategory) !== null
  );
}

function canActorEnterRated(
  actor?: Pick<RequestActor, "isDemo" | "moderationStatus"> | null
) {
  if (!actor) {
    return false;
  }

  return (
    !actor.isDemo &&
    actor.moderationStatus !== ModerationStatus.WATCH &&
    actor.moderationStatus !== ModerationStatus.REVIEW &&
    actor.moderationStatus !== ModerationStatus.RESTRICTED
  );
}

function makeInviteCode() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
}

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

function getParticipantEmail(participant: {
  user?: { email: string } | null;
  guestIdentity?: { email: string | null } | null;
}) {
  return participant.user?.email ?? participant.guestIdentity?.email ?? null;
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

function actorMatchesPlayer(
  player: {
    userId?: string | null;
    guestIdentityId?: string | null;
  },
  actor: Pick<RequestActor, "id" | "actorType">
) {
  return actor.actorType === "user" ? player.userId === actor.id : player.guestIdentityId === actor.id;
}

function actorMatchesCreator(
  game: {
    createdByUserId?: string | null;
    createdByGuestId?: string | null;
  },
  actor: Pick<RequestActor, "id" | "actorType">
) {
  return actor.actorType === "user" ? game.createdByUserId === actor.id : game.createdByGuestId === actor.id;
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

function actorMatchesGamePool(
  game: {
    createdByUserId?: string | null;
    createdByGuestId?: string | null;
  },
  actor?: Pick<RequestActor, "actorType"> | null
) {
  const gamePool = getGamePoolType(game);

  if (!gamePool || !actor) {
    return false;
  }

  return gamePool === actor.actorType;
}

function getActorRelationInput(actor: RequestActor) {
  return actor.actorType === "user"
    ? {
        userId: actor.id
      }
    : {
        guestIdentityId: actor.id
      };
}

function assertActorCanPlay(actor: RequestActor) {
  if (actor.moderationStatus === ModerationStatus.RESTRICTED) {
    throw new Error("ACCOUNT_RESTRICTED");
  }
}

function gameHasGuestPlayers(
  game: {
    players: Array<{
      userId?: string | null;
      guestIdentityId?: string | null;
      user?: { email: string } | null;
      guestIdentity?: { email: string | null } | null;
    }>;
  }
) {
  return game.players.some(
    (player) =>
      Boolean(player.guestIdentityId) ||
      Boolean(player.guestIdentity) ||
      isGuestEmail(getParticipantEmail(player))
  );
}

function getWaitingHostPlayer(
  game: {
    createdByUserId?: string | null;
    createdByGuestId?: string | null;
    players: Array<{
      userId?: string | null;
      guestIdentityId?: string | null;
      color: PlayerColor;
      isConnected?: boolean;
      lastSeenAt?: Date;
    }>;
  }
) {
  return (
    game.players.find((player) =>
      game.createdByUserId
        ? player.userId === game.createdByUserId
        : game.createdByGuestId
          ? player.guestIdentityId === game.createdByGuestId
          : false
    ) ??
    game.players.find((player) => player.color === PlayerColor.WHITE) ??
    game.players[0] ??
    null
  );
}

function getWaitingRoomExpiryRunAt(
  game: {
    status: GameStatus;
    createdByUserId?: string | null;
    createdByGuestId?: string | null;
    players: Array<{
      userId?: string | null;
      guestIdentityId?: string | null;
      color: PlayerColor;
      isConnected: boolean;
      lastSeenAt: Date;
    }>;
  },
  referenceTime = Date.now()
) {
  if (game.status !== GameStatus.WAITING) {
    return null;
  }

  const host = getWaitingHostPlayer(game);
  if (!host) {
    return new Date(referenceTime);
  }

  const graceMs = host.isConnected
    ? WAITING_ROOM_HOST_GRACE_MS
    : WAITING_ROOM_DISCONNECT_GRACE_MS;

  return new Date(Math.max(referenceTime, (host.lastSeenAt ?? new Date(0)).getTime() + graceMs));
}

function isWaitingHostAvailable(
  game: {
    status: GameStatus;
    createdByUserId?: string | null;
    createdByGuestId?: string | null;
    players: Array<{
      userId?: string | null;
      guestIdentityId?: string | null;
      color: PlayerColor;
      isConnected: boolean;
      lastSeenAt: Date;
    }>;
  },
  referenceTime = Date.now()
) {
  if (game.status !== GameStatus.WAITING) {
    return true;
  }

  const host = getWaitingHostPlayer(game);
  if (!host || !host.isConnected) {
    return false;
  }

  return referenceTime - (host.lastSeenAt ?? new Date(0)).getTime() <= WAITING_ROOM_HOST_GRACE_MS;
}

function shouldExpireWaitingRoom(
  game: {
    status: GameStatus;
    createdByUserId?: string | null;
    createdByGuestId?: string | null;
    players: Array<{
      userId?: string | null;
      guestIdentityId?: string | null;
      color: PlayerColor;
      isConnected: boolean;
      lastSeenAt: Date;
    }>;
  },
  referenceTime = Date.now()
) {
  if (game.status !== GameStatus.WAITING) {
    return false;
  }

  const host = getWaitingHostPlayer(game);
  if (!host) {
    return true;
  }

  const graceMs = host.isConnected
    ? WAITING_ROOM_HOST_GRACE_MS
    : WAITING_ROOM_DISCONNECT_GRACE_MS;

  return referenceTime - (host.lastSeenAt ?? new Date(0)).getTime() >= graceMs;
}

async function fetchGameDetailRecord(gameId: string) {
  return db.game.findUnique({
    where: {
      id: gameId
    },
    select: gameDetailSelect
  });
}

async function findExistingActiveGameForActor(
  tx: Prisma.TransactionClient,
  actor: RequestActor
) {
  return tx.game.findFirst({
    where: {
      status: GameStatus.ACTIVE,
      players: {
        some: getActorRelationInput(actor)
      }
    },
    select: gameDetailSelect,
    orderBy: {
      createdAt: "desc"
    }
  });
}

async function findExistingWaitingGameForActor(
  tx: Prisma.TransactionClient,
  actor: RequestActor
) {
  return tx.game.findFirst({
    where: {
      status: GameStatus.WAITING,
      players: {
        some: getActorRelationInput(actor)
      }
    },
    select: gameDetailSelect,
    orderBy: {
      createdAt: "desc"
    }
  });
}

async function scheduleWaitingRoomExpiry(game: {
  id: string;
  status: GameStatus;
  createdByUserId?: string | null;
  createdByGuestId?: string | null;
  players: Array<{
    userId?: string | null;
    guestIdentityId?: string | null;
    color: PlayerColor;
    isConnected: boolean;
    lastSeenAt: Date;
  }>;
}) {
  const runAt = getWaitingRoomExpiryRunAt(game);

  if (!runAt) {
    await cancelBackgroundJob(getWaitingRoomJobKey(game.id));
    return null;
  }

  return scheduleBackgroundJob({
    type: BACKGROUND_JOB_TYPES.waitingRoomExpiry,
    key: getWaitingRoomJobKey(game.id),
    runAt,
    payload: {
      gameId: game.id
    },
    maxAttempts: 20
  });
}

async function cancelWaitingRoomExpiry(gameId: string) {
  return cancelBackgroundJob(getWaitingRoomJobKey(gameId));
}

export function serializeLobbyGame(
  game: GameSummaryRecord,
  actor?: Pick<RequestActor, "id" | "isDemo" | "moderationStatus" | "actorType"> | null
) {
  const host = game.players.find((player) => player.color === PlayerColor.WHITE) ?? game.players[0];

  return {
    id: game.id,
    host: host ? getParticipantName(host) : getGameCreatorName(game),
    hostId: game.createdByUserId ?? game.createdByGuestId ?? null,
    status: game.status,
    visibility: game.visibility,
    rated: game.rated,
    timeCategory: game.timeCategory,
    format: formatCategoryLabel(game.timeCategory),
    control: formatControl(game.initialTimeMs, game.incrementMs),
    seatsFilled: game.players.length,
    canJoin:
      game.status === GameStatus.WAITING &&
      game.players.length < 2 &&
      isWaitingHostAvailable(game) &&
      actorMatchesGamePool(game, actor) &&
      (!actor || !actorMatchesCreator(game, actor)) &&
      (!game.rated || canActorEnterRated(actor)) &&
      actor?.moderationStatus !== ModerationStatus.RESTRICTED,
    createdAt: game.createdAt.toISOString()
  };
}

export function serializeLobbyGameSnapshot(
  game: Pick<
    GameSummaryRecord,
    | "id"
    | "status"
    | "visibility"
    | "rated"
    | "timeCategory"
    | "initialTimeMs"
    | "incrementMs"
    | "createdAt"
    | "createdByUserId"
    | "createdByGuestId"
    | "createdBy"
    | "createdByGuest"
    | "players"
  >
) {
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

export async function listLobbyRealtimeGames() {
  const games = await db.game.findMany({
    where: {
      status: GameStatus.WAITING,
      visibility: GameVisibility.PUBLIC,
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

  return games
    .filter((game) => isWaitingHostAvailable(game))
    .map(serializeLobbyGameSnapshot);
}

export function serializeGameDetail(
  game: GameDetailRecord,
  currentActor?: Pick<RequestActor, "id" | "actorType"> | null
) {
  const base = serializeGameSnapshot(game);
  const currentPlayer =
    game.players.find((player) => (currentActor ? actorMatchesPlayer(player, currentActor) : false)) ?? null;

  return {
    ...base,
    currentPlayerColor: currentPlayer?.color ?? null,
    canJoin:
      game.status === GameStatus.WAITING &&
      game.players.length < 2 &&
      !!currentActor &&
      actorMatchesGamePool(game, currentActor) &&
      !actorMatchesCreator(game, currentActor) &&
      isWaitingHostAvailable(game),
    isHost: currentActor ? actorMatchesCreator(game, currentActor) : false
  };
}

export function serializeGameSnapshot(game: GameDetailRecord) {
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
      game.status === GameStatus.ACTIVE && game.moves.length < 2
        ? getOpeningWindowEndsAt(game.turnStartedAt)
        : null,
    openingMovesRequired: game.status === GameStatus.ACTIVE && game.moves.length < 2 ? 1 : 0,
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

export async function listOpenGames(
  actor?: Pick<RequestActor, "id" | "isDemo" | "moderationStatus" | "actorType"> | null
) {
  const games = await db.game.findMany({
    where: {
      status: GameStatus.WAITING,
      visibility: GameVisibility.PUBLIC,
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

  return games
    .filter((game) => isWaitingHostAvailable(game))
    .filter((game) => (actor ? actorMatchesGamePool(game, actor) : true))
    .filter((game) => !game.rated || canActorEnterRated(actor))
    .map((game) => serializeLobbyGame(game, actor));
}

async function publishLobbySnapshot(reason: string, gameId?: string) {
  const games = await listLobbyRealtimeGames();
  return publishLobbyUpdate(reason, {
    gameId,
    games
  });
}

function publishLobbyUpsert(
  game: Parameters<typeof serializeLobbyGameSnapshot>[0],
  reason: string
) {
  return publishLobbyUpdate(reason, {
    gameId: game.id,
    patch: {
      kind: "ops",
      ops: [
        {
          type: "upsert",
          game: serializeLobbyGameSnapshot(game)
        }
      ]
    }
  });
}

function publishLobbyRemove(gameId: string, reason: string) {
  return publishLobbyUpdate(reason, {
    gameId,
    patch: {
      kind: "ops",
      ops: [
        {
          type: "remove",
          gameId
        }
      ]
    }
  });
}

function publishGameSnapshot(game: GameDetailRecord, reason: string) {
  return publishGameUpdate(game.id, reason, {
    game: serializeGameSnapshot(game)
  });
}

async function createWaitingGame(
  tx: Prisma.TransactionClient,
  actor: RequestActor,
  setup: NormalizedGameSetup,
  options?: {
    rated?: boolean;
  }
) {
  return tx.game.create({
    data: {
      status: GameStatus.WAITING,
      visibility: setup.visibility,
      timeCategory: setup.timeCategory,
      initialTimeMs: setup.initialTimeMs,
      incrementMs: setup.incrementMs,
      rated: options?.rated ?? false,
      ...(actor.actorType === "user"
        ? { createdByUserId: actor.id }
        : { createdByGuestId: actor.id }),
      inviteCode: setup.visibility === GameVisibility.PRIVATE ? makeInviteCode() : null,
      players: {
        create: {
          ...getActorRelationInput(actor),
          color: PlayerColor.WHITE,
          timeRemainingMs: setup.initialTimeMs,
          isConnected: true,
          lastSeenAt: new Date()
        }
      },
      events: {
        create: {
          type: "game_created",
          payload: {
            actorId: actor.id,
            control: setup.control,
            visibility: setup.visibility
          }
        }
      }
    },
    select: gameDetailSelect
  });
}

export async function createGame(actor: RequestActor, setup: NormalizedGameSetup) {
  assertActorCanPlay(actor);

  const game = await db.$transaction(async (tx) => {
    const existingActiveGame = await findExistingActiveGameForActor(tx, actor);
    if (existingActiveGame) {
      logInfo("games.reused_active_game", {
        gameId: existingActiveGame.id,
        actorId: actor.id,
        actorType: actor.actorType
      });
      return existingActiveGame;
    }

    const existingWaitingGame = await findExistingWaitingGameForActor(tx, actor);
    if (existingWaitingGame) {
      const sameSetup =
        !existingWaitingGame.rated &&
        existingWaitingGame.visibility === setup.visibility &&
        existingWaitingGame.timeCategory === setup.timeCategory &&
        existingWaitingGame.initialTimeMs === setup.initialTimeMs &&
        existingWaitingGame.incrementMs === setup.incrementMs;

      if (sameSetup) {
        logInfo("games.reused_waiting_game", {
          gameId: existingWaitingGame.id,
          actorId: actor.id,
          actorType: actor.actorType,
          visibility: existingWaitingGame.visibility,
          control: formatControl(existingWaitingGame.initialTimeMs, existingWaitingGame.incrementMs)
        });
        return existingWaitingGame;
      }

      logWarn("games.waiting_conflict", {
        gameId: existingWaitingGame.id,
        actorId: actor.id,
        actorType: actor.actorType,
        existingVisibility: existingWaitingGame.visibility,
        existingControl: formatControl(
          existingWaitingGame.initialTimeMs,
          existingWaitingGame.incrementMs
        ),
        requestedVisibility: setup.visibility,
        requestedControl: formatControl(setup.initialTimeMs, setup.incrementMs)
      });
      throw new Error("LIVE_GAME_ALREADY_OPEN");
    }

    const created = await createWaitingGame(tx, actor, setup, {
      rated: false
    });

    return created;
  });
  const serialized = serializeGameDetail(game, actor);

  if (game.status === GameStatus.ACTIVE) {
    await cancelWaitingRoomExpiry(game.id);
    void publishGameSnapshot(game, "game_reused");
    return serialized;
  }

  await scheduleWaitingRoomExpiry(game);
  void publishLobbyUpsert(game, "game_created");
  void publishGameSnapshot(game, "game_created");
  logInfo("games.created", {
    gameId: serialized.id,
    actorId: actor.id,
    actorType: actor.actorType,
    control: serialized.control,
    visibility: serialized.visibility
  });

  return serialized;
}

export async function quickPairGame(actor: RequestActor, setup: NormalizedGameSetup) {
  assertActorCanPlay(actor);

  const publicSetup = {
    ...setup,
    visibility: GameVisibility.PUBLIC
  };
  const rated = isRatedGameEligible(actor, publicSetup.timeCategory);

  const game = await db.$transaction(
    async (tx) => {
      const existingActiveGame = await findExistingActiveGameForActor(tx, actor);
      if (existingActiveGame) {
        logInfo("matchmaking.reused_active_game", {
          gameId: existingActiveGame.id,
          actorId: actor.id,
          actorType: actor.actorType
        });
        return existingActiveGame;
      }

      const existingWaitingGame = await findExistingWaitingGameForActor(tx, actor);
      if (existingWaitingGame) {
        const sameQueueConfig =
          existingWaitingGame.visibility === GameVisibility.PUBLIC &&
          existingWaitingGame.rated === rated &&
          existingWaitingGame.timeCategory === publicSetup.timeCategory &&
          existingWaitingGame.initialTimeMs === publicSetup.initialTimeMs &&
          existingWaitingGame.incrementMs === publicSetup.incrementMs;

        if (sameQueueConfig) {
          logInfo("matchmaking.reused_waiting_queue", {
            gameId: existingWaitingGame.id,
            actorId: actor.id,
            actorType: actor.actorType,
            rated,
            control: formatControl(publicSetup.initialTimeMs, publicSetup.incrementMs)
          });
          return existingWaitingGame;
        }

        logWarn("matchmaking.queue_conflict", {
          gameId: existingWaitingGame.id,
          actorId: actor.id,
          actorType: actor.actorType,
          existingControl: formatControl(
            existingWaitingGame.initialTimeMs,
            existingWaitingGame.incrementMs
          ),
          requestedControl: formatControl(
            publicSetup.initialTimeMs,
            publicSetup.incrementMs
          ),
          existingRated: existingWaitingGame.rated,
          existingVisibility: existingWaitingGame.visibility,
          requestedRated: rated
        });
        throw new Error("MATCHMAKING_ALREADY_QUEUED");
      }

      const waitingGames = await tx.game.findMany({
        where: {
          AND: [
            {
              status: GameStatus.WAITING
            },
            {
              visibility: GameVisibility.PUBLIC
            },
            {
              rated
            },
            actor.actorType === "user"
              ? {
                  createdBy: {
                    moderationStatus: {
                      not: ModerationStatus.RESTRICTED
                    }
                  },
                  createdByGuestId: null
                }
              : {
                  createdByGuestId: {
                    not: actor.id
                  },
                  createdByUserId: null
                },
            actor.actorType === "user"
              ? {
                  createdByUserId: {
                    not: actor.id
                  }
                }
              : {},
            {
              timeCategory: publicSetup.timeCategory
            },
            {
              initialTimeMs: publicSetup.initialTimeMs
            },
            {
              incrementMs: publicSetup.incrementMs
            }
          ]
        },
        select: gameDetailSelect,
        orderBy: {
          createdAt: "asc"
        },
        take: 12
      });
      const waitingGame = waitingGames.find((entry) => isWaitingHostAvailable(entry)) ?? null;

      if (!waitingGame) {
        return createWaitingGame(tx, actor, publicSetup, {
          rated
        });
      }

      return tx.game.update({
        where: {
          id: waitingGame.id
        },
        data: {
          status: GameStatus.ACTIVE,
          startedAt: new Date(),
          turnStartedAt: new Date(),
          players: {
            create: {
              ...getActorRelationInput(actor),
              color: PlayerColor.BLACK,
              timeRemainingMs: waitingGame.initialTimeMs,
              isConnected: true,
              lastSeenAt: new Date()
            }
          },
          events: {
            createMany: {
              data: [
                {
                  type: "player_joined",
                  payload: {
                    actorId: actor.id,
                    mode: "quick_pair"
                  }
                },
                {
                  type: "game_started",
                  payload: {
                    whiteId: waitingGame.createdByUserId ?? waitingGame.createdByGuestId,
                    blackId: actor.id,
                    turnColor: PlayerColor.WHITE,
                    openingWindowMs: OPENING_WINDOW_MS
                  }
                }
              ]
            }
          }
        },
        select: gameDetailSelect
      });
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    }
  );

  const serialized = serializeGameDetail(game, actor);

  if (game.turnStartedAt) {
    await cancelWaitingRoomExpiry(game.id);
    const queueWaitMs = Math.max(0, Date.now() - game.createdAt.getTime());
    await syncGameDeadlineJob(game);
    void publishLobbyRemove(serialized.id, "game_joined");
    void publishGameSnapshot(game, "game_joined");
    logInfo("matchmaking.paired", {
      gameId: serialized.id,
      actorId: actor.id,
      actorType: actor.actorType,
      rated: serialized.rated,
      control: serialized.control,
      queueWaitMs
    });
  } else {
    await scheduleWaitingRoomExpiry(game);
    void publishLobbyUpsert(game, "game_created");
    void publishGameSnapshot(game, "game_created");
    logInfo("matchmaking.queued", {
      gameId: serialized.id,
      actorId: actor.id,
      actorType: actor.actorType,
      rated: serialized.rated,
      control: serialized.control
    });
  }

  return serialized;
}

export async function getGame(
  gameId: string,
  currentActor?: Pick<RequestActor, "id" | "actorType"> | null
) {
  await maybeEnforceExpiredGameDeadline(gameId);

  const game = await db.game.findUnique({
    where: {
      id: gameId
    },
    select: gameDetailSelect
  });

  if (!game) {
    return null;
  }

  return serializeGameDetail(game, currentActor);
}

export async function runWaitingRoomExpiryJob(gameId: string): Promise<WaitingRoomJobResult> {
  let expiredGame: GameDetailRecord | null = null;

  const outcome = await db.$transaction(
    async (tx) => {
      const existing = await tx.game.findUnique({
        where: {
          id: gameId
        },
        select: gameDetailSelect
      });

      if (!existing) {
        return {
          status: "noop" as const,
          reason: "game_missing"
        };
      }

      if (existing.status !== GameStatus.WAITING) {
        return {
          status: "noop" as const,
          reason: "game_not_waiting"
        };
      }

      const nextRunAt = getWaitingRoomExpiryRunAt(existing);
      if (nextRunAt && !shouldExpireWaitingRoom(existing)) {
        return {
          status: "reschedule" as const,
          runAt: nextRunAt,
          reason: "host_still_present"
        };
      }

      const host = getWaitingHostPlayer(existing);
      expiredGame = await tx.game.update({
        where: {
          id: gameId
        },
        data: {
          status: GameStatus.CANCELLED,
          result: "cancelled_host_left",
          endedAt: new Date(),
          turnStartedAt: null,
          events: {
            create: {
              type: "waiting_room_expired",
              payload: {
                source: "waiting_room_expiry_job",
                hostConnected: host?.isConnected ?? false,
                hostLastSeenAt: host?.lastSeenAt?.toISOString() ?? null
              }
            }
          }
        },
        select: gameDetailSelect
      });

      return {
        status: "completed" as const,
        reason: host?.isConnected ? "host_heartbeat_expired" : "host_disconnected"
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    }
  );

  const finalizedGame = expiredGame as GameDetailRecord | null;
  if (!finalizedGame) {
    return outcome;
  }

  void publishGameSnapshot(finalizedGame, "waiting_room_expired");
  void publishLobbyRemove(finalizedGame.id, "waiting_room_expired");
  logInfo("games.waiting_room_expired", {
    gameId: finalizedGame.id,
    reason: outcome.reason
  });

  return outcome;
}

export async function cancelWaitingGame(gameId: string, actor: RequestActor) {
  const game = await db.$transaction(
    async (tx) => {
      const existing = await tx.game.findUnique({
        where: {
          id: gameId
        },
        select: gameDetailSelect
      });

      if (!existing) {
        throw new Error("GAME_NOT_FOUND");
      }

      if (existing.status !== GameStatus.WAITING) {
        throw new Error("GAME_NOT_WAITING");
      }

      const player = existing.players.find((entry) => actorMatchesPlayer(entry, actor));
      if (!player || !actorMatchesCreator(existing, actor)) {
        throw new Error("PLAYER_NOT_IN_GAME");
      }

      return tx.game.update({
        where: {
          id: gameId
        },
        data: {
          status: GameStatus.CANCELLED,
          result: "cancelled_matchmaking",
          endedAt: new Date(),
          turnStartedAt: null,
          events: {
            create: {
              type: "matchmaking_cancelled",
              payload: {
                actorId: actor.id
              }
            }
          }
        },
        select: gameDetailSelect
      });
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    }
  );

  await cancelWaitingRoomExpiry(gameId);
  await cancelGameDeadlineJob(gameId);

  const serialized = serializeGameDetail(game, actor);
  void publishGameSnapshot(game, "matchmaking_cancelled");
  void publishLobbyRemove(serialized.id, "game_cancelled");
  logInfo("matchmaking.cancelled", {
    gameId: serialized.id,
    actorId: actor.id,
    actorType: actor.actorType
  });

  return serialized;
}

export async function joinGame(gameId: string, actor: RequestActor) {
  assertActorCanPlay(actor);

  const game = await db.$transaction(
    async (tx) => {
      const existing = await tx.game.findUnique({
        where: {
          id: gameId
        },
        select: gameDetailSelect
      });

      if (!existing) {
        throw new Error("GAME_NOT_FOUND");
      }

      const currentSeat = existing.players.find((player) => actorMatchesPlayer(player, actor));
      if (currentSeat) {
        return existing;
      }

      if (existing.status !== GameStatus.WAITING || existing.players.length >= 2) {
        throw new Error("GAME_UNAVAILABLE");
      }

      if (!isWaitingHostAvailable(existing)) {
        throw new Error("GAME_UNAVAILABLE");
      }

      if (existing.rated && actor.isDemo) {
        throw new Error("RATED_REQUIRES_ACCOUNT");
      }

      if (existing.rated && !canActorEnterRated(actor)) {
        throw new Error("RATED_DISABLED_FOR_ACCOUNT");
      }

      if (!actorMatchesGamePool(existing, actor)) {
        throw new Error("GAME_POOL_MISMATCH");
      }

      if (existing.createdBy && existing.createdBy.moderationStatus === ModerationStatus.RESTRICTED) {
        throw new Error("GAME_UNAVAILABLE");
      }

      const updated = await tx.game.update({
        where: {
          id: gameId
        },
        data: {
          status: GameStatus.ACTIVE,
          startedAt: new Date(),
          turnStartedAt: new Date(),
          players: {
            create: {
              ...getActorRelationInput(actor),
              color: PlayerColor.BLACK,
              timeRemainingMs: existing.initialTimeMs,
              isConnected: true,
              lastSeenAt: new Date()
            }
          },
          events: {
            createMany: {
              data: [
                {
                  type: "player_joined",
                  payload: {
                    actorId: actor.id
                  }
                },
                {
                  type: "game_started",
                  payload: {
                    whiteId: existing.createdByUserId ?? existing.createdByGuestId,
                    blackId: actor.id,
                    turnColor: PlayerColor.WHITE
                  }
                }
              ]
            }
          }
        },
        select: gameDetailSelect
      });

      return updated;
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    }
  );

  const serialized = serializeGameDetail(game, actor);
  if (game.turnStartedAt) {
    await cancelWaitingRoomExpiry(game.id);
    await syncGameDeadlineJob(game);
  }
  void publishLobbyRemove(serialized.id, "game_joined");
  void publishGameSnapshot(game, "game_joined");
  logInfo("games.joined", {
    gameId: serialized.id,
    actorId: actor.id,
    actorType: actor.actorType,
    rated: serialized.rated
  });

  return serialized;
}

function normalizeMoveInput(input: SubmitMoveInput) {
  if (
    !input ||
    typeof input.from !== "string" ||
    typeof input.to !== "string" ||
    !input.from.trim() ||
    !input.to.trim()
  ) {
    throw new Error("INVALID_MOVE_PAYLOAD");
  }

  const from = input.from.trim().toLowerCase() as Square;
  const to = input.to.trim().toLowerCase() as Square;
  const promotion = input.promotion?.trim().toLowerCase() as PieceSymbol | undefined;
  const telemetry = normalizeMoveTelemetry(input);

  return {
    from,
    to,
    promotion,
    ...telemetry
  };
}

function getTimeoutResult(color: PlayerColor) {
  const winnerColor = color === PlayerColor.WHITE ? PlayerColor.BLACK : PlayerColor.WHITE;

  return {
    winnerColor,
    result: `${winnerColor.toLowerCase()}_timeout`,
    summary: `${winnerColor === PlayerColor.WHITE ? "White" : "Black"} wins on time.`
  };
}

function getMoveGuardWhere(existing: GameTransactionRecord): Prisma.GameWhereInput {
  return {
    id: existing.id,
    status: GameStatus.ACTIVE,
    turnColor: existing.turnColor,
    fen: existing.fen,
    turnStartedAt: existing.turnStartedAt
  };
}

function buildMoveDeltaPatch(
  serialized: ReturnType<typeof serializeGameDetail>,
  baseVersion: string
) {
  const move = serialized.moves.at(-1) ?? null;

  return {
    kind: "move_delta" as const,
    baseVersion,
    version: serialized.version,
    status: serialized.status,
    result: serialized.result,
    fen: serialized.fen,
    turnColor: serialized.turnColor,
    inCheck: serialized.inCheck,
    turnStartedAt: serialized.turnStartedAt,
    openingWindowEndsAt: serialized.openingWindowEndsAt,
    openingMovesRequired: serialized.openingMovesRequired,
    lastMove: serialized.lastMove,
    board: serialized.board,
    captured: serialized.captured,
    move,
    players: serialized.players
  };
}

export async function submitMove(gameId: string, actor: RequestActor, input: SubmitMoveInput) {
  assertActorCanPlay(actor);

  const moveInput = normalizeMoveInput(input);
  await maybeEnforceExpiredGameDeadline(gameId);
  let game: GameDetailRecord | null = null;
  let baseVersionForPatch: string | null = null;
  const moveRequestStartedAt = Date.now();

  for (let attempt = 0; attempt <= MOVE_TRANSACTION_RETRY_LIMIT; attempt += 1) {
    try {
      let previousVersion = "";
      const committed = await db.$transaction(
        async (tx) => {
          const existing = await tx.game.findUnique({
            where: {
              id: gameId
            },
            select: gameTransactionSelect
          });

          if (!existing) {
            throw new Error("GAME_NOT_FOUND");
          }

          previousVersion = existing.updatedAt.toISOString();

          if (existing.status !== GameStatus.ACTIVE) {
            throw new Error("GAME_NOT_ACTIVE");
          }

          const player = existing.players.find((entry) => actorMatchesPlayer(entry, actor));
          if (!player) {
            throw new Error("PLAYER_NOT_IN_GAME");
          }

          const chess = new Chess(existing.fen);
          const turnColor = chessColorToPlayerColor(chess.turn());

          if (player.color !== turnColor || existing.turnColor !== turnColor) {
            throw new Error("NOT_YOUR_TURN");
          }

          const turnStartedAt = existing.turnStartedAt ?? existing.startedAt ?? new Date();
          const spentTimeMs = Math.max(0, Date.now() - turnStartedAt.getTime());

          if (spentTimeMs >= player.timeRemainingMs) {
            const timeout = getTimeoutResult(player.color);
            const ratingAdjustment = await applyRatingAdjustment(tx, existing, timeout.winnerColor);
            const guardedTimeoutUpdate = await tx.game.updateMany({
              where: getMoveGuardWhere(existing),
              data: {
                status: GameStatus.FINISHED,
                result: timeout.result,
                winnerUserId:
                  existing.players.find((entry) => entry.color === timeout.winnerColor)?.userId ?? null,
                endedAt: new Date(),
                turnStartedAt: null
              }
            });

            if (guardedTimeoutUpdate.count !== 1) {
              throw new Error("MOVE_STATE_CONFLICT");
            }

            await tx.gamePlayer.update({
              where: {
                id: player.id
              },
              data: {
                timeRemainingMs: 0
              }
            });

            await tx.gameEvent.createMany({
              data: [
                {
                  gameId,
                  type: "timeout",
                  payload: {
                    actorId: actor.id,
                    loserColor: player.color,
                    winnerColor: timeout.winnerColor
                  }
                },
                ...(ratingAdjustment
                  ? [
                      {
                        gameId,
                        type: "rating_applied",
                        payload: {
                          ...ratingAdjustment,
                          rated: true
                        }
                      }
                    ]
                  : [])
              ]
            });

            await createAntiCheatReviewEvent(tx, gameId);

            return {
              gameId
            };
          }

          let chessMove;

          try {
            chessMove = chess.move({
              from: moveInput.from,
              to: moveInput.to,
              promotion: moveInput.promotion
            });
          } catch {
            throw new Error("INVALID_MOVE");
          }

          const timeRemainingMs = player.timeRemainingMs - spentTimeMs + existing.incrementMs;
          const fen = chess.fen();
          const outcome = resolveOutcomeFromFen(fen);
          const nextTurnColor = chessColorToPlayerColor(chess.turn());
          const winnerUserId =
            outcome.winnerColor === null
              ? null
              : existing.players.find((entry) => entry.color === outcome.winnerColor)?.userId ?? null;
          const ratingAdjustment =
            outcome.status === GameStatus.FINISHED
              ? await applyRatingAdjustment(tx, existing, outcome.winnerColor)
              : null;
          const nextTurnStartedAt = outcome.status === GameStatus.ACTIVE ? new Date() : null;
          const endedAt = outcome.status === GameStatus.FINISHED ? new Date() : null;

          await tx.gamePlayer.update({
            where: {
              id: player.id
            },
            data: {
              timeRemainingMs,
              isConnected: true
            }
          });

          const guardedMoveUpdate = await tx.game.updateMany({
            where: getMoveGuardWhere(existing),
            data: {
              fen,
              pgn: chess.pgn(),
              status: outcome.status,
              result: outcome.result,
              winnerUserId,
              turnColor: nextTurnColor,
              turnStartedAt: nextTurnStartedAt,
              endedAt
            }
          });

          if (guardedMoveUpdate.count !== 1) {
            throw new Error("MOVE_STATE_CONFLICT");
          }

          await tx.move.create({
            data: {
              gameId,
              ply: existing._count.moves + 1,
              san: chessMove.san,
              uci: `${chessMove.from}${chessMove.to}${chessMove.promotion ?? ""}`,
              fenAfter: fen,
              ...(actor.actorType === "user"
                ? { movedByUserId: actor.id }
                : { movedByGuestIdentityId: actor.id }),
              spentTimeMs,
              clientThinkTimeMs: moveInput.clientThinkTimeMs,
              turnBlurCount: moveInput.turnBlurCount,
              focusLossDurationMs: moveInput.focusLossDurationMs
            }
          });

          await tx.gameEvent.createMany({
            data: [
              {
                gameId,
                type: "move_made",
                payload: {
                  actorId: actor.id,
                  from: chessMove.from,
                  to: chessMove.to,
                  san: chessMove.san,
                  spentTimeMs
                }
              },
              ...(outcome.status === GameStatus.FINISHED
                ? [
                    {
                      gameId,
                      type: "game_finished",
                      payload: {
                        result: outcome.result,
                        winnerColor: outcome.winnerColor
                      }
                    },
                    ...(ratingAdjustment
                      ? [
                          {
                            gameId,
                            type: "rating_applied",
                            payload: {
                              ...ratingAdjustment,
                              rated: true
                            }
                          }
                        ]
                      : [])
                  ]
                : [])
            ]
          });

          if (outcome.status === GameStatus.FINISHED) {
            await createAntiCheatReviewEvent(tx, gameId);
          }

          return {
            gameId
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted
        }
      );
      game = await fetchGameDetailRecord(committed.gameId);
      if (!game) {
        throw new Error("GAME_NOT_FOUND");
      }
      baseVersionForPatch = previousVersion;
      break;
    } catch (error) {
      if (attempt < MOVE_TRANSACTION_RETRY_LIMIT && isRetryableMoveConflict(error)) {
        continue;
      }

      if (isMoveStateConflict(error)) {
        throw new Error("MOVE_STATE_CONFLICT");
      }

      throw error;
    }
  }

  if (!game) {
    throw new Error("MOVE_STATE_CONFLICT");
  }

  const serialized = serializeGameDetail(game, actor);
  if (
    serialized.status === GameStatus.ACTIVE &&
    serialized.openingMovesRequired > 0 &&
    game.turnStartedAt
  ) {
    await syncGameDeadlineJob(game);
  } else {
    await syncGameDeadlineJob(game);
  }
  void publishGameUpdate(serialized.id, "move_made", {
    patch: buildMoveDeltaPatch(serialized, baseVersionForPatch ?? serialized.version)
  });

  if (serialized.status !== GameStatus.ACTIVE) {
    if (!gameHasGuestPlayers(game)) {
      await maybeAutoRaiseObserveForGame(serialized.id);
    }
    await cancelGameDeadlineJob(serialized.id);
    void publishLobbyRemove(serialized.id, "game_finished");
    if (serialized.rated && !gameHasGuestPlayers(game)) {
      await scheduleEngineReview(serialized.id);
    }
  }

  logInfo("moves.submitted", {
    gameId: serialized.id,
    actorId: actor.id,
    actorType: actor.actorType,
    moveCount: serialized.moves.length,
    status: serialized.status,
    latencyMs: Date.now() - moveRequestStartedAt,
    inCheck: serialized.inCheck
  });

  return serialized;
}

export async function resignGame(gameId: string, actor: RequestActor) {
  assertActorCanPlay(actor);

  await maybeEnforceExpiredGameDeadline(gameId);

  const committed = await db.$transaction(
    async (tx) => {
      const existing = await tx.game.findUnique({
        where: {
          id: gameId
        },
        select: gameTransactionSelect
      });

      if (!existing) {
        throw new Error("GAME_NOT_FOUND");
      }

      if (existing.status !== GameStatus.ACTIVE) {
        throw new Error("GAME_NOT_ACTIVE");
      }

      const player = existing.players.find((entry) => actorMatchesPlayer(entry, actor));
      if (!player) {
        throw new Error("PLAYER_NOT_IN_GAME");
      }

      const winnerColor = player.color === PlayerColor.WHITE ? PlayerColor.BLACK : PlayerColor.WHITE;
      const winnerUserId =
        existing.players.find((entry) => entry.color === winnerColor)?.userId ?? null;
      const ratingAdjustment = await applyRatingAdjustment(tx, existing, winnerColor);

      await tx.game.update({
        where: {
          id: gameId
        },
        data: {
          status: GameStatus.FINISHED,
          result: `${winnerColor.toLowerCase()}_resignation`,
          winnerUserId,
          endedAt: new Date(),
          turnStartedAt: null,
          events: {
            createMany: {
              data: [
                {
                  type: "resigned",
                  payload: {
                    actorId: actor.id,
                    loserColor: player.color,
                    winnerColor
                  }
                },
                ...(ratingAdjustment
                  ? [
                      {
                        type: "rating_applied",
                        payload: {
                          ...ratingAdjustment,
                          rated: true
                        }
                      }
                    ]
                  : [])
              ]
            }
          }
        }
      });

      return {
        gameId
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    }
  );

  await db.$transaction(async (tx) => {
    await createAntiCheatReviewEvent(tx, gameId);
  });

  const game = await fetchGameDetailRecord(committed.gameId);
  if (!game) {
    throw new Error("GAME_NOT_FOUND");
  }

  const serialized = serializeGameDetail(game, actor);
  if (!gameHasGuestPlayers(game)) {
    await maybeAutoRaiseObserveForGame(serialized.id);
  }
  await cancelGameDeadlineJob(serialized.id);
  void publishGameSnapshot(game, "game_resigned");
  void publishLobbyRemove(serialized.id, "game_finished");
  if (serialized.rated && !gameHasGuestPlayers(game)) {
    await scheduleEngineReview(serialized.id);
  }

  logInfo("games.resigned", {
    gameId: serialized.id,
    actorId: actor.id,
    actorType: actor.actorType,
    result: serialized.result
  });

  return serialized;
}

export async function enforceModerationRestriction(userId: string, adminEmail: string) {
  const impactedGames = await db.$transaction(
    async (tx) => {
      const activeOrWaitingGames = await tx.game.findMany({
        where: {
          status: {
            in: [GameStatus.WAITING, GameStatus.ACTIVE]
          },
          players: {
            some: {
              userId
            }
          }
        },
        select: gameTransactionSelect
      });

      const cancelledWaitingGames: Array<{
        gameId: string;
        patch: Record<string, unknown>;
      }> = [];
      const forfeitedActiveGames: Array<{
        gameId: string;
        patch: Record<string, unknown>;
      }> = [];

      for (const game of activeOrWaitingGames) {
        const restrictedPlayer = game.players.find((player) => player.userId === userId);
        if (!restrictedPlayer) {
          continue;
        }

        if (game.status === GameStatus.WAITING) {
          const updated = await tx.game.update({
            where: {
              id: game.id
            },
            data: {
              status: GameStatus.CANCELLED,
              result: "cancelled_moderation_restriction",
              endedAt: new Date(),
              turnStartedAt: null,
              events: {
                create: {
                  type: "moderation_enforced",
                  payload: {
                    userId,
                    adminEmail,
                    action: "waiting_game_cancelled"
                  }
                }
              }
            }
          });

          cancelledWaitingGames.push({
            gameId: game.id,
            patch: {
              kind: "state_patch",
              baseVersion: game.updatedAt.toISOString(),
              version: updated.updatedAt.toISOString(),
              status: updated.status,
              result: updated.result,
              turnStartedAt: null,
              openingWindowEndsAt: null,
              openingMovesRequired: 0
            }
          });
          continue;
        }

        const winnerColor =
          restrictedPlayer.color === PlayerColor.WHITE ? PlayerColor.BLACK : PlayerColor.WHITE;
        const winnerUserId =
          game.players.find((player) => player.color === winnerColor)?.userId ?? null;

        const updated = await tx.game.update({
          where: {
            id: game.id
          },
          data: {
            status: GameStatus.FINISHED,
            result: `${winnerColor.toLowerCase()}_moderation_restriction`,
            winnerUserId,
            endedAt: new Date(),
            turnStartedAt: null,
            events: {
              create: {
                type: "moderation_enforced",
                payload: {
                  userId,
                  adminEmail,
                  action: "active_game_forfeited",
                  loserColor: restrictedPlayer.color,
                  winnerColor
                }
              }
            }
          }
        });

        forfeitedActiveGames.push({
          gameId: game.id,
          patch: {
            kind: "state_patch",
            baseVersion: game.updatedAt.toISOString(),
            version: updated.updatedAt.toISOString(),
            status: updated.status,
            result: updated.result,
            turnStartedAt: null,
            openingWindowEndsAt: null,
            openingMovesRequired: 0
          }
        });
      }

      return {
        cancelledWaitingGames,
        forfeitedActiveGames
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    }
  );

  for (const { gameId, patch } of impactedGames.cancelledWaitingGames) {
    await cancelGameDeadlineJob(gameId);
    void publishGameUpdate(gameId, "moderation_enforced", {
      patch
    });
    void publishLobbyRemove(gameId, "game_cancelled");
  }

  for (const { gameId, patch } of impactedGames.forfeitedActiveGames) {
    await cancelGameDeadlineJob(gameId);
    void publishGameUpdate(gameId, "moderation_enforced", {
      patch
    });
    void publishLobbyRemove(gameId, "game_finished");
  }

  return impactedGames;
}
