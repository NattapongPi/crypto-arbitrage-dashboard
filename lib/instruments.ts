/**
 * Client-side instrument cache.
 * Fetches from /api/instruments on startup, caches in memory for 1 hour.
 * Falls back to an empty array if the fetch fails.
 */

import type { InstrumentInfo } from './types'
import { INSTRUMENTS_CACHE_TTL_MS } from './constants'

interface Cache {
  data: InstrumentInfo[]
  fetchedAt: number
}

let cache: Cache | null = null
let inflight: Promise<InstrumentInfo[]> | null = null

export async function fetchInstruments(): Promise<InstrumentInfo[]> {
  // Return cached data if still fresh
  if (cache && Date.now() - cache.fetchedAt < INSTRUMENTS_CACHE_TTL_MS) {
    return cache.data
  }

  // Deduplicate concurrent calls — only one fetch at a time
  if (inflight) return inflight

  inflight = (async () => {
    try {
      const res = await fetch('/api/instruments')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: InstrumentInfo[] = await res.json()
      cache = { data, fetchedAt: Date.now() }
      return data
    } catch (err) {
      console.error('Failed to fetch instruments:', err)
      return cache?.data ?? []
    } finally {
      inflight = null
    }
  })()

  return inflight
}

/** Get instruments for a specific exchange from the cache (sync). */
export function getInstrumentsByExchange(
  instruments: InstrumentInfo[],
  exchange: InstrumentInfo['exchange']
): InstrumentInfo[] {
  return instruments.filter((i) => i.exchange === exchange)
}
