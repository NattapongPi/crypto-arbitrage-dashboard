/**
 * Server-side reconnecting WebSocket utility (Node.js).
 * Port of lib/exchanges/ws-manager.ts using the `ws` library instead of browser WebSocket.
 * Identical interface so exchange adapters can import this with minimal changes.
 */

import WebSocket from "ws";
import { RECONNECT_BASE_DELAY_MS, RECONNECT_MAX_DELAY_MS } from "../constants";

export type WsState =
  | "CONNECTING"
  | "OPEN"
  | "CLOSING"
  | "CLOSED"
  | "RECONNECTING";

// WebSocket message can be parsed JSON (object) or raw string (e.g., pong)
type WsMessage = Record<string, unknown> | string;

export interface WsManager {
  connect: () => void;
  disconnect: () => void;
  send: (data: string) => void;
  getState: () => WsState;
  getLatency: () => number | undefined;
  recordPong: (pingSentAt: number) => void;
}

interface WsManagerOptions {
  url: string;
  onOpen: (send: (data: string) => void) => void;
  onMessage: (data: WsMessage) => void;
  onClose: () => void;
  onError: (e: Error) => void;
}

export function createWsManager(options: WsManagerOptions): WsManager {
  const { url, onOpen, onMessage, onClose, onError } = options;

  let ws: WebSocket | null = null;
  let state: WsState = "CLOSED";
  let reconnectDelay = RECONNECT_BASE_DELAY_MS;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let shouldReconnect = true;
  let latency: number | undefined = undefined;

  function send(data: string) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }

  function connect() {
    if (
      ws &&
      (ws.readyState === WebSocket.OPEN ||
        ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    shouldReconnect = true;
    state = "CONNECTING";

    ws = new WebSocket(url);

    ws.on("open", () => {
      state = "OPEN";
      reconnectDelay = RECONNECT_BASE_DELAY_MS;
      onOpen(send);
    });

    ws.on("message", (raw) => {
      const text = raw.toString();
      try {
        onMessage(JSON.parse(text));
      } catch {
        // Some exchanges send plain text responses (e.g. pong)
        onMessage(text);
      }
    });

    ws.on("close", () => {
      state = "CLOSED";
      onClose();
      if (shouldReconnect) {
        state = "RECONNECTING";
        reconnectTimer = setTimeout(() => {
          reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_DELAY_MS);
          connect();
        }, reconnectDelay);
      }
    });

    ws.on("error", (err) => {
      onError(err);
      // 'close' fires after 'error', reconnection handled there
    });
  }

  function disconnect() {
    shouldReconnect = false;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (ws) {
      state = "CLOSING";
      ws.close();
      ws = null;
    }
    state = "CLOSED";
  }

  function recordPong(pingSentAt: number) {
    latency = Date.now() - pingSentAt;
  }

  return {
    connect,
    disconnect,
    send,
    getState: () => state,
    getLatency: () => latency,
    recordPong,
  };
}
