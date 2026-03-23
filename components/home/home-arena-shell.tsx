"use client";

import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useMemo, useState } from "react";

import { ChessPieceSvg } from "@/components/game/chess-piece-svg";
import { authClient } from "@/lib/auth-client";
import {
  buildDemoHeaders,
  buildDemoUrl,
  DEMO_IDENTITY_STORAGE_KEY,
  loadStoredDemoIdentity,
  type DemoIdentity
} from "@/lib/dev-auth";
import { CONTROL_PRESETS } from "@/lib/game-config";
import { useRealtimeChannel } from "@/lib/use-realtime-channel";

type LobbyGame = {
  id: string;
  host: string;
  hostId: string | null;
  poolType: "user" | "guest" | null;
  format: string;
  control: string;
  rated: boolean;
  visibility: "PUBLIC" | "PRIVATE";
  status: "WAITING" | "ACTIVE" | "FINISHED" | "CANCELLED";
  seatsFilled: number;
  createdAt: string;
};

type LobbyActor = {
  id?: string;
  name?: string;
  actorType?: "user" | "guest";
  isDemo?: boolean;
  moderationStatus?: "CLEAN" | "OBSERVE" | "WATCH" | "REVIEW" | "RESTRICTED";
  ratings?: {
    bullet: number;
    blitz: number;
    rapid: number;
  } | null;
} | null;

type LobbyStats = {
  onlinePlayers: number;
  gamesInProgress: number;
};

type LobbyViewGame = LobbyGame & {
  canJoin: boolean;
};

type LobbyRealtimePatch = {
  kind?: "ops";
  ops?: Array<
    | {
        type: "upsert";
        game: LobbyGame;
      }
    | {
        type: "remove";
        gameId: string;
      }
  >;
};

type ShowcaseTab = "moves" | "chat" | "analysis";
type PreviewTone = "light" | "dark";
type PreviewMarker = "trace" | "pulse" | "focus" | "ghost";

type HomeEventCard = {
  id: string;
  icon: string;
  title: string;
  schedule: string;
  players: string;
  highlight: string;
  buttonLabel: string;
  buttonKind: "join" | "open";
  href: Route;
  gameId?: string;
  canJoin?: boolean;
};

function getPreset(control: string) {
  const preset = CONTROL_PRESETS.find((option) => option.control === control);

  if (!preset) {
    throw new Error(`Missing preset for ${control}`);
  }

  return preset;
}

const HOME_PRESETS = [getPreset("3+0"), getPreset("1+0"), getPreset("10+0")] as const;
const HOME_PRESET_META = {
  "3+0": { icon: "⚡", label: "Blitz" },
  "1+0": { icon: "🔥", label: "Bullet" },
  "10+0": { icon: "🧠", label: "Rapid" }
} as const;
const HOME_CUSTOM_META = { icon: "🎯", label: "Custom" } as const;
const TOURNAMENT_SKINS = [
  { icon: "⚡", title: "Blitz Championship Arena" },
  { icon: "♞", title: "Sunday Grand Swiss" }
] as const;

const BOARD_FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const BOARD_RANKS = [8, 7, 6, 5, 4, 3, 2, 1] as const;

const HOME_BOARD_PREVIEW: Record<string, { label: string; tone: PreviewTone }> = {
  a8: { label: "R", tone: "dark" },
  b8: { label: "N", tone: "dark" },
  c8: { label: "B", tone: "dark" },
  d8: { label: "Q", tone: "dark" },
  e8: { label: "K", tone: "dark" },
  f8: { label: "B", tone: "dark" },
  g8: { label: "N", tone: "dark" },
  h8: { label: "R", tone: "dark" },
  a7: { label: "P", tone: "dark" },
  b7: { label: "P", tone: "dark" },
  c7: { label: "P", tone: "dark" },
  d7: { label: "P", tone: "dark" },
  e7: { label: "P", tone: "dark" },
  f7: { label: "P", tone: "dark" },
  h7: { label: "P", tone: "dark" },
  g6: { label: "P", tone: "dark" },
  e5: { label: "N", tone: "light" },
  c4: { label: "N", tone: "dark" },
  a2: { label: "P", tone: "light" },
  b2: { label: "P", tone: "light" },
  c2: { label: "P", tone: "light" },
  d2: { label: "P", tone: "light" },
  e2: { label: "P", tone: "light" },
  f2: { label: "P", tone: "light" },
  g2: { label: "P", tone: "light" },
  h2: { label: "P", tone: "light" },
  a1: { label: "R", tone: "light" },
  b1: { label: "N", tone: "light" },
  c1: { label: "B", tone: "light" },
  d1: { label: "Q", tone: "light" },
  e1: { label: "K", tone: "light" },
  f1: { label: "B", tone: "light" },
  g1: { label: "N", tone: "light" },
  h1: { label: "R", tone: "light" }
};

