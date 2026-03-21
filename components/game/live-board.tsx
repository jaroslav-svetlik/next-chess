"use client";

import { Chess } from "chess.js";
import { useEffect, useMemo, useState } from "react";

import { ChessPieceSvg } from "@/components/game/chess-piece-svg";

type BoardPiece = {
  square: string;
  type: "p" | "n" | "b" | "r" | "q" | "k";
  color: "w" | "b";
};

type LegalMove = {
  from: string;
  to: string;
  san: string;
  lan: string;
  promotion?: "p" | "n" | "b" | "r" | "q" | "k";
};

type PlayerState = {
  id: string;
  userId: string | null;
  color: "WHITE" | "BLACK";
  timeRemainingMs: number;
  isConnected: boolean;
  name: string;
  rating: number | null;
  ratingDelta: number | null;
  ratingAfter: number | null;
};

type MoveRecord = {
  id: string;
  ply: number;
  san: string;
  uci: string;
  from: string;
  to: string;
  createdAt: string;
};

type CapturedState = {
  white: Array<"p" | "n" | "b" | "r" | "q" | "k">;
  black: Array<"p" | "n" | "b" | "r" | "q" | "k">;
};

type LiveBoardProps = {
  fen: string;
  board: Array<Array<BoardPiece | null>>;
  whitePlayer: PlayerState | null;
  blackPlayer: PlayerState | null;
  controlLabel: string;
  moves: MoveRecord[];
  legalMoves: LegalMove[];
  turnColor: "WHITE" | "BLACK";
  currentPlayerColor: "WHITE" | "BLACK" | null;
  isSubmittingMove: boolean;
  inCheck: boolean;
  rated: boolean;
  status: "ACTIVE" | "FINISHED" | "CANCELLED";
  result: string | null;
  turnStartedAt: string | null;
  openingWindowEndsAt: string | null;
  openingMovesRequired: number;
  lastMove: {
    from: string;
    to: string;
    san: string;
  } | null;
  captured: CapturedState;
  onSubmitMove: (move: LegalMove) => Promise<void>;
  onResign: () => Promise<void>;
};

type PendingPromotion = {
  from: string;
  to: string;
  moves: LegalMove[];
  mode: "move" | "premove";
};

type QueuedPremove = {
  from: string;
  to: string;
  promotion?: "p" | "n" | "b" | "r" | "q" | "k";
};

type BoardArrow = {
  from: string;
  to: string;
};

const MAX_PREMOVES = 10;

function buildPremovePreviewState(
  fen: string,
  clientColor: "w" | "b",
  queuedPremoves: QueuedPremove[]
) {
  const chess = new Chess();
  const fenParts = fen.split(" ");
  fenParts[1] = clientColor;
  chess.load(fenParts.join(" "));

  const acceptedPremoves: QueuedPremove[] = [];

  for (const premove of queuedPremoves) {
    try {
      chess.move({
        from: premove.from,
        to: premove.to,
        promotion: premove.promotion
      });
      acceptedPremoves.push(premove);

      const nextFenParts = chess.fen().split(" ");
      nextFenParts[1] = clientColor;
      chess.load(nextFenParts.join(" "));
    } catch {
      break;
    }
  }

  return {
    chess,
    acceptedPremoves
  };
}

function chessToBoardMatrix(chess: Chess): Array<Array<BoardPiece | null>> {
  return chess.board().map((row, rowIndex) => {
    return row.map((piece, columnIndex) => {
      if (!piece) {
        return null;
      }

      return {
        square: getSquare(rowIndex, columnIndex),
        type: piece.type,
        color: piece.color
      };
    });
  });
}

function formatResult(result: string | null) {
  if (!result) {
    return null;
  }

  return result.replaceAll("_", " ");
}

function getClientColor(currentPlayerColor: "WHITE" | "BLACK" | null) {
  if (currentPlayerColor === "WHITE") {
    return "w";
  }

  if (currentPlayerColor === "BLACK") {
    return "b";
  }

  return null;
}

function getSquare(rowIndex: number, columnIndex: number) {
  return `${String.fromCharCode(97 + columnIndex)}${8 - rowIndex}`;
}

function parseSquare(square: string) {
  return {
    columnIndex: square.charCodeAt(0) - 97,
    rowIndex: 8 - Number(square[1])
  };
}

