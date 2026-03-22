/**
 * Server-side instrument fetching.
 * Shared between the /api/instruments route handler and the ExchangeHub.
 */

import type { InstrumentInfo, FuturesContract } from '../types'
import { MAX_PAIRS_PER_EXCHANGE } from '../constants'

const FETCH_TIMEOUT_MS = 10_000

// ─── Binance ──────────────────────────────────────────────────────────────────

async function fetchBinanceInstruments(): Promise<InstrumentInfo[]> {
  const [spotInfo, futuresInfo, futuresTickers] = await Promise.all([
    fetch('https://api.binance.com/api/v3/exchangeInfo?permissions=SPOT', { cache: 'no-store', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }).then((r) => r.json() as Promise<any>),
    fetch('https://fapi.binance.com/fapi/v1/exchangeInfo', { cache: 'no-store', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }).then((r) => r.json() as Promise<any>),
    fetch('https://fapi.binance.com/fapi/v1/ticker/24hr', { cache: 'no-store', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }).then((r) => r.json() as Promise<any>),
  ])

  const volumeMap = new Map<string, number>()
  for (const t of futuresTickers as { symbol: string; quoteVolume: string }[]) {
    volumeMap.set(t.symbol, parseFloat(t.quoteVolume))
  }

  const spotSymbols = new Set<string>()
  for (const s of spotInfo.symbols as { symbol: string; status: string; quoteAsset: string }[]) {
    if (s.status === 'TRADING' && s.quoteAsset === 'USDT') {
      spotSymbols.add(s.symbol)
    }
  }

  const assetMap = new Map<string, { perpSymbol?: string; futures: FuturesContract[] }>()

  for (const s of futuresInfo.symbols as {
    symbol: string
    status: string
    baseAsset: string
    quoteAsset: string
    contractType: string
    deliveryDate?: number
  }[]) {
    if (s.status !== 'TRADING' || s.quoteAsset !== 'USDT') continue

    const base = s.baseAsset
    if (!assetMap.has(base)) assetMap.set(base, { futures: [] })
    const entry = assetMap.get(base)!

    if (s.contractType === 'PERPETUAL') {
      entry.perpSymbol = s.symbol
    } else if (s.contractType === 'NEXT_QUARTER' || s.contractType === 'CURRENT_QUARTER') {
      const expiry = new Date(s.deliveryDate!).toISOString().split('T')[0]
      const expiryLabel = formatExpiryLabel(expiry)
      entry.futures.push({ symbol: s.symbol, expiry, expiryLabel })
    }
  }

  const results: InstrumentInfo[] = []
  for (const [base, { perpSymbol, futures }] of assetMap) {
    if (!perpSymbol) continue
    const spotSymbol = `${base}USDT`
    const volume = volumeMap.get(perpSymbol) ?? 0
    results.push({
      exchange: 'Binance',
      baseAsset: base,
      spotSymbol: spotSymbols.has(spotSymbol) ? spotSymbol : undefined,
      perpSymbol,
      futuresContracts: futures,
      volume24hUsd: volume,
    })
  }

  return results
    .sort((a, b) => b.volume24hUsd - a.volume24hUsd)
    .slice(0, MAX_PAIRS_PER_EXCHANGE)
}

// ─── Bybit ────────────────────────────────────────────────────────────────────

