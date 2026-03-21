/**
 * OKX WebSocket Adapter (server-side)
 * Identical to lib/exchanges/okx.ts but uses server-ws-manager (Node.js ws library).
 */

import { createWsManager } from '../server-ws-manager'
import type { AdapterCallbacks, ExchangeAdapter, InstrumentInfo, NormalizedFundingRate } from '../../types'

const WS_URL = 'wss://ws.okx.com:8443/ws/v5/public'

export function createOKXAdapter(): ExchangeAdapter {
  let manager: ReturnType<typeof createWsManager> | null = null
  let callbacks: AdapterCallbacks | null = null

  let spotInstToBase = new Map<string, string>()
  let swapInstToBase = new Map<string, string>()
  let futuresInstInfo = new Map<string, { baseAsset: string; expiry: string; expiryLabel: string }>()

  function connect(instruments: InstrumentInfo[], cb: AdapterCallbacks) {
    callbacks = cb
    const okxInstruments = instruments.filter((i) => i.exchange === 'OKX')
    if (okxInstruments.length === 0) return

    callbacks.onStatusChange('OKX', 'CONNECTING')

    spotInstToBase = new Map()
    swapInstToBase = new Map()
    futuresInstInfo = new Map()

    const subscriptions: OKXChannel[] = []

    for (const inst of okxInstruments) {
      if (inst.spotSymbol) {
        spotInstToBase.set(inst.spotSymbol, inst.baseAsset)
        subscriptions.push({ channel: 'tickers', instId: inst.spotSymbol })
      }
      if (inst.perpSymbol) {
        swapInstToBase.set(inst.perpSymbol, inst.baseAsset)
        subscriptions.push({ channel: 'tickers', instId: inst.perpSymbol })
        subscriptions.push({ channel: 'funding-rate', instId: inst.perpSymbol })
      }
      for (const contract of inst.futuresContracts) {
        futuresInstInfo.set(contract.symbol, {
          baseAsset: inst.baseAsset,
          expiry: contract.expiry,
          expiryLabel: contract.expiryLabel,
        })
        subscriptions.push({ channel: 'tickers', instId: contract.symbol })
      }
    }

    manager = createWsManager({
      url: WS_URL,
      onOpen: (send) => {
        const BATCH = 100
        for (let i = 0; i < subscriptions.length; i += BATCH) {
          send(JSON.stringify({ op: 'subscribe', args: subscriptions.slice(i, i + BATCH) }))
        }
        callbacks?.onStatusChange('OKX', 'LIVE', manager?.getLatency())
      },
      onMessage: (data) => handleMessage(data as OKXMsg),
      onClose: () => callbacks?.onStatusChange('OKX', 'CONNECTING'),
      onError: () => callbacks?.onStatusChange('OKX', 'OFFLINE'),
    })

    manager.connect()
  }

  function disconnect() {
    manager?.disconnect()
    manager = null
    callbacks = null
  }

  function handleMessage(data: OKXMsg) {
    if (!callbacks) return

    if ((data as unknown as { event: string }).event === 'ping') {
      manager?.send(JSON.stringify({ op: 'pong' }))
      return
    }

    const channel = data?.arg?.channel
    const instId = data?.arg?.instId
    if (!channel || !instId || !data.data || !Array.isArray(data.data)) return

    if (channel === 'tickers') {
      const tick = data.data[0] as OKXTicker
      const price = parseFloat(tick.last ?? '0')
      if (!price) return
      const ts = parseInt(tick.ts ?? '0') || Date.now()

      const spotBase = spotInstToBase.get(instId)
      if (spotBase) {
        callbacks.onTicker({ exchange: 'OKX', baseAsset: spotBase, type: 'spot', lastPrice: price, timestamp: ts })
        return
      }

      const swapBase = swapInstToBase.get(instId)
      if (swapBase) {
        callbacks.onTicker({ exchange: 'OKX', baseAsset: swapBase, type: 'perp', lastPrice: price, timestamp: ts })
        return
      }

      const futInfo = futuresInstInfo.get(instId)
      if (futInfo) {
        callbacks.onTicker({
          exchange: 'OKX',
          baseAsset: futInfo.baseAsset,
          type: 'future',
          expiry: futInfo.expiry,
          expiryLabel: futInfo.expiryLabel,
          lastPrice: price,
          timestamp: ts,
        })
      }
      return
    }

    if (channel === 'funding-rate') {
      const fr = data.data[0] as OKXFundingRate
      const baseAsset = swapInstToBase.get(instId)
      if (!baseAsset) return

      const funding: NormalizedFundingRate = {
        exchange: 'OKX',
        baseAsset,
        fundingRate: parseFloat(fr.fundingRate ?? '0') * 100,
        predictedRate: fr.nextFundingRate ? parseFloat(fr.nextFundingRate) * 100 : undefined,
        nextFundingTime: parseInt(fr.fundingTime ?? '0'),
      }
      callbacks.onFunding(funding)
    }
  }

  return { exchange: 'OKX', connect, disconnect }
}

interface OKXChannel {
  channel: string
  instId: string
}

interface OKXMsg {
  arg?: OKXChannel
  data?: unknown[]
}

interface OKXTicker {
  last?: string
  ts?: string
}

interface OKXFundingRate {
  fundingRate?: string
  nextFundingRate?: string
  fundingTime?: string
}