function getDisplayFileLabel(columnIndex: number, isBlackPerspective: boolean) {
  const fileIndex = isBlackPerspective ? 7 - columnIndex : columnIndex;
  return String.fromCharCode(97 + fileIndex);
}

function getDisplayRankLabel(rowIndex: number, isBlackPerspective: boolean) {
  return isBlackPerspective ? rowIndex + 1 : 8 - rowIndex;
}

function useClockState(
  whitePlayer: PlayerState | null,
  blackPlayer: PlayerState | null,
  turnColor: "WHITE" | "BLACK",
  turnStartedAt: string | null,
  status: "ACTIVE" | "FINISHED" | "CANCELLED"
) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (status !== "ACTIVE") {
      return;
    }

    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [status]);

  const elapsed = turnStartedAt ? Math.max(0, now - new Date(turnStartedAt).getTime()) : 0;
  const whiteTime =
    turnColor === "WHITE" && status === "ACTIVE"
      ? Math.max(0, (whitePlayer?.timeRemainingMs ?? 0) - elapsed)
      : whitePlayer?.timeRemainingMs ?? 0;
  const blackTime =
    turnColor === "BLACK" && status === "ACTIVE"
      ? Math.max(0, (blackPlayer?.timeRemainingMs ?? 0) - elapsed)
      : blackPlayer?.timeRemainingMs ?? 0;

  return {
    whiteTime,
    blackTime
  };
}

function formatClock(timeRemainingMs: number) {
  const totalSeconds = Math.floor(Math.max(0, timeRemainingMs) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function useOpeningCountdown(
  openingWindowEndsAt: string | null,
  openingMovesRequired: number,
  status: "ACTIVE" | "FINISHED" | "CANCELLED"
) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!openingWindowEndsAt || openingMovesRequired <= 0 || status !== "ACTIVE") {
      return;
    }

    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [openingMovesRequired, openingWindowEndsAt, status]);

  if (!openingWindowEndsAt || openingMovesRequired <= 0 || status !== "ACTIVE") {
    return null;
  }

  return Math.max(0, new Date(openingWindowEndsAt).getTime() - now);
}

function displayPlayerName(
  player: PlayerState | null,
  fallback: string,
  color: "WHITE" | "BLACK"
) {
  if (!player) {
    return fallback;
  }

  return player.name === "Anonymous"
    ? `Anonymous ${color === "WHITE" ? "White" : "Black"}`
    : player.name;
}

function formatRatingDelta(value: number | null) {
  if (value === null || value === 0) {
    return null;
  }

  return value > 0 ? `+${value}` : `${value}`;
}

