import { GameStatus, ModerationStatus, PlayerColor, Prisma, TimeCategory } from "@prisma/client";

import { buildAntiCheatPlayerReview } from "@/lib/anti-cheat";
import { db } from "@/lib/db";
import { formatCategoryLabel, formatControl } from "@/lib/game-config";
import { GUEST_EMAIL_DOMAIN, isGuestEmail } from "@/lib/guest-accounts";
import { enforceModerationRestriction } from "@/lib/games";
import {
  buildAccountRiskScore,
  buildModerationRecommendation,
  type ModerationRecommendationSuppression,
  type ModerationRecommendation
} from "@/lib/moderation-policy";

type AdminTopPlayer = {
  id: string;
  name: string;
  rating: number;
};

type AdminFinishedGameRow = {
  id: string;
  players: {
    white: string;
    black: string;
  };
  control: string;
  format: string;
  rated: boolean;
  result: string | null;
  endedAt: string | null;
};

export type AdminSuspiciousGameRow = {
  id: string;
  players: {
    white: string;
    black: string;
  };
  playerIds: {
    white: string | null;
    black: string | null;
  };
  primaryPlayerId: string | null;
  primaryPlayerName: string | null;
  primaryColor: PlayerColor | null;
  control: string;
  format: string;
  rated: boolean;
  source: "telemetry" | "engine" | "combined";
  riskScore: number;
  severity: string;
  summary: string;
  generatedAt: string;
};

export type AdminRiskProfile = {
  userId: string;
  name: string;
  email: string | null;
  riskScore: number;
  severity: string;
  moderationStatus: ModerationStatus;
  flaggedGames: number;
  watchLevelGames: number;
  reviewLevelGames: number;
  recentPeakRisk: number;
  reviewedGames: number;
  recentRatedGames: number;
  lastFlaggedAt: string | null;
  recommendation: AdminModerationRecommendation;
};

export type AdminModerationRecommendation = ModerationRecommendation;

export type AdminUserDetailData = {
  user: {
    id: string;
    name: string;
    email: string;
    createdAt: string;
    moderationStatus: ModerationStatus;
    moderationUpdatedAt: string | null;
    moderationUpdatedByEmail: string | null;
    ratings: {
      bullet: number;
      blitz: number;
      rapid: number;
    };
  };
  profile: AdminRiskProfile;
  trend: Array<{
    gameId: string;
    label: string;
    riskScore: number;
    severity: string;
  }>;
  reviewedGames: Array<{
    gameId: string;
    opponentId: string | null;
    opponentName: string;
    side: PlayerColor;
    format: string;
    control: string;
    rated: boolean;
    result: string | null;
    endedAt: string | null;
    generatedAt: string;
    source: "telemetry" | "engine" | "combined";
    riskScore: number;
    severity: string;
    telemetryRisk: number | null;
    engineRisk: number | null;
    summary: string;
  }>;
  moderationEvents: Array<{
    id: string;
    type: string;
    fromStatus: ModerationStatus | null;
    toStatus: ModerationStatus | null;
    note: string | null;
    createdByEmail: string;
    createdAt: string;
  }>;
};

export type AdminGameDetailData = {
  game: {
    id: string;
    status: GameStatus;
    result: string | null;
    rated: boolean;
    visibility: string;
    inviteCode: string | null;
    format: string;
    control: string;
    createdAt: string;
    startedAt: string | null;
    endedAt: string | null;
    hostName: string;
    hostId: string | null;
    fen: string;
    pgn: string | null;
  };
  players: Array<{
    userId: string | null;
    name: string;
    email: string | null;
    color: PlayerColor;
    timeRemainingMs: number;
    isConnected: boolean;
    rating: number | null;
  }>;
  moves: Array<{
    id: string;
    ply: number;
    san: string;
    uci: string;
    movedByUserId: string | null;
    spentTimeMs: number;
    clientThinkTimeMs: number | null;
    turnBlurCount: number;
    focusLossDurationMs: number;
    createdAt: string;
  }>;
  events: Array<{
    id: string;
    type: string;
    createdAt: string;
    summary: string;
  }>;
};

export type AdminHeadToHeadData = {
  leftPlayer: {
    id: string;
    name: string;
    email: string | null;
  };
  rightPlayer: {
    id: string;
    name: string;
    email: string | null;
  };
  summary: {
    totalGames: number;
    ratedGames: number;
    leftWins: number;
    rightWins: number;
    draws: number;
    reviewedGames: number;
  };
  timeline: Array<{
    id: string;
    type: "game_review" | "moderation_outcome";
    createdAt: string;
    actorUserId: string | null;
    actorName: string;
    label: string;
    summary: string;
    gameId: string | null;
  }>;
  games: Array<{
    id: string;
    format: string;
    control: string;
    rated: boolean;
    status: GameStatus;
    result: string | null;
    createdAt: string;
    endedAt: string | null;
    leftColor: PlayerColor | null;
    rightColor: PlayerColor | null;
    winnerUserId: string | null;
    hasReview: boolean;
  }>;
};

type AdminDashboardData = {
  selectedPeriodDays: number;
  overview: {
    totalUsers: number;
    newUsersWindow: number;
    totalGames: number;
    activeGames: number;
    waitingGames: number;
    finishedGames: number;
    finishedGamesWindow: number;
    ratedGames: number;
    totalMoves: number;
  };
  trend: Array<{
    day: string;
    users: number;
    finishedGames: number;
  }>;
  formats: Array<{
    label: string;
    rated: boolean;
    games: number;
  }>;
  results: Array<{
    label: string;
    games: number;
  }>;
  topPlayers: {
    bullet: AdminTopPlayer[];
    blitz: AdminTopPlayer[];
    rapid: AdminTopPlayer[];
  };
  recentFinishedGames: AdminFinishedGameRow[];
  suspiciousGames: AdminSuspiciousGameRow[];
  riskyAccounts: AdminRiskProfile[];
  recommendationQueue: AdminRiskProfile[];
  moderationFunnel: {
    flaggedAccounts: number;
    queuedRecommendations: number;
    observeAccounts: number;
    watchOrReviewAccounts: number;
    restrictedAccounts: number;
    clearedOutcomes30d: number;
    falsePositiveOutcomes30d: number;
    confirmedCheatOutcomes30d: number;
  };
  recentModerationOutcomes: Array<{
    id: string;
    userId: string;
    userName: string;
    userEmail: string | null;
    type: string;
    fromStatus: ModerationStatus | null;
    toStatus: ModerationStatus | null;
    createdByEmail: string;
    createdAt: string;
    note: string | null;
  }>;
  pairPatterns: Array<{
    leftUserId: string;
    leftName: string;
    rightUserId: string;
    rightName: string;
    totalGames: number;
    ratedGames: number;
    reviewedGames: number;
    fastRematches: number;
    lastGameAt: string;
    riskScore: number;
    summary: string;
  }>;
};

export type AdminSearchData = {
  query: string;
  users: Array<{
    id: string;
    name: string;
    email: string | null;
    moderationStatus: ModerationStatus;
    createdAt: string;
    ratings: {
      bullet: number;
      blitz: number;
      rapid: number;
    };
  }>;
  games: Array<{
    id: string;
    status: GameStatus;
    result: string | null;
    rated: boolean;
    format: string;
    control: string;
    inviteCode: string | null;
    createdAt: string;
    endedAt: string | null;
    players: {
      white: string;
      black: string;
    };
  }>;
};

type ReviewEventType = "anti_cheat_review" | "engine_analysis_review";
type ReviewSeverity = "clean" | "observe" | "watch" | "review";

type PlayerRiskSnapshot = {
  riskScore: number;
  severity: string;
  summary: string;
};

type CombinedPlayerRisk = {
  source: "telemetry" | "engine" | "combined";
  riskScore: number;
  severity: string;
  summary: string;
  telemetryRisk: number | null;
  telemetrySummary: string | null;
  engineRisk: number | null;
  engineSummary: string | null;
};

type CombinedReviewedGame = {
  id: string;
  players: {
    white: { id: string | null; name: string; email: string | null };
    black: { id: string | null; name: string; email: string | null };
  };
  control: string;
  format: string;
  rated: boolean;
  result: string | null;
  endedAt: string | null;
  generatedAt: string;
  playerRisks: {
    white: CombinedPlayerRisk;
    black: CombinedPlayerRisk;
  };
  riskScore: number;
  severity: string;
  source: "telemetry" | "engine" | "combined";
  summary: string;
  primaryColor: PlayerColor | null;
};

