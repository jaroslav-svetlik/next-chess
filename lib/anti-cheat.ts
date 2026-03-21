import { GameStatus, PlayerColor, TimeCategory, type Prisma } from "@prisma/client";

export type MoveTelemetryInput = {
  clientThinkTimeMs?: number;
  turnBlurCount?: number;
  focusLossDurationMs?: number;
};

type AntiCheatSignal = {
  code: string;
  score: number;
  label: string;
  detail: string;
};

type AntiCheatSeverity = "clean" | "observe" | "watch" | "review";

export type AntiCheatReviewPayload = {
  riskScore: number;
  severity: AntiCheatSeverity;
  rated: boolean;
  format: TimeCategory;
  primaryColor: PlayerColor | null;
  generatedAt: string;
  sample: {
    moveCount: number;
    measuredMoves: number;
    avgClientThinkTimeMs: number | null;
    thinkTimeStdDevMs: number | null;
    totalBlurCount: number;
    totalFocusLossDurationMs: number;
  };
  players: {
    white: AntiCheatPlayerReview;
    black: AntiCheatPlayerReview;
  };
  signals: AntiCheatSignal[];
  summary: string;
};

export type AntiCheatPlayerReview = {
  color: PlayerColor;
  riskScore: number;
  severity: AntiCheatSeverity;
  sample: {
    moveCount: number;
    measuredMoves: number;
    avgClientThinkTimeMs: number | null;
    thinkTimeStdDevMs: number | null;
    totalBlurCount: number;
    totalFocusLossDurationMs: number;
  };
  signals: AntiCheatSignal[];
  summary: string;
};

type AntiCheatGameRecord = {
  status: GameStatus;
  rated: boolean;
  timeCategory: TimeCategory;
  moves: Array<{
    ply: number;
    spentTimeMs: number;
    clientThinkTimeMs: number | null;
    turnBlurCount: number;
    focusLossDurationMs: number;
  }>;
};

export type FullGameForAntiCheat = Prisma.GameGetPayload<{
  include: {
    players: {
      include: {
        user: true;
        guestIdentity: true;
      };
    };
    moves: {
      orderBy: {
        ply: "asc";
      };
    };
  };
}>;

const MAX_CLIENT_THINK_TIME_MS = 30 * 60 * 1000;
const MAX_FOCUS_LOSS_DURATION_MS = 30 * 60 * 1000;

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeMoveTelemetry(input: MoveTelemetryInput) {
  const clientThinkTimeMs =
    typeof input.clientThinkTimeMs === "number" && Number.isFinite(input.clientThinkTimeMs)
      ? clampNumber(Math.round(input.clientThinkTimeMs), 0, MAX_CLIENT_THINK_TIME_MS)
      : null;
  const turnBlurCount =
    typeof input.turnBlurCount === "number" && Number.isFinite(input.turnBlurCount)
      ? clampNumber(Math.round(input.turnBlurCount), 0, 100)
      : 0;
  const focusLossDurationMs =
    typeof input.focusLossDurationMs === "number" && Number.isFinite(input.focusLossDurationMs)
      ? clampNumber(Math.round(input.focusLossDurationMs), 0, MAX_FOCUS_LOSS_DURATION_MS)
      : 0;

  return {
    clientThinkTimeMs,
    turnBlurCount,
    focusLossDurationMs
  };
}

