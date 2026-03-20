/**
 * Reconnecting WebSocket utility.
 * Creates a WebSocket that automatically reconnects with exponential backoff.
 * Returns a simple object with connect/disconnect/send/getLatency.
 */

import { RECONNECT_BASE_DELAY_MS, RECONNECT_MAX_DELAY_MS } from '../constants'

export type WsState = 'CONNECTING' | 'OPEN' | 'CLOSING' | 'CLOSED' | 'RECONNECTING'

export interface WsManager {
  connect: () => void
  disconnect: () => void
  send: (data: string) => void
  getState: () => WsState
  getLatency: () => number | undefined
}

interface WsManagerOptions {
  url: string
  onOpen: (send: (data: string) => void) => void
  onMessage: (data: unknown) => void
  onClose: () => void
  onError: (e: Event) => void
}

export function createWsManager(options: WsManagerOptions): WsManager {
  const { url, onOpen, onMessage, onClose, onError } = options

  let ws: WebSocket | null = null
  let state: WsState = 'CLOSED'
  let reconnectDelay = RECONNECT_BASE_DELAY_MS
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let shouldReconnect = true
  let latency: number | undefined = undefined
  let lastPongTime: number | undefined = undefined

  function send(data: string) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(data)
    }
  }

  function connect() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      return
    }

    shouldReconnect = true
    state = 'CONNECTING'

    ws = new WebSocket(url)

    ws.onopen = () => {
      state = 'OPEN'
      reconnectDelay = RECONNECT_BASE_DELAY_MS
      onOpen(send)
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string)
        onMessage(data)
      } catch {
        // Some exchanges send plain text pong responses
        onMessage(event.data)
      }
    }

    ws.onclose = () => {
      state = 'CLOSED'
      onClose()
      if (shouldReconnect) {
        state = 'RECONNECTING'
        reconnectTimer = setTimeout(() => {
          reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_DELAY_MS)
          connect()
        }, reconnectDelay)
      }
    }

    ws.onerror = (e) => {
      onError(e)
      // onclose fires after onerror, so reconnection is handled there
    }
  }

  function disconnect() {
    shouldReconnect = false
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    if (ws) {
      state = 'CLOSING'
      ws.close()
      ws = null
    }
    state = 'CLOSED'
  }

  /**
   * Track latency by recording the time between a ping sent and pong received.
   * Call this when you receive a pong response from the exchange.
   */
  function recordPong(pingSentAt: number) {
    lastPongTime = Date.now()
    latency = lastPongTime - pingSentAt
  }

  const manager = {
    connect,
    disconnect,
    send,
    getState: () => state,
    getLatency: () => latency,
    recordPong,
  }

  return manager
}

/** Utility used by the market data hook to read adapter status. */
export function determineExchangeStatus(latency?: number): import('../types').ExchangeStatus {
  if (latency === undefined) return 'CONNECTING'
  if (latency > 150) return 'SLOW'
  return 'LIVE'
}
