import { Chess, type Color, type Move as ChessMove, type PieceSymbol, type Square } from "chess.js";
import { GameStatus, PlayerColor } from "@prisma/client";

export type SerializedBoardPiece = {
  square: Square;
  type: PieceSymbol;
  color: Color;
};

export type SerializedLegalMove = {
  from: Square;
  to: Square;
  san: string;
  lan: string;
  promotion?: PieceSymbol;
};

export type SerializedGameOutcome = {
  status: GameStatus;
  result: string | null;
  winnerColor: PlayerColor | null;
  summary: string | null;
};

export function playerColorToChessColor(color: PlayerColor): Color {
  return color === PlayerColor.WHITE ? "w" : "b";
}

export function chessColorToPlayerColor(color: Color): PlayerColor {
  return color === "w" ? PlayerColor.WHITE : PlayerColor.BLACK;
}

export function serializeBoard(fen: string) {
  const chess = new Chess(fen);

  return chess.board().map((row) =>
    row.map((piece) =>
      piece
        ? {
            square: piece.square,
            type: piece.type,
            color: piece.color
          }
        : null
    )
  );
}

export function serializeLegalMoves(fen: string) {
  const chess = new Chess(fen);

  return chess.moves({ verbose: true }).map((move: ChessMove) => ({
    from: move.from,
    to: move.to,
    san: move.san,
    lan: move.lan,
    promotion: move.promotion
  }));
}

export function getTurnColorFromFen(fen: string) {
  const chess = new Chess(fen);

  return chessColorToPlayerColor(chess.turn());
}

export function getPositionFlags(fen: string) {
  const chess = new Chess(fen);

  return {
    inCheck: chess.isCheck(),
    turnColor: chessColorToPlayerColor(chess.turn())
  };
}

export function getCapturedPieces(board: ReturnType<typeof serializeBoard>) {
  const startingCounts = {
    w: { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 },
    b: { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 }
  };

  for (const row of board) {
    for (const piece of row) {
      if (!piece) {
        continue;
      }

      startingCounts[piece.color][piece.type] = Math.max(
        0,
        startingCounts[piece.color][piece.type] - 1
      );
    }
  }

  return {
    white: Object.entries(startingCounts.b).flatMap(([type, count]) =>
      Array.from({ length: count }, () => type as PieceSymbol)
    ),
    black: Object.entries(startingCounts.w).flatMap(([type, count]) =>
      Array.from({ length: count }, () => type as PieceSymbol)
    )
  };
}

export function resolveOutcomeFromFen(fen: string): SerializedGameOutcome {
  const chess = new Chess(fen);

  if (chess.isCheckmate()) {
    const winnerColor = chessColorToPlayerColor(chess.turn() === "w" ? "b" : "w");

    return {
      status: GameStatus.FINISHED,
      result: `${winnerColor.toLowerCase()}_checkmate`,
      winnerColor,
      summary: `${winnerColor === PlayerColor.WHITE ? "White" : "Black"} wins by checkmate.`
    };
  }

  if (chess.isStalemate()) {
    return {
      status: GameStatus.FINISHED,
      result: "draw_stalemate",
      winnerColor: null,
      summary: "Draw by stalemate."
    };
  }

  if (chess.isInsufficientMaterial()) {
    return {
      status: GameStatus.FINISHED,
      result: "draw_insufficient_material",
      winnerColor: null,
      summary: "Draw by insufficient material."
    };
  }

  if (chess.isThreefoldRepetition()) {
    return {
      status: GameStatus.FINISHED,
      result: "draw_threefold_repetition",
      winnerColor: null,
      summary: "Draw by threefold repetition."
    };
  }

  if (chess.isDrawByFiftyMoves()) {
    return {
      status: GameStatus.FINISHED,
      result: "draw_fifty_move_rule",
      winnerColor: null,
      summary: "Draw by fifty-move rule."
    };
  }

  if (chess.isDraw()) {
    return {
      status: GameStatus.FINISHED,
      result: "draw",
      winnerColor: null,
      summary: "Game drawn."
    };
  }

  return {
    status: GameStatus.ACTIVE,
    result: null,
    winnerColor: null,
    summary: null
  };
}