const HOME_BOARD_MARKERS: Partial<Record<string, PreviewMarker>> = {
  d3: "ghost",
  e3: "ghost",
  c4: "pulse",
  d4: "trace",
  e4: "focus",
  f4: "trace",
  e5: "focus",
  g5: "pulse"
};

const SHOWCASE_MOVES = [
  { turn: "1.", white: "e4", black: "e5" },
  { turn: "2.", white: "Nf3", black: "Nc6" },
  { turn: "3.", white: "Bc4", black: "Nf6" },
  { turn: "4.", white: "O-O", black: "Be7" }
];

const SHOWCASE_CHAT = [
  { author: "ShadowMaster", accent: "gold", text: "Gl hf!" },
  { author: "KnightRider", accent: "cyan", text: "You too." },
  { author: "ShadowMaster", accent: "gold", text: "That knight jump is clean." }
];

const SHOWCASE_ANALYSIS = [
  "Fast control favors initiative and tempo over deep structure.",
  "Centralized knight creates pressure on both king-side and queen-side squares.",
  "Open files appear quickly when the clock stays unforgiving."
];

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Choose Mode",
    copy: "Blitz, Bullet, or Custom"
  },
  {
    step: "2",
    title: "Get Matched",
    copy: "Instant skill-based pairing"
  },
  {
    step: "3",
    title: "Play & Climb",
    copy: "Win streaks & rank up"
  }
];

const RANK_MARKS = [
  { label: "Bronze", className: "bronze", imageSrc: "/branding/badges/bronze.png" },
  { label: "Silver", className: "silver", imageSrc: "/branding/badges/silver.png" },
  { label: "Gold", className: "gold", imageSrc: "/branding/badges/gold.png" },
  { label: "Diamond", className: "diamond", imageSrc: "/branding/badges/diamond.png" }
] as const;

function formatEventTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function getStatusLabel(game: LobbyViewGame) {
  if (game.status === "ACTIVE") {
    return "In progress";
  }

  if (game.status === "CANCELLED") {
    return "Cancelled";
  }

  if (game.status === "FINISHED") {
    return "Finished";
  }

  if (game.seatsFilled >= 2) {
    return "Full";
  }

  if (!game.canJoin) {
    return "Your table";
  }

  return "Joinable";
}

function formatMetric(value: number) {
  return value.toLocaleString("en-US");
}

function getActiveRating(control: string, actor: LobbyActor) {
  if (!actor?.ratings) {
    return null;
  }

  const preset = CONTROL_PRESETS.find((option) => option.control === control);
  if (!preset) {
    return actor.ratings.blitz;
  }

  if (preset.timeCategory === "BULLET") {
    return actor.ratings.bullet;
  }

  if (preset.timeCategory === "RAPID") {
    return actor.ratings.rapid;
  }

  return actor.ratings.blitz;
}

function getPreviewPieceType(label: string): "p" | "n" | "b" | "r" | "q" | "k" {
  if (label === "P") {
    return "p";
  }

  if (label === "N") {
    return "n";
  }

  if (label === "B") {
    return "b";
  }

  if (label === "R") {
    return "r";
  }

  if (label === "Q") {
    return "q";
  }

  return "k";
}

