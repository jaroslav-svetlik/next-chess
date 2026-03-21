import { spawn } from "node:child_process";
import path from "node:path";

import { Chess } from "chess.js";
import { GameStatus, PlayerColor, TimeCategory } from "@prisma/client";

import { BACKGROUND_JOB_TYPES, getEngineReviewJobKey, scheduleBackgroundJob } from "./background-jobs.ts";
import { db } from "./db.ts";
import { formatCategoryLabel, formatControl } from "./game-config.ts";
import { isGuestEmail } from "./guest-accounts.ts";
import { maybeAutoRaiseObserveForGame } from "./moderation-policy.ts";
import { logError, logInfo } from "./observability.ts";

const ENGINE_PATH = path.join(
  process.cwd(),
  "node_modules",
  "stockfish",
  "bin",
  "stockfish-18-asm.js"
);
const ANALYSIS_DEPTH = 8;
const ANALYSIS_PLIES_LIMIT = 24;
const ENGINE_MULTI_PV = 3;

type EngineScore = {
  type: "cp" | "mate";
  value: number;
};

type EngineAnalysis = {
  bestMove: string | null;
  score: EngineScore | null;
  topMoves: Array<{
    move: string;
    score: EngineScore | null;
  }>;
};

type EngineReviewPayload = {
  source: "engine";
  riskScore: number;
  severity: "clean" | "observe" | "watch" | "review";
  rated: boolean;
  format: string;
  control: string;
  primaryColor: PlayerColor | null;
  generatedAt: string;
  depth: number;
  analyzedPlies: number;
  top1Matches: number;
  top3Matches: number;
  top1MatchRate: number;
  top3MatchRate: number;
  avgCentipawnLoss: number | null;
  avgClientThinkTimeMs: number | null;
  players: {
    white: EnginePlayerReview;
    black: EnginePlayerReview;
  };
  sample: Array<{
    ply: number;
    actual: string;
    best: string | null;
    top3: string[];
    top1Match: boolean;
    top3Match: boolean;
    centipawnLoss: number | null;
  }>;
  summary: string;
};

type EnginePlayerReview = {
  color: PlayerColor;
  riskScore: number;
  severity: "clean" | "observe" | "watch" | "review";
  analyzedPlies: number;
  top1Matches: number;
  top3Matches: number;
  top1MatchRate: number;
  top3MatchRate: number;
  avgCentipawnLoss: number | null;
  avgClientThinkTimeMs: number | null;
  summary: string;
};

type UciWaiter = {
  predicate: (line: string, lines: string[]) => boolean;
  resolve: (lines: string[]) => void;
  reject: (error: Error) => void;
  lines: string[];
};

class StockfishProcess {
  private child = spawn(process.execPath, [ENGINE_PATH], {
    stdio: ["pipe", "pipe", "pipe"]
  });

  private waiters: UciWaiter[] = [];
  private lineBuffer = "";

  constructor() {
    this.child.stdout.setEncoding("utf8");
    this.child.stdout.on("data", (chunk: string) => {
      this.handleChunk(chunk);
    });

    this.child.stderr.setEncoding("utf8");
    this.child.stderr.on("data", () => {
      return;
    });

    this.child.on("error", (error) => {
      this.failAll(error instanceof Error ? error : new Error("Stockfish process failed."));
    });

    this.child.on("exit", () => {
      this.failAll(new Error("Stockfish process exited before analysis completed."));
    });
  }

