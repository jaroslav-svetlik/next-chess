import { PlayerColor, Prisma, TimeCategory } from "@prisma/client";

export type RatingField = "ratingBullet" | "ratingBlitz" | "ratingRapid";

export type RatingAdjustment = {
  whiteBefore: number;
  whiteAfter: number;
  whiteDelta: number;
  blackBefore: number;
  blackAfter: number;
  blackDelta: number;
};

const ELO_K_FACTOR = 24;

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

function calculateExpectedScore(playerRating: number, opponentRating: number) {
  return 1 / (1 + 10 ** ((opponentRating - playerRating) / 400));
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

export function buildRatingAdjustment(
  game: {
    rated: boolean;
    timeCategory: TimeCategory;
    players: Array<{
      color: PlayerColor;
      user: {
        ratingBullet: number;
        ratingBlitz: number;
        ratingRapid: number;
      } | null;
    }>;
  },
  winnerColor: PlayerColor | null
): RatingAdjustment | null {
  if (!game.rated) {
    return null;
  }

  const ratingField = getRatingField(game.timeCategory);
  if (!ratingField) {
    return null;
  }

  const whitePlayer = game.players.find((player) => player.color === PlayerColor.WHITE);
  const blackPlayer = game.players.find((player) => player.color === PlayerColor.BLACK);

  if (!whitePlayer || !blackPlayer || !whitePlayer.user || !blackPlayer.user) {
    return null;
  }

  const whiteBefore = whitePlayer.user[ratingField];
  const blackBefore = blackPlayer.user[ratingField];
  const whiteScore = getWhiteScore(winnerColor);
  const whiteExpected = calculateExpectedScore(whiteBefore, blackBefore);
  const whiteDelta = Math.round(ELO_K_FACTOR * (whiteScore - whiteExpected));
  const blackDelta = -whiteDelta;

  return {
    whiteBefore,
    whiteAfter: whiteBefore + whiteDelta,
    whiteDelta,
    blackBefore,
    blackAfter: blackBefore + blackDelta,
    blackDelta
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
      user: {
        ratingBullet: number;
        ratingBlitz: number;
        ratingRapid: number;
      } | null;
    }>;
  },
  winnerColor: PlayerColor | null
) {
  const ratingField = getRatingField(game.timeCategory);
  const ratingAdjustment = buildRatingAdjustment(game, winnerColor);

  if (!ratingField || !ratingAdjustment) {
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
        [ratingField]: ratingAdjustment.whiteAfter
      }
    }),
    tx.user.update({
      where: {
        id: blackPlayer.userId
      },
      data: {
        [ratingField]: ratingAdjustment.blackAfter
      }
    })
  ]);

  return ratingAdjustment;
}