async function fetchBybitInstruments(): Promise<InstrumentInfo[]> {
  const [spotRes, linearRes, tickersRes] = await Promise.all([
    fetch('https://api.bybit.com/v5/market/instruments-info?category=spot&limit=1000', { cache: 'no-store', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }).then((r) => r.json() as Promise<any>),
    fetch('https://api.bybit.com/v5/market/instruments-info?category=linear&limit=1000', { cache: 'no-store', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }).then((r) => r.json() as Promise<any>),
    fetch('https://api.bybit.com/v5/market/tickers?category=linear', { cache: 'no-store', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }).then((r) => r.json() as Promise<any>),
  ])

  const volumeMap = new Map<string, number>()
  for (const t of tickersRes.result?.list ?? []) {
    volumeMap.set(t.symbol, parseFloat(t.turnover24h ?? '0'))
  }

  const spotSymbols = new Set<string>()
  for (const s of spotRes.result?.list ?? []) {
    if (s.status === 'Trading' && s.quoteCoin === 'USDT') {
      spotSymbols.add(s.symbol)
    }
  }

  const assetMap = new Map<string, { perpSymbol?: string; futures: FuturesContract[] }>()
  for (const s of linearRes.result?.list ?? []) {
    if (s.status !== 'Trading' || s.quoteCoin !== 'USDT') continue
    const base = s.baseCoin as string
    if (!assetMap.has(base)) assetMap.set(base, { futures: [] })
    const entry = assetMap.get(base)!

    if (s.contractType === 'LinearPerpetual') {
      entry.perpSymbol = s.symbol
    } else if (s.contractType === 'LinearFutures' && s.deliveryTime) {
      const expiry = new Date(parseInt(s.deliveryTime)).toISOString().split('T')[0]
      entry.futures.push({ symbol: s.symbol, expiry, expiryLabel: formatExpiryLabel(expiry) })
    }
  }

  const results: InstrumentInfo[] = []
  for (const [base, { perpSymbol, futures }] of assetMap) {
    if (!perpSymbol) continue
    const spotSymbol = `${base}USDT`
    const volume = volumeMap.get(perpSymbol) ?? 0
    results.push({
      exchange: 'Bybit',
      baseAsset: base,
      spotSymbol: spotSymbols.has(spotSymbol) ? spotSymbol : undefined,
      perpSymbol,
      futuresContracts: futures,
      volume24hUsd: volume,
    })
  }

  return results
    .sort((a, b) => b.volume24hUsd - a.volume24hUsd)
    .slice(0, MAX_PAIRS_PER_EXCHANGE)
}

// ─── OKX ──────────────────────────────────────────────────────────────────────

async function fetchOKXInstruments(): Promise<InstrumentInfo[]> {
  const [spotRes, swapRes, futuresRes, tickersRes] = await Promise.all([
    fetch('https://www.okx.com/api/v5/public/instruments?instType=SPOT', { cache: 'no-store', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }).then((r) => r.json() as Promise<any>),
    fetch('https://www.okx.com/api/v5/public/instruments?instType=SWAP', { cache: 'no-store', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }).then((r) => r.json() as Promise<any>),
    fetch('https://www.okx.com/api/v5/public/instruments?instType=FUTURES', { cache: 'no-store', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }).then((r) => r.json() as Promise<any>),
    fetch('https://www.okx.com/api/v5/market/tickers?instType=SWAP', { cache: 'no-store', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }).then((r) => r.json() as Promise<any>),
  ])

  const volumeMap = new Map<string, number>()
  for (const t of tickersRes.data ?? []) {
    volumeMap.set(t.instId, parseFloat(t.volCcy24h ?? '0'))
  }

  const spotSymbols = new Set<string>()
  for (const s of spotRes.data ?? []) {
    if (s.state === 'live' && s.quoteCcy === 'USDT') {
      spotSymbols.add(s.instId)
    }
  }

  const assetMap = new Map<string, { perpInstId?: string; futures: FuturesContract[] }>()

  for (const s of swapRes.data ?? []) {
    if (s.state !== 'live' || s.settleCcy !== 'USDT') continue
    const base = s.instId.split('-')[0]
    if (!assetMap.has(base)) assetMap.set(base, { futures: [] })
    assetMap.get(base)!.perpInstId = s.instId
  }

  for (const s of futuresRes.data ?? []) {
    if (s.state !== 'live' || s.settleCcy !== 'USDT') continue
    const base = s.instId.split('-')[0]
    if (!assetMap.has(base)) continue
    const expiry = parseOKXExpiry(s.expTime)
    if (!expiry) continue
    assetMap.get(base)!.futures.push({
      symbol: s.instId,
      expiry,
      expiryLabel: formatExpiryLabel(expiry),
    })
  }

  const results: InstrumentInfo[] = []
  for (const [base, { perpInstId, futures }] of assetMap) {
    if (!perpInstId) continue
    const spotId = `${base}-USDT`
    const volume = volumeMap.get(perpInstId) ?? 0
    results.push({
      exchange: 'OKX',
      baseAsset: base,
      spotSymbol: spotSymbols.has(spotId) ? spotId : undefined,
      perpSymbol: perpInstId,
      futuresContracts: futures,
      volume24hUsd: volume,
    })
  }

  return results
    .sort((a, b) => b.volume24hUsd - a.volume24hUsd)
    .slice(0, MAX_PAIRS_PER_EXCHANGE)
}

// ─── Deribit ──────────────────────────────────────────────────────────────────

