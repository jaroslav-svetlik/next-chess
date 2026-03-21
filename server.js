const { createServer } = require("node:http");
const next = require("next");
const { Client } = require("pg");
const { WebSocketServer } = require("ws");

const dev = process.env.NODE_ENV !== "production";
const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 3000);
const app = next({ dev, hostname: host, port });
const handle = app.getRequestHandler();
const REALTIME_NOTIFY_CHANNEL = "chess_realtime";
const ARENA_CHAT_NOTIFY_CHANNEL = "chess_realtime_chat";
const socketsByChannel = new Map();

function isValidChannel(channel) {
  return channel === "lobby" || channel === "arena-chat" || channel.startsWith("game:");
}

function getSockets(channel) {
  let sockets = socketsByChannel.get(channel);

  if (!sockets) {
    sockets = new Set();
    socketsByChannel.set(channel, sockets);
  }

  return sockets;
}

async function initRealtimeListener() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  await client.connect();
  await client.query(`LISTEN ${REALTIME_NOTIFY_CHANNEL}`);
  await client.query(`LISTEN ${ARENA_CHAT_NOTIFY_CHANNEL}`);

  client.on("notification", (message) => {
    if (
      (message.channel !== REALTIME_NOTIFY_CHANNEL &&
        message.channel !== ARENA_CHAT_NOTIFY_CHANNEL) ||
      !message.payload
    ) {
      return;
    }

    try {
      const payload = JSON.parse(message.payload);
      const channel = payload?.channel;
      const realtimeMessage = payload?.message;

      if (!channel || !realtimeMessage) {
        return;
      }

      const sockets = socketsByChannel.get(channel);
      if (!sockets?.size) {
        return;
      }

      for (const socket of sockets) {
        if (socket.readyState === socket.OPEN) {
          socket.send(realtimeMessage);
        }
      }
    } catch (error) {
      console.error(
        JSON.stringify({
          at: new Date().toISOString(),
          level: "error",
          event: "realtime.server_notification_parse_failed",
          message: error instanceof Error ? error.message : "Unknown notification parse failure."
        })
      );
    }
  });

  client.on("error", (error) => {
    console.error(
      JSON.stringify({
        at: new Date().toISOString(),
        level: "error",
        event: "realtime.server_listener_failed",
        message: error instanceof Error ? error.message : "Unknown realtime listener failure."
      })
    );
  });

  console.log(
    JSON.stringify({
      at: new Date().toISOString(),
      level: "info",
      event: "realtime.server_listener_ready",
      transport: "postgres_notify",
      notifyChannels: [REALTIME_NOTIFY_CHANNEL, ARENA_CHAT_NOTIFY_CHANNEL]
    })
  );
}

app.prepare().then(() => {
  const handleUpgrade = app.getUpgradeHandler();
  const server = createServer((request, response) => {
    void handle(request, response);
  });

  const websocketServer = new WebSocketServer({ noServer: true });

  websocketServer.on("connection", (socket, request, channel) => {
    const sockets = getSockets(channel);
    sockets.add(socket);

    socket.send(
      JSON.stringify({
        at: new Date().toISOString(),
        channel,
        type: "connected"
      })
    );

    const heartbeat = setInterval(() => {
      if (socket.readyState === socket.OPEN) {
        socket.ping();
      }
    }, 25000);

    const closeConnection = () => {
      clearInterval(heartbeat);
      sockets.delete(socket);
      if (!sockets.size) {
        socketsByChannel.delete(channel);
      }

      console.log(
        JSON.stringify({
          at: new Date().toISOString(),
          level: "info",
          event: "realtime.ws_disconnected",
          channel,
          remainingChannelSockets: sockets.size
        })
      );
    };

    console.log(
      JSON.stringify({
        at: new Date().toISOString(),
        level: "info",
        event: "realtime.ws_connected",
        channel,
        activeChannelSockets: sockets.size
      })
    );

    socket.on("close", closeConnection);
    socket.on("error", closeConnection);
    socket.on("message", (rawMessage) => {
      try {
        const message = JSON.parse(String(rawMessage));

        if (message?.type !== "ack") {
          return;
        }

        console.log(
          JSON.stringify({
            at: new Date().toISOString(),
            level: "info",
            event: "realtime.ws_ack",
            channel,
            serverId: message.serverId,
            seq: message.seq,
            receivedAt: message.receivedAt ?? null
          })
        );
      } catch {
        return;
      }
    });
  });

  server.on("upgrade", (request, socket, head) => {
    try {
      const url = new URL(request.url || "/", `http://${request.headers.host || host}`);

      if (url.pathname !== "/ws") {
        void handleUpgrade(request, socket, head);
        return;
      }

      const channel = url.searchParams.get("channel");

      if (!channel || !isValidChannel(channel)) {
        socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
        socket.destroy();
        return;
      }

      websocketServer.handleUpgrade(request, socket, head, (websocket) => {
        websocketServer.emit("connection", websocket, request, channel);
      });
    } catch {
      socket.destroy();
    }
  });

  void initRealtimeListener().catch((error) => {
    console.error(
      JSON.stringify({
        at: new Date().toISOString(),
        level: "error",
        event: "realtime.server_listener_boot_failed",
        message: error instanceof Error ? error.message : "Unknown realtime boot failure."
      })
    );
  });

  server.listen(port, host, () => {
    console.log(`> Ready on http://${host}:${port}`);
    console.log(`> WebSocket endpoint ws://${host}:${port}/ws`);
  });
});
