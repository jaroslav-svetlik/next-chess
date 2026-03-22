"use client";

import { Chess } from "chess.js";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { LiveBoard } from "@/components/game/live-board";
import { buildDemoHeaders, buildDemoUrl, loadStoredDemoIdentity } from "@/lib/dev-auth";
import { WAITING_ROOM_HEARTBEAT_MS } from "@/lib/game-timing";
import { useGameSoundEffects } from "@/lib/use-game-sound-effects";
import { useRealtimeChannel } from "@/lib/use-realtime-channel";

type GameDetail = {
  id: string;
  version: string;
  status: "WAITING" | "ACTIVE" | "FINISHED" | "CANCELLED";
  visibility: "PUBLIC" | "PRIVATE";
  rated: boolean;
  inviteCode: string | null;
  fen: string;
  format: string;
  control: string;
  hostName: string;
  hostId: string | null;
  poolType: "user" | "guest" | null;
  turnColor: "WHITE" | "BLACK";
  inCheck: boolean;
  turnStartedAt: string | null;
  openingWindowEndsAt: string | null;
  openingMovesRequired: number;
  result: string | null;
  captured: {
    white: Array<"p" | "n" | "b" | "r" | "q" | "k">;
    black: Array<"p" | "n" | "b" | "r" | "q" | "k">;
  };
  lastMove: {
    from: string;
    to: string;
    san: string;
  } | null;
  board: Array<
    Array<{
      square: string;
      type: "p" | "n" | "b" | "r" | "q" | "k";
      color: "w" | "b";
    } | null>
  >;
  moves: Array<{
    id: string;
    ply: number;
    san: string;
    uci: string;
    from: string;
    to: string;
    createdAt: string;
  }>;
  players: Array<{
    id: string;
    userId: string | null;
    guestIdentityId: string | null;
    color: "WHITE" | "BLACK";
    timeRemainingMs: number;
    isConnected: boolean;
    name: string;
    rating: number | null;
    ratingDelta: number | null;
    ratingAfter: number | null;
  }>;
  currentPlayerColor?: "WHITE" | "BLACK" | null;
};

type LegalMove = {
  from: string;
  to: string;
  san: string;
  lan: string;
  promotion?: "p" | "n" | "b" | "r" | "q" | "k";
};

type GameActor = {
  id: string;
  actorType: "user" | "guest";
  isDemo: boolean;
} | null;

type GameRealtimePatch = {
  kind?: "move_delta" | "state_patch";
  baseVersion?: string;
  version?: string;
  status?: GameDetail["status"];
  result?: string | null;
  fen?: string;
  turnColor?: GameDetail["turnColor"];
  inCheck?: boolean;
  turnStartedAt?: string | null;
  openingWindowEndsAt?: string | null;
  openingMovesRequired?: number;
  lastMove?: GameDetail["lastMove"];
  board?: GameDetail["board"];
  captured?: GameDetail["captured"];
  move?: GameDetail["moves"][number] | null;
  players?: GameDetail["players"];
  playerState?: Array<{
    playerId: string;
    isConnected?: boolean;
    timeRemainingMs?: number;
    ratingDelta?: number | null;
    ratingAfter?: number | null;
  }>;
  playerPresence?: Array<{
    playerId: string;
    isConnected: boolean;
  }>;
};

type GameRoomShellProps = {
  gameId: string;
};