function average(values: number[]) {
  if (!values.length) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stdDev(values: number[]) {
  const mean = average(values);
  if (mean === null || values.length < 2) {
    return null;
  }

  const variance =
    values.reduce((sum, value) => {
      return sum + (value - mean) ** 2;
    }, 0) / values.length;

  return Math.sqrt(variance);
}

function buildSummary(severity: AntiCheatSeverity, riskScore: number, signals: AntiCheatSignal[]) {
  if (!signals.length) {
    return "No anti-cheat risk signals were strong enough to flag this game.";
  }

  const lead = signals
    .slice(0, 2)
    .map((signal) => signal.label.toLowerCase())
    .join(", ");

  return `${severity.toUpperCase()} risk (${riskScore}) driven by ${lead}.`;
}

function resolveSeverity(riskScore: number): AntiCheatSeverity {
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

function getColorForPly(ply: number) {
  return ply % 2 === 1 ? PlayerColor.WHITE : PlayerColor.BLACK;
}

function buildSignalSet(game: Pick<AntiCheatGameRecord, "rated">, moves: AntiCheatGameRecord["moves"]) {
  const measuredMoves = moves.filter((move) => move.clientThinkTimeMs !== null);
  const clientThinkTimes = measuredMoves
    .map((move) => move.clientThinkTimeMs)
    .filter((value): value is number => value !== null);
  const avgClientThinkTimeMs = average(clientThinkTimes);
  const thinkTimeStdDevMs = stdDev(clientThinkTimes);
  const totalBlurCount = moves.reduce((sum, move) => sum + move.turnBlurCount, 0);
  const totalFocusLossDurationMs = moves.reduce((sum, move) => sum + move.focusLossDurationMs, 0);
  const blurredMoves = moves.filter((move) => move.turnBlurCount > 0).length;
  const signals: AntiCheatSignal[] = [];

  if (game.rated && moves.length >= 6 && avgClientThinkTimeMs !== null && avgClientThinkTimeMs < 1500) {
    signals.push({
      code: "fast_avg_think",
      score: 14,
      label: "Very low average think time",
      detail: `Average client think time was ${Math.round(avgClientThinkTimeMs)}ms over ${clientThinkTimes.length} measured moves.`
    });
  }

  if (game.rated && clientThinkTimes.length >= 5 && thinkTimeStdDevMs !== null && thinkTimeStdDevMs < 325) {
    signals.push({
      code: "uniform_timing",
      score: 12,
      label: "Highly uniform timing",
      detail: `Timing deviation stayed around ${Math.round(thinkTimeStdDevMs)}ms, which is unusually flat across the game.`
    });
  }

  if (totalBlurCount >= 4) {
    signals.push({
      code: "frequent_blur",
      score: Math.min(18, totalBlurCount * 3),
      label: "Frequent tab or focus loss",
      detail: `The player left focus ${totalBlurCount} times during measured turns.`
    });
  }

  if (totalFocusLossDurationMs >= 45_000) {
    signals.push({
      code: "long_focus_loss",
      score: 18,
      label: "Long focus-loss duration",
      detail: `The browser lost focus for ${Math.round(totalFocusLossDurationMs / 1000)} seconds across the game.`
    });
  }

  if (moves.length >= 5 && blurredMoves / Math.max(1, moves.length) >= 0.35) {
    signals.push({
      code: "blurred_move_ratio",
      score: 10,
      label: "High ratio of blurred turns",
      detail: `${blurredMoves} of ${moves.length} turns had at least one focus loss event.`
    });
  }

  if (
    game.rated &&
    totalBlurCount >= 3 &&
    avgClientThinkTimeMs !== null &&
    avgClientThinkTimeMs < 2200
  ) {
    signals.push({
      code: "fast_and_blurred",
      score: 12,
      label: "Fast play combined with focus loss",
      detail: "The player moved very quickly while repeatedly leaving the board context."
    });
  }

  const riskScore = Math.min(
    100,
    signals.reduce((sum, signal) => sum + signal.score, 0)
  );
  const severity = resolveSeverity(riskScore);

  return {
    riskScore,
    severity,
    signals,
    sample: {
      moveCount: moves.length,
      measuredMoves: clientThinkTimes.length,
      avgClientThinkTimeMs: avgClientThinkTimeMs ? Math.round(avgClientThinkTimeMs) : null,
      thinkTimeStdDevMs: thinkTimeStdDevMs ? Math.round(thinkTimeStdDevMs) : null,
      totalBlurCount,
      totalFocusLossDurationMs
    }
  };
}

export function buildAntiCheatPlayerReview(
  game: AntiCheatGameRecord,
  color: PlayerColor
): AntiCheatPlayerReview | null {
  if (game.status !== GameStatus.FINISHED) {
    return null;
  }

  const moves = game.moves.filter((move) => getColorForPly(move.ply) === color);
  const result = buildSignalSet(game, moves);

  return {
    color,
    riskScore: result.riskScore,
    severity: result.severity,
    sample: result.sample,
    signals: result.signals,
    summary: buildSummary(result.severity, result.riskScore, result.signals)
  };
}

export function buildAntiCheatReview(game: AntiCheatGameRecord): AntiCheatReviewPayload | null {
  if (game.status !== GameStatus.FINISHED) {
    return null;
  }

  const measuredMoves = game.moves.filter((move) => move.clientThinkTimeMs !== null);
  const clientThinkTimes = measuredMoves
    .map((move) => move.clientThinkTimeMs)
    .filter((value): value is number => value !== null);
  const avgClientThinkTimeMs = average(clientThinkTimes);
  const thinkTimeStdDevMs = stdDev(clientThinkTimes);
  const totalBlurCount = game.moves.reduce((sum, move) => sum + move.turnBlurCount, 0);
  const totalFocusLossDurationMs = game.moves.reduce(
    (sum, move) => sum + move.focusLossDurationMs,
    0
  );
  const whiteReview = buildAntiCheatPlayerReview(game, PlayerColor.WHITE);
  const blackReview = buildAntiCheatPlayerReview(game, PlayerColor.BLACK);

  if (!whiteReview || !blackReview) {
    return null;
  }

  const primaryReview =
    whiteReview.riskScore >= blackReview.riskScore ? whiteReview : blackReview;
  const primaryColor =
    primaryReview.riskScore > 0 ? primaryReview.color : null;

  return {
    riskScore: primaryReview.riskScore,
    severity: primaryReview.severity,
    rated: game.rated,
    format: game.timeCategory,
    primaryColor,
    generatedAt: new Date().toISOString(),
    sample: {
      moveCount: game.moves.length,
      measuredMoves: clientThinkTimes.length,
      avgClientThinkTimeMs: avgClientThinkTimeMs ? Math.round(avgClientThinkTimeMs) : null,
      thinkTimeStdDevMs: thinkTimeStdDevMs ? Math.round(thinkTimeStdDevMs) : null,
      totalBlurCount,
      totalFocusLossDurationMs
    },
    players: {
      white: whiteReview,
      black: blackReview
    },
    signals: primaryReview.signals,
    summary:
      primaryColor === null
        ? "No anti-cheat risk signals were strong enough to flag this game."
        : `${primaryColor === PlayerColor.WHITE ? "White" : "Black"} side: ${primaryReview.summary}`
  };
}
