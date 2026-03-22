import { PlayerColor, Prisma, TimeCategory } from "@prisma/client";

export type RatingField = "ratingBullet" | "ratingBlitz" | "ratingRapid";
export type RatingDeviationField =
  | "ratingBulletDeviation"
  | "ratingBlitzDeviation"
  | "ratingRapidDeviation";
export type RatingVolatilityField =
  | "ratingBulletVolatility"
  | "ratingBlitzVolatility"
  | "ratingRapidVolatility";
export type RatingLastRatedAtField =
  | "ratingBulletLastRatedAt"
  | "ratingBlitzLastRatedAt"
  | "ratingRapidLastRatedAt";

export type RatedUserState = {
  ratingBullet: number;
  ratingBulletDeviation: number;
  ratingBulletVolatility: number;
  ratingBulletLastRatedAt: Date | null;
  ratingBlitz: number;
  ratingBlitzDeviation: number;
  ratingBlitzVolatility: number;
  ratingBlitzLastRatedAt: Date | null;
  ratingRapid: number;
  ratingRapidDeviation: number;
  ratingRapidVolatility: number;
  ratingRapidLastRatedAt: Date | null;
};

export type CategoryRatingState = {
  rating: number;
  deviation: number;
  volatility: number;
  lastRatedAt: Date | null;
  provisional: boolean;
};

export type RatingAdjustment = {
  whiteBefore: number;
  whiteAfter: number;
  whiteDelta: number;
  whiteBeforeDeviation: number;
  whiteAfterDeviation: number;
  whiteAfterVolatility: number;
  whiteProvisional: boolean;
  blackBefore: number;
  blackAfter: number;
  blackDelta: number;
  blackBeforeDeviation: number;
  blackAfterDeviation: number;
  blackAfterVolatility: number;
  blackProvisional: boolean;
};

export const RATING_INITIAL = 1500;
export const RATING_INITIAL_DEVIATION = 250;
export const RATING_INITIAL_VOLATILITY = 0.06;
export const RATING_PROVISIONAL_DEVIATION = 110;

const GLICKO2_SCALE = 173.7178;
const GLICKO2_TAU = 0.5;
const GLICKO2_EPSILON = 0.000001;
const RATING_MIN_DEVIATION = 60;
const RATING_MAX_DEVIATION = 250;
const RATING_PERIOD_MS = 24 * 60 * 60 * 1000;

function roundRating(value: number) {
  return Math.round(value);
}

function roundStateFloat(value: number) {
  return Number.parseFloat(value.toFixed(6));
}

function clampDeviation(value: number) {
  return Math.min(RATING_MAX_DEVIATION, Math.max(RATING_MIN_DEVIATION, value));
}

function toMu(rating: number) {
  return (rating - RATING_INITIAL) / GLICKO2_SCALE;
}

function toPhi(deviation: number) {
  return deviation / GLICKO2_SCALE;
}

function fromMu(mu: number) {
  return mu * GLICKO2_SCALE + RATING_INITIAL;
}

function fromPhi(phi: number) {
  return phi * GLICKO2_SCALE;
}

function g(phi: number) {
  return 1 / Math.sqrt(1 + (3 * phi ** 2) / Math.PI ** 2);
}

function expectedScore(mu: number, opponentMu: number, opponentPhi: number) {
  return 1 / (1 + Math.exp(-g(opponentPhi) * (mu - opponentMu)));
}

function getWhiteScore(winnerColor: PlayerColor | null) {
  if (winnerColor === PlayerColor.WHITE) {
    return 1;
  }

  if (winnerColor === PlayerColor.BLACK) {
    return 0;
  }

  return 0.5;
}

function applyInactivityDeviation(state: CategoryRatingState, ratedAt: Date) {
  if (!state.lastRatedAt) {
    return state;
  }

  const elapsedMs = ratedAt.getTime() - state.lastRatedAt.getTime();
  if (elapsedMs <= 0) {
    return state;
  }

  const periods = elapsedMs / RATING_PERIOD_MS;
  if (periods <= 0) {
    return state;
  }

  const inflatedPhi = Math.sqrt(toPhi(state.deviation) ** 2 + state.volatility ** 2 * periods);
  const deviation = clampDeviation(fromPhi(inflatedPhi));

  return {
    ...state,
    deviation,
    provisional: deviation > RATING_PROVISIONAL_DEVIATION
  };
}