export function GameRoomShell({ gameId }: GameRoomShellProps) {
  const router = useRouter();
  const [game, setGame] = useState<GameDetail | null>(null);
  const [actor, setActor] = useState<GameActor>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [isSubmittingMove, setIsSubmittingMove] = useState(false);
  const [isCancellingSearch, setIsCancellingSearch] = useState(false);
  const latestGameRef = useRef<GameDetail | null>(null);
  const latestActorRef = useRef<GameActor>(null);
  const hasQueuedAutoCancelRef = useRef(false);
  const moveRequestInFlightRef = useRef(false);
  const telemetryTurnKeyRef = useRef<string | null>(null);
  const telemetryTurnStartedAtRef = useRef<number | null>(null);
  const turnBlurCountRef = useRef(0);
  const focusLossDurationMsRef = useRef(0);
  const focusLossStartedAtRef = useRef<number | null>(null);

  function applyRealtimePatch(snapshot: GameDetail | null, patch: GameRealtimePatch) {
    if (!snapshot) {
      return snapshot;
    }

    let nextSnapshot = snapshot;

    if (patch.playerPresence?.length) {
      nextSnapshot = {
        ...nextSnapshot,
        players: nextSnapshot.players.map((player) => {
          const update = patch.playerPresence?.find((entry) => entry.playerId === player.id);
          return update ? { ...player, isConnected: update.isConnected } : player;
        })
      };
    }

    if (patch.playerState?.length) {
      nextSnapshot = {
        ...nextSnapshot,
        players: nextSnapshot.players.map((player) => {
          const update = patch.playerState?.find((entry) => entry.playerId === player.id);
          if (!update) {
            return player;
          }

          return {
            ...player,
            isConnected: update.isConnected ?? player.isConnected,
            timeRemainingMs: update.timeRemainingMs ?? player.timeRemainingMs,
            ratingDelta: update.ratingDelta ?? player.ratingDelta,
            ratingAfter: update.ratingAfter ?? player.ratingAfter
          };
        })
      };
    }

    if (patch.kind === "state_patch") {
      if (patch.baseVersion && nextSnapshot.version !== patch.baseVersion) {
        return null;
      }

      nextSnapshot = {
        ...nextSnapshot,
        version: patch.version ?? nextSnapshot.version,
        status: patch.status ?? nextSnapshot.status,
        result: patch.result ?? nextSnapshot.result,
        turnStartedAt:
          patch.turnStartedAt === undefined ? nextSnapshot.turnStartedAt : patch.turnStartedAt,
        openingWindowEndsAt:
          patch.openingWindowEndsAt === undefined
            ? nextSnapshot.openingWindowEndsAt
            : patch.openingWindowEndsAt,
        openingMovesRequired:
          patch.openingMovesRequired ?? nextSnapshot.openingMovesRequired
      };
    }

    if (patch.kind === "move_delta") {
      if (patch.baseVersion && nextSnapshot.version !== patch.baseVersion) {
        return null;
      }

      const nextMoves = patch.move
        ? [...nextSnapshot.moves.filter((move) => move.id !== patch.move?.id), patch.move].slice(-20)
        : nextSnapshot.moves;

      nextSnapshot = {
        ...nextSnapshot,
        version: patch.version ?? nextSnapshot.version,
        status: patch.status ?? nextSnapshot.status,
        result: patch.result ?? nextSnapshot.result,
        fen: patch.fen ?? nextSnapshot.fen,
        turnColor: patch.turnColor ?? nextSnapshot.turnColor,
        inCheck: patch.inCheck ?? nextSnapshot.inCheck,
        turnStartedAt:
          patch.turnStartedAt === undefined ? nextSnapshot.turnStartedAt : patch.turnStartedAt,
        openingWindowEndsAt:
          patch.openingWindowEndsAt === undefined
            ? nextSnapshot.openingWindowEndsAt
            : patch.openingWindowEndsAt,
        openingMovesRequired:
          patch.openingMovesRequired ?? nextSnapshot.openingMovesRequired,
        lastMove: patch.lastMove === undefined ? nextSnapshot.lastMove : patch.lastMove,
        board: patch.board ?? nextSnapshot.board,
        captured: patch.captured ?? nextSnapshot.captured,
        players: patch.players ?? nextSnapshot.players,
        moves: nextMoves
      };
    }

    return nextSnapshot;
  }

  function findActorPlayerColor(
    snapshot: GameDetail | null,
    currentActor: GameActor = actor
  ) {
    if (!snapshot || !currentActor) {
      return null;
    }

    const player = snapshot.players.find((entry) =>
      currentActor.actorType === "user"
        ? entry.userId === currentActor.id
        : entry.guestIdentityId === currentActor.id
    );

    return player?.color ?? null;
  }

  function withClientPerspective(
    snapshot: GameDetail,
    previousSnapshot: GameDetail | null = null,
    currentActor: GameActor = actor
  ) {
    const actorPlayerColor = findActorPlayerColor(snapshot, currentActor);

    return {
      ...snapshot,
      currentPlayerColor:
        actorPlayerColor ??
        snapshot.currentPlayerColor ??
        previousSnapshot?.currentPlayerColor ??
        null
    };
  }

  useGameSoundEffects({
    gameId,
    status: game?.status ?? "WAITING",
    result: game?.result ?? null,
    moveCount: game?.moves.length ?? 0
  });

  useEffect(() => {
    latestGameRef.current = game;
  }, [game]);

  useEffect(() => {
    latestActorRef.current = actor;
  }, [actor]);

  async function sendPresence(connected: boolean, reason: string) {
    if (!actor || !game) {
      return;
    }

    try {
      const identity = loadStoredDemoIdentity();
      await fetch(buildDemoUrl(`/api/games/${gameId}/presence`, identity), {
        method: "POST",
        keepalive: !connected,
        headers: {
          "content-type": "application/json",
          ...buildDemoHeaders(identity)
        },
        body: JSON.stringify({
          connected,
          reason
        })
      });
    } catch {
      return;
    }
  }

  async function cancelWaitingRoomOnLeave() {
    if (hasQueuedAutoCancelRef.current) {
      return;
    }

    const currentGame = latestGameRef.current;
    const currentActor = latestActorRef.current;
    if (!isWaitingHost(currentGame, currentActor)) {
      return;
    }

    hasQueuedAutoCancelRef.current = true;

    try {
      const identity = loadStoredDemoIdentity();
      await fetch(buildDemoUrl(`/api/games/${gameId}`, identity), {
        method: "DELETE",
        keepalive: true,
        headers: buildDemoHeaders(identity)
      });
    } catch {
      hasQueuedAutoCancelRef.current = false;
    }
  }

  async function loadGame() {
    const identity = loadStoredDemoIdentity();
    const response = await fetch(buildDemoUrl(`/api/games/${gameId}`, identity), {
      cache: "no-store",
      headers: buildDemoHeaders(identity)
    });
    const payload = (await response.json()) as {
      game?: GameDetail;
      actor?: GameActor;
      error?: string;
    };

    if (!response.ok || !payload.game) {
      throw new Error(payload.error ?? "Unable to load game room.");
    }

    const nextGame = payload.game;
    setGame((current) => withClientPerspective(nextGame, current, payload.actor ?? actor));
    setActor(payload.actor ?? null);
    setError(null);
  }

  function getCurrentPlayerColor(snapshot: GameDetail | null) {
    if (!snapshot) {
      return null;
    }

    return snapshot.currentPlayerColor ?? findActorPlayerColor(snapshot);
  }

  function getHostSeat(snapshot: GameDetail | null) {
    if (!snapshot) {
      return null;
    }

    return (
      snapshot.players.find((entry) =>
        snapshot.poolType === "user"
          ? entry.userId === snapshot.hostId
          : entry.guestIdentityId === snapshot.hostId
      ) ??
      snapshot.players.find((entry) => entry.color === "WHITE") ??
      snapshot.players[0] ??
      null
    );
  }

  function getCanJoin(snapshot: GameDetail | null) {
    if (!snapshot || !actor) {
      return false;
    }

    const hostSeat = getHostSeat(snapshot);

    return (
      snapshot.status === "WAITING" &&
      snapshot.players.length < 2 &&
      snapshot.poolType === actor.actorType &&
      snapshot.hostId !== actor.id &&
      Boolean(hostSeat?.isConnected)
    );
  }

  function getIsHost(snapshot: GameDetail | null) {
    if (!snapshot || !actor) {
      return false;
    }

    return snapshot.hostId === actor.id;
  }

  function isWaitingHost(
    snapshot: GameDetail | null,
    currentActor: GameActor
  ) {
    if (!snapshot || !currentActor) {
      return false;
    }

    return snapshot.status === "WAITING" && snapshot.hostId === currentActor.id;
  }

  function getLegalMoves(snapshot: GameDetail | null): LegalMove[] {
    const currentPlayerColor = getCurrentPlayerColor(snapshot);
    if (
      !snapshot ||
      snapshot.status !== "ACTIVE" ||
      !currentPlayerColor ||
      currentPlayerColor !== snapshot.turnColor
    ) {
      return [];
    }

    const chess = new Chess(snapshot.fen);
    return chess.moves({ verbose: true }).map((move) => ({
      from: move.from,
      to: move.to,
      san: move.san,
      lan: move.lan,
      promotion: move.promotion as LegalMove["promotion"] | undefined
    }));
  }

  function resetTurnTelemetry() {
    telemetryTurnStartedAtRef.current = null;
    turnBlurCountRef.current = 0;
    focusLossDurationMsRef.current = 0;
    focusLossStartedAtRef.current = null;
  }

  function isTrackingOwnTurn(snapshot: GameDetail | null) {
    const currentPlayerColor = getCurrentPlayerColor(snapshot);
    return (
      !!snapshot &&
      snapshot.status === "ACTIVE" &&
      !!currentPlayerColor &&
      currentPlayerColor === snapshot.turnColor
    );
  }

  function startFocusLossTracking() {
    if (
      telemetryTurnStartedAtRef.current === null ||
      focusLossStartedAtRef.current !== null
    ) {
      return;
    }

    turnBlurCountRef.current += 1;
    focusLossStartedAtRef.current = Date.now();
  }

  function stopFocusLossTracking() {
    if (focusLossStartedAtRef.current === null) {
      return;
    }

    focusLossDurationMsRef.current += Date.now() - focusLossStartedAtRef.current;
    focusLossStartedAtRef.current = null;
  }

  function collectMoveTelemetry() {
    const startedAt = telemetryTurnStartedAtRef.current ?? Date.now();
    const liveFocusLossDuration =
      focusLossStartedAtRef.current !== null
        ? Date.now() - focusLossStartedAtRef.current
        : 0;

    return {
      clientThinkTimeMs: Math.max(0, Date.now() - startedAt),
      turnBlurCount: turnBlurCountRef.current,
      focusLossDurationMs: focusLossDurationMsRef.current + liveFocusLossDuration
    };
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialGame() {
      try {
        await loadGame();
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load game room.");
        }
      } finally {
        if (isMounted) {
          setIsPending(false);
        }
      }
    }

    setIsPending(true);
    void loadInitialGame();

    return () => {
      isMounted = false;
    };
  }, [gameId]);

  useEffect(() => {
    function handleWindowBlur() {
      startFocusLossTracking();
    }

    function handleWindowFocus() {
      stopFocusLossTracking();
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        startFocusLossTracking();
      } else {
        stopFocusLossTracking();
      }
    }

    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!isTrackingOwnTurn(game)) {
      telemetryTurnKeyRef.current = null;
      resetTurnTelemetry();
      return;
    }

    const currentGame = game;
    if (!currentGame) {
      telemetryTurnKeyRef.current = null;
      resetTurnTelemetry();
      return;
    }

    const turnKey = `${currentGame.id}:${currentGame.turnColor}:${currentGame.turnStartedAt ?? "none"}:${currentGame.moves.length}`;
    if (telemetryTurnKeyRef.current === turnKey) {
      return;
    }

    telemetryTurnKeyRef.current = turnKey;
    telemetryTurnStartedAtRef.current = currentGame.turnStartedAt
      ? new Date(currentGame.turnStartedAt).getTime()
      : Date.now();
    turnBlurCountRef.current = 0;
    focusLossDurationMsRef.current = 0;
    focusLossStartedAtRef.current =
      document.hidden || !document.hasFocus() ? Date.now() : null;
  }, [game]);

  useRealtimeChannel({
    channel: `game:${gameId}`,
    onStatusChange: (status) => {
      if (!actor || !game || !getCurrentPlayerColor(game)) {
        return;
      }

      if (status === "connected") {
        void sendPresence(true, "ws_connected");
        return;
      }

      if (status === "reconnecting") {
        void sendPresence(false, "ws_reconnecting");
        return;
      }

      if (status === "disconnected") {
        void sendPresence(false, "ws_disconnected");
      }
    },
    onMessage: (message) => {
      if (message.type !== "game_update") {
        return;
      }

      if (message.game) {
        setGame((current) =>
          withClientPerspective(message.game as GameDetail, current)
        );
        setError(null);
        return;
      }

      if (message.patch) {
        let shouldRefetch = false;
        setGame((current) => {
          const nextGame = applyRealtimePatch(current, message.patch as GameRealtimePatch);
          if (!nextGame) {
            shouldRefetch = true;
            return current;
          }

          return nextGame;
        });

        if (shouldRefetch) {
          void loadGame().catch((loadError: unknown) => {
            setError(loadError instanceof Error ? loadError.message : "Unable to sync game room.");
          });
          return;
        }

        setError(null);
        return;
      }

      void loadGame().catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : "Unable to sync game room.");
      });
    }
  });

  useEffect(() => {
    if (!actor || !game || !getCurrentPlayerColor(game)) {
      return;
    }

    void sendPresence(true, "room_visible");
    const heartbeatInterval = window.setInterval(() => {
      void sendPresence(true, "heartbeat");
    }, WAITING_ROOM_HEARTBEAT_MS);

    function handlePageHide() {
      void sendPresence(false, "pagehide");
    }

    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.clearInterval(heartbeatInterval);
      window.removeEventListener("pagehide", handlePageHide);
      void sendPresence(false, "room_cleanup");
    };
  }, [actor, game, gameId]);

  useEffect(() => {
    function handlePageHide() {
      void cancelWaitingRoomOnLeave();
    }

    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      void cancelWaitingRoomOnLeave();
    };
  }, [gameId]);

  async function handleJoin() {
    setIsJoining(true);

    try {
      const identity = loadStoredDemoIdentity();
      const response = await fetch(buildDemoUrl(`/api/games/${gameId}/join`, identity), {
        method: "POST",
        headers: buildDemoHeaders(identity)
      });
      const payload = (await response.json()) as { game?: GameDetail; error?: string };

      if (!response.ok || !payload.game) {
        throw new Error(payload.error ?? "Unable to join the game.");
      }

      const nextGame = payload.game;
      setGame((current) => withClientPerspective(nextGame, current));
      setError(null);
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : "Unable to join the game.");
    } finally {
      setIsJoining(false);
    }
  }

  async function handleMove(move: {
    from: string;
    to: string;
    san: string;
    lan: string;
    promotion?: "p" | "n" | "b" | "r" | "q" | "k";
  }) {
    if (moveRequestInFlightRef.current) {
      return;
    }

    moveRequestInFlightRef.current = true;
    setIsSubmittingMove(true);
    setError(null);

    try {
      const identity = loadStoredDemoIdentity();
      const response = await fetch(buildDemoUrl(`/api/games/${gameId}/move`, identity), {
        method: "POST",
        headers: {
          ...buildDemoHeaders(identity)
        },
        body: JSON.stringify({
          from: move.from,
          to: move.to,
          promotion: move.promotion,
          ...collectMoveTelemetry()
        })
      });
      const payload = (await response.json()) as { game?: GameDetail; error?: string };

      if (!response.ok || !payload.game) {
        throw new Error(payload.error ?? "Unable to submit move.");
      }

      const nextGame = payload.game;
      setGame((current) => withClientPerspective(nextGame, current));
      setError(null);
    } catch (moveError) {
      setError(moveError instanceof Error ? moveError.message : "Unable to submit move.");
      void loadGame().catch(() => {
        return undefined;
      });
    } finally {
      moveRequestInFlightRef.current = false;
      setIsSubmittingMove(false);
    }
  }

  async function handleResign() {
    setIsSubmittingMove(true);

    try {
      const identity = loadStoredDemoIdentity();
      const response = await fetch(buildDemoUrl(`/api/games/${gameId}/resign`, identity), {
        method: "POST",
        headers: buildDemoHeaders(identity)
      });
      const payload = (await response.json()) as { game?: GameDetail; error?: string };

      if (!response.ok || !payload.game) {
        throw new Error(payload.error ?? "Unable to resign.");
      }

      const nextGame = payload.game;
      setGame((current) => withClientPerspective(nextGame, current));
      setError(null);
    } catch (resignError) {
      setError(resignError instanceof Error ? resignError.message : "Unable to resign.");
    } finally {
      setIsSubmittingMove(false);
    }
  }

  async function handleCancelSearch() {
    setIsCancellingSearch(true);
    hasQueuedAutoCancelRef.current = true;

    try {
      const identity = loadStoredDemoIdentity();
      const response = await fetch(buildDemoUrl(`/api/games/${gameId}`, identity), {
        method: "DELETE",
        headers: buildDemoHeaders(identity)
      });
      const payload = (await response.json()) as { game?: GameDetail; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to cancel search.");
      }

      router.push("/");
    } catch (cancelError) {
      hasQueuedAutoCancelRef.current = false;
      setError(cancelError instanceof Error ? cancelError.message : "Unable to cancel search.");
    } finally {
      setIsCancellingSearch(false);
    }
  }

  if (isPending) {
    return <p className="notice">Loading game room...</p>;
  }

  if (error || !game) {
    return <p className="notice danger">{error ?? "Game room is unavailable."}</p>;
  }

  if (game.status === "WAITING") {
    const isSeated = !!getCurrentPlayerColor(game);
    const hostSeat = getHostSeat(game);

    return (
      <section className="glass-panel matchmaking-shell">
        <div className="matchmaking-pulse" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <span className="panel-kicker">{isSeated ? "Matchmaking" : "Waiting Room"}</span>
        <h2 className="panel-title matchmaking-title">
          {isSeated ? "Searching for an opponent" : `${game.hostName} is waiting for an opponent`}
        </h2>
        <p className="panel-copy matchmaking-copy">
          {isSeated
            ? `You are queued for ${game.format} ${game.control}. As soon as the second player connects, both players are moved into the live board automatically.`
            : `This ${game.format} ${game.control} table is open. Join now and the game starts immediately with the 10-second opening rule active.`}
        </p>
        <div className="detail-stack matchmaking-meta">
          <div className="pill">{game.rated ? "Rated" : "Casual"}</div>
          <div className="pill">{game.format}</div>
          <div className="pill">{game.control}</div>
          <div className="pill">{game.players.length}/2 seated</div>
          {getCurrentPlayerColor(game) ? <div className="pill">You are {getCurrentPlayerColor(game)}</div> : null}
          {game.inviteCode ? <div className="pill">Invite {game.inviteCode}</div> : null}
        </div>
        {isSeated ? (
          <div className="notice">
            Server queue is active. Once paired, white gets 10 seconds for the first move, then
            black gets 10 seconds for the first reply.
          </div>
        ) : hostSeat?.isConnected === false ? (
          <div className="notice">
            The host is no longer in this room. This open seek will disappear unless they reconnect.
          </div>
        ) : null}
        {getCanJoin(game) ? (
          <div className="action-row">
            <button className="primary-button translucent-cta" disabled={isJoining} onClick={handleJoin} type="button">
              {isJoining ? "Joining..." : "Join from this room"}
            </button>
          </div>
        ) : getIsHost(game) ? (
          <div className="action-row">
            <button
              className="secondary-button"
              disabled={isCancellingSearch}
              onClick={() => void handleCancelSearch()}
              type="button"
            >
              {isCancellingSearch ? "Cancelling..." : "Cancel search"}
            </button>
          </div>
        ) : null}
      </section>
    );
  }

  const whitePlayer = game.players.find((player) => player.color === "WHITE") ?? null;
  const blackPlayer = game.players.find((player) => player.color === "BLACK") ?? null;
  const currentPlayerColor = getCurrentPlayerColor(game);
  const legalMoves = getLegalMoves(game);

  return (
    <>
      {error ? <p className="notice danger">{error}</p> : null}
      <LiveBoard
        blackPlayer={blackPlayer}
        board={game.board}
        controlLabel={`${game.format} ${game.control}`}
        currentPlayerColor={currentPlayerColor}
        fen={game.fen}
        inCheck={game.inCheck}
        isSubmittingMove={isSubmittingMove}
        legalMoves={legalMoves}
        lastMove={game.lastMove}
        moves={game.moves}
        onSubmitMove={handleMove}
        onResign={handleResign}
        openingMovesRequired={game.openingMovesRequired}
        openingWindowEndsAt={game.openingWindowEndsAt}
        rated={game.rated}
        result={game.result}
        status={game.status}
        turnStartedAt={game.turnStartedAt}
        turnColor={game.turnColor}
        whitePlayer={whitePlayer}
        captured={game.captured}
      />
    </>
  );
}
