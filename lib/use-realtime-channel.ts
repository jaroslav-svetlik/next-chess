"use client";

import { useEffect, useEffectEvent } from "react";

type RealtimeMessage = {
  at: string;
  channel: string;
  type: string;
  serverId?: string;
  seq?: number;
  reason?: string;
  gameId?: string;
  game?: unknown;
  games?: unknown;
  patch?: unknown;
};

type UseRealtimeChannelOptions = {
  channel: string | null;
  enabled?: boolean;
  onMessage: (message: RealtimeMessage) => void;
  onStatusChange?: (status: "connecting" | "connected" | "reconnecting" | "disconnected") => void;
};

export function useRealtimeChannel({
  channel,
  enabled = true,
  onMessage,
  onStatusChange
}: UseRealtimeChannelOptions) {
  const handleMessage = useEffectEvent(onMessage);
  const handleStatusChange = useEffectEvent(
    onStatusChange ?? (() => undefined)
  );

  useEffect(() => {
    if (!enabled || !channel) {
      return;
    }

    let websocket: WebSocket | null = null;
    let reconnectTimeout: number | null = null;
    let isClosed = false;

    const connect = () => {
      handleStatusChange(websocket ? "reconnecting" : "connecting");
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      websocket = new WebSocket(
        `${protocol}://${window.location.host}/ws?channel=${encodeURIComponent(channel)}`
      );

      websocket.onopen = () => {
        handleStatusChange("connected");
      };

      websocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as RealtimeMessage;
          handleMessage(message);

          if (message.serverId && typeof message.seq === "number" && websocket?.readyState === WebSocket.OPEN) {
            websocket.send(
              JSON.stringify({
                type: "ack",
                channel,
                serverId: message.serverId,
                seq: message.seq,
                receivedAt: new Date().toISOString()
              })
            );
          }
        } catch {
          // Ignore malformed packets and keep the connection alive.
        }
      };

      websocket.onerror = () => {
        // Let the browser drive the close lifecycle. Forcing close() while the
        // socket is still connecting creates noisy production console errors.
      };

      websocket.onclose = () => {
        if (isClosed) {
          handleStatusChange("disconnected");
          return;
        }

        handleStatusChange("reconnecting");
        reconnectTimeout = window.setTimeout(connect, 900);
      };
    };

    connect();

    return () => {
      isClosed = true;

      if (reconnectTimeout) {
        window.clearTimeout(reconnectTimeout);
      }

      handleStatusChange("disconnected");
      websocket?.close();
    };
  }, [channel, enabled, handleMessage, handleStatusChange]);
}
