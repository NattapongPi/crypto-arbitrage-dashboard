/**
 * Bybit WebSocket Adapter
 *
 * Two connections:
 *   - Spot: wss://stream.bybit.com/v5/public/spot
 *   - Linear: wss://stream.bybit.com/v5/public/linear (perps + quarterly futures)
 *
 * Requires sending {"op":"ping"} every 20 seconds.
 * Subscription: {"op":"subscribe","args":["tickers.BTCUSDT",...]}
 * Bybit does NOT provide a predicted funding rate via WebSocket.
 */

import { createWsManager } from './ws-manager'
import type { AdapterCallbacks, ExchangeAdapter, InstrumentInfo, NormalizedFundingRate, NormalizedTicker } from '../types'

const SPOT_WS_URL = 'wss://stream.bybit.com/v5/public/spot'
const LINEAR_WS_URL = 'wss://stream.bybit.com/v5/public/linear'
const PING_INTERVAL_MS = 20_000

// Bybit recommends max 10 topics per subscribe call, but we can send many calls
const SUBSCRIBE_BATCH_SIZE = 10

export function createBybitAdapter(): ExchangeAdapter {
  let spotManager: ReturnType<typeof createWsManager> | null = null
  let linearManager: ReturnType<typeof createWsManager> | null = null
  let spotPingTimer: ReturnType<typeof setInterval> | null = null
  let linearPingTimer: ReturnType<typeof setInterval> | null = null
  let callbacks: AdapterCallbacks | null = null

  // Symbol → baseAsset maps (populated in connect)
  let spotSymbolToBase = new Map<string, string>()
  let perpSymbolToBase = new Map<string, string>()
  let futuresSymbolInfo = new Map<string, { baseAsset: string; expiry: string; expiryLabel: string }>()

  function connect(instruments: InstrumentInfo[], cb: AdapterCallbacks) {
    callbacks = cb
    const bybitInstruments = instruments.filter((i) => i.exchange === 'Bybit')
    if (bybitInstruments.length === 0) return

    callbacks.onStatusChange('Bybit', 'CONNECTING')

    // Build lookup maps
    spotSymbolToBase = new Map()
    perpSymbolToBase = new Map()
    futuresSymbolInfo = new Map()

    for (const inst of bybitInstruments) {
      if (inst.spotSymbol) spotSymbolToBase.set(inst.spotSymbol, inst.baseAsset)
      if (inst.perpSymbol) perpSymbolToBase.set(inst.perpSymbol, inst.baseAsset)
      for (const contract of inst.futuresContracts) {
        futuresSymbolInfo.set(contract.symbol, {
          baseAsset: inst.baseAsset,
          expiry: contract.expiry,
          expiryLabel: contract.expiryLabel,
        })
      }
    }

    // ── Spot ─────────────────────────────────────────────────────────────────
    const spotTopics = bybitInstruments
      .filter((i) => i.spotSymbol)
      .map((i) => `tickers.${i.spotSymbol}`)

    spotManager = createWsManager({
      url: SPOT_WS_URL,
      onOpen: (send) => {
        subscribeBatched(send, spotTopics)
        spotPingTimer = setInterval(() => send(JSON.stringify({ op: 'ping' })), PING_INTERVAL_MS)
        callbacks?.onStatusChange('Bybit', 'LIVE', spotManager?.getLatency())
      },
      onMessage: (data) => handleMessage(data as BybitMsg, 'spot'),
      onClose: () => {
        if (spotPingTimer) clearInterval(spotPingTimer)
        callbacks?.onStatusChange('Bybit', 'CONNECTING')
      },
      onError: () => callbacks?.onStatusChange('Bybit', 'OFFLINE'),
    })

    // ── Linear (perps + futures) ──────────────────────────────────────────────
    const linearTopics: string[] = []
    for (const inst of bybitInstruments) {
      if (inst.perpSymbol) linearTopics.push(`tickers.${inst.perpSymbol}`)
      for (const contract of inst.futuresContracts) {
        linearTopics.push(`tickers.${contract.symbol}`)
      }
    }

    linearManager = createWsManager({
      url: LINEAR_WS_URL,
      onOpen: (send) => {
        subscribeBatched(send, linearTopics)
        linearPingTimer = setInterval(() => send(JSON.stringify({ op: 'ping' })), PING_INTERVAL_MS)
      },
      onMessage: (data) => handleMessage(data as BybitMsg, 'linear'),
      onClose: () => {
        if (linearPingTimer) clearInterval(linearPingTimer)
      },
      onError: () => callbacks?.onStatusChange('Bybit', 'OFFLINE'),
    })

    spotManager.connect()
    linearManager.connect()
  }

  function disconnect() {
    if (spotPingTimer) clearInterval(spotPingTimer)
    if (linearPingTimer) clearInterval(linearPingTimer)
    spotManager?.disconnect()
    linearManager?.disconnect()
    spotManager = null
    linearManager = null
    callbacks = null
  }

  function handleMessage(data: BybitMsg, source: 'spot' | 'linear') {
    if (!callbacks) return
    // Ignore pong and subscription confirmations
    if (!data?.topic || !data?.data) return
    if (!data.topic.startsWith('tickers.')) return

    const symbol = data.topic.replace('tickers.', '')
    const tickerData = data.data as BybitTickerData

    if (source === 'spot') {
      const baseAsset = spotSymbolToBase.get(symbol)
      if (!baseAsset) return

      const price = parseFloat(tickerData.lastPrice ?? '0')
      if (!price) return

      callbacks.onTicker({
        exchange: 'Bybit',
        baseAsset,
        type: 'spot',
        lastPrice: price,
        timestamp: data.ts ?? Date.now(),
      })
      return
    }

    // Linear: check if perp or futures
    const perpBase = perpSymbolToBase.get(symbol)
    if (perpBase) {
      const price = parseFloat(tickerData.lastPrice ?? '0')
      if (!price) return

      callbacks.onTicker({
        exchange: 'Bybit',
        baseAsset: perpBase,
        type: 'perp',
        lastPrice: price,
        timestamp: data.ts ?? Date.now(),
      })

      // Funding data is included in linear tickers
      const fundingRate = parseFloat(tickerData.fundingRate ?? '0')
      const nextFundingTime = parseInt(tickerData.nextFundingTime ?? '0')
      if (fundingRate && nextFundingTime) {
        const funding: NormalizedFundingRate = {
          exchange: 'Bybit',
          baseAsset: perpBase,
          fundingRate: fundingRate * 100, // Bybit gives 0.0001 = 0.01%, convert to 0.01
          nextFundingTime,
          // Bybit does not provide predictedRate via WS
        }
        callbacks.onFunding(funding)
      }
      return
    }

    // Check if it's a futures contract
    const futInfo = futuresSymbolInfo.get(symbol)
    if (futInfo) {
      const price = parseFloat(tickerData.lastPrice ?? '0')
      if (!price) return

      const ticker: NormalizedTicker = {
        exchange: 'Bybit',
        baseAsset: futInfo.baseAsset,
        type: 'future',
        expiry: futInfo.expiry,
        expiryLabel: futInfo.expiryLabel,
        lastPrice: price,
        timestamp: data.ts ?? Date.now(),
      }
      callbacks.onTicker(ticker)
    }
  }

  return { exchange: 'Bybit', connect, disconnect }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function subscribeBatched(send: (data: string) => void, topics: string[]) {
  for (let i = 0; i < topics.length; i += SUBSCRIBE_BATCH_SIZE) {
    const batch = topics.slice(i, i + SUBSCRIBE_BATCH_SIZE)
    send(JSON.stringify({ op: 'subscribe', args: batch }))
  }
}

// ── Bybit message types ────────────────────────────────────────────────────────

interface BybitMsg {
  topic?: string
  ts?: number
  data?: unknown
  op?: string
  ret_msg?: string
}

interface BybitTickerData {
  lastPrice?: string
  fundingRate?: string
  nextFundingTime?: string
}
