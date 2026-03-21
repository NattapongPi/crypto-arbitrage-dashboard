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
import { fetchAllInstruments } from '@/lib/server/fetch-instruments'

// Cache the route response for 1 hour
export const revalidate = 3600

export async function GET() {
  try {
    const instruments = await fetchAllInstruments()
    return NextResponse.json(instruments)
  } catch (err) {
    console.error('Instruments route error:', err)
    return NextResponse.json({ error: 'Failed to fetch instruments' }, { status: 500 })
  }
}
