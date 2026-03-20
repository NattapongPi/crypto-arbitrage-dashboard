/**
 * Pure calculation functions for arbitrage metrics.
 * No side effects — all functions take numbers, return numbers.
 * Floating point: we round to 4 decimal places internally to avoid drift.
 */

import { differenceInDays } from 'date-fns'
import { FUNDING_PERIODS_PER_DAY } from '../constants'
import type { PriceSnapshot } from '../types'

const round4 = (n: number) => Math.round(n * 10000) / 10000

/**
 * Basis % between spot and perpetual futures.
 * Positive = perp is at a premium (futures trading above spot).
 */
export function calcBasisPercent(spotPrice: number, perpPrice: number): number {
  if (!spotPrice) return 0
  return round4(((perpPrice - spotPrice) / spotPrice) * 100)
}

/**
 * Fee-adjusted PnL for spot-futures arbitrage.
 * Assumes you pay taker on both legs (spot buy + perp short).
 * Returns 0 if basis is too small to be meaningful.
 */
export function calcSpotFuturesFeeAdjPnl(
  basisPercent: number,
  makerFeePercent: number,
  takerFeePercent: number
): number {
  // Entry: pay taker on spot, pay maker on perp (post-only)
  // Exit: pay taker on perp, pay maker on spot
  const totalFees = makerFeePercent + takerFeePercent + makerFeePercent + takerFeePercent
  return round4(basisPercent - totalFees)
}

/**
 * Annualized funding rate.
 * fundingRate: raw percentage (e.g. 0.041 means 0.041%)
 */
export function calcAnnualizedFunding(
  fundingRate: number,
  periodsPerDay: number = FUNDING_PERIODS_PER_DAY
): number {
  return round4(fundingRate * periodsPerDay * 365)
}

/**
 * Spread % between near-leg and far-leg futures.
 * Positive = far-leg is at a premium (contango).
 */
export function calcCalendarSpread(nearPrice: number, farPrice: number): number {
  if (!nearPrice) return 0
  return round4(((farPrice - nearPrice) / nearPrice) * 100)
}

/**
 * Annualized return for a calendar spread.
 * spreadPercent: the spread between near and far leg
 * daysToFarExpiry: days until the far leg expires
 * daysToNearExpiry: days until the near leg expires (0 if near = spot)
 * Holding period = daysToFarExpiry - daysToNearExpiry
 */
export function calcCalendarAnnualizedReturn(
  spreadPercent: number,
  daysToFarExpiry: number,
  daysToNearExpiry: number = 0
): number {
  const holdingDays = daysToFarExpiry - daysToNearExpiry
  if (holdingDays <= 0) return 0
  return round4((spreadPercent / holdingDays) * 365)
}

/**
 * Fee-adjusted PnL for a calendar spread.
 * Entry: open near short + far long (2 futures legs)
 * Exit: close both legs (2 more trades)
 */
export function calcCalendarFeeAdjPnl(
  spreadPercent: number,
  makerFeePercent: number,
  takerFeePercent: number
): number {
  // 4 trades total: open near, open far, close near, close far
  const totalFees = 2 * (makerFeePercent + takerFeePercent)
  return round4(spreadPercent - totalFees)
}

/**
 * Number of days from now to an expiry date string (ISO format: "2025-06-27").
 */
export function calcDaysToExpiry(expiryIso: string): number {
  const expiry = new Date(expiryIso + 'T00:00:00Z')
  const days = differenceInDays(expiry, new Date())
  return Math.max(0, days)
}

/**
 * 1-minute price change as a percentage.
 * Finds the price from ~60 seconds ago in the buffer and compares.
 */
export function calc1MinChange(currentPrice: number, buffer: PriceSnapshot[]): number {
  if (!buffer.length || !currentPrice) return 0
  const oneMinAgo = Date.now() - 60_000
  // Find the snapshot closest to 60s ago
  const past = buffer.reduce((closest, snap) => {
    if (snap.timestamp > oneMinAgo) return closest
    if (!closest || Math.abs(snap.timestamp - oneMinAgo) < Math.abs(closest.timestamp - oneMinAgo)) {
      return snap
    }
    return closest
  }, null as PriceSnapshot | null)

  if (!past || !past.price) return 0
  return round4(((currentPrice - past.price) / past.price) * 100)
}
