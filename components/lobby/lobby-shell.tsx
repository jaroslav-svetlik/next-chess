"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";
import { OpenGamesList } from "@/components/lobby/open-games-list";
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

export function LobbyShell() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [games, setGames] = useState<LobbyGame[]>([]);
  const [actor, setActor] = useState<LobbyActor>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [identity, setIdentity] = useState<DemoIdentity>(loadStoredDemoIdentity);
  const [control, setControl] = useState("3+2");
  const [visibility, setVisibility] = useState("PUBLIC");

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

  async function loadGames(currentIdentity: DemoIdentity) {
    const response = await fetch(buildDemoUrl("/api/lobby", currentIdentity), {
      cache: "no-store",
      headers: buildDemoHeaders(currentIdentity)
    });
    const payload = (await response.json()) as {
      games?: LobbyGame[];
      actor?: LobbyActor;
      error?: string;
    };

    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to load lobby.");
    }

    setGames(payload.games ?? []);
    setActor(payload.actor ?? null);
  }

  useEffect(() => {
    const currentIdentity = loadStoredDemoIdentity();
    setIdentity(currentIdentity);

    startTransition(() => {
      loadGames(currentIdentity).catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : "Failed to load lobby.");
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
        setError(loadError instanceof Error ? loadError.message : "Failed to sync lobby.");
      });
    }
  });

  async function refreshLobby() {
    setError(null);
    setIsPending(true);

    try {
      await loadGames(identity);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to refresh lobby.");
    } finally {
      setIsPending(false);
    }
  }

  async function handleCreateGame() {
    setError(null);
    setIsPending(true);

    try {
      const response = await fetch(buildDemoUrl("/api/games", identity), {
        method: "POST",
        headers: buildDemoHeaders(identity),
        body: JSON.stringify({
          control,
          visibility
        })
      });
      const payload = (await response.json()) as {
        game?: { id: string };
        error?: string;
      };

      if (!response.ok || !payload.game) {
        throw new Error(payload.error ?? "Game creation failed.");
      }

      router.push(`/game/${payload.game.id}`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Game creation failed.");
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
      const payload = (await response.json()) as {
        game?: { id: string };
        error?: string;
      };

      if (!response.ok || !payload.game) {
        throw new Error(payload.error ?? "Join request failed.");
      }

      router.push(`/game/${payload.game.id}`);
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : "Join request failed.");
      await refreshLobby();
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="lobby-grid">
      <section className="glass-panel">
        <span className="panel-kicker">Open Games</span>
        <h1 className="panel-title">Join a live table or prepare your own room.</h1>
        <p className="panel-copy">
          {session?.user
            ? `Signed in as ${session.user.name}. Your real account session now takes priority over guest mode.`
            : "Anonymous lobby with instant create/join flow. Guests now only see and join guest tables."}
        </p>
        {actor?.moderationStatus === "RESTRICTED" ? (
          <p className="notice danger">
            This account is currently restricted. Creating, joining and playing games are disabled.
          </p>
        ) : actor?.moderationStatus === "WATCH" || actor?.moderationStatus === "REVIEW" ? (
          <p className="notice">
            This account is currently limited to casual games. Rated tables are hidden and blocked while moderation review is active.
          </p>
        ) : null}
        {error ? <p className="notice danger">{error}</p> : null}
        <div className="action-row">
          <button className="secondary-button" onClick={refreshLobby} type="button">
            Refresh lobby
          </button>
        </div>
        <OpenGamesList games={viewGames} isPending={isPending} onJoin={handleJoinGame} />
      </section>

      <aside className="glass-panel">
        <span className="panel-kicker">Create Match</span>
        <h2 className="feature-title">Choose the pace</h2>
        <div className="field-grid">
          {session?.user ? (
            <p className="muted">
              {actor?.moderationStatus === "WATCH" || actor?.moderationStatus === "REVIEW"
                ? "Real account session is active, but rated play is currently limited to casual tables."
                : "Real account session is active. This is the foundation for rated play, profiles, and stats."}
            </p>
          ) : (
            <p className="muted">
              Guest mode is active. This browser tab uses its own anonymous guest identity, so
              you can create and join guest tables immediately without registering.
            </p>
          )}
          <div className="field">
            <label htmlFor="time">Control</label>
            <select id="time" onChange={(event) => setControl(event.target.value)} value={control}>
              {CONTROL_PRESETS.map((preset) => (
                <option key={preset.control} value={preset.control}>
                  {preset.label} {preset.control}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="visibility">Visibility</label>
            <select
              id="visibility"
              onChange={(event) => setVisibility(event.target.value)}
              value={visibility}
            >
              <option value="PUBLIC">Public</option>
              <option value="PRIVATE">Private</option>
            </select>
          </div>
          <div className="action-row">
            <button
              className="primary-button translucent-cta"
              disabled={isPending || actor?.moderationStatus === "RESTRICTED"}
              onClick={handleCreateGame}
              type="button"
            >
              Create game
            </button>
            <a className="secondary-button" href="/auth/register">
              Full auth setup
            </a>
          </div>
        </div>
      </aside>
    </div>
  );
}
