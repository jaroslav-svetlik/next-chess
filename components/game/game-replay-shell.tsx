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

function getPlayerInitials(name: string | null | undefined) {
  if (!name) {
    return "--";
  }

  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

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
  const whiteDeskPlayer = {
    player: whitePlayer,
    captured: position.captured.black,
    capturedColor: "b" as const,
    label: "WHITE" as const
  };
  const blackDeskPlayer = {
    player: blackPlayer,
    captured: position.captured.white,
    capturedColor: "w" as const,
    label: "BLACK" as const
  };
  const topPlayer = isBlackPerspective ? whiteDeskPlayer : blackDeskPlayer;
  const bottomPlayer = isBlackPerspective ? blackDeskPlayer : whiteDeskPlayer;
  const whitePlayerName = whitePlayer?.name ?? "Unknown";
  const blackPlayerName = blackPlayer?.name ?? "Unknown";
  const topPlayerName = topPlayer.player?.name ?? "Unknown";
  const bottomPlayerName = bottomPlayer.player?.name ?? "Unknown";
  const whiteDisplayedRating = formatRating(whitePlayer?.rating ?? null, whitePlayer?.provisional ?? false);
  const blackDisplayedRating = formatRating(blackPlayer?.rating ?? null, blackPlayer?.provisional ?? false);
  const topDisplayedRating = formatRating(topPlayer.player?.rating ?? null, topPlayer.player?.provisional ?? false);
  const bottomDisplayedRating = formatRating(
    bottomPlayer.player?.rating ?? null,
    bottomPlayer.player?.provisional ?? false
  );
  const topPlayerInitials = getPlayerInitials(topPlayerName);
  const bottomPlayerInitials = getPlayerInitials(bottomPlayerName);

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

  function renderReplayMaterial(
    slotPosition: "top" | "bottom",
    playerSlot: typeof topPlayer,
  ) {
    return (
      <div className={`captured-row game-table-material game-table-material-${slotPosition}`}>
        {playerSlot.captured.length ? (
          playerSlot.captured.map((piece, index) => (
            <span
              className="captured-piece"
              key={`${slotPosition}-material-${playerSlot.label.toLowerCase()}-${piece}-${index}`}
            >
              <ChessPieceSvg color={playerSlot.capturedColor} type={piece} />
            </span>
          ))
        ) : (
          <span className="game-table-empty-captures">No captures in this line</span>
        )}
      </div>
    );
  }

  function renderReplayClock(playerSlot: typeof topPlayer) {
    return (
      <div className={`game-table-clock-row ${position.turnColor === playerSlot.label ? "live" : ""}`}>
        <div className={`game-table-clock ${position.turnColor === playerSlot.label ? "live" : ""} replay`}>
          Replay
        </div>
      </div>
    );
  }

  function renderReplayUser(
    slotPosition: "top" | "bottom",
    playerSlot: typeof topPlayer,
    playerName: string,
    playerInitials: string,
    displayedRating: string | null
  ) {
    return (
      <section className={`game-table-user game-table-user-${slotPosition}`}>
        <div className="game-table-user-main">
          <div className="game-player-rail-avatar">{playerInitials}</div>
          <div className="game-table-user-copy">
            <span>{playerSlot.label}</span>
            <strong>
              {playerSlot.player?.profileId ? (
                <Link className="admin-inline-link" href={`/players/${playerSlot.player.profileId}`}>
                  {playerName}
                </Link>
              ) : (
                playerName
              )}
            </strong>
          </div>
        </div>

        <div className="game-table-user-meta">
          {displayedRating ? <span className="pill">Rating {displayedRating}</span> : null}
          <span className="pill">{position.turnColor === playerSlot.label ? "On move" : "Waiting"}</span>
          <span className="pill">{slotPosition === "top" ? "Top seat" : "Bottom seat"}</span>
          {playerSlot.player?.profileId ? <span className="pill">Profile linked</span> : null}
        </div>
      </section>
    );
  }

  return (
    <div className="game-arena-shell archive-page">
      <div className="game-grid game-arena-layout archive-arena-layout">
        <aside className="game-side-column">
          <section className="glass-panel game-side-meta">
            <div className="game-side-meta-head">
              <span className="panel-kicker">Game Archive</span>
              <span className="pill">{game.control}</span>
            </div>
            <div className="game-side-meta-match">
              <strong>{whitePlayerName}</strong>
              <span>vs</span>
              <strong>{blackPlayerName}</strong>
            </div>
            <div className="detail-stack">
              <div className="pill">{game.format}</div>
              <div className="pill">{game.rated ? "Rated" : "Casual"}</div>
              {whiteDisplayedRating ? <div className="pill">W {whiteDisplayedRating}</div> : null}
              {blackDisplayedRating ? <div className="pill">B {blackDisplayedRating}</div> : null}
              <div className="pill">{formatEndedAt(game.endedAt)}</div>
            </div>
          </section>

          <section className="glass-panel game-chat-panel archive-pgn-panel">
            <div className="game-chat-head">
              <div>
                <span className="panel-kicker">Portable Game</span>
                <h2 className="game-chat-title">PGN</h2>
              </div>
              <span className="game-chat-count">{game.moves.length}</span>
            </div>

            {game.pgn ? (
              <pre className="archive-pgn-block">{game.pgn}</pre>
            ) : (
              <p className="panel-copy">PGN is not available for this replay.</p>
            )}
          </section>
        </aside>

        <div className="game-center-column archive-board-column">
          <section className="board-shell game-board-shell">
            <div className="board-frame archive-board-frame live-game-board">
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
          </section>
        </div>

        <aside className="glass-panel game-table-column archive-replay-desk">
          {renderReplayMaterial("top", topPlayer)}
          {renderReplayClock(topPlayer)}
          {renderReplayUser("top", topPlayer, topPlayerName, topPlayerInitials, topDisplayedRating)}

          <div className="game-table-stack">
            <div className="status-banner finished game-desk-alert">
              <span>{game.resultReason}</span>
              {position.inCheck ? <strong>Check</strong> : null}
            </div>

            <div className="detail-stack game-table-meta">
              <div className="pill">Move {currentPly}/{game.moves.length}</div>
              {currentMove ? <div className="pill">Current: {currentMove.san}</div> : <div className="pill">Start position</div>}
              <div className="pill">{game.visibility}</div>
            </div>

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
          </div>

          <div className="action-row game-table-actions archive-actions">
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
            <button className="secondary-button" onClick={() => setCurrentPly(game.moves.length)} type="button">
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
              Flip Board
            </button>
            <button className="secondary-button" onClick={() => void handleCopyPgn()} type="button">
              {copyFeedback === "copied"
                ? "PGN copied"
                : copyFeedback === "failed"
                  ? "Copy failed"
                  : "Copy PGN"}
            </button>
          </div>

          {renderReplayUser("bottom", bottomPlayer, bottomPlayerName, bottomPlayerInitials, bottomDisplayedRating)}
          {renderReplayClock(bottomPlayer)}
          {renderReplayMaterial("bottom", bottomPlayer)}
        </aside>
      </div>
    </div>
  );
}