function renderBoardPreview() {
  return BOARD_RANKS.flatMap((rank, rankIndex) =>
    BOARD_FILES.map((file, fileIndex) => {
      const square = `${file}${rank}`;
      const piece = HOME_BOARD_PREVIEW[square];
      const marker = HOME_BOARD_MARKERS[square];
      const tone = (rankIndex + fileIndex) % 2 === 0 ? "dark" : "light";

      return (
        <div className={`home-showcase-square ${tone}${marker ? ` ${marker}` : ""}`} key={square}>
          {marker ? <span className="home-showcase-marker" aria-hidden="true" /> : null}
          {piece ? (
            <span className={`home-showcase-piece ${piece.tone}`} aria-hidden="true">
              <ChessPieceSvg
                color={piece.tone === "light" ? "w" : "b"}
                type={getPreviewPieceType(piece.label)}
              />
            </span>
          ) : null}
        </div>
      );
    })
  );
}

function renderShowcasePanel(tab: ShowcaseTab) {
  if (tab === "moves") {
    return (
      <div className="home-activity-moves">
        {SHOWCASE_MOVES.map((move) => (
          <div className="home-activity-move-row" key={move.turn}>
            <span>{move.turn}</span>
            <strong>{move.white}</strong>
            <strong>{move.black}</strong>
          </div>
        ))}
      </div>
    );
  }

  if (tab === "chat") {
    return (
      <div className="home-activity-chat">
        {SHOWCASE_CHAT.map((message) => (
          <div className="home-activity-chat-line" key={`${message.author}-${message.text}`}>
            <strong className={message.accent}>{message.author}:</strong>
            <span>{message.text}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="home-activity-analysis">
      {SHOWCASE_ANALYSIS.map((item) => (
        <p key={item}>{item}</p>
      ))}
    </div>
  );
}

function getHomePresetMeta(control: string) {
  return HOME_PRESET_META[control as keyof typeof HOME_PRESET_META] ?? {
    icon: "♟",
    label: "Play"
  };
}

export function HomeArenaShell() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [games, setGames] = useState<LobbyGame[]>([]);
  const [actor, setActor] = useState<LobbyActor>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [identity, setIdentity] = useState<DemoIdentity>(loadStoredDemoIdentity);
  const [control, setControl] = useState("3+0");
  const [showcaseTab, setShowcaseTab] = useState<ShowcaseTab>("moves");
  const [stats, setStats] = useState<LobbyStats>({
    onlinePlayers: 0,
    gamesInProgress: 0
  });

  function applyLobbyPatch(current: LobbyGame[], patch: LobbyRealtimePatch) {
    if (patch.kind !== "ops" || !patch.ops?.length) {
      return null;
    }

    let nextGames = current;

    for (const operation of patch.ops) {
      if (operation.type === "remove") {
        nextGames = nextGames.filter((game) => game.id !== operation.gameId);
        continue;
      }

      const existingIndex = nextGames.findIndex((game) => game.id === operation.game.id);
      if (existingIndex === -1) {
        nextGames = [operation.game, ...nextGames].slice(0, 24);
        continue;
      }

      nextGames = nextGames.map((game, index) =>
        index === existingIndex ? operation.game : game
      );
    }

    return nextGames
      .slice()
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .slice(0, 24);
  }

  const viewGames = useMemo<LobbyViewGame[]>(() => {
    return games
      .filter((game) => !actor?.actorType || !game.poolType || game.poolType === actor.actorType)
      .filter((game) => !game.rated || actor?.isDemo === false)
      .map((game) => ({
        ...game,
        canJoin:
          game.status === "WAITING" &&
          game.seatsFilled < 2 &&
          (!!actor?.actorType ? game.poolType === actor.actorType : true) &&
          actor?.moderationStatus !== "RESTRICTED" &&
          (!game.rated ||
            (actor?.isDemo === false &&
              actor?.moderationStatus !== "WATCH" &&
              actor?.moderationStatus !== "REVIEW")) &&
          (!actor?.id || game.hostId !== actor.id)
      }));
  }, [actor, games]);

  const actorName = actor?.name ?? session?.user?.name ?? "KnightRider";
  const waitingGames = useMemo(
    () => viewGames.filter((game) => game.status === "WAITING"),
    [viewGames]
  );
  const activePoolGames = useMemo(
    () => viewGames.filter((game) => game.status === "ACTIVE"),
    [viewGames]
  );
  const joinableGames = useMemo(
    () => waitingGames.filter((game) => game.canJoin),
    [waitingGames]
  );
  const featuredGames = useMemo(
    () => waitingGames.slice(0, 2),
    [waitingGames]
  );
  const activeRating = useMemo(
    () => getActiveRating(control, actor),
    [actor, control]
  );

  const eventCards = useMemo<HomeEventCard[]>(() => {
    const cards: HomeEventCard[] = featuredGames.map((game, index): HomeEventCard => ({
      id: game.id,
      icon: TOURNAMENT_SKINS[index]?.icon ?? "⚔",
      title: TOURNAMENT_SKINS[index]?.title ?? `${game.rated ? "Rated" : "Casual"} Arena`,
      schedule: `${index === 0 ? "Today" : "Now"} · ${formatEventTime(game.createdAt)}`,
      players: `${game.seatsFilled}/2 seats filled`,
      highlight: `${game.control} · ${getStatusLabel(game)}`,
      buttonLabel: game.canJoin ? "Join Tournament" : "Open Room",
      buttonKind: game.canJoin ? "join" : "open",
      href: `/game/${game.id}` as Route,
      gameId: game.id,
      canJoin: game.canJoin
    }));

    while (cards.length < 2) {
      const fallbackIndex = cards.length;
      cards.push({
        id: `fallback-${fallbackIndex}`,
        icon: TOURNAMENT_SKINS[fallbackIndex]?.icon ?? "⚔",
        title: TOURNAMENT_SKINS[fallbackIndex]?.title ?? "Arena Event",
        schedule: fallbackIndex === 0 ? "Today · Live lobby" : "Tomorrow · Prime slot",
        players: fallbackIndex === 0 ? `${waitingGames.length} open tables` : `${activePoolGames.length} games in progress`,
        highlight: fallbackIndex === 0 ? "$500 Prize Pool" : "$1,200 Prize Pool",
        buttonLabel: "Join Tournament",
        buttonKind: "open",
        href: "/lobby"
      });
    }

    return cards;
  }, [activePoolGames.length, featuredGames, waitingGames.length]);

  async function loadGames(currentIdentity: DemoIdentity) {
    const response = await fetch(buildDemoUrl("/api/lobby", currentIdentity), {
      cache: "no-store",
      headers: buildDemoHeaders(currentIdentity)
    });
    const payload = (await response.json()) as {
      games?: LobbyGame[];
      actor?: LobbyActor;
      stats?: LobbyStats;
      error?: string;
    };

    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to load open games.");
    }

    setGames(payload.games ?? []);
    setActor(payload.actor ?? null);
    setStats(
      payload.stats ?? {
        onlinePlayers: 0,
        gamesInProgress: 0
      }
    );
  }

  useEffect(() => {
    const currentIdentity = loadStoredDemoIdentity();
    setIdentity(currentIdentity);

    startTransition(() => {
      loadGames(currentIdentity).catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : "Failed to load open games.");
      });
    });
  }, []);

  useEffect(() => {
    window.sessionStorage.setItem(DEMO_IDENTITY_STORAGE_KEY, JSON.stringify(identity));
  }, [identity]);

  useRealtimeChannel({
    channel: "lobby",
    onMessage: (message) => {
      if (message.type !== "lobby_update") {
        return;
      }

      if (Array.isArray(message.games)) {
        setGames(message.games as LobbyGame[]);
        return;
      }

      if (message.patch) {
        let applied = false;
        setGames((current) => {
          const nextGames = applyLobbyPatch(current, message.patch as LobbyRealtimePatch);
          if (!nextGames) {
            return current;
          }

          applied = true;
          return nextGames;
        });
        if (applied) {
          return;
        }
      }

      void loadGames(identity).catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : "Failed to sync open games.");
      });
    }
  });

  async function handleCreateGame(nextControl?: string) {
    const selectedControl = nextControl ?? control;

    setError(null);
    setIsPending(true);
    setControl(selectedControl);

    try {
      const response = await fetch(buildDemoUrl("/api/matchmaking/quick-pair", identity), {
        method: "POST",
        headers: buildDemoHeaders(identity),
        body: JSON.stringify({
          control: selectedControl,
          visibility: "PUBLIC"
        })
      });
      const payload = (await response.json()) as { game?: { id: string }; error?: string };

      if (!response.ok || !payload.game) {
        throw new Error(payload.error ?? "Unable to create game.");
      }

      router.push(`/game/${payload.game.id}`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create game.");
    } finally {
      setIsPending(false);
    }
  }

  async function handleJoinGame(gameId: string) {
    setError(null);
    setIsPending(true);

    try {
      const response = await fetch(buildDemoUrl(`/api/games/${gameId}/join`, identity), {
        method: "POST",
        headers: buildDemoHeaders(identity)
      });
      const payload = (await response.json()) as { game?: { id: string }; error?: string };

      if (!response.ok || !payload.game) {
        throw new Error(payload.error ?? "Unable to join game.");
      }

      router.push(`/game/${payload.game.id}`);
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : "Unable to join game.");
      void loadGames(identity).catch(() => undefined);
    } finally {
      setIsPending(false);
    }
  }

  function handleEventCardAction(card: HomeEventCard) {
    if (card.buttonKind === "join" && card.gameId && card.canJoin) {
      void handleJoinGame(card.gameId);
      return;
    }

    router.push(card.href);
  }

  return (
    <section className="home-stage-shell">
      <div className="home-stage-columns">
        <div className="home-stage-main">
          <section className="home-copy-stage" id="play-now">
            <div className="home-copy-backdrop" aria-hidden="true" />
            <div className="home-copy-shell">
              <h1 className="home-copy-title">
                <span className="home-copy-line">Play chess.</span>
                <span className="home-copy-line home-copy-line-accent">Dominate.</span>
              </h1>
              <p className="home-copy-lead">Fast. Competitive. Real-time Battles.</p>

              <div className="home-cta-row">
                <button
                  className="home-play-button"
                  disabled={isPending || actor?.moderationStatus === "RESTRICTED"}
                  onClick={() => void handleCreateGame()}
                  type="button"
                >
                  <span className="home-play-button-label">
                    {isPending ? "Starting..." : "Play Now"}
                  </span>
                  <span aria-hidden="true" className="home-play-button-arrow">
                    ›
                  </span>
                </button>
              </div>

              {error ? <p className="notice danger">{error}</p> : null}

              {actor?.moderationStatus === "RESTRICTED" ? (
                <p className="notice danger">
                  This account is currently restricted. Matchmaking and gameplay actions are disabled.
                </p>
              ) : actor?.moderationStatus === "WATCH" || actor?.moderationStatus === "REVIEW" ? (
                <p className="notice">
                  This account is currently limited to casual play. Rated quick pair is disabled while
                  moderation review is active.
                </p>
              ) : null}

              <div className="home-mode-row" id="practice">
                {HOME_PRESETS.map((preset) => {
                  const isActive = preset.control === control;
                  const meta = getHomePresetMeta(preset.control);

                  return (
                    <button
                      className={`home-mode-card${isActive ? " active" : ""}`}
                      disabled={isPending || actor?.moderationStatus === "RESTRICTED"}
                      key={preset.control}
                      onClick={() => void handleCreateGame(preset.control)}
                      type="button"
                    >
                      <strong>
                        <span className="home-mode-icon" aria-hidden="true">
                          {meta.icon}
                        </span>
                        {meta.label}
                      </strong>
                      <span>{preset.control}</span>
                    </button>
                  );
                })}

                <Link className="home-mode-card" href="/lobby">
                  <strong>
                    <span className="home-mode-icon" aria-hidden="true">
                      {HOME_CUSTOM_META.icon}
                    </span>
                    {HOME_CUSTOM_META.label}
                  </strong>
                  <span>Custom Game</span>
                </Link>
              </div>

              <div className="home-live-strip">
                <div className="home-live-strip-metrics">
                  <div className="home-live-strip-item online">
                    <span className="home-live-strip-dot" aria-hidden="true" />
                    <strong>{formatMetric(stats.onlinePlayers)}</strong>
                    <span>Online</span>
                  </div>
                  <div className="home-live-strip-item progress">
                    <span className="home-live-strip-dot" aria-hidden="true" />
                    <strong>{formatMetric(stats.gamesInProgress)}</strong>
                    <span>Games</span>
                  </div>
                </div>
                <div className={`home-live-strip-rating${activeRating === null ? " muted" : ""}`}>
                  <span className="home-live-strip-rating-label">Your Rating:</span>
                  {activeRating === null ? (
                    <Link className="home-live-strip-signin" href="/auth/login">
                      Sign in
                    </Link>
                  ) : (
                    <strong>{formatMetric(activeRating)}</strong>
                  )}
                  {activeRating !== null ? (
                    <span className="home-live-strip-rating-icon" aria-hidden="true">
                      ↗
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          <section className="home-events-section" id="tournaments">
            <div className="home-section-head">
              <h2>
                <span aria-hidden="true">🏆</span>
                Tournaments
              </h2>
              <Link href="/lobby">View All</Link>
            </div>

            <div className="home-event-grid">
              {eventCards.map((card) => (
                <article className="home-event-card" key={card.id}>
                  <span className="home-event-icon" aria-hidden="true">
                    {card.icon}
                  </span>
                  <strong>{card.title}</strong>
                  <span>{card.schedule}</span>
                  <span>{card.players}</span>
                  <span className="accent">{card.highlight}</span>
                  <button
                    className="home-event-button"
                    disabled={isPending}
                    onClick={() => handleEventCardAction(card)}
                    type="button"
                  >
                    {card.buttonLabel}
                  </button>
                </article>
              ))}
            </div>
          </section>

        </div>

        <aside className="home-stage-side" id="live-arena">
          <div className="home-preview-stage">
            <div className="home-preview-player top">
              <div className="home-preview-avatar dark">S</div>
              <div className="home-preview-player-meta">
                <strong>{featuredGames[0]?.host ?? "ShadowMaster"}</strong>
                <span>{featuredGames[0]?.rated ? "● Online · Rated challenge" : "● Online"}</span>
              </div>
              <div className="home-preview-clock">02:43</div>
            </div>

            <div className="home-preview-board-frame">
              <div className="home-showcase-board">{renderBoardPreview()}</div>
              <span className="home-showcase-beam" aria-hidden="true" />
            </div>

            <div className="home-preview-player bottom">
              <div className="home-preview-avatar light">K</div>
              <div className="home-preview-player-meta">
                <strong>{actorName}</strong>
                <span>{actor?.actorType === "user" ? "Registered player" : "Guest session"} · Live</span>
              </div>
              <div className="home-preview-clock">02:58</div>
            </div>

            <div className="home-activity-shell">
              <div className="home-activity-tabs">
                {(["moves", "chat", "analysis"] as ShowcaseTab[]).map((tab) => (
                  <button
                    className={showcaseTab === tab ? "active" : ""}
                    key={tab}
                    onClick={() => setShowcaseTab(tab)}
                    type="button"
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              <div className="home-activity-panel">{renderShowcasePanel(showcaseTab)}</div>

              <div className="home-activity-actions">
                <button type="button">Resign</button>
                <button type="button">Draw</button>
                <button type="button">Rematch</button>
                <button className="primary" type="button">
                  Flip Board
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <section className="home-how-section" id="how-it-works">
        <div className="home-section-head compact home-how-head">
          <h2>
            <span aria-hidden="true">🎯</span>
            How It Works
          </h2>
        </div>

        <div className="home-how-shell">
          <div className="home-how-row">
            {HOW_IT_WORKS.map((item) => (
              <article className="home-how-card" key={item.step}>
                <span className="home-flow-step">{item.step}</span>
                <div className="home-how-copy">
                  <strong>{item.title}</strong>
                  <span>{item.copy}</span>
                </div>
              </article>
            ))}
          </div>

          <div className="home-rank-row">
            {RANK_MARKS.map((rank) => (
              <div className="home-rank-badge" key={rank.label}>
                <span className="home-rank-image-wrap">
                  <Image
                    alt={`${rank.label} badge`}
                    className="home-rank-image"
                    height={340}
                    src={rank.imageSrc}
                    width={340}
                  />
                </span>
                <strong className={rank.className}>{rank.label}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>
    </section>
  );
}