const REVIEW_EVENT_TYPES: ReviewEventType[] = ["anti_cheat_review", "engine_analysis_review"];

const reviewedGameSelect = {
  id: true,
  timeCategory: true,
  initialTimeMs: true,
  incrementMs: true,
  rated: true,
  result: true,
  endedAt: true,
  players: {
    select: {
      color: true,
      user: {
        select: {
          id: true,
          name: true,
          displayName: true,
          email: true
        }
      }
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
  },
  moves: {
    orderBy: {
      ply: "asc"
    },
    select: {
      ply: true,
      spentTimeMs: true,
      clientThinkTimeMs: true,
      turnBlurCount: true,
      focusLossDurationMs: true
    }
  }
} satisfies Prisma.GameSelect;

type ReviewedGameRecord = Prisma.GameGetPayload<{
  select: typeof reviewedGameSelect;
}>;

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(value: Date, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function formatDayLabel(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short"
  }).format(date);
}

function formatShortDate(value: string | Date | null) {
  if (!value) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short"
  }).format(new Date(value));
}

function displayUserName(user: { displayName?: string | null; name: string } | null | undefined) {
  if (!user) {
    return "Anonymous";
  }

  return user.displayName ?? user.name;
}

function formatResultLabel(result: string | null) {
  if (!result) {
    return "No result";
  }

  return result.replaceAll("_", " ");
}

function normalizeAdminSearchQuery(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized.length >= 2 ? normalized.slice(0, 80) : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}

function parseString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function summarizeEventPayload(payload: Prisma.JsonValue | null) {
  if (!isRecord(payload)) {
    return "No payload.";
  }

  const summary = parseString(payload.summary);
  if (summary) {
    return summary;
  }

  const riskScore = parseNumber(payload.riskScore);
  const severity = parseString(payload.severity);
  if (riskScore !== null && severity) {
    return `${severity.toUpperCase()} risk ${riskScore}.`;
  }

  const result = parseString(payload.result);
  const winnerColor = parseString(payload.winnerColor);
  if (result || winnerColor) {
    return [result ? `Result ${result.replaceAll("_", " ")}` : null, winnerColor ? `Winner ${winnerColor}` : null]
      .filter(Boolean)
      .join(" • ");
  }

  try {
    const serialized = JSON.stringify(payload);
    return serialized.length > 180 ? `${serialized.slice(0, 177)}...` : serialized;
  } catch {
    return "Structured event payload.";
  }
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

function buildDayBuckets(days: number) {
  const today = startOfDay(new Date());
  return Array.from({ length: days }, (_, index) => {
    const date = addDays(today, index - (days - 1));

    return {
      key: date.toISOString().slice(0, 10),
      label: formatDayLabel(date),
      users: 0,
      finishedGames: 0
    };
  });
}

function buildPairKey(leftUserId: string, rightUserId: string) {
  return [leftUserId, rightUserId].sort().join(":");
}

export function normalizeAdminPeriodDays(value: number | string | string[] | null | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = typeof raw === "number" ? raw : Number(raw);

  if (parsed === 7 || parsed === 90) {
    return parsed;
  }

  return 30;
}

function normalizeAdminEmails() {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean)
  );
}

function getPlayerByColor(game: ReviewedGameRecord, color: PlayerColor) {
  return game.players.find((player) => player.color === color) ?? null;
}

function calculateEngineRisk(
  analyzedPlies: number,
  top1MatchRate: number,
  top3MatchRate: number,
  avgCentipawnLoss: number | null,
  avgClientThinkTimeMs: number | null
) {
  let riskScore = 0;

  if (analyzedPlies >= 5) {
    if (top1MatchRate >= 0.9) {
      riskScore += 48;
    } else if (top1MatchRate >= 0.82) {
      riskScore += 34;
    } else if (top1MatchRate >= 0.74) {
      riskScore += 18;
    }

    if (top3MatchRate >= 0.97) {
      riskScore += 20;
    } else if (top3MatchRate >= 0.9) {
      riskScore += 12;
    }

    if (avgCentipawnLoss !== null && avgCentipawnLoss <= 18) {
      riskScore += 20;
    } else if (avgCentipawnLoss !== null && avgCentipawnLoss <= 28) {
      riskScore += 12;
    } else if (avgCentipawnLoss !== null && avgCentipawnLoss <= 40) {
      riskScore += 6;
    }
  }

  if (avgClientThinkTimeMs !== null && avgClientThinkTimeMs < 1800 && top3MatchRate >= 0.9) {
    riskScore += 10;
  }

  riskScore = Math.min(100, riskScore);

  return {
    riskScore,
    severity: resolveSeverity(riskScore)
  };
}