function solveNewVolatility(phi: number, delta: number, variance: number, volatility: number) {
  const a = Math.log(volatility ** 2);
  const f = (x: number) =>
    (Math.exp(x) * (delta ** 2 - phi ** 2 - variance - Math.exp(x))) /
      (2 * (phi ** 2 + variance + Math.exp(x)) ** 2) -
    (x - a) / GLICKO2_TAU ** 2;

  let aBoundary = a;
  let bBoundary: number;

  if (delta ** 2 > phi ** 2 + variance) {
    bBoundary = Math.log(delta ** 2 - phi ** 2 - variance);
  } else {
    let k = 1;
    while (f(a - k * GLICKO2_TAU) < 0) {
      k += 1;
    }
    bBoundary = a - k * GLICKO2_TAU;
  }

  let fA = f(aBoundary);
  let fB = f(bBoundary);

  while (Math.abs(bBoundary - aBoundary) > GLICKO2_EPSILON) {
    const cBoundary =
      aBoundary + ((aBoundary - bBoundary) * fA) / (fB - fA);
    const fC = f(cBoundary);

    if (fC * fB < 0) {
      aBoundary = bBoundary;
      fA = fB;
    } else {
      fA /= 2;
    }

    bBoundary = cBoundary;
    fB = fC;
  }

  return Math.exp(aBoundary / 2);
}

function updateRatingState(
  player: CategoryRatingState,
  opponent: CategoryRatingState,
  score: 0 | 0.5 | 1
) {
  const mu = toMu(player.rating);
  const phi = toPhi(player.deviation);
  const opponentMu = toMu(opponent.rating);
  const opponentPhi = toPhi(opponent.deviation);
  const opponentImpact = g(opponentPhi);
  const expected = expectedScore(mu, opponentMu, opponentPhi);
  const variance = 1 / (opponentImpact ** 2 * expected * (1 - expected));
  const delta = variance * opponentImpact * (score - expected);
  const newVolatility = solveNewVolatility(phi, delta, variance, player.volatility);
  const phiStar = Math.sqrt(phi ** 2 + newVolatility ** 2);
  const newPhi = 1 / Math.sqrt(1 / phiStar ** 2 + 1 / variance);
  const newMu = mu + newPhi ** 2 * opponentImpact * (score - expected);
  const nextDeviation = clampDeviation(fromPhi(newPhi));

  return {
    rating: roundRating(fromMu(newMu)),
    deviation: roundStateFloat(nextDeviation),
    volatility: roundStateFloat(newVolatility),
    provisional: nextDeviation > RATING_PROVISIONAL_DEVIATION
  };
}

export function getRatingField(timeCategory: TimeCategory): RatingField | null {
  if (timeCategory === TimeCategory.BULLET) {
    return "ratingBullet";
  }

  if (timeCategory === TimeCategory.BLITZ) {
    return "ratingBlitz";
  }

  if (timeCategory === TimeCategory.RAPID) {
    return "ratingRapid";
  }

  return null;
}

export function getRatingDeviationField(
  timeCategory: TimeCategory
): RatingDeviationField | null {
  if (timeCategory === TimeCategory.BULLET) {
    return "ratingBulletDeviation";
  }

  if (timeCategory === TimeCategory.BLITZ) {
    return "ratingBlitzDeviation";
  }

  if (timeCategory === TimeCategory.RAPID) {
    return "ratingRapidDeviation";
  }

  return null;
}

export function getRatingVolatilityField(
  timeCategory: TimeCategory
): RatingVolatilityField | null {
  if (timeCategory === TimeCategory.BULLET) {
    return "ratingBulletVolatility";
  }

  if (timeCategory === TimeCategory.BLITZ) {
    return "ratingBlitzVolatility";
  }

  if (timeCategory === TimeCategory.RAPID) {
    return "ratingRapidVolatility";
  }

  return null;
}

export function getRatingLastRatedAtField(
  timeCategory: TimeCategory
): RatingLastRatedAtField | null {
  if (timeCategory === TimeCategory.BULLET) {
    return "ratingBulletLastRatedAt";
  }

  if (timeCategory === TimeCategory.BLITZ) {
    return "ratingBlitzLastRatedAt";
  }

  if (timeCategory === TimeCategory.RAPID) {
    return "ratingRapidLastRatedAt";
  }

  return null;
}

export function getUserRatingByCategory(
  user: {
    ratingBullet: number;
    ratingBlitz: number;
    ratingRapid: number;
  },
  timeCategory: TimeCategory
) {
  const field = getRatingField(timeCategory);

  return field ? user[field] : null;
}

export function getUserRatingStateByCategory(
  user: RatedUserState,
  timeCategory: TimeCategory
): CategoryRatingState | null {
  const ratingField = getRatingField(timeCategory);
  const deviationField = getRatingDeviationField(timeCategory);
  const volatilityField = getRatingVolatilityField(timeCategory);
  const lastRatedAtField = getRatingLastRatedAtField(timeCategory);

  if (!ratingField || !deviationField || !volatilityField || !lastRatedAtField) {
    return null;
  }

  const deviation = clampDeviation(user[deviationField]);

  return {
    rating: user[ratingField],
    deviation,
    volatility: user[volatilityField] > 0 ? user[volatilityField] : RATING_INITIAL_VOLATILITY,
    lastRatedAt: user[lastRatedAtField],
    provisional: deviation > RATING_PROVISIONAL_DEVIATION
  };
}

