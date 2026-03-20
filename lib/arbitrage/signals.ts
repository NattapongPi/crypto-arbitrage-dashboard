/**
 * Signal determination logic.
 * Takes calculated values + user thresholds → returns a Signal.
 * All thresholds come from UserSettings so the user can configure them.
 */

import type { Signal, UserSettings } from '../types'

type Thresholds = UserSettings['thresholds']

/**
 * Signal for spot-futures basis opportunities.
 */
export function determineSpotFuturesSignal(
  basisPercent: number,
  feeAdjPnl: number,
  thresholds: Thresholds
): Signal {
  if (basisPercent < -0.1) return 'INVERTED'
  if (feeAdjPnl >= thresholds.minBasisPercent) return 'BUY BASIS'
  if (basisPercent >= thresholds.minBasisPercent * 0.5) return 'WATCH'
  return 'SKIP'
}

/**
 * Signal for funding rate opportunities.
 */
export function determineFundingSignal(
  annualized: number,
  fundingRate: number,
  thresholds: Thresholds
): Signal {
  if (fundingRate < -0.005) return 'SHORT OPP'
  if (annualized >= thresholds.minAnnualizedPercent) return 'LONG SPOT'
  if (annualized >= thresholds.minAnnualizedPercent * 0.5) return 'WATCH'
  return 'SKIP'
}

/**
 * Signal for calendar spread opportunities.
 */
export function determineCalendarSignal(
  spreadPercent: number,
  feeAdjPnl: number,
  thresholds: Thresholds
): Signal {
  if (feeAdjPnl >= thresholds.minSpreadPercent) return 'ENTER'
  if (spreadPercent >= thresholds.minSpreadPercent * 0.5) return 'WATCH'
  return 'SKIP'
}
