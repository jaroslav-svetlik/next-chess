import { GameStatus, PlayerColor, Prisma } from "@prisma/client";

import {
  BACKGROUND_JOB_TYPES,
  cancelBackgroundJob,
  getGameDeadlineJobKey,
  scheduleBackgroundJob
} from "./background-jobs.ts";
import { db } from "./db.ts";
import { scheduleEngineReview } from "./engine-analysis.ts";
import { OPENING_WINDOW_MS } from "./game-timing.ts";
import { isGuestEmail } from "./guest-accounts.ts";
import { maybeAutoRaiseObserveForGame } from "./moderation-policy.ts";
import { logInfo, logWarn } from "./observability.ts";
import { applyRatingAdjustment } from "./rating.ts";
import { publishGameUpdate, publishLobbyUpdate } from "./realtime.ts";
import { createAntiCheatReviewEvent } from "./review-events.ts";

const gameDeadlineInclude = {
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

type DeadlineGameRecord = Prisma.GameGetPayload<{
  include: typeof gameDeadlineInclude;
}>;

type DeadlineScheduleGame = {
  id: string;
  status: GameStatus;
  turnStartedAt: Date | null;
  turnColor: PlayerColor;
  moves: Array<unknown>;
  players: Array<{
    color: PlayerColor;
    timeRemainingMs: number;
  }>;
};

type DeadlineRunResult =
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
      action: "clock_timeout";
      gameId: string;
      rated: boolean;
      hasGuestPlayers: boolean;
      patch: Record<string, unknown>;
    };

function getParticipantEmail(participant: {
  user?: { email: string } | null;
  guestIdentity?: { email: string | null } | null;
}) {
  return participant.user?.email ?? participant.guestIdentity?.email ?? null;
}

function gameHasGuestPlayers(game: Pick<DeadlineGameRecord, "players">) {
  return game.players.some(
    (player) => Boolean(player.guestIdentity) || isGuestEmail(getParticipantEmail(player))
  );
}

function getTimeoutResult(color: PlayerColor) {
  const winnerColor = color === PlayerColor.WHITE ? PlayerColor.BLACK : PlayerColor.WHITE;

  return {
    winnerColor,
    result: `${winnerColor.toLowerCase()}_timeout`,
    summary: `${winnerColor === PlayerColor.WHITE ? "White" : "Black"} wins on time.`
  };
}

function buildClockTimeoutPlayerState(
  game: DeadlineGameRecord,
  timedOutPlayerId: string,
  ratingAdjustment: Awaited<ReturnType<typeof applyRatingAdjustment>>
) {
  return game.players.map((player) => ({
    playerId: player.id,
    ...(player.id === timedOutPlayerId
      ? {
          timeRemainingMs: 0,
          isConnected: false
        }
      : {}),
    ...(ratingAdjustment
      ? player.color === PlayerColor.WHITE
        ? {
            ratingDelta: ratingAdjustment.whiteDelta,
            ratingAfter: ratingAdjustment.whiteAfter
          }
        : {
            ratingDelta: ratingAdjustment.blackDelta,
            ratingAfter: ratingAdjustment.blackAfter
          }
      : {})
  }));
}

function getDeadlineForGame(game: DeadlineScheduleGame) {
  if (game.status !== GameStatus.ACTIVE || !game.turnStartedAt) {
    return null;
  }

  if (game.moves.length < 2) {
    return new Date(game.turnStartedAt.getTime() + OPENING_WINDOW_MS);
  }

  const currentPlayer = game.players.find((player) => player.color === game.turnColor);
  if (!currentPlayer) {
    return null;
  }

  return new Date(game.turnStartedAt.getTime() + currentPlayer.timeRemainingMs);
}

export async function cancelGameDeadlineJob(gameId: string) {
  return cancelBackgroundJob(getGameDeadlineJobKey(gameId));
}

export async function maybeEnforceExpiredGameDeadline(gameId: string) {
  const game = await db.game.findUnique({
    where: {
      id: gameId
    },
    select: {
      status: true,
      turnStartedAt: true,
      turnColor: true,
      _count: {
        select: {
          moves: true
        }
      },
      players: {
        select: {
          color: true,
          timeRemainingMs: true
        }
      }
    }
  });

  if (!game || game.status !== GameStatus.ACTIVE || !game.turnStartedAt) {
    return;
  }

  let deadlineAt = game.turnStartedAt.getTime() + OPENING_WINDOW_MS;

  if (game._count.moves >= 2) {
    const currentPlayer = game.players.find((player) => player.color === game.turnColor);
    if (!currentPlayer) {
      return;
    }

    deadlineAt = game.turnStartedAt.getTime() + currentPlayer.timeRemainingMs;
  }

  if (Date.now() >= deadlineAt) {
    await enforceGameDeadlineNow(gameId);
  }
}

export async function syncGameDeadlineJob(game: DeadlineScheduleGame) {
  const runAt = getDeadlineForGame(game);

  if (!runAt) {
    await cancelGameDeadlineJob(game.id);
    return null;
  }

  return scheduleBackgroundJob({
    type: BACKGROUND_JOB_TYPES.gameDeadline,
    key: getGameDeadlineJobKey(game.id),
    runAt,
    payload: {
      gameId: game.id,
      expectedTurnStartedAt: game.turnStartedAt?.toISOString() ?? null
    },
    maxAttempts: 12
  });
}