export function isCategoryRatingProvisional(
  user: RatedUserState,
  timeCategory: TimeCategory
) {
  const state = getUserRatingStateByCategory(user, timeCategory);
  return state ? state.provisional : false;
}

export function buildRatingAdjustment(
  game: {
    rated: boolean;
    timeCategory: TimeCategory;
    players: Array<{
      color: PlayerColor;
      user: RatedUserState | null;
    }>;
  },
  winnerColor: PlayerColor | null,
  ratedAt = new Date()
): RatingAdjustment | null {
  if (!game.rated) {
    return null;
  }

  if (!getRatingField(game.timeCategory)) {
    return null;
  }

  const whitePlayer = game.players.find((player) => player.color === PlayerColor.WHITE);
  const blackPlayer = game.players.find((player) => player.color === PlayerColor.BLACK);

  if (!whitePlayer || !blackPlayer || !whitePlayer.user || !blackPlayer.user) {
    return null;
  }

  const whiteBefore = getUserRatingStateByCategory(whitePlayer.user, game.timeCategory);
  const blackBefore = getUserRatingStateByCategory(blackPlayer.user, game.timeCategory);

  if (!whiteBefore || !blackBefore) {
    return null;
  }

  const whiteForGame = applyInactivityDeviation(whiteBefore, ratedAt);
  const blackForGame = applyInactivityDeviation(blackBefore, ratedAt);
  const whiteScore = getWhiteScore(winnerColor) as 0 | 0.5 | 1;
  const blackScore = (1 - whiteScore) as 0 | 0.5 | 1;
  const whiteAfter = updateRatingState(whiteForGame, blackForGame, whiteScore);
  const blackAfter = updateRatingState(blackForGame, whiteForGame, blackScore);

  return {
    whiteBefore: whiteBefore.rating,
    whiteAfter: whiteAfter.rating,
    whiteDelta: whiteAfter.rating - whiteBefore.rating,
    whiteBeforeDeviation: roundStateFloat(whiteBefore.deviation),
    whiteAfterDeviation: whiteAfter.deviation,
    whiteAfterVolatility: whiteAfter.volatility,
    whiteProvisional: whiteAfter.provisional,
    blackBefore: blackBefore.rating,
    blackAfter: blackAfter.rating,
    blackDelta: blackAfter.rating - blackBefore.rating,
    blackBeforeDeviation: roundStateFloat(blackBefore.deviation),
    blackAfterDeviation: blackAfter.deviation,
    blackAfterVolatility: blackAfter.volatility,
    blackProvisional: blackAfter.provisional
  };
}

export async function applyRatingAdjustment(
  tx: Prisma.TransactionClient,
  game: {
    rated: boolean;
    timeCategory: TimeCategory;
    players: Array<{
      color: PlayerColor;
      userId: string | null;
      user: RatedUserState | null;
    }>;
  },
  winnerColor: PlayerColor | null,
  ratedAt = new Date()
) {
  const ratingField = getRatingField(game.timeCategory);
  const deviationField = getRatingDeviationField(game.timeCategory);
  const volatilityField = getRatingVolatilityField(game.timeCategory);
  const lastRatedAtField = getRatingLastRatedAtField(game.timeCategory);
  const ratingAdjustment = buildRatingAdjustment(game, winnerColor, ratedAt);

  if (
    !ratingField ||
    !deviationField ||
    !volatilityField ||
    !lastRatedAtField ||
    !ratingAdjustment
  ) {
    return null;
  }

  const whitePlayer = game.players.find((player) => player.color === PlayerColor.WHITE);
  const blackPlayer = game.players.find((player) => player.color === PlayerColor.BLACK);

  if (!whitePlayer || !blackPlayer || !whitePlayer.userId || !blackPlayer.userId) {
    return null;
  }

  await Promise.all([
    tx.user.update({
      where: {
        id: whitePlayer.userId
      },
      data: {
        [ratingField]: ratingAdjustment.whiteAfter,
        [deviationField]: ratingAdjustment.whiteAfterDeviation,
        [volatilityField]: ratingAdjustment.whiteAfterVolatility,
        [lastRatedAtField]: ratedAt
      }
    }),
    tx.user.update({
      where: {
        id: blackPlayer.userId
      },
      data: {
        [ratingField]: ratingAdjustment.blackAfter,
        [deviationField]: ratingAdjustment.blackAfterDeviation,
        [volatilityField]: ratingAdjustment.blackAfterVolatility,
        [lastRatedAtField]: ratedAt
      }
    })
  ]);

  return ratingAdjustment;
}