async function fetchDeribitInstruments(): Promise<InstrumentInfo[]> {
  const currencies = ['BTC', 'ETH', 'SOL']

  const results = await Promise.all(
    currencies.map(async (currency) => {
      const res = await fetch(
        `https://www.deribit.com/api/v2/public/get_instruments?currency=${currency}&kind=future&expired=false`,
        { cache: 'no-store', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }
      ).then((r) => r.json() as Promise<any>)

      const instruments: InstrumentInfo = {
        exchange: 'Deribit',
        baseAsset: currency,
        spotSymbol: undefined,
        perpSymbol: undefined,
        futuresContracts: [],
        volume24hUsd: 0,
      }

      for (const s of res.result ?? []) {
        if (s.kind !== 'future') continue
        if (s.instrument_name.endsWith('PERPETUAL')) {
          instruments.perpSymbol = s.instrument_name
        } else {
          const expiry = parseDeribitExpiry(s.instrument_name)
          if (!expiry) continue
          instruments.futuresContracts.push({
            symbol: s.instrument_name,
            expiry,
            expiryLabel: formatExpiryLabel(expiry),
          })
        }
      }

      if (instruments.perpSymbol) {
        try {
          const ticker = await fetch(
            `https://www.deribit.com/api/v2/public/ticker?instrument_name=${instruments.perpSymbol}`,
            { cache: 'no-store', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }
          ).then((r) => r.json() as Promise<any>)
          instruments.volume24hUsd = ticker.result?.stats?.volume_usd ?? 0
        } catch {
          // Volume fetch is optional
        }
      }

      return instruments
    })
  )

  return results.filter((i) => i.perpSymbol !== undefined)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatExpiryLabel(isoDate: string): string {
  const date = new Date(isoDate + 'T00:00:00Z')
  const day = date.getUTCDate().toString().padStart(2, '0')
  const month = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
  return `${day}-${month}`
}

function parseOKXExpiry(expTimeMs: string): string | null {
  if (!expTimeMs) return null
  const date = new Date(parseInt(expTimeMs))
  return date.toISOString().split('T')[0]
}

function parseDeribitExpiry(name: string): string | null {
  const parts = name.split('-')
  if (parts.length < 2) return null
  const datePart = parts[parts.length - 1]
  if (datePart === 'PERPETUAL') return null

  const day = datePart.slice(0, 2)
  const monthStr = datePart.slice(2, 5)
  const year = '20' + datePart.slice(5, 7)

  const months: Record<string, string> = {
    JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
    JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
  }
  const month = months[monthStr]
  if (!month) return null

  return `${year}-${month}-${day}`
}

// ─── In-memory cache ──────────────────────────────────────────────────────────

const CACHE_TTL_MS = 3_600_000 // 1 hour
let cachedInstruments: InstrumentInfo[] | null = null
let cacheExpiresAt = 0
let fetchInProgress: Promise<InstrumentInfo[]> | null = null

// ─── Public API ───────────────────────────────────────────────────────────────

export async function fetchAllInstruments(): Promise<InstrumentInfo[]> {
  const now = Date.now()

  // Return cached result if still valid
  if (cachedInstruments && now < cacheExpiresAt) {
    return cachedInstruments
  }

  // Deduplicate concurrent fetches
  if (fetchInProgress) return fetchInProgress

  fetchInProgress = (async () => {
    const [binance, bybit, okx, deribit] = await Promise.allSettled([
      fetchBinanceInstruments(),
      fetchBybitInstruments(),
      fetchOKXInstruments(),
      fetchDeribitInstruments(),
    ])

    for (const [name, settled] of [['Binance', binance], ['Bybit', bybit], ['OKX', okx], ['Deribit', deribit]] as const) {
      if (settled.status === 'rejected') {
        console.warn(`[instruments] ${name} fetch failed:`, (settled.reason as Error)?.message ?? settled.reason)
      }
    }

    const result = [
      ...(binance.status === 'fulfilled' ? binance.value : []),
      ...(bybit.status === 'fulfilled' ? bybit.value : []),
      ...(okx.status === 'fulfilled' ? okx.value : []),
      ...(deribit.status === 'fulfilled' ? deribit.value : []),
    ]

    // Only update cache if we got data; otherwise preserve stale cache so a
    // total failure doesn't wipe out an hour of valid instrument data.
    if (result.length > 0) {
      cachedInstruments = result
      cacheExpiresAt = Date.now() + CACHE_TTL_MS
    }

    fetchInProgress = null
    return result.length > 0 ? result : (cachedInstruments ?? [])
  })()

  return fetchInProgress
}