function parseColorPlayerRisk(
  payload: Record<string, unknown> | null,
  colorKey: "white" | "black"
): PlayerRiskSnapshot | null {
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

function buildTelemetryFallback(game: ReviewedGameRecord, color: PlayerColor): PlayerRiskSnapshot {
  const review = buildAntiCheatPlayerReview(
    {
      status: GameStatus.FINISHED,
      rated: game.rated,
      timeCategory: game.timeCategory,
      moves: game.moves
    },
    color
  );

  return {
    riskScore: review?.riskScore ?? 0,
    severity: review?.severity ?? "clean",
    summary: review?.summary ?? "No telemetry summary."
  };
}

function buildEngineFallback(game: ReviewedGameRecord, payload: Record<string, unknown> | null, color: PlayerColor) {
  const sample = Array.isArray(payload?.sample) ? payload.sample : [];
  const playerEntries = sample.filter((entry) => {
    if (!isRecord(entry) || typeof entry.ply !== "number") {
      return false;
    }

    return color === PlayerColor.WHITE ? entry.ply % 2 === 1 : entry.ply % 2 === 0;
  });

  const analyzedPlies = playerEntries.length;
  const top1Matches = playerEntries.filter((entry) => isRecord(entry) && entry.top1Match === true).length;
  const top3Matches = playerEntries.filter((entry) => isRecord(entry) && entry.top3Match === true).length;
  const centipawnLossValues = playerEntries
    .map((entry) => (isRecord(entry) ? parseNumber(entry.centipawnLoss) : null))
    .filter((value): value is number => value !== null);
  const avgCentipawnLoss = centipawnLossValues.length
    ? Math.round(
        centipawnLossValues.reduce((sum, value) => sum + value, 0) / centipawnLossValues.length
      )
    : null;
  const thinkTimes = game.moves
    .filter((move) => (color === PlayerColor.WHITE ? move.ply % 2 === 1 : move.ply % 2 === 0))
    .map((move) => move.clientThinkTimeMs)
    .filter((value): value is number => value !== null);
  const avgClientThinkTimeMs = thinkTimes.length
    ? Math.round(thinkTimes.reduce((sum, value) => sum + value, 0) / thinkTimes.length)
    : null;
  const { riskScore, severity } = calculateEngineRisk(
    analyzedPlies,
    analyzedPlies ? top1Matches / analyzedPlies : 0,
    analyzedPlies ? top3Matches / analyzedPlies : 0,
    avgCentipawnLoss,
    avgClientThinkTimeMs
  );

  return {
    riskScore,
    severity,
    summary:
      analyzedPlies > 0
        ? `${color === PlayerColor.WHITE ? "White" : "Black"} matched ${top1Matches}/${analyzedPlies} top-1 engine moves.`
        : "No engine summary."
  } satisfies PlayerRiskSnapshot;
}

function combinePlayerRisk(
  telemetry: PlayerRiskSnapshot | null,
  engine: PlayerRiskSnapshot | null
): CombinedPlayerRisk {
  const telemetryRisk = telemetry?.riskScore ?? null;
  const engineRisk = engine?.riskScore ?? null;
  const riskScore =
    telemetryRisk !== null && engineRisk !== null
      ? Math.min(100, Math.round(engineRisk * 0.7 + telemetryRisk * 0.3))
      : Math.max(telemetryRisk ?? 0, engineRisk ?? 0);
  const source: CombinedPlayerRisk["source"] =
    telemetryRisk !== null && engineRisk !== null
      ? "combined"
      : engineRisk !== null
        ? "engine"
        : "telemetry";
  const summary =
    source === "combined"
      ? `Engine: ${engine?.summary ?? "n/a"} Telemetry: ${telemetry?.summary ?? "n/a"}`
      : source === "engine"
        ? (engine?.summary ?? "No engine summary.")
        : (telemetry?.summary ?? "No telemetry summary.");

  return {
    source,
    riskScore,
    severity: resolveSeverity(riskScore),
    summary,
    telemetryRisk,
    telemetrySummary: telemetry?.summary ?? null,
    engineRisk,
    engineSummary: engine?.summary ?? null
  };
}

function buildCombinedReviewedGames(reviewedGames: ReviewedGameRecord[]): CombinedReviewedGame[] {
  return reviewedGames
    .map((game) => {
      const white = getPlayerByColor(game, PlayerColor.WHITE);
      const black = getPlayerByColor(game, PlayerColor.BLACK);
      const telemetryEvent =
        game.events.find((event) => event.type === "anti_cheat_review") ?? null;
      const engineEvent =
        game.events.find((event) => event.type === "engine_analysis_review") ?? null;
      const telemetryPayload = telemetryEvent && isRecord(telemetryEvent.payload) ? telemetryEvent.payload : null;
      const enginePayload = engineEvent && isRecord(engineEvent.payload) ? engineEvent.payload : null;
      const whiteTelemetry =
        parseColorPlayerRisk(telemetryPayload, "white") ??
        (telemetryEvent ? buildTelemetryFallback(game, PlayerColor.WHITE) : null);
      const blackTelemetry =
        parseColorPlayerRisk(telemetryPayload, "black") ??
        (telemetryEvent ? buildTelemetryFallback(game, PlayerColor.BLACK) : null);
      const whiteEngine =
        parseColorPlayerRisk(enginePayload, "white") ??
        (engineEvent ? buildEngineFallback(game, enginePayload, PlayerColor.WHITE) : null);
      const blackEngine =
        parseColorPlayerRisk(enginePayload, "black") ??
        (engineEvent ? buildEngineFallback(game, enginePayload, PlayerColor.BLACK) : null);
      const whiteCombined = combinePlayerRisk(whiteTelemetry, whiteEngine);
      const blackCombined = combinePlayerRisk(blackTelemetry, blackEngine);
      const primaryColor =
        whiteCombined.riskScore === 0 && blackCombined.riskScore === 0
          ? null
          : whiteCombined.riskScore >= blackCombined.riskScore
            ? PlayerColor.WHITE
            : PlayerColor.BLACK;
      const primaryRisk =
        primaryColor === PlayerColor.WHITE
          ? whiteCombined
          : primaryColor === PlayerColor.BLACK
            ? blackCombined
            : whiteCombined;
      const source: CombinedReviewedGame["source"] =
        telemetryEvent && engineEvent
          ? "combined"
          : engineEvent
            ? "engine"
            : "telemetry";
      const generatedAt = (
        engineEvent && telemetryEvent
          ? engineEvent.createdAt > telemetryEvent.createdAt
            ? engineEvent.createdAt
            : telemetryEvent.createdAt
          : engineEvent?.createdAt ?? telemetryEvent?.createdAt ?? game.endedAt ?? new Date()
      ).toISOString();

      return {
        id: game.id,
        players: {
          white: {
            id: white?.user?.id ?? null,
            name: white?.user ? displayUserName(white.user) : "Unknown",
            email: white?.user?.email ?? null
          },
          black: {
            id: black?.user?.id ?? null,
            name: black?.user ? displayUserName(black.user) : "Unknown",
            email: black?.user?.email ?? null
          }
        },
        control: formatControl(game.initialTimeMs, game.incrementMs),
        format: formatCategoryLabel(game.timeCategory),
        rated: game.rated,
        result: game.result,
        endedAt: game.endedAt?.toISOString() ?? null,
        generatedAt,
        playerRisks: {
          white: whiteCombined,
          black: blackCombined
        },
        riskScore: Math.max(whiteCombined.riskScore, blackCombined.riskScore),
        severity: resolveSeverity(Math.max(whiteCombined.riskScore, blackCombined.riskScore)),
        source,
        summary:
          primaryColor === null
            ? "No player crossed the watch threshold in this reviewed game."
            : `${primaryColor === PlayerColor.WHITE ? "White" : "Black"} side: ${primaryRisk.summary}`,
        primaryColor
      };
    })
    .sort((left, right) => {
      if (right.riskScore !== left.riskScore) {
        return right.riskScore - left.riskScore;
      }

      return right.generatedAt.localeCompare(left.generatedAt);
    });
}

function buildRiskProfiles(
  reviewedGames: CombinedReviewedGame[],
  recentRatedCounts: Map<string, number>,
  moderationStatuses: Map<string, ModerationStatus>,
  moderationSuppressions: Map<string, ModerationRecommendationSuppression>
): AdminRiskProfile[] {
  const profiles = new Map<
    string,
    {
      userId: string;
      name: string;
      email: string | null;
      risks: number[];
      reviewedGames: number;
      flaggedGames: number;
      watchLevelGames: number;
      reviewLevelGames: number;
      recentPeakRisk: number;
      lastFlaggedAt: string | null;
    }
  >();

  for (const game of reviewedGames) {
    for (const color of [PlayerColor.WHITE, PlayerColor.BLACK] as const) {
      const player = color === PlayerColor.WHITE ? game.players.white : game.players.black;
      const playerRisk = color === PlayerColor.WHITE ? game.playerRisks.white : game.playerRisks.black;

      if (!player.id || isGuestEmail(player.email)) {
        continue;
      }

      const current = profiles.get(player.id) ?? {
        userId: player.id,
        name: player.name,
        email: player.email,
        risks: [],
        reviewedGames: 0,
        flaggedGames: 0,
        watchLevelGames: 0,
        reviewLevelGames: 0,
        recentPeakRisk: 0,
        lastFlaggedAt: null
      };

      current.reviewedGames += 1;
      current.risks.push(playerRisk.riskScore);
      current.recentPeakRisk = Math.max(current.recentPeakRisk, playerRisk.riskScore);
      if (playerRisk.riskScore >= 20) {
        current.flaggedGames += 1;
        if (!current.lastFlaggedAt || game.generatedAt > current.lastFlaggedAt) {
          current.lastFlaggedAt = game.generatedAt;
        }
      }
      if (playerRisk.riskScore >= 35) {
        current.watchLevelGames += 1;
      }
      if (playerRisk.riskScore >= 60) {
        current.reviewLevelGames += 1;
      }

      profiles.set(player.id, current);
    }
  }

  return Array.from(profiles.values())
    .map((profile) => {
      const riskScore = buildAccountRiskScore(profile.risks);
      const moderationStatus = moderationStatuses.get(profile.userId) ?? ModerationStatus.CLEAN;
      const suppression = moderationSuppressions.get(profile.userId) ?? {
        eventType: null,
        status: null,
        createdAt: null
      };
      const recommendation = buildModerationRecommendation({
        riskScore,
        flaggedGames: profile.flaggedGames,
        watchLevelGames: profile.watchLevelGames,
        reviewLevelGames: profile.reviewLevelGames,
        recentPeakRisk: profile.recentPeakRisk,
        lastFlaggedAt: profile.lastFlaggedAt,
        suppressionEventType: suppression.eventType,
        suppressionStatus: suppression.status,
        suppressionAt: suppression.createdAt,
        currentStatus: moderationStatus
      });

      return {
        userId: profile.userId,
        name: profile.name,
        email: profile.email,
        riskScore,
        severity: resolveSeverity(riskScore),
        moderationStatus,
        flaggedGames: profile.flaggedGames,
        watchLevelGames: profile.watchLevelGames,
        reviewLevelGames: profile.reviewLevelGames,
        recentPeakRisk: profile.recentPeakRisk,
        reviewedGames: profile.reviewedGames,
        recentRatedGames: recentRatedCounts.get(profile.userId) ?? 0,
        lastFlaggedAt: profile.lastFlaggedAt,
        recommendation
      } satisfies AdminRiskProfile;
    })
    .filter((profile) => profile.flaggedGames > 0 || profile.riskScore >= 20)
    .sort((left, right) => {
      if (right.riskScore !== left.riskScore) {
        return right.riskScore - left.riskScore;
      }

      return right.flaggedGames - left.flaggedGames;
    });
}

async function getRecentRatedCounts(userIds: string[]) {
  if (!userIds.length) {
    return new Map<string, number>();
  }

  const rows = await db.gamePlayer.groupBy({
    by: ["userId"],
    where: {
      userId: {
        in: userIds
      },
      game: {
        status: GameStatus.FINISHED,
        rated: true
      }
    },
    _count: {
      _all: true
    }
  });

  return new Map(
    rows
      .filter((row): row is typeof row & { userId: string } => Boolean(row.userId))
      .map((row) => [row.userId, row._count._all])
  );
}

async function getModerationStatuses(userIds: string[]) {
  if (!userIds.length) {
    return new Map<string, ModerationStatus>();
  }

  const users = await db.user.findMany({
    where: {
      id: {
        in: userIds
      }
    },
    select: {
      id: true,
      moderationStatus: true
    }
  });

  return new Map(users.map((user) => [user.id, user.moderationStatus]));
}

async function getModerationSuppressions(userIds: string[]) {
  if (!userIds.length) {
    return new Map<string, ModerationRecommendationSuppression>();
  }

  const users = await db.user.findMany({
    where: {
      id: {
        in: userIds
      }
    },
    select: {
      id: true,
      moderationEvents: {
        where: {
          type: {
            in: ["recommendation_dismissed", "false_positive_marked", "account_cleared"]
          }
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
  });

  return new Map(
    users.map((user) => [
      user.id,
      {
        eventType: user.moderationEvents[0]?.type ?? null,
        status: user.moderationEvents[0]?.toStatus ?? null,
        createdAt: user.moderationEvents[0]?.createdAt.toISOString() ?? null
      }
    ])
  );
}

export function canAccessAdmin(email: string | null | undefined) {
  if (!email) {
    return false;
  }

  const adminEmails = normalizeAdminEmails();
  if (adminEmails.size > 0) {
    return adminEmails.has(email.toLowerCase());
  }

  return process.env.NODE_ENV !== "production";
}

export function getAdminEmailHint() {
  const adminEmails = normalizeAdminEmails();

  if (!adminEmails.size) {
    return process.env.NODE_ENV !== "production"
      ? "Development fallback is active. Any signed-in account can open /admin until ADMIN_EMAILS is set."
      : "Set ADMIN_EMAILS in the environment to allow admin access.";
  }

  return `Admin access is restricted to ${adminEmails.size} configured email account${adminEmails.size > 1 ? "s" : ""}.`;
}

export async function getAdminSearchData(query: string): Promise<AdminSearchData | null> {
  const normalizedQuery = normalizeAdminSearchQuery(query);
  if (!normalizedQuery) {
    return null;
  }

  const [users, games] = await Promise.all([
    db.user.findMany({
      where: {
        email: {
          not: {
            endsWith: GUEST_EMAIL_DOMAIN
          }
        },
        OR: [
          {
            id: {
              startsWith: normalizedQuery
            }
          },
          {
            email: {
              contains: normalizedQuery,
              mode: "insensitive"
            }
          },
          {
            name: {
              contains: normalizedQuery,
              mode: "insensitive"
            }
          },
          {
            displayName: {
              contains: normalizedQuery,
              mode: "insensitive"
            }
          }
        ]
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 8,
      select: {
        id: true,
        name: true,
        displayName: true,
        email: true,
        moderationStatus: true,
        createdAt: true,
        ratingBullet: true,
        ratingBlitz: true,
        ratingRapid: true
      }
    }),
    db.game.findMany({
      where: {
        OR: [
          {
            id: {
              startsWith: normalizedQuery
            }
          },
          {
            inviteCode: {
              startsWith: normalizedQuery.toUpperCase()
            }
          },
          {
            result: {
              contains: normalizedQuery,
              mode: "insensitive"
            }
          },
          {
            players: {
              some: {
                user: {
                  OR: [
                    {
                      email: {
                        contains: normalizedQuery,
                        mode: "insensitive"
                      }
                    },
                    {
                      name: {
                        contains: normalizedQuery,
                        mode: "insensitive"
                      }
                    },
                    {
                      displayName: {
                        contains: normalizedQuery,
                        mode: "insensitive"
                      }
                    }
                  ]
                }
              }
            }
          }
        ]
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 8,
      select: {
        id: true,
        status: true,
        result: true,
        rated: true,
        inviteCode: true,
        timeCategory: true,
        initialTimeMs: true,
        incrementMs: true,
        createdAt: true,
        endedAt: true,
        players: {
          select: {
            color: true,
            user: {
              select: {
                name: true,
                displayName: true
              }
            }
          }
        }
      }
    })
  ]);

  return {
    query: normalizedQuery,
    users: users.map((user) => ({
      id: user.id,
      name: displayUserName(user),
      email: user.email,
      moderationStatus: user.moderationStatus,
      createdAt: user.createdAt.toISOString(),
      ratings: {
        bullet: user.ratingBullet,
        blitz: user.ratingBlitz,
        rapid: user.ratingRapid
      }
    })),
    games: games.map((game) => {
      const white = game.players.find((player) => player.color === PlayerColor.WHITE);
      const black = game.players.find((player) => player.color === PlayerColor.BLACK);

      return {
        id: game.id,
        status: game.status,
        result: game.result,
        rated: game.rated,
        format: formatCategoryLabel(game.timeCategory),
        control: formatControl(game.initialTimeMs, game.incrementMs),
        inviteCode: game.inviteCode,
        createdAt: game.createdAt.toISOString(),
        endedAt: game.endedAt?.toISOString() ?? null,
        players: {
          white: white ? displayUserName(white.user) : "Unknown",
          black: black ? displayUserName(black.user) : "Unknown"
        }
      };
    })
  };
}

async function getRiskProfilesForPeriod(periodStart: Date) {
  const reviewedGames = await db.game.findMany({
    where: {
      status: GameStatus.FINISHED,
      events: {
        some: {
          type: {
            in: REVIEW_EVENT_TYPES
          }
        }
      },
      endedAt: {
        gte: periodStart
      }
    },
    orderBy: {
      endedAt: "desc"
    },
    take: 400,
    select: reviewedGameSelect
  });

  const combinedReviewedGames = buildCombinedReviewedGames(reviewedGames);
  const reviewedUserIds = Array.from(
    new Set(
      combinedReviewedGames.flatMap((game) =>
        [game.players.white.id, game.players.black.id].filter((value): value is string => Boolean(value))
      )
    )
  );
  const recentRatedCounts = await getRecentRatedCounts(reviewedUserIds);
  const moderationStatuses = await getModerationStatuses(reviewedUserIds);
  const moderationSuppressions = await getModerationSuppressions(reviewedUserIds);

  return buildRiskProfiles(
    combinedReviewedGames,
    recentRatedCounts,
    moderationStatuses,
    moderationSuppressions
  );
}

async function getPairPatternsForPeriod(periodStart: Date) {
  const games = await db.game.findMany({
    where: {
      status: GameStatus.FINISHED,
      endedAt: {
        gte: periodStart
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 600,
    select: {
      id: true,
      rated: true,
      createdAt: true,
      endedAt: true,
      players: {
        select: {
          userId: true,
          user: {
            select: {
              name: true,
              displayName: true
            }
          }
        }
      },
      events: {
        where: {
          type: {
            in: REVIEW_EVENT_TYPES
          }
        },
        take: 1,
        select: {
          id: true
        }
      }
    }
  });

  const pairs = new Map<
    string,
    {
      leftUserId: string;
      leftName: string;
      rightUserId: string;
      rightName: string;
      totalGames: number;
      ratedGames: number;
      reviewedGames: number;
      timestamps: number[];
      lastGameAt: string;
    }
  >();

  for (const game of games) {
    if (game.players.length !== 2) {
      continue;
    }

    if (game.players.some((player) => !player.userId || !player.user)) {
      continue;
    }

    const sortedPlayers = [...game.players].sort((left, right) =>
      (left.userId ?? "").localeCompare(right.userId ?? "")
    );
    const left = sortedPlayers[0];
    const right = sortedPlayers[1];

    if (!left || !right || !left.userId || !right.userId || left.userId === right.userId) {
      continue;
    }

    const key = buildPairKey(left.userId, right.userId);
    const current = pairs.get(key) ?? {
      leftUserId: left.userId,
      leftName: displayUserName(left.user),
      rightUserId: right.userId,
      rightName: displayUserName(right.user),
      totalGames: 0,
      ratedGames: 0,
      reviewedGames: 0,
      timestamps: [],
      lastGameAt: game.endedAt?.toISOString() ?? game.createdAt.toISOString()
    };

    current.totalGames += 1;
    current.ratedGames += game.rated ? 1 : 0;
    current.reviewedGames += game.events.length ? 1 : 0;
    current.timestamps.push((game.endedAt ?? game.createdAt).getTime());
    if ((game.endedAt?.toISOString() ?? game.createdAt.toISOString()) > current.lastGameAt) {
      current.lastGameAt = game.endedAt?.toISOString() ?? game.createdAt.toISOString();
    }

    pairs.set(key, current);
  }

  return Array.from(pairs.values())
    .map((pair) => {
      const sortedTimes = [...pair.timestamps].sort((left, right) => left - right);
      let fastRematches = 0;

      for (let index = 1; index < sortedTimes.length; index += 1) {
        if (sortedTimes[index] - sortedTimes[index - 1] <= 45 * 60 * 1000) {
          fastRematches += 1;
        }
      }

      const riskScore = Math.min(
        100,
        pair.totalGames * 8 + pair.ratedGames * 3 + pair.reviewedGames * 18 + fastRematches * 14
      );

      return {
        leftUserId: pair.leftUserId,
        leftName: pair.leftName,
        rightUserId: pair.rightUserId,
        rightName: pair.rightName,
        totalGames: pair.totalGames,
        ratedGames: pair.ratedGames,
        reviewedGames: pair.reviewedGames,
        fastRematches,
        lastGameAt: pair.lastGameAt,
        riskScore,
        summary: `${pair.totalGames} games, ${pair.ratedGames} rated, ${pair.reviewedGames} reviewed, ${fastRematches} fast rematches.`
      };
    })
    .filter((pair) => pair.totalGames >= 2 || pair.reviewedGames > 0 || pair.fastRematches > 0)
    .sort((left, right) => {
      if (right.riskScore !== left.riskScore) {
        return right.riskScore - left.riskScore;
      }

      return right.totalGames - left.totalGames;
    })
    .slice(0, 10);
}

export async function getAdminModerationExportData(
  exportType: "flagged_accounts" | "outcomes",
  periodDays = 30
) {
  const normalizedPeriodDays = normalizeAdminPeriodDays(periodDays);
  const today = startOfDay(new Date());
  const periodStart = addDays(today, -(normalizedPeriodDays - 1));

  if (exportType === "flagged_accounts") {
    const riskProfiles = await getRiskProfilesForPeriod(periodStart);

    return {
      exportType,
      periodDays: normalizedPeriodDays,
      rows: riskProfiles.map((profile) => ({
        userId: profile.userId,
        name: profile.name,
        email: profile.email ?? "",
        riskScore: profile.riskScore,
        severity: profile.severity,
        moderationStatus: profile.moderationStatus,
        flaggedGames: profile.flaggedGames,
        watchLevelGames: profile.watchLevelGames,
        reviewLevelGames: profile.reviewLevelGames,
        recentPeakRisk: profile.recentPeakRisk,
        reviewedGames: profile.reviewedGames,
        recentRatedGames: profile.recentRatedGames,
        lastFlaggedAt: profile.lastFlaggedAt ?? "",
        recommendationStatus: profile.recommendation.status,
        recommendationConfidence: Math.round(profile.recommendation.confidence * 100),
        recommendationMuted: profile.recommendation.dismissed ? "yes" : "no"
      }))
    };
  }

  const outcomeEvents = await db.userModerationEvent.findMany({
    where: {
      createdAt: {
        gte: periodStart
      },
      type: {
        in: [
          "system_auto_raised",
          "account_cleared",
          "false_positive_marked",
          "cheat_confirmed",
          "recommendation_dismissed"
        ]
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    select: {
      id: true,
      type: true,
      fromStatus: true,
      toStatus: true,
      note: true,
      createdByEmail: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          name: true,
          displayName: true,
          email: true
        }
      }
    }
  });

  return {
    exportType,
    periodDays: normalizedPeriodDays,
    rows: outcomeEvents.map((event) => ({
      id: event.id,
      userId: event.user.id,
      userName: displayUserName(event.user),
      userEmail: event.user.email ?? "",
      type: event.type,
      fromStatus: event.fromStatus ?? "",
      toStatus: event.toStatus ?? "",
      createdByEmail: event.createdByEmail,
      createdAt: event.createdAt.toISOString(),
      note: event.note ?? ""
    }))
  };
}

async function getTopPlayers(field: "ratingBullet" | "ratingBlitz" | "ratingRapid") {
  if (field === "ratingBullet") {
    const users = await db.user.findMany({
      where: {
        email: {
          not: {
            endsWith: GUEST_EMAIL_DOMAIN
          }
        }
      },
      orderBy: {
        ratingBullet: "desc"
      },
      select: {
        id: true,
        name: true,
        displayName: true,
        ratingBullet: true
      },
      take: 5
    });

    return users.map((user) => ({
      id: user.id,
      name: displayUserName(user),
      rating: user.ratingBullet
    }));
  }

  if (field === "ratingBlitz") {
    const users = await db.user.findMany({
      where: {
        email: {
          not: {
            endsWith: GUEST_EMAIL_DOMAIN
          }
        }
      },
      orderBy: {
        ratingBlitz: "desc"
      },
      select: {
        id: true,
        name: true,
        displayName: true,
        ratingBlitz: true
      },
      take: 5
    });

    return users.map((user) => ({
      id: user.id,
      name: displayUserName(user),
      rating: user.ratingBlitz
    }));
  }

  const users = await db.user.findMany({
    where: {
      email: {
        not: {
          endsWith: GUEST_EMAIL_DOMAIN
        }
      }
    },
    orderBy: {
      ratingRapid: "desc"
    },
    select: {
      id: true,
      name: true,
      displayName: true,
      ratingRapid: true
    },
    take: 5
  });

  return users.map((user) => ({
    id: user.id,
    name: displayUserName(user),
    rating: user.ratingRapid
  }));
}

export async function getAdminDashboardData(periodDays = 30): Promise<AdminDashboardData> {
  const normalizedPeriodDays = periodDays === 7 || periodDays === 90 ? periodDays : 30;
  const today = startOfDay(new Date());
  const periodStart = addDays(today, -(normalizedPeriodDays - 1));

  const [
    totalUsers,
    newUsersWindow,
    totalGames,
    activeGames,
    waitingGames,
    finishedGames,
    finishedGamesWindow,
    ratedGames,
    totalMoves,
    userRowsWindow,
    finishedRowsWindow,
    gameFormatRows,
    gameResultRows,
    topBullet,
    topBlitz,
    topRapid,
    recentFinishedGames,
    reviewedGames,
    moderationOutcomeRows,
    moderationOutcomeEvents,
    pairPatterns
  ] = await Promise.all([
    db.user.count({
      where: {
        email: {
          not: {
            endsWith: GUEST_EMAIL_DOMAIN
          }
        }
      }
    }),
    db.user.count({
      where: {
        email: {
          not: {
            endsWith: GUEST_EMAIL_DOMAIN
          }
        },
        createdAt: {
          gte: periodStart
        }
      }
    }),
    db.game.count(),
    db.game.count({
      where: {
        status: GameStatus.ACTIVE
      }
    }),
    db.game.count({
      where: {
        status: GameStatus.WAITING
      }
    }),
    db.game.count({
      where: {
        status: GameStatus.FINISHED
      }
    }),
    db.game.count({
      where: {
        status: GameStatus.FINISHED,
        endedAt: {
          gte: periodStart
        }
      }
    }),
    db.game.count({
      where: {
        rated: true
      }
    }),
    db.move.count(),
    db.user.findMany({
      where: {
        email: {
          not: {
            endsWith: GUEST_EMAIL_DOMAIN
          }
        },
        createdAt: {
          gte: periodStart
        }
      },
      select: {
        createdAt: true
      },
      orderBy: {
        createdAt: "asc"
      }
    }),
    db.game.findMany({
      where: {
        status: GameStatus.FINISHED,
        endedAt: {
          gte: periodStart
        }
      },
      select: {
        endedAt: true
      },
      orderBy: {
        endedAt: "asc"
      }
    }),
    db.game.groupBy({
      by: ["timeCategory", "rated"],
      where: {
        status: GameStatus.FINISHED,
        endedAt: {
          gte: periodStart
        }
      },
      _count: {
        _all: true
      }
    }),
    db.game.groupBy({
      by: ["result"],
      where: {
        status: GameStatus.FINISHED,
        endedAt: {
          gte: periodStart
        }
      },
      _count: {
        _all: true
      }
    }),
    getTopPlayers("ratingBullet"),
    getTopPlayers("ratingBlitz"),
    getTopPlayers("ratingRapid"),
    db.game.findMany({
      where: {
        status: GameStatus.FINISHED
      },
      orderBy: {
        endedAt: "desc"
      },
      take: 8,
      select: {
        id: true,
        timeCategory: true,
        initialTimeMs: true,
        incrementMs: true,
        rated: true,
        result: true,
        endedAt: true,
        players: {
          select: {
            color: true,
            user: {
              select: {
                name: true,
                displayName: true
              }
            }
          }
        }
      }
    }),
    db.game.findMany({
      where: {
        status: GameStatus.FINISHED,
        events: {
          some: {
            type: {
              in: REVIEW_EVENT_TYPES
            }
          }
        },
        endedAt: {
          gte: periodStart
        }
      },
      orderBy: {
        endedAt: "desc"
      },
      take: 60,
      select: reviewedGameSelect
    }),
    db.userModerationEvent.groupBy({
      by: ["type"],
      where: {
        createdAt: {
          gte: periodStart
        },
        type: {
          in: ["account_cleared", "false_positive_marked", "cheat_confirmed"]
        }
      },
      _count: {
        _all: true
      }
    }),
    db.userModerationEvent.findMany({
      where: {
        type: {
          in: [
            "system_auto_raised",
            "account_cleared",
            "false_positive_marked",
            "cheat_confirmed"
          ]
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 8,
      select: {
        id: true,
        type: true,
        fromStatus: true,
        toStatus: true,
        note: true,
        createdByEmail: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            displayName: true,
            email: true
          }
        }
      }
    }),
    getPairPatternsForPeriod(periodStart)
  ]);

  const trendBuckets = buildDayBuckets(normalizedPeriodDays);
  const trendByKey = Object.fromEntries(trendBuckets.map((entry) => [entry.key, entry]));

  for (const userRow of userRowsWindow) {
    const key = userRow.createdAt.toISOString().slice(0, 10);
    if (trendByKey[key]) {
      trendByKey[key].users += 1;
    }
  }

  for (const gameRow of finishedRowsWindow) {
    if (!gameRow.endedAt) {
      continue;
    }

    const key = gameRow.endedAt.toISOString().slice(0, 10);
    if (trendByKey[key]) {
      trendByKey[key].finishedGames += 1;
    }
  }

  const combinedReviewedGames = buildCombinedReviewedGames(reviewedGames);
  const reviewedUserIds = Array.from(
    new Set(
      combinedReviewedGames.flatMap((game) =>
        [game.players.white.id, game.players.black.id].filter((value): value is string => Boolean(value))
      )
    )
  );
  const recentRatedCounts = await getRecentRatedCounts(reviewedUserIds);
  const moderationStatuses = await getModerationStatuses(reviewedUserIds);
  const moderationSuppressions = await getModerationSuppressions(reviewedUserIds);
  const riskProfiles = buildRiskProfiles(
    combinedReviewedGames,
    recentRatedCounts,
    moderationStatuses,
    moderationSuppressions
  );
  const recommendationQueue = riskProfiles
    .filter((profile) => profile.recommendation.differsFromCurrent)
    .sort((left, right) => {
      if (right.recommendation.confidence !== left.recommendation.confidence) {
        return right.recommendation.confidence - left.recommendation.confidence;
      }

      return right.riskScore - left.riskScore;
    })
    .slice(0, 10);
  const moderationOutcomeCounts = Object.fromEntries(
    moderationOutcomeRows.map((row) => [row.type, row._count._all])
  );

  return {
    selectedPeriodDays: normalizedPeriodDays,
    overview: {
      totalUsers,
      newUsersWindow,
      totalGames,
      activeGames,
      waitingGames,
      finishedGames,
      finishedGamesWindow,
      ratedGames,
      totalMoves
    },
    trend: trendBuckets.map((entry) => ({
      day: entry.label,
      users: entry.users,
      finishedGames: entry.finishedGames
    })),
    formats: gameFormatRows
      .filter((row) => row.timeCategory !== TimeCategory.CUSTOM)
      .map((row) => ({
        label: formatCategoryLabel(row.timeCategory),
        rated: row.rated,
        games: row._count._all
      }))
      .sort((left, right) => right.games - left.games),
    results: gameResultRows
      .map((row) => ({
        label: formatResultLabel(row.result),
        games: row._count._all
      }))
      .sort((left, right) => right.games - left.games),
    topPlayers: {
      bullet: topBullet,
      blitz: topBlitz,
      rapid: topRapid
    },
    recentFinishedGames: recentFinishedGames.map((game) => {
      const white = game.players.find((player) => player.color === "WHITE");
      const black = game.players.find((player) => player.color === "BLACK");

      return {
        id: game.id,
        players: {
          white: white ? displayUserName(white.user) : "Unknown",
          black: black ? displayUserName(black.user) : "Unknown"
        },
        control: formatControl(game.initialTimeMs, game.incrementMs),
        format: formatCategoryLabel(game.timeCategory),
        rated: game.rated,
        result: game.result,
        endedAt: game.endedAt?.toISOString() ?? null
      };
    }),
    suspiciousGames: combinedReviewedGames
      .filter((game) => game.riskScore >= 20)
      .slice(0, 12)
      .map((game) => ({
        id: game.id,
        players: {
          white: game.players.white.name,
          black: game.players.black.name
        },
        playerIds: {
          white: game.players.white.id,
          black: game.players.black.id
        },
        primaryPlayerId:
          game.primaryColor === PlayerColor.WHITE
            ? game.players.white.id
            : game.primaryColor === PlayerColor.BLACK
              ? game.players.black.id
              : null,
        primaryPlayerName:
          game.primaryColor === PlayerColor.WHITE
            ? game.players.white.name
            : game.primaryColor === PlayerColor.BLACK
              ? game.players.black.name
              : null,
        primaryColor: game.primaryColor,
        control: game.control,
        format: game.format,
        rated: game.rated,
        source: game.source,
        riskScore: game.riskScore,
        severity: game.severity,
        summary: game.summary,
        generatedAt: game.generatedAt
      })),
    riskyAccounts: riskProfiles.slice(0, 8),
    recommendationQueue,
    moderationFunnel: {
      flaggedAccounts: riskProfiles.length,
      queuedRecommendations: recommendationQueue.length,
      observeAccounts: riskProfiles.filter(
        (profile) => profile.moderationStatus === ModerationStatus.OBSERVE
      ).length,
      watchOrReviewAccounts: riskProfiles.filter(
        (profile) =>
          profile.moderationStatus === ModerationStatus.WATCH ||
          profile.moderationStatus === ModerationStatus.REVIEW
      ).length,
      restrictedAccounts: riskProfiles.filter(
        (profile) => profile.moderationStatus === ModerationStatus.RESTRICTED
      ).length,
      clearedOutcomes30d: moderationOutcomeCounts.account_cleared ?? 0,
      falsePositiveOutcomes30d: moderationOutcomeCounts.false_positive_marked ?? 0,
      confirmedCheatOutcomes30d: moderationOutcomeCounts.cheat_confirmed ?? 0
    },
    recentModerationOutcomes: moderationOutcomeEvents.map((event) => ({
      id: event.id,
      userId: event.user.id,
      userName: displayUserName(event.user),
      userEmail: event.user.email,
      type: event.type,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      createdByEmail: event.createdByEmail,
      createdAt: event.createdAt.toISOString(),
      note: event.note
    })),
    pairPatterns
  };
}

export async function getAdminUserDetail(userId: string): Promise<AdminUserDetailData | null> {
  const [user, reviewedGames, recentRatedGames] = await Promise.all([
    db.user.findUnique({
      where: {
        id: userId
      },
      select: {
        id: true,
        name: true,
        displayName: true,
        email: true,
        createdAt: true,
        moderationStatus: true,
        moderationUpdatedAt: true,
        moderationUpdatedByEmail: true,
        ratingBullet: true,
        ratingBlitz: true,
        ratingRapid: true,
        moderationEvents: {
          orderBy: {
            createdAt: "desc"
          },
          take: 20,
          select: {
            id: true,
            type: true,
            fromStatus: true,
            toStatus: true,
            note: true,
            createdByEmail: true,
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
      select: reviewedGameSelect
    }),
    db.gamePlayer.count({
      where: {
        userId,
        game: {
          status: GameStatus.FINISHED,
          rated: true
        }
      }
    })
  ]);

  if (!user) {
    return null;
  }

  if (isGuestEmail(user.email)) {
    return null;
  }

  const combinedReviewedGames = buildCombinedReviewedGames(reviewedGames);
  const recentRatedCounts = new Map([[userId, recentRatedGames]]);
  const moderationStatuses = new Map([[userId, user.moderationStatus]]);
  const moderationSuppressions = await getModerationSuppressions([userId]);
  const profile =
    buildRiskProfiles(
      combinedReviewedGames.filter(
        (game) => game.players.white.id === userId || game.players.black.id === userId
      ),
      recentRatedCounts,
      moderationStatuses,
      moderationSuppressions
    ).find((entry) => entry.userId === userId) ??
    ({
      userId,
      name: displayUserName(user),
      email: user.email,
      riskScore: 0,
      severity: "clean",
      moderationStatus: user.moderationStatus,
      flaggedGames: 0,
        watchLevelGames: 0,
        reviewLevelGames: 0,
        recentPeakRisk: 0,
        reviewedGames: combinedReviewedGames.length,
        recentRatedGames,
        lastFlaggedAt: null,
        recommendation: buildModerationRecommendation({
          riskScore: 0,
          flaggedGames: 0,
          watchLevelGames: 0,
          reviewLevelGames: 0,
          recentPeakRisk: 0,
          lastFlaggedAt: null,
          suppressionEventType: null,
          suppressionStatus: null,
          suppressionAt: null,
          currentStatus: user.moderationStatus
        })
      } satisfies AdminRiskProfile);

  const reviewedRows = combinedReviewedGames
    .filter((game) => game.players.white.id === userId || game.players.black.id === userId)
    .map((game) => {
      const side = game.players.white.id === userId ? PlayerColor.WHITE : PlayerColor.BLACK;
      const playerRisk = side === PlayerColor.WHITE ? game.playerRisks.white : game.playerRisks.black;
      const opponent = side === PlayerColor.WHITE ? game.players.black : game.players.white;

      return {
        gameId: game.id,
        opponentId: opponent.id,
        opponentName: opponent.name,
        side,
        format: game.format,
        control: game.control,
        rated: game.rated,
        result: game.result,
        endedAt: game.endedAt,
        generatedAt: game.generatedAt,
        source: playerRisk.source,
        riskScore: playerRisk.riskScore,
        severity: playerRisk.severity,
        telemetryRisk: playerRisk.telemetryRisk,
        engineRisk: playerRisk.engineRisk,
        summary: playerRisk.summary
      };
    })
    .sort((left, right) => {
      if (right.riskScore !== left.riskScore) {
        return right.riskScore - left.riskScore;
      }

      return right.generatedAt.localeCompare(left.generatedAt);
    });

  return {
    user: {
      id: user.id,
      name: displayUserName(user),
      email: user.email,
      createdAt: user.createdAt.toISOString(),
      moderationStatus: user.moderationStatus,
      moderationUpdatedAt: user.moderationUpdatedAt?.toISOString() ?? null,
      moderationUpdatedByEmail: user.moderationUpdatedByEmail ?? null,
      ratings: {
        bullet: user.ratingBullet,
        blitz: user.ratingBlitz,
        rapid: user.ratingRapid
      }
    },
    profile,
    trend: reviewedRows.slice(0, 10).map((row) => ({
      gameId: row.gameId,
      label: formatShortDate(row.generatedAt),
      riskScore: row.riskScore,
      severity: row.severity
    })),
    reviewedGames: reviewedRows.slice(0, 24),
    moderationEvents: user.moderationEvents.map((event) => ({
      id: event.id,
      type: event.type,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      note: event.note,
      createdByEmail: event.createdByEmail,
      createdAt: event.createdAt.toISOString()
    }))
  };
}

export async function getAdminGameDetail(gameId: string): Promise<AdminGameDetailData | null> {
  const game = await db.game.findUnique({
    where: {
      id: gameId
    },
    select: {
      id: true,
      status: true,
      result: true,
      rated: true,
      visibility: true,
      inviteCode: true,
      timeCategory: true,
      initialTimeMs: true,
      incrementMs: true,
      createdAt: true,
      startedAt: true,
      endedAt: true,
      fen: true,
      pgn: true,
      createdByUserId: true,
      createdBy: {
        select: {
          name: true,
          displayName: true
        }
      },
      players: {
        orderBy: {
          color: "asc"
        },
        select: {
          userId: true,
          color: true,
          timeRemainingMs: true,
          isConnected: true,
          user: {
            select: {
              id: true,
              name: true,
              displayName: true,
              email: true,
              ratingBullet: true,
              ratingBlitz: true,
              ratingRapid: true
            }
          }
        }
      },
      moves: {
        orderBy: {
          ply: "asc"
        },
        take: 160,
        select: {
          id: true,
          ply: true,
          san: true,
          uci: true,
          movedByUserId: true,
          spentTimeMs: true,
          clientThinkTimeMs: true,
          turnBlurCount: true,
          focusLossDurationMs: true,
          createdAt: true
        }
      },
      events: {
        orderBy: {
          createdAt: "desc"
        },
        take: 60,
        select: {
          id: true,
          type: true,
          createdAt: true,
          payload: true
        }
      }
    }
  });

  if (!game) {
    return null;
  }

  return {
    game: {
      id: game.id,
      status: game.status,
      result: game.result,
      rated: game.rated,
      visibility: game.visibility,
      inviteCode: game.inviteCode,
      format: formatCategoryLabel(game.timeCategory),
      control: formatControl(game.initialTimeMs, game.incrementMs),
      createdAt: game.createdAt.toISOString(),
      startedAt: game.startedAt?.toISOString() ?? null,
      endedAt: game.endedAt?.toISOString() ?? null,
      hostName: displayUserName(game.createdBy),
      hostId: game.createdByUserId,
      fen: game.fen,
      pgn: game.pgn
    },
    players: game.players.map((player) => ({
      userId: player.userId,
      name: displayUserName(player.user),
      email: player.user?.email ?? null,
      color: player.color,
      timeRemainingMs: player.timeRemainingMs,
      isConnected: player.isConnected,
      rating:
        !player.user
          ? null
          : game.timeCategory === TimeCategory.BULLET
            ? player.user.ratingBullet
            : game.timeCategory === TimeCategory.BLITZ
              ? player.user.ratingBlitz
              : game.timeCategory === TimeCategory.RAPID
                ? player.user.ratingRapid
                : null
    })),
    moves: game.moves.map((move) => ({
      id: move.id,
      ply: move.ply,
      san: move.san,
      uci: move.uci,
      movedByUserId: move.movedByUserId,
      spentTimeMs: move.spentTimeMs,
      clientThinkTimeMs: move.clientThinkTimeMs,
      turnBlurCount: move.turnBlurCount,
      focusLossDurationMs: move.focusLossDurationMs,
      createdAt: move.createdAt.toISOString()
    })),
    events: game.events.map((event) => ({
      id: event.id,
      type: event.type,
      createdAt: event.createdAt.toISOString(),
      summary: summarizeEventPayload(event.payload)
    }))
  };
}

export async function getAdminHeadToHead(
  leftUserId: string,
  rightUserId: string
): Promise<AdminHeadToHeadData | null> {
  if (!leftUserId || !rightUserId || leftUserId === rightUserId) {
    return null;
  }

  const [users, games] = await Promise.all([
    db.user.findMany({
      where: {
        id: {
          in: [leftUserId, rightUserId]
        }
      },
      select: {
        id: true,
        name: true,
        displayName: true,
        email: true
      }
    }),
    db.game.findMany({
      where: {
        players: {
          some: {
            userId: leftUserId
          }
        },
        AND: {
          players: {
            some: {
              userId: rightUserId
            }
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 80,
      select: {
        id: true,
        status: true,
        result: true,
        winnerUserId: true,
        rated: true,
        timeCategory: true,
        initialTimeMs: true,
        incrementMs: true,
        createdAt: true,
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
            id: true,
            type: true,
            createdAt: true,
            payload: true
          }
        }
      }
    })
  ]);

  const leftPlayer = users.find((user) => user.id === leftUserId);
  const rightPlayer = users.find((user) => user.id === rightUserId);

  if (!leftPlayer || !rightPlayer) {
    return null;
  }

  const leftWins = games.filter((game) => game.winnerUserId === leftUserId).length;
  const rightWins = games.filter((game) => game.winnerUserId === rightUserId).length;
  const draws = games.filter((game) => game.winnerUserId === null && game.status === GameStatus.FINISHED).length;
  const moderationEvents = await db.userModerationEvent.findMany({
    where: {
      userId: {
        in: [leftUserId, rightUserId]
      },
      type: {
        in: [
          "system_auto_raised",
          "account_cleared",
          "false_positive_marked",
          "cheat_confirmed",
          "recommendation_dismissed"
        ]
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 40,
    select: {
      id: true,
      userId: true,
      type: true,
      createdAt: true,
      note: true
    }
  });
  const timeline = [
    ...games
      .filter((game) => game.events.length > 0)
      .map((game) => ({
        id: `review-${game.events[0].id}`,
        type: "game_review" as const,
        createdAt: game.events[0].createdAt.toISOString(),
        actorUserId: null,
        actorName: `${displayUserName(leftPlayer)} vs ${displayUserName(rightPlayer)}`,
        label: "Game flagged",
        summary: summarizeEventPayload(game.events[0].payload),
        gameId: game.id
      })),
    ...moderationEvents.map((event) => ({
      id: `moderation-${event.id}`,
      type: "moderation_outcome" as const,
      createdAt: event.createdAt.toISOString(),
      actorUserId: event.userId,
      actorName:
        event.userId === leftUserId ? displayUserName(leftPlayer) : displayUserName(rightPlayer),
      label: event.type.replaceAll("_", " "),
      summary: event.note ?? "Moderator outcome recorded.",
      gameId: null
    }))
  ].sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  return {
    leftPlayer: {
      id: leftPlayer.id,
      name: displayUserName(leftPlayer),
      email: leftPlayer.email
    },
    rightPlayer: {
      id: rightPlayer.id,
      name: displayUserName(rightPlayer),
      email: rightPlayer.email
    },
    summary: {
      totalGames: games.length,
      ratedGames: games.filter((game) => game.rated).length,
      leftWins,
      rightWins,
      draws,
      reviewedGames: games.filter((game) => game.events.length > 0).length
    },
    timeline,
    games: games.map((game) => ({
      id: game.id,
      format: formatCategoryLabel(game.timeCategory),
      control: formatControl(game.initialTimeMs, game.incrementMs),
      rated: game.rated,
      status: game.status,
      result: game.result,
      createdAt: game.createdAt.toISOString(),
      endedAt: game.endedAt?.toISOString() ?? null,
      leftColor: game.players.find((player) => player.userId === leftUserId)?.color ?? null,
      rightColor: game.players.find((player) => player.userId === rightUserId)?.color ?? null,
      winnerUserId: game.winnerUserId,
      hasReview: game.events.length > 0
    }))
  };
}

function normalizeModerationNote(note: string | null | undefined) {
  const normalized = note?.trim() ?? "";
  return normalized.length ? normalized.slice(0, 2000) : null;
}

export async function applyUserModerationAction(input: {
  userId: string;
  adminEmail: string;
  action?:
    | "update"
    | "dismiss_recommendation"
    | "clear_account"
    | "mark_false_positive"
    | "confirm_cheat";
  status?: ModerationStatus;
  note?: string | null;
}) {
  const note = normalizeModerationNote(input.note);

  const action = await db.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({
      where: {
        id: input.userId
      },
      select: {
        id: true,
        moderationStatus: true
      }
    });

    if (!existing) {
      throw new Error("USER_NOT_FOUND");
    }

    const nextStatus = input.status ?? existing.moderationStatus;
    const statusChanged = nextStatus !== existing.moderationStatus;
    const isDismissal = input.action === "dismiss_recommendation";
    const isClearAction = input.action === "clear_account";
    const isFalsePositiveAction = input.action === "mark_false_positive";
    const isConfirmCheatAction = input.action === "confirm_cheat";

    if (isClearAction || isFalsePositiveAction || isConfirmCheatAction) {
      const resolvedStatus = isConfirmCheatAction
        ? ModerationStatus.RESTRICTED
        : ModerationStatus.CLEAN;
      const resolutionType = isConfirmCheatAction
        ? "cheat_confirmed"
        : isFalsePositiveAction
          ? "false_positive_marked"
          : "account_cleared";
      const resolutionNote =
        note ??
        (isConfirmCheatAction
          ? "Moderator confirmed cheating and restricted this account."
          : isFalsePositiveAction
            ? "Moderator marked prior anti-cheat suspicion as a false positive."
            : "Moderator reviewed the account and cleared it.");

      if (resolvedStatus !== existing.moderationStatus) {
        await tx.user.update({
          where: {
            id: input.userId
          },
          data: {
            moderationStatus: resolvedStatus,
            moderationUpdatedAt: new Date(),
            moderationUpdatedByEmail: input.adminEmail
          }
        });
      }

      await tx.userModerationEvent.create({
        data: {
          userId: input.userId,
          type: resolutionType,
          fromStatus: existing.moderationStatus,
          toStatus: resolvedStatus,
          note: resolutionNote,
          createdByEmail: input.adminEmail
        }
      });

      return {
        status: resolvedStatus,
        note: resolutionNote,
        statusChanged: resolvedStatus !== existing.moderationStatus,
        dismissed: false,
        actionType: resolutionType
      };
    }

    if (!isDismissal && !statusChanged && !note) {
      throw new Error("EMPTY_MODERATION_ACTION");
    }

    if (isDismissal && !input.status) {
      throw new Error("MISSING_RECOMMENDATION_STATUS");
    }

    if (isDismissal) {
      await tx.userModerationEvent.create({
        data: {
          userId: input.userId,
          type: "recommendation_dismissed",
          fromStatus: existing.moderationStatus,
          toStatus: input.status ?? null,
          note,
          createdByEmail: input.adminEmail
        }
      });

      return {
        status: existing.moderationStatus,
        note,
        statusChanged: false,
        dismissed: true,
        actionType: "recommendation_dismissed"
      };
    }

    if (statusChanged) {
      await tx.user.update({
        where: {
          id: input.userId
        },
        data: {
          moderationStatus: nextStatus,
          moderationUpdatedAt: new Date(),
          moderationUpdatedByEmail: input.adminEmail
        }
      });
    }

    await tx.userModerationEvent.create({
      data: {
        userId: input.userId,
        type: statusChanged ? "status_updated" : "note_added",
        fromStatus: statusChanged ? existing.moderationStatus : null,
        toStatus: statusChanged ? nextStatus : existing.moderationStatus,
        note,
        createdByEmail: input.adminEmail
      }
    });

    return {
      status: nextStatus,
      note,
      statusChanged,
      dismissed: false,
      actionType: statusChanged ? "status_updated" : "note_added"
    };
  });

  const enforcement =
    action.statusChanged && action.status === ModerationStatus.RESTRICTED
      ? await enforceModerationRestriction(input.userId, input.adminEmail)
      : {
          cancelledWaitingGameIds: [] as string[],
          forfeitedActiveGameIds: [] as string[]
        };

  return {
    ...action,
    enforcement
  };
}
