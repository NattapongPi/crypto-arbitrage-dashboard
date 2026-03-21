/**
 * Client-side proxy adapter.
 *
 * Routes all exchange data through the server's /ws endpoint instead of
 * connecting directly to exchanges. All adapters share a single WebSocket
 * connection to the server (ref-counted).
 *
 * Implements ExchangeAdapter so useMarketData requires zero changes.
 */

import type { AdapterCallbacks, Exchange, ExchangeAdapter, InstrumentInfo } from '../types'
import { RECONNECT_BASE_DELAY_MS, RECONNECT_MAX_DELAY_MS } from '../constants'

// ─── Shared singleton connection ──────────────────────────────────────────────

let sharedWs: WebSocket | null = null
let sharedWsReady = false
let reconnectDelay = RECONNECT_BASE_DELAY_MS
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let shouldReconnect = true
let pingTimer: ReturnType<typeof setInterval> | null = null
let pingSentAt = 0
let latency: number | undefined = undefined
let visibilityListenerAdded = false

// Registry of active adapters (exchange → callbacks)
const registry = new Map<Exchange, AdapterCallbacks>()

// Listeners notified when proxy latency updates
const latencyListeners = new Set<(ms: number) => void>()

// Pending subscriptions to send once the socket opens
const pendingSubscriptions = new Set<Exchange>()

// Reconnect immediately when tab becomes visible again
function ensureVisibilityListener() {
  if (visibilityListenerAdded || typeof document === 'undefined') return
  visibilityListenerAdded = true
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !shouldReconnect) return

    if (!sharedWs || sharedWs.readyState === WebSocket.CLOSED || sharedWs.readyState === WebSocket.CLOSING) {
      // Socket is dead — reconnect immediately (reset backoff)
      reconnectDelay = RECONNECT_BASE_DELAY_MS
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
      openSharedSocket()
    } else if (sharedWs.readyState === WebSocket.OPEN) {
      // Socket is still open — ask server to resend all current statuses
      sharedWs.send(JSON.stringify({ type: 'sync' }))
    }
  })
}

function getWsUrl(): string {
  // Allow overriding the WS endpoint via env var (needed for Railway TCP proxy)
  const override = process.env.NEXT_PUBLIC_WS_URL
  if (override) return override
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/ws`
}

function openSharedSocket() {
  if (sharedWs && (sharedWs.readyState === WebSocket.OPEN || sharedWs.readyState === WebSocket.CONNECTING)) {
    return
  }

  shouldReconnect = true
  sharedWs = new WebSocket(getWsUrl())

  sharedWs.onopen = () => {
    sharedWsReady = true
    reconnectDelay = RECONNECT_BASE_DELAY_MS

    // Re-subscribe all active adapters (handles reconnection too)
    for (const exchange of registry.keys()) {
      sharedWs!.send(JSON.stringify({ type: 'subscribe', exchange }))
    }
    for (const exchange of pendingSubscriptions) {
      sharedWs!.send(JSON.stringify({ type: 'subscribe', exchange }))
    }
    pendingSubscriptions.clear()

    // Ask server to immediately resend current status for all subscribed exchanges
    sharedWs!.send(JSON.stringify({ type: 'sync' }))

    // Send an immediate ping to get latency right away
    pingSentAt = Date.now()
    sharedWs!.send(JSON.stringify({ type: 'ping', ts: pingSentAt }))

    // Start ping/pong for latency tracking
    pingTimer = setInterval(() => {
      if (sharedWs?.readyState === WebSocket.OPEN) {
        pingSentAt = Date.now()
        sharedWs.send(JSON.stringify({ type: 'ping', ts: pingSentAt }))
      }
    }, 10_000)
  }

  sharedWs.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data as string)
      dispatchMessage(msg)
    } catch {
      // Ignore parse errors
    }
  }

  sharedWs.onclose = () => {
    sharedWsReady = false
    if (pingTimer) { clearInterval(pingTimer); pingTimer = null }

    // Notify all registered adapters
    for (const [exchange, callbacks] of registry) {
      callbacks.onStatusChange(exchange, 'CONNECTING')
    }

    if (shouldReconnect) {
      reconnectTimer = setTimeout(() => {
        reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_DELAY_MS)
        openSharedSocket()
      }, reconnectDelay)
    }
  }

  sharedWs.onerror = () => {
    // onclose fires after onerror — reconnection handled there
  }
}

function closeSharedSocket() {
  shouldReconnect = false
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
  if (pingTimer) { clearInterval(pingTimer); pingTimer = null }
  if (sharedWs) {
    sharedWs.close()
    sharedWs = null
  }
  sharedWsReady = false
}

function dispatchMessage(msg: Record<string, unknown>) {
  if (msg.type === 'pong' && typeof msg.ts === 'number') {
    latency = Date.now() - msg.ts
    for (const fn of latencyListeners) fn(latency)
    return
  }

  if (msg.type === 'ticker' || msg.type === 'funding' || msg.type === 'status') {
    const data = msg.data as Record<string, unknown>
    const exchange = data?.exchange as Exchange | undefined
    if (!exchange) return

    const callbacks = registry.get(exchange)
    if (!callbacks) return

    if (msg.type === 'ticker') {
      callbacks.onTicker(data as Parameters<AdapterCallbacks['onTicker']>[0])
    } else if (msg.type === 'funding') {
      callbacks.onFunding(data as Parameters<AdapterCallbacks['onFunding']>[0])
    } else if (msg.type === 'status') {
      callbacks.onStatusChange(
        exchange,
        data.status as Parameters<AdapterCallbacks['onStatusChange']>[1],
        typeof data.latency === 'number' ? data.latency : undefined
      )
    }
  }
}

// ─── Proxy adapter factory ────────────────────────────────────────────────────

export function createProxyAdapter(exchange: Exchange): ExchangeAdapter {
  return {
    exchange,

    connect(_instruments: InstrumentInfo[], callbacks: AdapterCallbacks) {
      registry.set(exchange, callbacks)
      callbacks.onStatusChange(exchange, 'CONNECTING')
      ensureVisibilityListener()

      if (!sharedWs || sharedWs.readyState === WebSocket.CLOSED || sharedWs.readyState === WebSocket.CLOSING) {
        openSharedSocket()
      }

      if (sharedWsReady && sharedWs?.readyState === WebSocket.OPEN) {
        sharedWs.send(JSON.stringify({ type: 'subscribe', exchange }))
      } else {
        pendingSubscriptions.add(exchange)
      }
    },

    disconnect() {
      registry.delete(exchange)
      pendingSubscriptions.delete(exchange)

      if (sharedWs?.readyState === WebSocket.OPEN) {
        sharedWs.send(JSON.stringify({ type: 'unsubscribe', exchange }))
      }

      // Close shared socket if no more adapters are active
      if (registry.size === 0) {
        closeSharedSocket()
      }
    },
  }
}

/** Expose latency for any adapter to report (shared connection, single latency). */
export function getProxyLatency(): number | undefined {
  return latency
}

/** Subscribe to proxy latency updates (called on each pong). Returns unsubscribe fn. */
export function onProxyLatency(fn: (ms: number) => void): () => void {
  latencyListeners.add(fn)
  return () => latencyListeners.delete(fn)
}