export function LiveBoard({
  fen,
  board,
  whitePlayer,
  blackPlayer,
  controlLabel,
  moves,
  legalMoves,
  turnColor,
  currentPlayerColor,
  isSubmittingMove,
  inCheck,
  rated,
  status,
  result,
  turnStartedAt,
  openingWindowEndsAt,
  openingMovesRequired,
  lastMove,
  captured,
  onSubmitMove,
  onResign
}: LiveBoardProps) {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [dragSource, setDragSource] = useState<string | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);
  const [queuedPremoves, setQueuedPremoves] = useState<QueuedPremove[]>([]);
  const [markedSquares, setMarkedSquares] = useState<string[]>([]);
  const [drawnArrows, setDrawnArrows] = useState<BoardArrow[]>([]);
  const [annotationStart, setAnnotationStart] = useState<string | null>(null);
  const [annotationHover, setAnnotationHover] = useState<string | null>(null);
  const canMove = status === "ACTIVE" && currentPlayerColor === turnColor && legalMoves.length > 0;
  const canPremove =
    status === "ACTIVE" &&
    !!currentPlayerColor &&
    currentPlayerColor !== turnColor &&
    !isSubmittingMove;
  const canInteractWithBoard = canMove || canPremove;
  const clientColor = getClientColor(currentPlayerColor);
  const isBlackPerspective = currentPlayerColor === "BLACK";
  const { whiteTime, blackTime } = useClockState(
    whitePlayer,
    blackPlayer,
    turnColor,
    turnStartedAt,
    status
  );
  const openingCountdownMs = useOpeningCountdown(
    openingWindowEndsAt,
    openingMovesRequired,
    status
  );

  useEffect(() => {
    setSelectedSquare(null);
    setDragSource(null);
    setPendingPromotion(null);
  }, [legalMoves, turnColor, currentPlayerColor, lastMove?.san]);

  useEffect(() => {
    if (status !== "ACTIVE" || !currentPlayerColor) {
      setQueuedPremoves([]);
    }
  }, [currentPlayerColor, status]);

  useEffect(() => {
    function handleWindowMouseUp() {
      setAnnotationStart(null);
      setAnnotationHover(null);
    }

    window.addEventListener("mouseup", handleWindowMouseUp);

    return () => {
      window.removeEventListener("mouseup", handleWindowMouseUp);
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      clearAnnotations();
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const groupedMoves = useMemo(() => {
    const rows: Array<{ turn: number; white?: string; black?: string }> = [];

    for (const move of moves) {
      const index = Math.ceil(move.ply / 2) - 1;
      const row = rows[index] ?? { turn: index + 1 };

      if (move.ply % 2 === 1) {
        row.white = move.san;
      } else {
        row.black = move.san;
      }

      rows[index] = row;
    }

    return rows;
  }, [moves]);

  const movesBySource = useMemo(() => {
    return legalMoves.reduce<Record<string, LegalMove[]>>((accumulator, move) => {
      accumulator[move.from] ??= [];
      accumulator[move.from].push(move);
      return accumulator;
    }, {});
  }, [legalMoves]);
  const premovePreview = useMemo(() => {
    if (!fen || !clientColor || !canPremove) {
      return {
        previewBoard: null as Array<Array<BoardPiece | null>> | null,
        movesBySource: {} as Record<string, LegalMove[]>,
        acceptedPremoves: [] as QueuedPremove[]
      };
    }

    try {
      const preview = buildPremovePreviewState(fen, clientColor, queuedPremoves);
      const movesBySource = preview.chess.moves({ verbose: true }).reduce<Record<string, LegalMove[]>>(
        (accumulator, move) => {
          const legalMove: LegalMove = {
            from: move.from,
            to: move.to,
            san: move.san,
            lan: `${move.from}${move.to}${move.promotion ?? ""}`,
            promotion: move.promotion as LegalMove["promotion"] | undefined
          };

          accumulator[move.from] ??= [];
          accumulator[move.from].push(legalMove);
          return accumulator;
        },
        {}
      );

      return {
        previewBoard: chessToBoardMatrix(preview.chess),
        movesBySource,
        acceptedPremoves: preview.acceptedPremoves
      };
    } catch {
      return {
        previewBoard: null as Array<Array<BoardPiece | null>> | null,
        movesBySource: {} as Record<string, LegalMove[]>,
        acceptedPremoves: [] as QueuedPremove[]
      };
    }
  }, [canPremove, clientColor, fen, queuedPremoves]);
  const activeQueuedPremoves = canPremove ? premovePreview.acceptedPremoves : queuedPremoves;
  const activeMovesBySource =
    canMove ? movesBySource : canPremove ? premovePreview.movesBySource : {};
  const renderedBoard =
    canPremove && activeQueuedPremoves.length && premovePreview.previewBoard
      ? premovePreview.previewBoard
      : board;

  const interactionSource = dragSource ?? selectedSquare;
  const highlightedTargets = useMemo(() => {
    const source = interactionSource;
    if (!source) {
      return new Set<string>();
    }

    return new Set((activeMovesBySource[source] ?? []).map((move) => move.to));
  }, [activeMovesBySource, interactionSource]);

  const boardTiles = useMemo(() => {
    return Array.from({ length: 64 }, (_, index) => {
      const displayRowIndex = Math.floor(index / 8);
      const displayColumnIndex = index % 8;
      const sourceRowIndex = isBlackPerspective ? 7 - displayRowIndex : displayRowIndex;
      const sourceColumnIndex = isBlackPerspective ? 7 - displayColumnIndex : displayColumnIndex;
      const piece = renderedBoard[sourceRowIndex]?.[sourceColumnIndex] ?? null;
      const square = getSquare(sourceRowIndex, sourceColumnIndex);

      return {
        piece,
        square,
        displayRowIndex,
        displayColumnIndex,
        showRank: displayColumnIndex === 0,
        showFile: displayRowIndex === 7,
        rankLabel: getDisplayRankLabel(displayRowIndex, isBlackPerspective),
        fileLabel: getDisplayFileLabel(displayColumnIndex, isBlackPerspective),
        isLight: (sourceRowIndex + sourceColumnIndex) % 2 === 0
      };
    });
  }, [isBlackPerspective, renderedBoard]);
  const squareDisplayMap = useMemo(() => {
    return boardTiles.reduce<Record<string, { row: number; column: number }>>((accumulator, tile) => {
      accumulator[tile.square] = {
        row: tile.displayRowIndex,
        column: tile.displayColumnIndex
      };
      return accumulator;
    }, {});
  }, [boardTiles]);
  const annotationArrows = useMemo(() => {
    return drawnArrows
      .map((arrow) => {
        const from = squareDisplayMap[arrow.from];
        const to = squareDisplayMap[arrow.to];

        if (!from || !to) {
          return null;
        }

        return {
          key: `${arrow.from}-${arrow.to}`,
          x1: from.column * 12.5 + 6.25,
          y1: from.row * 12.5 + 6.25,
          x2: to.column * 12.5 + 6.25,
          y2: to.row * 12.5 + 6.25
        };
      })
      .filter((arrow): arrow is { key: string; x1: number; y1: number; x2: number; y2: number } => {
        return !!arrow;
      });
  }, [drawnArrows, squareDisplayMap]);
  const previewArrow = useMemo(() => {
    if (!annotationStart || !annotationHover || annotationStart === annotationHover) {
      return null;
    }

    const from = squareDisplayMap[annotationStart];
    const to = squareDisplayMap[annotationHover];

    if (!from || !to) {
      return null;
    }

    return {
      x1: from.column * 12.5 + 6.25,
      y1: from.row * 12.5 + 6.25,
      x2: to.column * 12.5 + 6.25,
      y2: to.row * 12.5 + 6.25
    };
  }, [annotationHover, annotationStart, squareDisplayMap]);

  const topPlayer = isBlackPerspective
    ? { label: "White", player: whitePlayer, time: whiteTime, turn: turnColor === "WHITE", capturedPieces: captured.white, capturedColor: "b" as const, fallback: "Waiting...", color: "WHITE" as const }
    : { label: "Black", player: blackPlayer, time: blackTime, turn: turnColor === "BLACK", capturedPieces: captured.white, capturedColor: "b" as const, fallback: "Waiting...", color: "BLACK" as const };
  const bottomPlayer = isBlackPerspective
    ? { label: "Black", player: blackPlayer, time: blackTime, turn: turnColor === "BLACK", capturedPieces: captured.black, capturedColor: "w" as const, fallback: "Waiting...", color: "BLACK" as const }
    : { label: "White", player: whitePlayer, time: whiteTime, turn: turnColor === "WHITE", capturedPieces: captured.black, capturedColor: "w" as const, fallback: "Waiting...", color: "WHITE" as const };
  const topRatedPlayer = topPlayer.player;
  const bottomRatedPlayer = bottomPlayer.player;
  const openingCountdownLabel =
    openingCountdownMs !== null ? formatClock(openingCountdownMs) : null;
  const openingPlayerLabel = turnColor === "WHITE" ? "White" : "Black";
  const openingInstruction =
    moves.length === 0
      ? `${openingPlayerLabel} must make the first move`
      : `${openingPlayerLabel} must answer with the first reply`;
  const promotionChoices = useMemo(() => {
    if (!pendingPromotion) {
      return [];
    }

    const priority = ["q", "n", "r", "b"];

    return [...pendingPromotion.moves].sort((left, right) => {
      return priority.indexOf(left.promotion ?? "q") - priority.indexOf(right.promotion ?? "q");
    });
  }, [pendingPromotion]);
  const promotionPosition = useMemo(() => {
    if (!pendingPromotion) {
      return null;
    }

    const targetSquare = parseSquare(pendingPromotion.to);
    const displayColumnIndex = isBlackPerspective
      ? 7 - targetSquare.columnIndex
      : targetSquare.columnIndex;
    const displayRowIndex = isBlackPerspective ? 7 - targetSquare.rowIndex : targetSquare.rowIndex;

    return {
      square: pendingPromotion.to,
      displayColumnIndex,
      direction: displayRowIndex < 4 ? "down" : "up"
    } as const;
  }, [isBlackPerspective, pendingPromotion]);
  const queuedPremoveLabel = activeQueuedPremoves.length
    ? activeQueuedPremoves
        .map((move) => {
          return `${move.from}-${move.to}${move.promotion ? `=${move.promotion.toUpperCase()}` : ""}`;
        })
        .join(", ")
    : null;

  function isOwnPiece(piece: BoardPiece | null) {
    return !!piece && !!clientColor && piece.color === clientColor && canInteractWithBoard;
  }

  function clearQueuedPremove() {
    setQueuedPremoves([]);
    setSelectedSquare(null);
    setDragSource(null);
    setPendingPromotion(null);
  }

  function clearAnnotations() {
    setMarkedSquares([]);
    setDrawnArrows([]);
    setAnnotationStart(null);
    setAnnotationHover(null);
  }

  function toggleMarkedSquare(square: string) {
    setMarkedSquares((current) => {
      return current.includes(square)
        ? current.filter((entry) => entry !== square)
        : [...current, square];
    });
  }

  function toggleArrow(from: string, to: string) {
    const key = `${from}-${to}`;

    setDrawnArrows((current) => {
      return current.some((arrow) => `${arrow.from}-${arrow.to}` === key)
        ? current.filter((arrow) => `${arrow.from}-${arrow.to}` !== key)
        : [...current, { from, to }];
    });
  }

  function getMatchingMoves(from: string, to: string) {
    return (activeMovesBySource[from] ?? []).filter((move) => move.to === to);
  }

  async function submitBoardMove(move: LegalMove) {
    setSelectedSquare(null);
    setDragSource(null);
    setPendingPromotion(null);
    if (canMove) {
      await onSubmitMove(move);
      return;
    }

    setQueuedPremoves((current) => {
      const nextQueue = [
        ...activeQueuedPremoves,
        {
          from: move.from,
          to: move.to,
          promotion: move.promotion
        }
      ];

      return nextQueue.slice(0, MAX_PREMOVES);
    });
  }

  async function tryMove(from: string, to: string) {
    const matchingMoves = getMatchingMoves(from, to);
    if (!matchingMoves.length) {
      return false;
    }

    if (matchingMoves.length > 1) {
      setPendingPromotion({
        from,
        to,
        moves: matchingMoves,
        mode: canMove ? "move" : "premove"
      });
      return true;
    }

    await submitBoardMove(matchingMoves[0]);
    return true;
  }

  async function handleSquareClick(square: string, piece: BoardPiece | null) {
    if (drawnArrows.length || markedSquares.length) {
      clearAnnotations();
    }

    if (!canInteractWithBoard || isSubmittingMove || pendingPromotion) {
      return;
    }

    if (!selectedSquare) {
      if (isOwnPiece(piece)) {
        setSelectedSquare(square);
      }
      return;
    }

    if (selectedSquare === square) {
      setSelectedSquare(null);
      return;
    }

    const moved = await tryMove(selectedSquare, square);
    if (moved) {
      return;
    }

    if (isOwnPiece(piece)) {
      setSelectedSquare(square);
      return;
    }

    setSelectedSquare(null);
  }

  function handleDragStart(square: string) {
    if (!canInteractWithBoard || isSubmittingMove || pendingPromotion) {
      return;
    }

    setDragSource(square);
    setSelectedSquare(square);
  }

  function handleDragEnd() {
    setDragSource(null);
  }

  async function handleDrop(targetSquare: string) {
    if (!dragSource || isSubmittingMove || pendingPromotion) {
      return;
    }

    const source = dragSource;
    setDragSource(null);
    await tryMove(source, targetSquare);
  }

  function handleAnnotationStart(square: string) {
    setAnnotationStart(square);
    setAnnotationHover(square);
    setSelectedSquare(null);
    setDragSource(null);
    setPendingPromotion(null);
  }

  function handleAnnotationEnd(square: string) {
    if (!annotationStart) {
      return;
    }

    if (annotationStart === square) {
      toggleMarkedSquare(square);
    } else {
      toggleArrow(annotationStart, square);
    }

    setAnnotationStart(null);
    setAnnotationHover(null);
  }

  useEffect(() => {
    if (!activeQueuedPremoves.length || !canMove || isSubmittingMove) {
      return;
    }

    const [nextPremove, ...remainingPremoves] = activeQueuedPremoves;
    const matchingMove = legalMoves.find((move) => {
      return (
        move.from === nextPremove.from &&
        move.to === nextPremove.to &&
        (move.promotion ?? undefined) === (nextPremove.promotion ?? undefined)
      );
    });

    if (!matchingMove) {
      clearQueuedPremove();
      return;
    }

    setQueuedPremoves(remainingPremoves);
    void onSubmitMove(matchingMove);
  }, [activeQueuedPremoves, canMove, isSubmittingMove, legalMoves, onSubmitMove]);

  return (
    <div className="game-grid">
      <section className="board-shell">
        {openingCountdownLabel ? (
          <div className="opening-banner">
            <div className="opening-banner-copy">
              <strong>Opening Countdown</strong>
              <span>
                {openingInstruction} in the next {openingCountdownLabel} or the game is aborted.
              </span>
            </div>
            <div className="opening-banner-timer">{openingCountdownLabel}</div>
          </div>
        ) : null}

        <div className="player-card">
          <div className="player-row">
            <div>
              <div className="panel-kicker">{topPlayer.label}</div>
              <strong>{displayPlayerName(topPlayer.player, topPlayer.fallback, topPlayer.color)}</strong>
              {topRatedPlayer && topRatedPlayer.rating !== null ? (
                <div className="player-rating-line">
                  <span>{topRatedPlayer.rating}</span>
                  {rated && topRatedPlayer.ratingDelta !== null ? (
                    <span className={`rating-delta ${topRatedPlayer.ratingDelta >= 0 ? "up" : "down"}`}>
                      {formatRatingDelta(topRatedPlayer.ratingDelta)}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className={`clock ${topPlayer.turn ? "live" : ""}`}>
              {formatClock(topPlayer.time)}
            </div>
          </div>
          <div className="captured-row">
            {topPlayer.capturedPieces.map((piece, index) => (
              <span className="captured-piece" key={`${topPlayer.label.toLowerCase()}-captured-${piece}-${index}`}>
                <ChessPieceSvg color={topPlayer.capturedColor} type={piece} />
              </span>
            ))}
          </div>
        </div>

        <div
          className={`board-frame ${canInteractWithBoard ? "interactive" : ""} ${dragSource ? "dragging" : ""} ${canPremove ? "premove-mode" : ""}`}
          onContextMenu={(event) => {
            event.preventDefault();
          }}
        >
          <svg aria-hidden="true" className="board-annotations" viewBox="0 0 100 100">
            <defs>
              <marker
                id="board-arrowhead"
                markerHeight="6"
                markerUnits="strokeWidth"
                markerWidth="6"
                orient="auto"
                refX="5.3"
                refY="3"
              >
                <path d="M0,0 L6,3 L0,6 Z" fill="rgba(118, 255, 162, 0.82)" />
              </marker>
            </defs>

            {annotationArrows.map((arrow) => (
              <line
                className="board-arrow"
                key={arrow.key}
                markerEnd="url(#board-arrowhead)"
                x1={arrow.x1}
                x2={arrow.x2}
                y1={arrow.y1}
                y2={arrow.y2}
              />
            ))}

            {previewArrow ? (
              <line
                className="board-arrow preview"
                markerEnd="url(#board-arrowhead)"
                x1={previewArrow.x1}
                x2={previewArrow.x2}
                y1={previewArrow.y1}
                y2={previewArrow.y2}
              />
            ) : null}
          </svg>

          {boardTiles.map((tile) => {
              const piece = tile.piece;
              const square = tile.square;
              const squareIsSelected = selectedSquare === square;
              const squareIsTarget = highlightedTargets.has(square);
              const squareIsPremoveTarget = canPremove && squareIsTarget;
              const squareIsPremoveSelected = canPremove && squareIsSelected;
              const squareIsDraggable = isOwnPiece(piece);
              const squareIsLastMove = lastMove?.from === square || lastMove?.to === square;
              const isPromotionSquare = promotionPosition?.square === square;
              const squareIsQueuedPremoveSource = activeQueuedPremoves.some(
                (move) => move.from === square
              );
              const squareIsQueuedPremoveTarget = activeQueuedPremoves.some(
                (move) => move.to === square
              );
              const squareIsCheckedKing =
                status === "ACTIVE" &&
                inCheck &&
                piece?.type === "k" &&
                ((turnColor === "WHITE" && piece.color === "w") ||
                  (turnColor === "BLACK" && piece.color === "b"));
              const squareIsMarked = markedSquares.includes(square);

              return (
                <div
                  key={square}
                  className={`board-tile ${tile.isLight ? "light" : "dark"} ${squareIsSelected ? "selected" : ""} ${squareIsTarget ? "target" : ""} ${squareIsDraggable ? "movable" : ""} ${squareIsLastMove ? "last-move" : ""} ${isPromotionSquare ? "promotion-host" : ""} ${squareIsCheckedKing ? "checked-king" : ""} ${squareIsQueuedPremoveSource ? "queued-premove-source" : ""} ${squareIsQueuedPremoveTarget ? "queued-premove-target" : ""} ${squareIsPremoveTarget ? "premove-target" : ""} ${squareIsPremoveSelected ? "premove-selected" : ""} ${squareIsMarked ? "marked-square" : ""}`}
                  onClick={() => {
                    void handleSquareClick(square, piece);
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault();
                  }}
                  onDragOver={(event) => {
                    if (dragSource && highlightedTargets.has(square)) {
                      event.preventDefault();
                    }
                  }}
                  onMouseDown={(event) => {
                    if (event.button !== 2) {
                      return;
                    }

                    event.preventDefault();
                    handleAnnotationStart(square);
                  }}
                  onMouseEnter={() => {
                    if (!annotationStart) {
                      return;
                    }

                    setAnnotationHover(square);
                  }}
                  onMouseUp={(event) => {
                    if (event.button !== 2) {
                      return;
                    }

                    event.preventDefault();
                    handleAnnotationEnd(square);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    void handleDrop(square);
                  }}
                  title={square}
                >
                  {tile.showRank ? <span className="board-rank">{tile.rankLabel}</span> : null}
                  {tile.showFile ? <span className="board-file">{tile.fileLabel}</span> : null}
                  {piece ? (
                    <span
                      className={`board-piece ${squareIsDraggable ? "draggable" : ""}`}
                      draggable={squareIsDraggable && !isSubmittingMove}
                      onDragEnd={handleDragEnd}
                      onDragStart={(event) => {
                        handleDragStart(square);
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", square);
                      }}
                    >
                      <ChessPieceSvg color={piece.color} type={piece.type} />
                    </span>
                  ) : null}

                  {isPromotionSquare ? (
                    <div
                      className={`promotion-tile-picker promotion-tile-picker-${promotionPosition.direction}`}
                    >
                      {promotionChoices.map((move) => (
                        <button
                          aria-label={`Promote to ${move.promotion ?? "q"}`}
                          className="promotion-square"
                          key={move.promotion ?? move.lan}
                          onClick={() => {
                            void submitBoardMove(move);
                          }}
                          type="button"
                        >
                          <ChessPieceSvg
                            color={(clientColor ?? "w") as "w" | "b"}
                            type={(move.promotion ?? "q") as "p" | "n" | "b" | "r" | "q" | "k"}
                          />
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}

          {pendingPromotion ? (
            <>
              <button
                aria-label={`Close ${pendingPromotion.mode} choices`}
                className="promotion-backdrop"
                onClick={() => {
                  setPendingPromotion(null);
                  setSelectedSquare(null);
                  setDragSource(null);
                }}
                type="button"
              />
            </>
          ) : null}
        </div>

        <div className="player-card">
          <div className="player-row">
            <div>
              <div className="panel-kicker">{bottomPlayer.label}</div>
              <strong>
                {displayPlayerName(bottomPlayer.player, bottomPlayer.fallback, bottomPlayer.color)}
              </strong>
              {bottomRatedPlayer && bottomRatedPlayer.rating !== null ? (
                <div className="player-rating-line">
                  <span>{bottomRatedPlayer.rating}</span>
                  {rated && bottomRatedPlayer.ratingDelta !== null ? (
                    <span
                      className={`rating-delta ${bottomRatedPlayer.ratingDelta >= 0 ? "up" : "down"}`}
                    >
                      {formatRatingDelta(bottomRatedPlayer.ratingDelta)}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className={`clock ${bottomPlayer.turn ? "live" : ""}`}>
              {formatClock(bottomPlayer.time)}
            </div>
          </div>
          <div className="captured-row">
            {bottomPlayer.capturedPieces.map((piece, index) => (
              <span className="captured-piece" key={`${bottomPlayer.label.toLowerCase()}-captured-${piece}-${index}`}>
                <ChessPieceSvg color={bottomPlayer.capturedColor} type={piece} />
              </span>
            ))}
          </div>
        </div>
      </section>

      <aside className="glass-panel game-side-panel">
        <div className={`status-banner ${status !== "ACTIVE" ? "finished" : ""}`}>
          <span>{status === "ACTIVE" ? `${turnColor} to move` : formatResult(result) ?? "Game finished"}</span>
          {inCheck && status === "ACTIVE" ? <strong>Check</strong> : null}
        </div>

        <div className="game-card-header">
          <div>
            <div className="panel-kicker">Live Game</div>
            <h2 className="panel-title">Match Desk</h2>
          </div>
          <span className="pill">{controlLabel}</span>
        </div>

        <div className="detail-stack">
          <div className="pill">{rated ? "Rated" : "Casual"}</div>
          <div className="pill">Turn: {turnColor}</div>
          {currentPlayerColor ? <div className="pill">You: {currentPlayerColor}</div> : null}
          {lastMove ? <div className="pill">Last move: {lastMove.san}</div> : null}
          {activeQueuedPremoves.length ? (
            <div className="pill">Premoves: {activeQueuedPremoves.length}</div>
          ) : null}
        </div>

        {openingCountdownMs !== null ? (
          <div className="notice opening-side-note">
            Opening phase: {openingInstruction.toLowerCase()} in {openingCountdownLabel} or the
            game is aborted automatically.
          </div>
        ) : null}

        {canMove ? (
          <p className="panel-copy">
            Drag your piece or tap piece then target. Legal destinations are highlighted and
            promotion opens a picker.
          </p>
        ) : canPremove ? (
          <p className="panel-copy">
            Your turn has not started yet. You can queue up to {MAX_PREMOVES} premoves. They fire
            in order if they stay legal. Use clear premove to cancel the queue.
          </p>
        ) : (
          <p className="panel-copy">
            {status === "ACTIVE"
              ? currentPlayerColor
                ? "Waiting for your opponent. The board stays in sync live."
                : "You are currently spectating this room."
              : "This game is finished."}
          </p>
        )}

        <div className="action-row">
          <button className="secondary-button" disabled={status !== "ACTIVE" || isSubmittingMove} onClick={() => void onResign()} type="button">
            Resign
          </button>
          {activeQueuedPremoves.length ? (
            <button
              className="secondary-button premove-clear-button"
              disabled={isSubmittingMove}
              onClick={clearQueuedPremove}
              type="button"
            >
              Clear premove
            </button>
          ) : null}
          {drawnArrows.length || markedSquares.length ? (
            <button
              className="secondary-button"
              disabled={isSubmittingMove}
              onClick={clearAnnotations}
              type="button"
            >
              Clear annotations
            </button>
          ) : null}
        </div>

        {queuedPremoveLabel ? <p className="muted premove-queue">{queuedPremoveLabel}</p> : null}
        {drawnArrows.length || markedSquares.length ? (
          <p className="muted premove-queue">
            Draw the same arrow again to remove it, right-click the same square to unmark it, or
            press Esc to clear all annotations.
          </p>
        ) : null}

        <div className="move-list">
          {groupedMoves.length ? (
            groupedMoves.map((row) => (
              <div className="move-row" key={row.turn}>
                <strong>{row.turn}.</strong>
                <span>{row.white ?? "..."}</span>
                <span>{row.black ?? ""}</span>
              </div>
            ))
          ) : (
            <p className="muted">No moves played yet.</p>
          )}
        </div>
      </aside>
    </div>
  );
}
