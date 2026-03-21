/**
 * ExchangeHub — server-side singleton that manages exchange WebSocket connections
 * and fans out normalized data to all connected browser clients.
 *
 * - Maintains one set of exchange connections shared across all browser clients
 * - Ref-counts subscriptions: opens exchange WS when first client subscribes,
 *   closes when last client unsubscribes or disconnects
 * - Broadcasts ticker/funding/status to all subscribed clients
 */

import type { WebSocket } from 'ws'
import type { AdapterCallbacks, Exchange, ExchangeAdapter, ExchangeStatus, InstrumentInfo, NormalizedFundingRate, NormalizedTicker } from '../types'
import { fetchAllInstruments } from './fetch-instruments'
import { createBinanceAdapter } from './adapters/binance'
import { createBybitAdapter } from './adapters/bybit'
import { createOKXAdapter } from './adapters/okx'
import { createDeribitAdapter } from './adapters/deribit'

interface ClientSession {
  ws: WebSocket
  subscribedExchanges: Set<Exchange>
}

type ServerMsg =
  | { type: 'ticker'; data: NormalizedTicker }
  | { type: 'funding'; data: NormalizedFundingRate }
  | { type: 'status'; data: { exchange: Exchange; status: ExchangeStatus; latency?: number } }
  | { type: 'pong'; ts: number }

export class ExchangeHub {
  private clients = new Set<ClientSession>()
  private adapters = new Map<Exchange, ExchangeAdapter>()
  private exchangeRefCount = new Map<Exchange, number>()
  private disconnectTimers = new Map<Exchange, ReturnType<typeof setTimeout>>()
  private instruments: InstrumentInfo[] = []
  private instrumentsFetched = false
  private instrumentsFetching: Promise<void> | null = null
  private exchangeStatus = new Map<Exchange, { status: ExchangeStatus; latency?: number }>()

  // How long to wait before closing an exchange connection after last client
  // unsubscribes. Prevents churn during React StrictMode double-mount or
  // brief page navigation.
  private static DISCONNECT_GRACE_MS = 5_000

  // ─── Client management ────────────────────────────────────────────────────

