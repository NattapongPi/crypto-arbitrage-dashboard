/**
 * GET /api/instruments
 *
 * Server-side proxy that fetches available trading instruments from all 4
 * exchanges and returns a normalized list. Runs server-side to avoid CORS
 * issues with exchange REST APIs.
 *
 * Returns: InstrumentInfo[] sorted by volume descending, top 200 per exchange.
 */

import { NextResponse } from 'next/server'
import type { InstrumentInfo, FuturesContract } from '@/lib/types'
import { MAX_PAIRS_PER_EXCHANGE } from '@/lib/constants'

// Cache on the server side for 1 hour
export const revalidate = 3600

// ─── Binance ─────────────────────────────────────────────────────────────────

async function fetchBinanceInstruments(): Promise<InstrumentInfo[]> {
  // Use `permissions=SPOT` to get only spot symbols (~300KB vs 22MB for full exchangeInfo).
  // Use `cache: 'no-store'` to skip Next.js data cache (which has a 2MB limit) — the
  // route-level `revalidate = 3600` already caches the entire route response for 1 hour.
  const [spotInfo, futuresInfo, futuresTickers] = await Promise.all([
    fetch('https://api.binance.com/api/v3/exchangeInfo?permissions=SPOT', { cache: 'no-store' }).then((r) => r.json()),
    fetch('https://fapi.binance.com/fapi/v1/exchangeInfo', { cache: 'no-store' }).then((r) => r.json()),
    fetch('https://fapi.binance.com/fapi/v1/ticker/24hr', { cache: 'no-store' }).then((r) => r.json()),
  ])

  // Build a map of volume by symbol from futures tickers
  const volumeMap = new Map<string, number>()
  for (const t of futuresTickers as { symbol: string; quoteVolume: string }[]) {
    volumeMap.set(t.symbol, parseFloat(t.quoteVolume))
  }

  // Build set of spot symbols (USDT pairs only)
  const spotSymbols = new Set<string>()
  for (const s of spotInfo.symbols as { symbol: string; status: string; quoteAsset: string }[]) {
    if (s.status === 'TRADING' && s.quoteAsset === 'USDT') {
      spotSymbols.add(s.symbol)
    }
  }

  // Build map: baseAsset → { perpSymbol, futures[] }
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
    fetch('https://api.bybit.com/v5/market/instruments-info?category=spot&limit=1000', { cache: 'no-store' }).then((r) => r.json()),
    fetch('https://api.bybit.com/v5/market/instruments-info?category=linear&limit=1000', { cache: 'no-store' }).then((r) => r.json()),
    fetch('https://api.bybit.com/v5/market/tickers?category=linear', { cache: 'no-store' }).then((r) => r.json()),
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
    fetch('https://www.okx.com/api/v5/public/instruments?instType=SPOT', { cache: 'no-store' }).then((r) => r.json()),
    fetch('https://www.okx.com/api/v5/public/instruments?instType=SWAP', { cache: 'no-store' }).then((r) => r.json()),
    fetch('https://www.okx.com/api/v5/public/instruments?instType=FUTURES', { cache: 'no-store' }).then((r) => r.json()),
    fetch('https://www.okx.com/api/v5/market/tickers?instType=SWAP', { cache: 'no-store' }).then((r) => r.json()),
  ])

  const volumeMap = new Map<string, number>()
  for (const t of tickersRes.data ?? []) {
    volumeMap.set(t.instId, parseFloat(t.volCcy24h ?? '0'))
  }

  const spotSymbols = new Set<string>()
  for (const s of spotRes.data ?? []) {
    if (s.state === 'live' && s.quoteCcy === 'USDT') {
      spotSymbols.add(s.instId) // e.g. "BTC-USDT"
    }
  }

  const assetMap = new Map<string, { perpInstId?: string; futures: FuturesContract[] }>()

  for (const s of swapRes.data ?? []) {
    if (s.state !== 'live' || s.settleCcy !== 'USDT') continue
    // e.g. "BTC-USDT-SWAP" → base = "BTC"
    const base = s.instId.split('-')[0]
    if (!assetMap.has(base)) assetMap.set(base, { futures: [] })
    assetMap.get(base)!.perpInstId = s.instId
  }

  for (const s of futuresRes.data ?? []) {
    if (s.state !== 'live' || s.settleCcy !== 'USDT') continue
    const base = s.instId.split('-')[0]
    if (!assetMap.has(base)) continue // only track assets with a perp
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
  // Deribit only supports BTC and ETH with meaningful liquidity
  const currencies = ['BTC', 'ETH', 'SOL']

  const results = await Promise.all(
    currencies.map(async (currency) => {
      const res = await fetch(
        `https://www.deribit.com/api/v2/public/get_instruments?currency=${currency}&kind=future&expired=false`,
        { cache: 'no-store' }
      ).then((r) => r.json())

      const instruments: InstrumentInfo = {
        exchange: 'Deribit',
        baseAsset: currency,
        spotSymbol: undefined, // Deribit has no spot market
        perpSymbol: undefined,
        futuresContracts: [],
        volume24hUsd: 0,
      }

      for (const s of res.result ?? []) {
        if (s.kind !== 'future') continue
        if (s.instrument_name.endsWith('PERPETUAL')) {
          instruments.perpSymbol = s.instrument_name
        } else {
          // e.g. "BTC-27JUN25" → expiry
          const expiry = parseDeribitExpiry(s.instrument_name)
          if (!expiry) continue
          instruments.futuresContracts.push({
            symbol: s.instrument_name,
            expiry,
            expiryLabel: formatExpiryLabel(expiry),
          })
        }
      }

      // Get 24h volume for sorting
      if (instruments.perpSymbol) {
        try {
          const ticker = await fetch(
            `https://www.deribit.com/api/v2/public/ticker?instrument_name=${instruments.perpSymbol}`,
            { cache: 'no-store' }
          ).then((r) => r.json())
          instruments.volume24hUsd = ticker.result?.stats?.volume_usd ?? 0
        } catch {
          // Volume fetch is optional — don't fail if it errors
        }
      }

      return instruments
    })
  )

  return results.filter((i) => i.perpSymbol !== undefined)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Convert ISO date "2025-06-27" to display label "27-Jun"
function formatExpiryLabel(isoDate: string): string {
  const date = new Date(isoDate + 'T00:00:00Z')
  const day = date.getUTCDate().toString().padStart(2, '0')
  const month = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
  return `${day}-${month}`
}

// OKX expiry timestamp (ms string) → ISO date
function parseOKXExpiry(expTimeMs: string): string | null {
  if (!expTimeMs) return null
  const date = new Date(parseInt(expTimeMs))
  return date.toISOString().split('T')[0]
}

// Deribit instrument name "BTC-27JUN25" → ISO date "2025-06-27"
function parseDeribitExpiry(name: string): string | null {
  const parts = name.split('-')
  if (parts.length < 2) return null
  const datePart = parts[parts.length - 1] // e.g. "27JUN25"
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

// ─── Route Handler ─────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const [binance, bybit, okx, deribit] = await Promise.allSettled([
      fetchBinanceInstruments(),
      fetchBybitInstruments(),
      fetchOKXInstruments(),
      fetchDeribitInstruments(),
    ])

    const instruments = [
      ...(binance.status === 'fulfilled' ? binance.value : []),
      ...(bybit.status === 'fulfilled' ? bybit.value : []),
      ...(okx.status === 'fulfilled' ? okx.value : []),
      ...(deribit.status === 'fulfilled' ? deribit.value : []),
    ]

    // Log any fetch failures server-side but don't break the response
    if (binance.status === 'rejected') console.error('Binance instruments failed:', binance.reason)
    if (bybit.status === 'rejected') console.error('Bybit instruments failed:', bybit.reason)
    if (okx.status === 'rejected') console.error('OKX instruments failed:', okx.reason)
    if (deribit.status === 'rejected') console.error('Deribit instruments failed:', deribit.reason)

    return NextResponse.json(instruments)
  } catch (err) {
    console.error('Instruments route error:', err)
    return NextResponse.json({ error: 'Failed to fetch instruments' }, { status: 500 })
  }
}
