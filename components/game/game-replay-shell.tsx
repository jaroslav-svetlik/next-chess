"use client";

import Link from "next/link";
import { Chess } from "chess.js";
import { useEffect, useMemo, useState } from "react";

import { ChessPieceSvg } from "@/components/game/chess-piece-svg";
import { getCapturedPieces, getPositionFlags, serializeBoard } from "@/lib/chess-engine";

type ReplayPlayer = {
  id: string;
  userId: string | null;
  guestIdentityId: string | null;
  color: "WHITE" | "BLACK";
  name: string;
  profileId: string | null;
  rating: number | null;
  provisional: boolean;
};

type ReplayMove = {
  id: string;
  ply: number;
  san: string;
  uci: string;
  from: string;
  to: string;
  promotion: string | null;
  createdAt: string;
};

type ReplayData = {
  id: string;
  status: "FINISHED" | "CANCELLED";
  rated: boolean;
  visibility: "PUBLIC" | "PRIVATE";
  format: string;
  control: string;
  result: string | null;
  resultReason: string;
  pgn: string;
  winnerUserId: string | null;
  createdAt: string;
  endedAt: string | null;
  players: ReplayPlayer[];
  moves: ReplayMove[];
};

type GameReplayShellProps = {
  game: ReplayData;
};

function getSquare(rowIndex: number, columnIndex: number) {
  return `${String.fromCharCode(97 + columnIndex)}${8 - rowIndex}`;
}

function getDisplayFileLabel(columnIndex: number, isBlackPerspective: boolean) {
  const fileIndex = isBlackPerspective ? 7 - columnIndex : columnIndex;
  return String.fromCharCode(97 + fileIndex);
}

function getDisplayRankLabel(rowIndex: number, isBlackPerspective: boolean) {
  return isBlackPerspective ? rowIndex + 1 : 8 - rowIndex;
}