async function finalizeClockTimeout(tx: Prisma.TransactionClient, game: DeadlineGameRecord) {
  const player = game.players.find((entry) => entry.color === game.turnColor);
  if (!player) {
    return null;
  }

  const timeout = getTimeoutResult(player.color);
  const ratingAdjustment = await applyRatingAdjustment(tx, game, timeout.winnerColor);

  await tx.gamePlayer.update({
    where: {
      id: player.id
    },
    data: {
      timeRemainingMs: 0,
      isConnected: false
    }
  });

  const timedOut = await tx.game.update({
    where: {
      id: game.id
    },
    data: {
      status: GameStatus.FINISHED,
      result: timeout.result,
      winnerUserId:
        game.players.find((entry) => entry.color === timeout.winnerColor)?.userId ?? null,
      endedAt: new Date(),
      turnStartedAt: null,
      events: {
        createMany: {
          data: [
            {
              type: "timeout",
              payload: {
                actorId: "system",
                loserColor: player.color,
                winnerColor: timeout.winnerColor,
                source: game.moves.length < 2 ? "opening_window" : "deadline_worker",
                openingPhase: game.moves.length < 2
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
    },
    include: gameDeadlineInclude
  });

  await createAntiCheatReviewEvent(tx, game.id);

  return {
    game: timedOut,
    ratingAdjustment
  };
}

async function processDeadline(gameId: string, expectedTurnStartedAt?: string | null): Promise<DeadlineRunResult> {
  const now = new Date();
  const outcome = await db.$transaction(
    async (tx) => {
      const existing = await tx.game.findUnique({
        where: {
          id: gameId
        },
        include: gameDeadlineInclude
      });

      if (!existing) {
        return {
          status: "noop",
          reason: "game_not_found"
        } satisfies DeadlineRunResult;
      }

      if (existing.status !== GameStatus.ACTIVE || !existing.turnStartedAt) {
        return {
          status: "noop",
          reason: "game_not_active"
        } satisfies DeadlineRunResult;
      }

      if (
        expectedTurnStartedAt &&
        existing.turnStartedAt.toISOString() !== expectedTurnStartedAt
      ) {
        return {
          status: "noop",
          reason: "stale_turn_marker"
        } satisfies DeadlineRunResult;
      }

      const deadlineAt = getDeadlineForGame(existing);
      if (!deadlineAt) {
        return {
          status: "noop",
          reason: "deadline_unavailable"
        } satisfies DeadlineRunResult;
      }

      if (deadlineAt.getTime() > now.getTime()) {
        return {
          status: "reschedule",
          runAt: deadlineAt,
          reason: "deadline_not_reached"
        } satisfies DeadlineRunResult;
      }

      const finishedOutcome = await finalizeClockTimeout(tx, existing);
      if (!finishedOutcome) {
        return {
          status: "noop",
          reason: "missing_turn_player"
        } satisfies DeadlineRunResult;
      }
      const finished = finishedOutcome.game;
      const timedOutPlayer = existing.players.find((entry) => entry.color === existing.turnColor);

      return {
        status: "completed",
        action: "clock_timeout",
        gameId: finished.id,
        rated: finished.rated,
        hasGuestPlayers: gameHasGuestPlayers(finished),
        patch: {
          kind: "state_patch",
          baseVersion: existing.updatedAt.toISOString(),
          version: finished.updatedAt.toISOString(),
          status: finished.status,
          result: finished.result,
          turnStartedAt: null,
          openingWindowEndsAt: null,
          openingMovesRequired: 0,
          playerState: timedOutPlayer
            ? buildClockTimeoutPlayerState(
                finished,
                timedOutPlayer.id,
                finishedOutcome.ratingAdjustment
              )
            : []
        }
      } satisfies DeadlineRunResult;
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    }
  );

  if (outcome.status === "completed") {
    await cancelGameDeadlineJob(outcome.gameId);

    if (!outcome.hasGuestPlayers) {
      await maybeAutoRaiseObserveForGame(outcome.gameId);
    }

    await publishGameUpdate(outcome.gameId, "clock_timeout", {
      patch: outcome.patch
    });
    await publishLobbyUpdate("game_finished", {
      gameId: outcome.gameId,
      patch: {
        kind: "ops",
        ops: [
          {
            type: "remove",
            gameId: outcome.gameId
          }
        ]
      }
    });

    if (outcome.rated && !outcome.hasGuestPlayers) {
      await scheduleEngineReview(outcome.gameId);
    }
  }

  return outcome;
}

export async function enforceGameDeadlineNow(gameId: string) {
  const outcome = await processDeadline(gameId);

  if (outcome.status === "completed") {
    logInfo("games.deadline_enforced_inline", {
      gameId,
      action: outcome.action
    });
  } else if (outcome.status === "reschedule") {
    await scheduleBackgroundJob({
      type: BACKGROUND_JOB_TYPES.gameDeadline,
      key: getGameDeadlineJobKey(gameId),
      runAt: outcome.runAt,
      payload: {
        gameId,
        expectedTurnStartedAt: null
      },
      maxAttempts: 12
    }).catch(() => undefined);
  }

  return outcome;
}

export async function runGameDeadlineJob(gameId: string, expectedTurnStartedAt?: string | null) {
  const outcome = await processDeadline(gameId, expectedTurnStartedAt);

  if (outcome.status === "completed") {
    logInfo("games.deadline_enforced_worker", {
      gameId,
      action: outcome.action
    });
    return outcome;
  }

  if (outcome.status === "reschedule") {
    logWarn("games.deadline_reschedule_needed", {
      gameId,
      reason: outcome.reason,
      runAt: outcome.runAt.toISOString()
    });
    return outcome;
  }

  logInfo("games.deadline_noop", {
    gameId,
    reason: outcome.reason
  });
  return outcome;
}
