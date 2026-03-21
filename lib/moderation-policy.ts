import { GameStatus, ModerationStatus, PlayerColor, Prisma } from "@prisma/client";

import { db } from "./db.ts";
import { isGuestEmail } from "./guest-accounts.ts";

export type ModerationRecommendation = {
  status: ModerationStatus;
  confidence: number;
  reason: string;
  differsFromCurrent: boolean;
  dismissed: boolean;
};

export type ModerationRecommendationSuppression = {
  eventType: string | null;
  status: ModerationStatus | null;
  createdAt: string | null;
};

type ReviewRiskSnapshot = {
  gameId: string;
  generatedAt: string;
  riskScore: number;
};

const REVIEW_EVENT_TYPES = ["anti_cheat_review", "engine_analysis_review"];

const reviewGameSelect = {
  id: true,
  endedAt: true,
  players: {
    select: {
      userId: true,
      color: true
    }
  },
  events: {
    where: {
      type: {
        in: REVIEW_EVENT_TYPES
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    select: {
      type: true,
      createdAt: true,
      payload: true
    }
  }
} satisfies Prisma.GameSelect;

type ReviewGameRecord = Prisma.GameGetPayload<{
  select: typeof reviewGameSelect;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}

function parseString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function resolveSeverity(riskScore: number) {
  if (riskScore >= 60) {
    return "review";
  }

  if (riskScore >= 35) {
    return "watch";
  }

  if (riskScore >= 20) {
    return "observe";
  }

  return "clean";
}

function parseColorPlayerRisk(
  payload: Record<string, unknown> | null,
  colorKey: "white" | "black"
) {
  const players = isRecord(payload?.players) ? payload.players : null;
  const playerPayload = players && isRecord(players[colorKey]) ? players[colorKey] : null;
  if (!playerPayload) {
    return null;
  }

  const riskScore = parseNumber(playerPayload.riskScore);
  const summary = parseString(playerPayload.summary);
  const severity = parseString(playerPayload.severity);
  if (riskScore === null || summary === null || severity === null) {
    return null;
  }

  return {
    riskScore,
    severity,
    summary
  };
}

function combinePlayerRisk(
  telemetryRisk: number | null,
  engineRisk: number | null
) {
  return telemetryRisk !== null && engineRisk !== null
    ? Math.min(100, Math.round(engineRisk * 0.7 + telemetryRisk * 0.3))
    : Math.max(telemetryRisk ?? 0, engineRisk ?? 0);
}

function buildPlayerRiskSnapshots(reviewedGames: ReviewGameRecord[], userId: string) {
  const risks: ReviewRiskSnapshot[] = [];

  for (const game of reviewedGames) {
    const seat = game.players.find((player) => player.userId === userId);
    if (!seat) {
      continue;
    }

    const colorKey = seat.color === PlayerColor.WHITE ? "white" : "black";
    const telemetryPayload =
      game.events.find((event) => event.type === "anti_cheat_review" && isRecord(event.payload))
        ?.payload ?? null;
    const enginePayload =
      game.events.find((event) => event.type === "engine_analysis_review" && isRecord(event.payload))
        ?.payload ?? null;
    const telemetryRisk = parseColorPlayerRisk(
      isRecord(telemetryPayload) ? telemetryPayload : null,
      colorKey
    )?.riskScore ?? null;
    const engineRisk = parseColorPlayerRisk(
      isRecord(enginePayload) ? enginePayload : null,
      colorKey
    )?.riskScore ?? null;
    const riskScore = combinePlayerRisk(telemetryRisk, engineRisk);

    risks.push({
      gameId: game.id,
      generatedAt: (
        game.events[0]?.createdAt ??
        game.endedAt ??
        new Date(0)
      ).toISOString(),
      riskScore
    });
  }

  return risks.sort((left, right) => right.generatedAt.localeCompare(left.generatedAt));
}

export function buildAccountRiskScore(risks: number[]) {
  if (!risks.length) {
    return 0;
  }

  const weighted = risks.slice(0, 12).reduce(
    (accumulator, risk, index) => {
      const weight = Math.max(0.35, 1 - index * 0.08);
      return {
        total: accumulator.total + risk * weight,
        weight: accumulator.weight + weight
      };
    },
    { total: 0, weight: 0 }
  );
  const baseline = weighted.weight > 0 ? weighted.total / weighted.weight : 0;
  const flaggedCount = risks.filter((risk) => risk >= 20).length;
  const watchCount = risks.filter((risk) => risk >= 35).length;
  const reviewCount = risks.filter((risk) => risk >= 60).length;

  return Math.min(
    100,
    Math.round(baseline + flaggedCount * 3 + watchCount * 4 + reviewCount * 6)
  );
}

export function buildModerationRecommendation(input: {
  riskScore: number;
  flaggedGames: number;
  watchLevelGames: number;
  reviewLevelGames: number;
  recentPeakRisk: number;
  lastFlaggedAt: string | null;
  suppressionEventType: string | null;
  suppressionStatus: ModerationStatus | null;
  suppressionAt: string | null;
  currentStatus: ModerationStatus;
}): ModerationRecommendation {
  if (input.currentStatus === ModerationStatus.RESTRICTED) {
    return {
      status: ModerationStatus.RESTRICTED,
      confidence: 1,
      reason: "Manual restriction is already active on this account.",
      differsFromCurrent: false,
      dismissed: false
    };
  }

  let status: ModerationStatus = ModerationStatus.CLEAN;
  let confidence = 0.52;
  let reason = "Recent reviewed games do not currently justify a moderation hold.";

  if (
    input.riskScore >= 70 ||
    input.reviewLevelGames >= 2 ||
    (input.reviewLevelGames >= 1 && input.watchLevelGames >= 3)
  ) {
    status = ModerationStatus.REVIEW;
    confidence = 0.91;
    reason =
      "Multiple reviewed games are landing in the review band, so this account should stay in manual review.";
  } else if (
    input.riskScore >= 45 ||
    input.watchLevelGames >= 2 ||
    input.flaggedGames >= 4 ||
    input.recentPeakRisk >= 60
  ) {
    status = ModerationStatus.WATCH;
    confidence = 0.82;
    reason =
      "The account is accumulating repeated suspicious games and should be limited while signals stabilize.";
  } else if (input.riskScore >= 20 || input.flaggedGames >= 1 || input.recentPeakRisk >= 35) {
    status = ModerationStatus.OBSERVE;
    confidence = 0.68;
    reason =
      "The account has early anti-cheat signals and should stay under observation without a hard restriction.";
  }

  const suppressionIsFresh =
    !!input.suppressionAt && (!input.lastFlaggedAt || input.suppressionAt > input.lastFlaggedAt);
  const dismissalMatchesRecommendation =
    input.suppressionEventType === "recommendation_dismissed" &&
    input.suppressionStatus === status;
  const resolutionSuppressesRecommendation =
    input.suppressionEventType === "account_cleared" ||
    input.suppressionEventType === "false_positive_marked";
  const dismissed = suppressionIsFresh && (dismissalMatchesRecommendation || resolutionSuppressesRecommendation);

  if (dismissed && resolutionSuppressesRecommendation) {
    reason = `${reason} Recommendation is currently muted because a moderator recently cleared this account or marked the prior case as a false positive.`;
  }

  return {
    status,
    confidence,
    reason,
    differsFromCurrent: status !== input.currentStatus && !dismissed,
    dismissed
  };
}

function shouldAutoRaiseObserve(input: {
  currentStatus: ModerationStatus;
  recommendation: ModerationRecommendation;
  flaggedGames: number;
}) {
  if (input.currentStatus !== ModerationStatus.CLEAN) {
    return false;
  }

  if (input.recommendation.dismissed || input.recommendation.status === ModerationStatus.CLEAN) {
    return false;
  }

  if (input.recommendation.status === ModerationStatus.OBSERVE) {
    return input.flaggedGames >= 2;
  }

  return true;
}

export async function maybeAutoRaiseObserveForGame(gameId: string) {
  const game = await db.game.findUnique({
    where: {
      id: gameId
    },
    select: {
      id: true,
      status: true,
      players: {
        select: {
          userId: true
        }
      }
    }
  });

  if (!game || game.status !== GameStatus.FINISHED) {
    return [];
  }

  const applied = [];

  for (const player of game.players) {
    if (!player.userId) {
      continue;
    }

    const result = await maybeAutoRaiseObserveForUser(player.userId);
    if (result) {
      applied.push(result);
    }
  }

  return applied;
}

export async function maybeAutoRaiseObserveForUser(userId: string) {
  const [user, reviewedGames] = await Promise.all([
    db.user.findUnique({
      where: {
        id: userId
      },
      select: {
        id: true,
        email: true,
        moderationStatus: true,
        moderationEvents: {
          where: {
            type: "recommendation_dismissed"
          },
          orderBy: {
            createdAt: "desc"
          },
        take: 1,
        select: {
          type: true,
          toStatus: true,
          createdAt: true
        }
      }
      }
    }),
    db.game.findMany({
      where: {
        status: GameStatus.FINISHED,
        players: {
          some: {
            userId
          }
        },
        events: {
          some: {
            type: {
              in: REVIEW_EVENT_TYPES
            }
          }
        }
      },
      orderBy: {
        endedAt: "desc"
      },
      take: 60,
      select: reviewGameSelect
    })
  ]);

  if (!user) {
    return null;
  }

  if (isGuestEmail(user.email)) {
    return null;
  }

  const riskSnapshots = buildPlayerRiskSnapshots(reviewedGames, userId);
  const risks = riskSnapshots.map((entry) => entry.riskScore);
  const flaggedGames = risks.filter((risk) => risk >= 20).length;
  const watchLevelGames = risks.filter((risk) => risk >= 35).length;
  const reviewLevelGames = risks.filter((risk) => risk >= 60).length;
  const recentPeakRisk = Math.max(...risks, 0);
  const lastFlaggedAt = riskSnapshots.find((entry) => entry.riskScore >= 20)?.generatedAt ?? null;
  const recommendation = buildModerationRecommendation({
    riskScore: buildAccountRiskScore(risks),
    flaggedGames,
    watchLevelGames,
    reviewLevelGames,
    recentPeakRisk,
    lastFlaggedAt,
    suppressionEventType: user.moderationEvents[0]?.type ?? null,
    suppressionStatus: user.moderationEvents[0]?.toStatus ?? null,
    suppressionAt: user.moderationEvents[0]?.createdAt.toISOString() ?? null,
    currentStatus: user.moderationStatus
  });

  if (
    !shouldAutoRaiseObserve({
      currentStatus: user.moderationStatus,
      recommendation,
      flaggedGames
    })
  ) {
    return null;
  }

  const autoRaiseReason =
    `System auto-raised this account to OBSERVE after anti-cheat recommendation ` +
    `${recommendation.status} (${Math.round(recommendation.confidence * 100)}% confidence). ` +
    `${recommendation.reason}`;

  const updated = await db.$transaction(async (tx) => {
    const current = await tx.user.findUnique({
      where: {
        id: userId
      },
      select: {
        moderationStatus: true
      }
    });

    if (!current || current.moderationStatus !== ModerationStatus.CLEAN) {
      return null;
    }

    await tx.user.update({
      where: {
        id: userId
      },
      data: {
        moderationStatus: ModerationStatus.OBSERVE,
        moderationUpdatedAt: new Date(),
        moderationUpdatedByEmail: "system@moderation.local"
      }
    });

    await tx.userModerationEvent.create({
      data: {
        userId,
        type: "system_auto_raised",
        fromStatus: ModerationStatus.CLEAN,
        toStatus: ModerationStatus.OBSERVE,
        note: autoRaiseReason,
        createdByEmail: "system@moderation.local"
      }
    });

    return {
      userId,
      status: ModerationStatus.OBSERVE,
      recommendationStatus: recommendation.status,
      confidence: recommendation.confidence
    };
  });

  return updated;
}
