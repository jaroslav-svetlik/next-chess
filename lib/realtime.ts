import { getPgPool, getSingletonPgListener } from "./pg.ts";
import { logError, logInfo } from "./observability.ts";
import { fetchGameRealtimeSnapshot, listLobbyRealtimeSnapshots } from "./realtime-snapshots.ts";

type Listener = (payload: string) => void;

type LocalRealtimeState = {
  channels: Map<string, Set<Listener>>;
  listenerReady?: Promise<void>;
  serverId: string;
  nextSeq: number;
};

const REALTIME_NOTIFY_CHANNEL = "chess_realtime";

declare global {
  var __grandmateRealtimeState: LocalRealtimeState | undefined;
}

function getRealtimeState() {
  globalThis.__grandmateRealtimeState ??= {
    channels: new Map<string, Set<Listener>>(),
    serverId: crypto.randomUUID(),
    nextSeq: 0
  };

  return globalThis.__grandmateRealtimeState;
}

function dispatchLocal(channel: string, payload: string) {
  const listeners = getRealtimeState().channels.get(channel);

  if (!listeners?.size) {
    return;
  }

  for (const listener of listeners) {
    listener(payload);
  }
}

async function ensureSharedListener() {
  const state = getRealtimeState();

  state.listenerReady ??= (async () => {
    const client = await getSingletonPgListener(REALTIME_NOTIFY_CHANNEL);

    client.on("notification", (message) => {
      if (message.channel !== REALTIME_NOTIFY_CHANNEL || !message.payload) {
        return;
      }

      try {
        const payload = JSON.parse(message.payload) as {
          channel?: string;
          message?: string;
        };

        if (!payload.channel || !payload.message) {
          return;
        }

        dispatchLocal(payload.channel, payload.message);
      } catch (error) {
        logError("realtime.notification_parse_failed", {
          message: error instanceof Error ? error.message : "Unknown notification parse failure."
        });
      }
    });

    logInfo("realtime.listener_ready", {
      transport: "postgres_notify",
      notifyChannel: REALTIME_NOTIFY_CHANNEL
    });
  })();

  return state.listenerReady;
}

function getListeners(channel: string) {
  const state = getRealtimeState();
  let listeners = state.channels.get(channel);

  if (!listeners) {
    listeners = new Set<Listener>();
    state.channels.set(channel, listeners);
  }

  return listeners;
}

export function subscribe(channel: string, listener: Listener) {
  void ensureSharedListener().catch((error) => {
    logError("realtime.listener_init_failed", {
      channel,
      message: error instanceof Error ? error.message : "Unknown realtime init failure."
    });
  });

  const listeners = getListeners(channel);
  listeners.add(listener);

  return () => {
    listeners.delete(listener);

    if (!listeners.size) {
      getRealtimeState().channels.delete(channel);
    }
  };
}

export async function publish(channel: string, payload: Record<string, unknown>) {
  const state = getRealtimeState();
  state.nextSeq += 1;

  const message = JSON.stringify({
    at: new Date().toISOString(),
    channel,
    serverId: state.serverId,
    seq: state.nextSeq,
    ...payload
  });

  try {
    await getPgPool().query("SELECT pg_notify($1, $2)", [
      REALTIME_NOTIFY_CHANNEL,
      JSON.stringify({
        channel,
        message
      })
    ]);
  } catch (error) {
    logError("realtime.publish_failed", {
      channel,
      message: error instanceof Error ? error.message : "Unknown realtime publish failure."
    });
    throw error;
  }
}

export async function publishLobbyUpdate(
  reason: string,
  options?: {
    gameId?: string;
    games?: unknown;
    patch?: unknown;
  }
) {
  const games =
    options?.games === undefined && options?.patch === undefined
      ? await listLobbyRealtimeSnapshots()
      : options?.games;

  return publish("lobby", {
    type: "lobby_update",
    reason,
    gameId: options?.gameId,
    games,
    patch: options?.patch
  });
}

export async function publishGameUpdate(
  gameId: string,
  reason: string,
  options?: {
    game?: unknown;
    patch?: unknown;
  }
) {
  const game =
    options?.game === undefined && options?.patch === undefined
      ? await fetchGameRealtimeSnapshot(gameId)
      : options?.game;

  return publish(`game:${gameId}`, {
    type: "game_update",
    reason,
    gameId,
    game,
    patch: options?.patch
  });
}