function formatEndedAt(value: string | null) {
  if (!value) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatRating(value: number | null, provisional: boolean) {
  if (value === null) {
    return null;
  }

  return provisional ? `${value}?` : `${value}`;
}

function buildReplayPosition(moves: ReplayMove[], ply: number) {
  const chess = new Chess();

  for (const move of moves.slice(0, ply)) {
    chess.move({
      from: move.from,
      to: move.to,
      promotion: (move.promotion ?? undefined) as "q" | "r" | "b" | "n" | undefined
    });
  }

  const fen = chess.fen();
  const board = serializeBoard(fen);
  const { inCheck, turnColor } = getPositionFlags(fen);

  return {
    fen,
    board,
    inCheck,
    turnColor,
    captured: getCapturedPieces(board),
    lastMove: ply > 0 ? moves[ply - 1] : null
  };
}

function buildMoveRows(moves: ReplayMove[]) {
  const rows: Array<{ turn: number; white?: ReplayMove; black?: ReplayMove }> = [];

  for (const move of moves) {
    const index = Math.ceil(move.ply / 2) - 1;
    const row = rows[index] ?? { turn: index + 1 };

    if (move.ply % 2 === 1) {
      row.white = move;
    } else {
      row.black = move;
    }

    rows[index] = row;
  }

  return rows;
}

export function GameReplayShell({ game }: GameReplayShellProps) {
  const [currentPly, setCurrentPly] = useState(game.moves.length);
  const [isBlackPerspective, setIsBlackPerspective] = useState(false);
  const [isAutoplaying, setIsAutoplaying] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") {
        setCurrentPly((current) => Math.max(0, current - 1));
      }

      if (event.key === "ArrowRight") {
        setCurrentPly((current) => Math.min(game.moves.length, current + 1));
      }

      if (event.key === "Home") {
        setCurrentPly(0);
      }

      if (event.key === "End") {
        setCurrentPly(game.moves.length);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [game.moves.length]);

  useEffect(() => {
    if (!isAutoplaying) {
      return;
    }

    if (currentPly >= game.moves.length) {
      setIsAutoplaying(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCurrentPly((current) => Math.min(game.moves.length, current + 1));
    }, 700);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [currentPly, game.moves.length, isAutoplaying]);

  useEffect(() => {
    if (copyFeedback === "idle") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCopyFeedback("idle");
    }, 1500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [copyFeedback]);

  const position = useMemo(() => buildReplayPosition(game.moves, currentPly), [currentPly, game.moves]);
  const groupedMoves = useMemo(() => buildMoveRows(game.moves), [game.moves]);
  const currentMove = currentPly > 0 ? game.moves[currentPly - 1] ?? null : null;
  const whitePlayer = game.players.find((player) => player.color === "WHITE") ?? null;
  const blackPlayer = game.players.find((player) => player.color === "BLACK") ?? null;
  const topPlayer = isBlackPerspective ? whitePlayer : blackPlayer;
  const bottomPlayer = isBlackPerspective ? blackPlayer : whitePlayer;
  const topCaptured = isBlackPerspective ? position.captured.white : position.captured.white;
  const bottomCaptured = isBlackPerspective ? position.captured.black : position.captured.black;

  const boardTiles = useMemo(() => {
    return Array.from({ length: 64 }, (_, index) => {
      const displayRowIndex = Math.floor(index / 8);
      const displayColumnIndex = index % 8;
      const sourceRowIndex = isBlackPerspective ? 7 - displayRowIndex : displayRowIndex;
      const sourceColumnIndex = isBlackPerspective ? 7 - displayColumnIndex : displayColumnIndex;
      const piece = position.board[sourceRowIndex]?.[sourceColumnIndex] ?? null;
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
  }, [isBlackPerspective, position.board]);

  async function handleCopyPgn() {
    try {
      await navigator.clipboard.writeText(game.pgn);
      setCopyFeedback("copied");
    } catch {
      setCopyFeedback("failed");
    }
  }

  return (
    <div className="game-grid archive-page">
      <section className="board-shell">
        <div className="player-card">
          <div className="player-row">
            <div>
              <div className="panel-kicker">{topPlayer?.color ?? "Player"}</div>
              <strong>
                {topPlayer?.profileId ? (
                  <Link className="admin-inline-link" href={`/players/${topPlayer.profileId}`}>
                    {topPlayer.name}
                  </Link>
                ) : (
                  topPlayer?.name ?? "Unknown"
                )}
              </strong>
              {topPlayer?.rating !== null && topPlayer?.rating !== undefined ? (
                <div className="player-rating-line">
                  <span>{formatRating(topPlayer.rating, topPlayer.provisional)}</span>
                </div>
              ) : null}
            </div>
            <div className={`clock ${position.turnColor === topPlayer?.color ? "live" : ""}`}>Replay</div>
          </div>
          <div className="captured-row">
            {topCaptured.map((piece, index) => (
              <span className="captured-piece" key={`top-${piece}-${index}`}>
                <ChessPieceSvg color={isBlackPerspective ? "b" : "b"} type={piece} />
              </span>
            ))}
          </div>
        </div>

        <div className="board-frame archive-board-frame">
          {boardTiles.map((tile) => {
            const squareIsLastMove =
              position.lastMove?.from === tile.square || position.lastMove?.to === tile.square;
            const squareIsCheckedKing =
              position.inCheck &&
              tile.piece?.type === "k" &&
              ((position.turnColor === "WHITE" && tile.piece.color === "w") ||
                (position.turnColor === "BLACK" && tile.piece.color === "b"));

            return (
              <div
                className={`board-tile ${tile.isLight ? "light" : "dark"} ${squareIsLastMove ? "last-move" : ""} ${squareIsCheckedKing ? "checked-king" : ""}`}
                key={tile.square}
              >
                {tile.showRank ? <span className="board-rank">{tile.rankLabel}</span> : null}
                {tile.showFile ? <span className="board-file">{tile.fileLabel}</span> : null}
                {tile.piece ? (
                  <span className="board-piece">
                    <ChessPieceSvg color={tile.piece.color} type={tile.piece.type} />
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="player-card">
          <div className="player-row">
            <div>
              <div className="panel-kicker">{bottomPlayer?.color ?? "Player"}</div>
              <strong>
                {bottomPlayer?.profileId ? (
                  <Link className="admin-inline-link" href={`/players/${bottomPlayer.profileId}`}>
                    {bottomPlayer.name}
                  </Link>
                ) : (
                  bottomPlayer?.name ?? "Unknown"
                )}
              </strong>
              {bottomPlayer?.rating !== null && bottomPlayer?.rating !== undefined ? (
                <div className="player-rating-line">
                  <span>{formatRating(bottomPlayer.rating, bottomPlayer.provisional)}</span>
                </div>
              ) : null}
            </div>
            <div className={`clock ${position.turnColor === bottomPlayer?.color ? "live" : ""}`}>Replay</div>
          </div>
          <div className="captured-row">
            {bottomCaptured.map((piece, index) => (
              <span className="captured-piece" key={`bottom-${piece}-${index}`}>
                <ChessPieceSvg color={isBlackPerspective ? "w" : "w"} type={piece} />
              </span>
            ))}
          </div>
        </div>
      </section>

      <aside className="glass-panel game-side-panel archive-side-panel">
        <div className="status-banner finished">
          <span>{game.resultReason}</span>
          {position.inCheck ? <strong>Check</strong> : null}
        </div>

        <div className="game-card-header">
          <div>
            <div className="panel-kicker">Archive</div>
            <h2 className="panel-title">Replay Desk</h2>
          </div>
          <span className="pill">{game.control}</span>
        </div>

        <div className="detail-stack">
          <div className="pill">{game.format}</div>
          <div className="pill">{game.rated ? "Rated" : "Casual"}</div>
          <div className="pill">{formatEndedAt(game.endedAt)}</div>
          <div className="pill">Move {currentPly}/{game.moves.length}</div>
          {currentMove ? <div className="pill">Current: {currentMove.san}</div> : <div className="pill">Start position</div>}
        </div>

        <div className="archive-actions">
          <button className="secondary-button" onClick={() => setCurrentPly(0)} type="button">
            First
          </button>
          <button
            className="secondary-button"
            onClick={() => setCurrentPly((current) => Math.max(0, current - 1))}
            type="button"
          >
            Prev
          </button>
          <button
            className="secondary-button"
            onClick={() => setCurrentPly((current) => Math.min(game.moves.length, current + 1))}
            type="button"
          >
            Next
          </button>
          <button
            className="secondary-button"
            onClick={() => setCurrentPly(game.moves.length)}
            type="button"
          >
            Last
          </button>
          <button
            className="secondary-button"
            onClick={() => setIsAutoplaying((current) => !current)}
            type="button"
          >
            {isAutoplaying ? "Pause" : "Autoplay"}
          </button>
          <button
            className="secondary-button"
            onClick={() => setIsBlackPerspective((current) => !current)}
            type="button"
          >
            Flip board
          </button>
          <button className="secondary-button" onClick={() => void handleCopyPgn()} type="button">
            {copyFeedback === "copied"
              ? "PGN copied"
              : copyFeedback === "failed"
                ? "Copy failed"
                : "Copy PGN"}
          </button>
        </div>

        <p className="panel-copy">
          Use the controls or keyboard arrows to walk through the game move by move.
        </p>

        {game.pgn ? (
          <pre className="archive-pgn-block">{game.pgn}</pre>
        ) : null}

        <div className="archive-move-table">
          {groupedMoves.map((row) => (
            <div className="archive-move-row" key={row.turn}>
              <span className="archive-move-turn">{row.turn}.</span>
              <button
                className={`archive-move-button${currentPly === row.white?.ply ? " active" : ""}`}
                disabled={!row.white}
                onClick={() => row.white && setCurrentPly(row.white.ply)}
                type="button"
              >
                {row.white?.san ?? "…"}
              </button>
              <button
                className={`archive-move-button${currentPly === row.black?.ply ? " active" : ""}`}
                disabled={!row.black}
                onClick={() => row.black && setCurrentPly(row.black.ply)}
                type="button"
              >
                {row.black?.san ?? ""}
              </button>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