  private handleChunk(chunk: string) {
    this.lineBuffer += chunk;
    const lines = this.lineBuffer.split(/\r?\n/);
    this.lineBuffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      for (const waiter of [...this.waiters]) {
        waiter.lines.push(trimmed);
        if (waiter.predicate(trimmed, waiter.lines)) {
          this.waiters = this.waiters.filter((entry) => entry !== waiter);
          waiter.resolve(waiter.lines);
        }
      }
    }
  }

  private failAll(error: Error) {
    for (const waiter of this.waiters) {
      waiter.reject(error);
    }
    this.waiters = [];
  }

  private send(command: string) {
    this.child.stdin.write(`${command}\n`);
  }

  private waitFor(predicate: UciWaiter["predicate"]) {
    return new Promise<string[]>((resolve, reject) => {
      this.waiters.push({
        predicate,
        resolve,
        reject,
        lines: []
      });
    });
  }

  async init() {
    this.send("uci");
    await this.waitFor((line) => line === "uciok");
    this.send("setoption name Threads value 1");
    this.send("setoption name Hash value 16");
    this.send(`setoption name MultiPV value ${ENGINE_MULTI_PV}`);
    this.send("isready");
    await this.waitFor((line) => line === "readyok");
  }

  async analyzePosition(fen: string, depth: number) {
    const moveMap = new Map<number, { move: string; score: EngineScore | null }>();

    this.send(`position fen ${fen}`);
    this.send(`go depth ${depth}`);
    const lines = await this.waitFor((line) => line.startsWith("bestmove "));

    for (const line of lines) {
      if (line.startsWith("info depth")) {
        const multipvMatch = line.match(/\smultipv\s(\d+)/);
        const moveMatch = line.match(/\spv\s([a-h][1-8][a-h][1-8][nbrq]?)/);
        const scoreMatch = line.match(/score (cp|mate) (-?\d+)/);
        const multipv = multipvMatch ? Number(multipvMatch[1]) : 1;

        if (moveMatch) {
          moveMap.set(multipv, {
            move: moveMatch[1],
            score: scoreMatch
              ? {
                  type: scoreMatch[1] as "cp" | "mate",
                  value: Number(scoreMatch[2])
                }
              : null
          });
        }
      }
    }

    const topMoves = [...moveMap.entries()]
      .sort((left, right) => left[0] - right[0])
      .map(([, value]) => value)
      .slice(0, ENGINE_MULTI_PV);
    const best = topMoves[0] ?? null;

    return {
      bestMove: best?.move ?? null,
      score: best?.score ?? null,
      topMoves
    } satisfies EngineAnalysis;
  }

  async evaluateMove(fen: string, move: string, depth: number) {
    this.send("setoption name MultiPV value 1");
    this.send(`position fen ${fen}`);
    this.send(`go depth ${depth} searchmoves ${move}`);
    const lines = await this.waitFor((line) => line.startsWith("bestmove "));
    this.send(`setoption name MultiPV value ${ENGINE_MULTI_PV}`);

    let score: EngineScore | null = null;

    for (const line of lines) {
      if (!line.startsWith("info depth")) {
        continue;
      }

      const scoreMatch = line.match(/score (cp|mate) (-?\d+)/);
      if (scoreMatch) {
        score = {
          type: scoreMatch[1] as "cp" | "mate",
          value: Number(scoreMatch[2])
        };
      }
    }

    return score;
  }

  async quit() {
    this.send("quit");
    this.child.stdin.end();
  }
}

function resolveSeverity(riskScore: number) {
  if (riskScore >= 60) {
    return "review" as const;
  }

  if (riskScore >= 35) {
    return "watch" as const;
  }

  if (riskScore >= 20) {
    return "observe" as const;
  }

  return "clean" as const;
}

