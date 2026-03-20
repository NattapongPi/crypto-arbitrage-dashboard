/**
 * Deribit WebSocket Adapter
 *
 * Single connection: wss://www.deribit.com/ws/api/v2
 * Uses JSON-RPC 2.0 protocol.
 *
 * Key quirks:
 *   - No native spot market — uses index_price from perpetual ticker as spot reference
 *   - Must call public/set_heartbeat after connecting and respond to test_request
 *   - Funding rate is in the perpetual ticker as current_funding (annualized) and funding_8h
 *   - Supports BTC, ETH, and a few others (SOL has limited coverage)
 *   - Instrument names: BTC-PERPETUAL, BTC-27JUN25, ETH-27JUN25, etc.
 */

import { createWsManager } from './ws-manager'
import type { AdapterCallbacks, ExchangeAdapter, InstrumentInfo, NormalizedFundingRate } from '../types'

const WS_URL = 'wss://www.deribit.com/ws/api/v2'
const HEARTBEAT_INTERVAL_S = 30

export function createDeribitAdapter(): ExchangeAdapter {
  let manager: ReturnType<typeof createWsManager> | null = null
  let callbacks: AdapterCallbacks | null = null
  let rpcId = 1

  let perpInstToBase = new Map<string, string>()
  let futuresInstInfo = new Map<string, { baseAsset: string; expiry: string; expiryLabel: string }>()

  function nextId() {
    return rpcId++
  }

  function sendRpc(method: string, params: Record<string, unknown>) {
    manager?.send(JSON.stringify({ jsonrpc: '2.0', id: nextId(), method, params }))
  }

  function connect(instruments: InstrumentInfo[], cb: AdapterCallbacks) {
    callbacks = cb
    const deribitInstruments = instruments.filter((i) => i.exchange === 'Deribit')
    if (deribitInstruments.length === 0) return

    callbacks.onStatusChange('Deribit', 'CONNECTING')

    perpInstToBase = new Map()
    futuresInstInfo = new Map()

    const channels: string[] = []

    for (const inst of deribitInstruments) {
      if (inst.perpSymbol) {
        perpInstToBase.set(inst.perpSymbol, inst.baseAsset)
        channels.push(`ticker.${inst.perpSymbol}.raw`)
      }
      for (const contract of inst.futuresContracts) {
        futuresInstInfo.set(contract.symbol, {
          baseAsset: inst.baseAsset,
          expiry: contract.expiry,
          expiryLabel: contract.expiryLabel,
        })
        channels.push(`ticker.${contract.symbol}.raw`)
      }
    }

    manager = createWsManager({
      url: WS_URL,
      onOpen: () => {
        // Set up heartbeat first
        sendRpc('public/set_heartbeat', { interval: HEARTBEAT_INTERVAL_S })
        // Subscribe to all channels
        sendRpc('public/subscribe', { channels })
        callbacks?.onStatusChange('Deribit', 'LIVE', manager?.getLatency())
      },
      onMessage: (data) => handleMessage(data as DeribitMsg),
      onClose: () => callbacks?.onStatusChange('Deribit', 'CONNECTING'),
      onError: () => callbacks?.onStatusChange('Deribit', 'OFFLINE'),
    })

    manager.connect()
  }

  function disconnect() {
    manager?.disconnect()
    manager = null
    callbacks = null
  }

  function handleMessage(data: DeribitMsg) {
    if (!callbacks) return

    // Respond to heartbeat test_request
    if (data.method === 'public/test') {
      sendRpc('public/test', {})
      return
    }

    if (data.method !== 'subscription') return
    const channel = data.params?.channel ?? ''
    const tickerData = data.params?.data as DeribitTicker | undefined
    if (!tickerData) return

    // channel format: "ticker.BTC-PERPETUAL.raw" or "ticker.BTC-27JUN25.raw"
    const instrumentName = channel.split('.')[1]
    if (!instrumentName) return

    const price = tickerData.last_price
    const ts = Date.now()

    // Check if it's a perpetual
    const perpBase = perpInstToBase.get(instrumentName)
    if (perpBase) {
      // Emit the perp price
      if (price) {
        callbacks.onTicker({
          exchange: 'Deribit',
          baseAsset: perpBase,
          type: 'perp',
          lastPrice: price,
          timestamp: ts,
        })
      }

      // Emit the index price as "spot" reference
      const indexPrice = tickerData.index_price
      if (indexPrice) {
        callbacks.onTicker({
          exchange: 'Deribit',
          baseAsset: perpBase,
          type: 'spot',
          lastPrice: indexPrice,
          timestamp: ts,
        })
      }

      // Emit funding rate
      // Deribit funding_8h is the rate for the current 8h period
      const funding8h = tickerData.funding_8h
      const currentFunding = tickerData.current_funding
      if (funding8h !== undefined) {
        const funding: NormalizedFundingRate = {
          exchange: 'Deribit',
          baseAsset: perpBase,
          // Deribit gives funding_8h as a decimal, e.g. 0.00041 = 0.041%
          fundingRate: (currentFunding ?? funding8h) * 100,
          nextFundingTime: nextDeribitFundingTime(),
          openInterest: tickerData.open_interest,
        }
        callbacks.onFunding(funding)
      }
      return
    }

    // Check if it's a futures contract
    const futInfo = futuresInstInfo.get(instrumentName)
    if (futInfo && price) {
      callbacks.onTicker({
        exchange: 'Deribit',
        baseAsset: futInfo.baseAsset,
        type: 'future',
        expiry: futInfo.expiry,
        expiryLabel: futInfo.expiryLabel,
        lastPrice: price,
        timestamp: ts,
      })
    }
  }

  return { exchange: 'Deribit', connect, disconnect }
}

// Deribit settles funding every 8 hours at 00:00, 08:00, 16:00 UTC
function nextDeribitFundingTime(): number {
  const now = new Date()
  const utcHours = now.getUTCHours()
  const nextHour = utcHours < 8 ? 8 : utcHours < 16 ? 16 : 24
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), nextHour % 24))
  if (nextHour === 24) next.setUTCDate(next.getUTCDate() + 1)
  return next.getTime()
}

// ── Deribit message types ──────────────────────────────────────────────────────

interface DeribitMsg {
  jsonrpc?: string
  method?: string
  params?: {
    channel?: string
    data?: unknown
  }
  id?: number
}

interface DeribitTicker {
  last_price?: number
  index_price?: number
  funding_8h?: number
  current_funding?: number
  open_interest?: number
}
