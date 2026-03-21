"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";
import { ArenaChatPanel } from "@/components/home/arena-chat-panel";
import {
  buildDemoHeaders,
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
} | null;

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

type HomeTabId = "quick" | "lobby" | "correspondence";

const HOME_TABS: Array<{ id: HomeTabId; label: string }> = [
  { id: "quick", label: "Quick pairing" },
  { id: "lobby", label: "Lobby" },
  { id: "correspondence", label: "Correspondence" }
];

const HOME_PRESETS = CONTROL_PRESETS;

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

export function HomeArenaShell() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [hasMounted, setHasMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<HomeTabId>("quick");
  const [games, setGames] = useState<LobbyGame[]>([]);
  const [actor, setActor] = useState<LobbyActor>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [identity, setIdentity] = useState<DemoIdentity>(loadStoredDemoIdentity);
  const [control, setControl] = useState("3+2");

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

  const actorName = actor?.name ?? session?.user?.name ?? null;

  async function loadGames(currentIdentity: DemoIdentity) {
    const response = await fetch("/api/lobby", {
      cache: "no-store",
      headers: buildDemoHeaders(currentIdentity)
    });
    const payload = (await response.json()) as {
      games?: LobbyGame[];
      actor?: LobbyActor;
      error?: string;
    };

    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to load open games.");
    }

    setGames(payload.games ?? []);
    setActor(payload.actor ?? null);
  }

  useEffect(() => {
    setHasMounted(true);
  }, []);

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
      const response = await fetch("/api/matchmaking/quick-pair", {
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
      const response = await fetch(`/api/games/${gameId}/join`, {
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

  return (
    <section className="home-arena-layout">
      <div className="home-tab-shell glass-panel">
        <div className="home-tab-strip" role="tablist" aria-label="Arena views">
          {HOME_TABS.map((tab) => (
            <button
              aria-selected={activeTab === tab.id}
              className={`home-tab-button${activeTab === tab.id ? " active" : ""}`}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error ? <p className="notice danger">{error}</p> : null}

        {activeTab === "quick" ? (
          <div className="home-tab-panel">
            {actor?.moderationStatus === "RESTRICTED" ? (
              <p className="notice danger">
                This account is currently restricted. Matchmaking and gameplay actions are disabled.
              </p>
            ) : actor?.moderationStatus === "WATCH" || actor?.moderationStatus === "REVIEW" ? (
              <p className="notice">
                This account is currently limited to casual play. Rated quick pair is disabled while moderation review is active.
              </p>
            ) : null}

            <div className="home-preset-grid">
              {HOME_PRESETS.map((preset) => {
                const isActive = preset.control === control;

                return (
                  <button
                    className={`home-preset-card${isActive ? " active" : ""}`}
                    disabled={isPending || actor?.moderationStatus === "RESTRICTED"}
                    key={preset.control}
                    onClick={() => void handleCreateGame(preset.control)}
                    type="button"
                  >
                    <span className="home-preset-time">{preset.control}</span>
                    <span className="home-preset-label">{preset.label}</span>
                  </button>
                );
              })}

              <Link className="home-preset-card home-preset-card-custom" href="/lobby">
                <span className="home-preset-time">Custom</span>
                <span className="home-preset-label">Lobby</span>
              </Link>
            </div>
          </div>
        ) : null}

        {activeTab === "lobby" ? (
          <div className="home-tab-panel">
            <div className="home-panel-head">
              <div>
                <span className="panel-kicker">Open Tables</span>
                <h2 className="home-tab-title">Browse live challenges in the same pool.</h2>
                <p className="home-tab-copy">
                  Open games update in real time. Join directly from the list or open the full lobby
                  if you want custom creation and deeper controls.
                </p>
              </div>
              <div className="home-lobby-actions">
                <span className="pill">{viewGames.length} open</span>
                <Link className="secondary-button" href="/lobby">
                  Full lobby
                </Link>
              </div>
            </div>

            <div className="home-lobby-table">
              <div className="home-lobby-head">
                <span>Player</span>
                <span>Time</span>
                <span>Mode</span>
                <span>Status</span>
                <span>Action</span>
              </div>

              {!viewGames.length ? (
                <div className="home-lobby-empty">
                  <strong>Lobby is clear.</strong>
                  <span>Create the first public table or switch back to Quick pairing.</span>
                </div>
              ) : (
                viewGames.map((game) => (
                  <article className="home-lobby-row" key={game.id}>
                    <div className="home-lobby-player">
                      <strong>{game.host}</strong>
                      <span>{game.visibility === "PRIVATE" ? "Private invite" : "Public table"}</span>
                    </div>
                    <div className="home-lobby-cell">
                      <strong>{game.control}</strong>
                      <span>{game.format}</span>
                    </div>
                    <div className="home-lobby-cell">
                      <strong>{game.rated ? "Rated" : "Casual"}</strong>
                      <span>{game.poolType === "user" ? "Account pool" : "Guest pool"}</span>
                    </div>
                    <div className="home-lobby-cell">
                      <strong>{getStatusLabel(game)}</strong>
                      <span>{game.seatsFilled}/2 seated</span>
                    </div>
                    <div className="home-lobby-row-actions">
                      <button
                        className="secondary-button"
                        disabled={!game.canJoin || isPending}
                        onClick={() => void handleJoinGame(game.id)}
                        type="button"
                      >
                        {game.canJoin ? "Join" : "Open"}
                      </button>
                      <Link className="home-inline-link" href={`/game/${game.id}`}>
                        Room
                      </Link>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        ) : null}

        {activeTab === "correspondence" ? (
          <div className="home-tab-panel">
            <div className="home-correspondence-card">
              <span className="panel-kicker">Coming Next</span>
              <h2 className="home-tab-title">Correspondence play is not wired yet.</h2>
              <p className="home-tab-copy">
                The tab is reserved for slower, asynchronous games. For now, use Quick pairing for
                instant starts or the Lobby for open public tables.
              </p>
              <div className="action-row">
                <button className="primary-button translucent-cta" onClick={() => setActiveTab("quick")} type="button">
                  Back to quick pair
                </button>
                <button className="secondary-button" onClick={() => setActiveTab("lobby")} type="button">
                  Open lobby tab
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {hasMounted ? (
        <ArenaChatPanel actorId={actor?.id ?? null} actorName={actorName} identity={identity} />
      ) : (
        <aside className="home-chat-shell glass-panel">
          <div className="home-chat-head">
            <div className="home-chat-headline">
              <div className="home-chat-title-row">
                <span className="panel-kicker">Live chat</span>
                <span className="home-chat-presence">
                  <span className="home-chat-presence-dot" />
                  Loading
                </span>
              </div>
              <h2 className="home-chat-title">Arena</h2>
            </div>
            <span className="home-chat-count">0</span>
          </div>
          <div className="home-chat-status">
            <strong>Loading arena chat...</strong>
            <span>Connecting the live panel.</span>
          </div>
          <div className="home-chat-empty">
            <strong>Chat is loading.</strong>
            <span>The live feed will appear after hydration completes.</span>
          </div>
        </aside>
      )}
    </section>
  );
}