function scoreToCp(score: EngineScore | null) {
  if (!score) {
    return null;
  }

  if (score.type === "cp") {
    return score.value;
  }

  const sign = score.value >= 0 ? 1 : -1;
  return sign * (100_000 - Math.min(999, Math.abs(score.value)) * 100);
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

function buildPlayerEngineReview(
  color: PlayerColor,
  analyses: Array<{
    ply: number;
    actual: string;
    best: string | null;
    top3: string[];
    top1Match: boolean;
    top3Match: boolean;
    centipawnLoss: number | null;
  }>,
  thinkTimes: number[]
): EnginePlayerReview {
  const playerAnalyses = analyses.filter((entry) =>
    color === PlayerColor.WHITE ? entry.ply % 2 === 1 : entry.ply % 2 === 0
  );
  const top1Matches = playerAnalyses.filter((entry) => entry.top1Match).length;
  const top3Matches = playerAnalyses.filter((entry) => entry.top3Match).length;
  const analyzedPlies = playerAnalyses.length;
  const top1MatchRate = analyzedPlies ? top1Matches / analyzedPlies : 0;
  const top3MatchRate = analyzedPlies ? top3Matches / analyzedPlies : 0;
  const centipawnLossValues = playerAnalyses
    .map((entry) => entry.centipawnLoss)
    .filter((value): value is number => value !== null);
  const avgCentipawnLoss = centipawnLossValues.length
    ? Math.round(
        centipawnLossValues.reduce((sum, value) => sum + value, 0) / centipawnLossValues.length
      )
    : null;
  const avgClientThinkTimeMs = thinkTimes.length
    ? Math.round(thinkTimes.reduce((sum, value) => sum + value, 0) / thinkTimes.length)
    : null;
  const { riskScore, severity } = calculateEngineRisk(
    analyzedPlies,
    top1MatchRate,
    top3MatchRate,
    avgCentipawnLoss,
    avgClientThinkTimeMs
  );

  return {
    color,
    riskScore,
    severity,
    analyzedPlies,
    top1Matches,
    top3Matches,
    top1MatchRate: Number(top1MatchRate.toFixed(3)),
    top3MatchRate: Number(top3MatchRate.toFixed(3)),
    avgCentipawnLoss,
    avgClientThinkTimeMs,
    summary:
      analyzedPlies >= 5
        ? `${color === PlayerColor.WHITE ? "White" : "Black"} matched ${top1Matches}/${analyzedPlies} top-1 and ${top3Matches}/${analyzedPlies} top-3 moves with average CPL ${avgCentipawnLoss ?? "n/a"}.`
        : `${color === PlayerColor.WHITE ? "White" : "Black"} does not have enough analyzed plies for a strong engine signal.`
  };
}

function buildEngineReviewPayload(
  game: {
    rated: boolean;
    timeCategory: TimeCategory;
    initialTimeMs: number;
    incrementMs: number;
    moves: Array<{
      ply: number;
      uci: string;
      clientThinkTimeMs: number | null;
    }>;
  },
  analyses: Array<{
    ply: number;
    actual: string;
    best: string | null;
    top3: string[];
    top1Match: boolean;
    top3Match: boolean;
    centipawnLoss: number | null;
  }>
) {
  const whiteThinkTimes = game.moves
    .filter((move) => move.ply % 2 === 1)
    .map((move) => move.clientThinkTimeMs)
    .filter((value): value is number => value !== null);
  const blackThinkTimes = game.moves
    .filter((move) => move.ply % 2 === 0)
    .map((move) => move.clientThinkTimeMs)
    .filter((value): value is number => value !== null);
  const whiteReview = buildPlayerEngineReview(PlayerColor.WHITE, analyses, whiteThinkTimes);
  const blackReview = buildPlayerEngineReview(PlayerColor.BLACK, analyses, blackThinkTimes);
  const primaryReview =
    whiteReview.riskScore >= blackReview.riskScore ? whiteReview : blackReview;
  const primaryColor = primaryReview.riskScore > 0 ? primaryReview.color : null;
  const top1Matches = analyses.filter((entry) => entry.top1Match).length;
  const top3Matches = analyses.filter((entry) => entry.top3Match).length;
  const analyzedPlies = analyses.length;
  const top1MatchRate = analyzedPlies ? top1Matches / analyzedPlies : 0;
  const top3MatchRate = analyzedPlies ? top3Matches / analyzedPlies : 0;
  const centipawnLossValues = analyses
    .map((entry) => entry.centipawnLoss)
    .filter((value): value is number => value !== null);
  const avgCentipawnLoss = centipawnLossValues.length
    ? Math.round(
        centipawnLossValues.reduce((sum, value) => sum + value, 0) / centipawnLossValues.length
      )
    : null;
  const measuredThinkTimes = game.moves
    .map((move) => move.clientThinkTimeMs)
    .filter((value): value is number => value !== null);
  const avgClientThinkTimeMs = measuredThinkTimes.length
    ? Math.round(
        measuredThinkTimes.reduce((sum, value) => sum + value, 0) / measuredThinkTimes.length
      )
    : null;

  const { riskScore, severity } = calculateEngineRisk(
    analyzedPlies,
    top1MatchRate,
    top3MatchRate,
    avgCentipawnLoss,
    avgClientThinkTimeMs
  );
  const summary =
    analyzedPlies >= 10
      ? `Engine review saw ${top1Matches}/${analyzedPlies} top-1 and ${top3Matches}/${analyzedPlies} top-3 matches with average CPL ${avgCentipawnLoss ?? "n/a"}.`
      : "Engine review sample is still too small for a strong signal.";

  return {
    source: "engine",
    riskScore,
    severity,
    rated: game.rated,
    format: formatCategoryLabel(game.timeCategory),
    control: formatControl(game.initialTimeMs, game.incrementMs),
    primaryColor,
    generatedAt: new Date().toISOString(),
    depth: ANALYSIS_DEPTH,
    analyzedPlies,
    top1Matches,
    top3Matches,
    top1MatchRate: Number(top1MatchRate.toFixed(3)),
    top3MatchRate: Number(top3MatchRate.toFixed(3)),
    avgCentipawnLoss,
    avgClientThinkTimeMs,
    players: {
      white: whiteReview,
      black: blackReview
    },
    sample: analyses.slice(0, 12),
    summary
  } satisfies EngineReviewPayload;
}

export async function runEngineReview(gameId: string) {
  const game = await db.game.findUnique({
    where: {
      id: gameId
    },
    include: {
      players: {
        select: {
          user: {
            select: {
              email: true
            }
          }
        }
      },
      moves: {
        orderBy: {
          ply: "asc"
        }
      },
      events: {
        where: {
          type: "engine_analysis_review"
        },
        take: 1
      }
    }
  });

  if (
    !game ||
    game.status !== GameStatus.FINISHED ||
    !game.rated ||
    game.events.length ||
    game.players.some((player) => isGuestEmail(player.user?.email))
  ) {
    logInfo("engine.review_skipped", {
      gameId,
      reason: !game
        ? "game_missing"
        : game.status !== GameStatus.FINISHED
          ? "game_not_finished"
          : !game.rated
            ? "game_not_rated"
            : game.events.length
              ? "review_exists"
              : "guest_players"
    });
    return;
  }

  const chess = new Chess();
  const engine = new StockfishProcess();

  try {
    await engine.init();

    const analyses: Array<{
      ply: number;
      actual: string;
      best: string | null;
      top3: string[];
      top1Match: boolean;
      top3Match: boolean;
      centipawnLoss: number | null;
    }> = [];

    for (const move of game.moves.slice(0, ANALYSIS_PLIES_LIMIT)) {
      const fenBefore = chess.fen();
      const analysis = await engine.analyzePosition(fenBefore, ANALYSIS_DEPTH);
      const actual = move.uci;
      const actualScore = await engine.evaluateMove(fenBefore, actual, ANALYSIS_DEPTH);
      const bestCp = scoreToCp(analysis.score);
      const actualCp = scoreToCp(actualScore);
      const top3 = analysis.topMoves.map((entry) => entry.move);

      analyses.push({
        ply: move.ply,
        actual,
        best: analysis.bestMove,
        top3,
        top1Match: analysis.bestMove === actual,
        top3Match: top3.includes(actual),
        centipawnLoss:
          bestCp !== null && actualCp !== null ? Math.max(0, bestCp - actualCp) : null
      });

      chess.move({
        from: actual.slice(0, 2),
        to: actual.slice(2, 4),
        promotion: actual[4] || undefined
      });
    }

    const payload = buildEngineReviewPayload(game, analyses);

    await db.gameEvent.create({
      data: {
        gameId,
        type: "engine_analysis_review",
        payload
      }
    });

    await maybeAutoRaiseObserveForGame(gameId);
    logInfo("engine.review_completed", {
      gameId,
      riskScore: payload.riskScore,
      severity: payload.severity,
      analyzedPlies: payload.analyzedPlies
    });
  } finally {
    await engine.quit().catch(() => undefined);
  }
}

export function scheduleEngineReview(gameId: string) {
  return scheduleBackgroundJob({
    type: BACKGROUND_JOB_TYPES.engineReview,
    key: getEngineReviewJobKey(gameId),
    payload: {
      gameId
    },
    runAt: new Date(Date.now() + 250),
    maxAttempts: 6
  }).catch((error) => {
    logError("engine.review_schedule_failed", {
      gameId,
      message: error instanceof Error ? error.message : "Unknown engine schedule failure."
    });
    throw error;
  });
}