  addClient(ws: WebSocket) {
    const session: ClientSession = { ws, subscribedExchanges: new Set() }
    this.clients.add(session)

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString())
        this.handleClientMessage(session, msg)
      } catch {
        // Ignore malformed messages
      }
    })

    ws.on('close', () => {
      this.removeClient(session)
    })

    ws.on('error', () => {
      this.removeClient(session)
    })
  }

  private removeClient(session: ClientSession) {
    if (!this.clients.has(session)) return
    this.clients.delete(session)

    // Decrement ref count for each exchange the client was subscribed to
    for (const exchange of session.subscribedExchanges) {
      this.decrementRef(exchange)
    }
  }

  // ─── Client message handling ──────────────────────────────────────────────

  private handleClientMessage(session: ClientSession, msg: Record<string, unknown>) {
    if (msg.type === 'subscribe' && typeof msg.exchange === 'string') {
      this.subscribe(session, msg.exchange as Exchange)
    } else if (msg.type === 'unsubscribe' && typeof msg.exchange === 'string') {
      this.unsubscribe(session, msg.exchange as Exchange)
    } else if (msg.type === 'ping' && typeof msg.ts === 'number') {
      this.sendToClient(session.ws, { type: 'pong', ts: msg.ts })
    }
  }

  private async subscribe(session: ClientSession, exchange: Exchange) {
    if (session.subscribedExchanges.has(exchange)) return
    session.subscribedExchanges.add(exchange)

    // Ensure instruments are loaded before connecting
    await this.ensureInstruments()

    this.incrementRef(exchange, session)
  }

  private unsubscribe(session: ClientSession, exchange: Exchange) {
    if (!session.subscribedExchanges.has(exchange)) return
    session.subscribedExchanges.delete(exchange)
    this.decrementRef(exchange)
  }

  // ─── Ref counting ─────────────────────────────────────────────────────────

  private incrementRef(exchange: Exchange, session: ClientSession) {
    // Cancel any pending disconnect for this exchange
    const timer = this.disconnectTimers.get(exchange)
    if (timer) {
      clearTimeout(timer)
      this.disconnectTimers.delete(exchange)
    }

    const count = (this.exchangeRefCount.get(exchange) ?? 0) + 1
    this.exchangeRefCount.set(exchange, count)

    if (count === 1) {
      // First subscriber — open connection
      this.connectExchange(exchange)
    }

    // Always send current status immediately if we have it
    const current = this.exchangeStatus.get(exchange)
    if (current) {
      this.sendToClient(session.ws, { type: 'status', data: { exchange, ...current } })
    }
  }

  private decrementRef(exchange: Exchange) {
    const count = (this.exchangeRefCount.get(exchange) ?? 1) - 1
    this.exchangeRefCount.set(exchange, Math.max(0, count))

    if (count <= 0) {
      // Delay disconnect to handle brief client disconnects (StrictMode, page nav)
      const timer = setTimeout(() => {
        this.disconnectTimers.delete(exchange)
        if ((this.exchangeRefCount.get(exchange) ?? 0) <= 0) {
          this.disconnectExchange(exchange)
        }
      }, ExchangeHub.DISCONNECT_GRACE_MS)
      this.disconnectTimers.set(exchange, timer)
    }
  }

  // ─── Exchange adapter lifecycle ───────────────────────────────────────────

  private connectExchange(exchange: Exchange) {
    if (this.adapters.has(exchange)) return

    const adapter = this.createAdapter(exchange)
    this.adapters.set(exchange, adapter)

    const callbacks: AdapterCallbacks = {
      onTicker: (ticker) => {
        const msg = JSON.stringify({ type: 'ticker', data: ticker } satisfies ServerMsg)
        this.broadcast(exchange, msg)
      },
      onFunding: (funding) => {
        const msg = JSON.stringify({ type: 'funding', data: funding } satisfies ServerMsg)
        this.broadcast(exchange, msg)
      },
      onStatusChange: (ex, status, latency) => {
        this.exchangeStatus.set(ex, { status, latency })
        const msg = JSON.stringify({ type: 'status', data: { exchange: ex, status, latency } } satisfies ServerMsg)
        this.broadcast(ex, msg)
      },
    }

    adapter.connect(this.instruments, callbacks)
  }

  private disconnectExchange(exchange: Exchange) {
    const adapter = this.adapters.get(exchange)
    if (!adapter) return

    adapter.disconnect()
    this.adapters.delete(exchange)
  }

  private createAdapter(exchange: Exchange): ExchangeAdapter {
    switch (exchange) {
      case 'Binance': return createBinanceAdapter()
      case 'Bybit':   return createBybitAdapter()
      case 'OKX':     return createOKXAdapter()
      case 'Deribit': return createDeribitAdapter()
    }
  }

  // ─── Broadcasting ─────────────────────────────────────────────────────────

  private broadcast(exchange: Exchange, message: string) {
    for (const client of this.clients) {
      if (client.subscribedExchanges.has(exchange) && client.ws.readyState === 1 /* OPEN */) {
        client.ws.send(message)
      }
    }
  }

  private sendToClient(ws: WebSocket, msg: ServerMsg) {
    if (ws.readyState === 1 /* OPEN */) {
      ws.send(JSON.stringify(msg))
    }
  }

  // ─── Instruments ─────────────────────────────────────────────────────────

  private async ensureInstruments() {
    if (this.instrumentsFetched) return

    if (!this.instrumentsFetching) {
      this.instrumentsFetching = (async () => {
        try {
          this.instruments = await fetchAllInstruments()
          this.instrumentsFetched = true
        } catch {
          // Will retry on next subscribe
        } finally {
          this.instrumentsFetching = null
        }
      })()
    }

    await this.instrumentsFetching
  }

  // ─── Shutdown ─────────────────────────────────────────────────────────────

  shutdown() {
    for (const timer of this.disconnectTimers.values()) {
      clearTimeout(timer)
    }
    this.disconnectTimers.clear()
    for (const adapter of this.adapters.values()) {
      adapter.disconnect()
    }
    this.adapters.clear()
    for (const client of this.clients) {
      client.ws.close()
    }
    this.clients.clear()
  }
}
