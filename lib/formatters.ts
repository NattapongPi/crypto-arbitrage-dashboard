/**
 * Consistent number formatting across the entire dashboard.
 * All functions take raw numbers and return display strings.
 * Never store pre-formatted strings — format at render time only.
 */

/**
 * Format a USD price.
 * >= $1: 2 decimal places with commas. e.g. $67,410.50
 * < $1: 4 decimal places. e.g. $0.0012
 */
export function formatPrice(value: number): string {
  if (value >= 1) {
    return `$${value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }
  return `$${value.toFixed(4)}`
}

/**
 * Format a percentage value.
 * Default 2 decimal places. Includes optional leading + sign.
 * e.g. +0.83%, -0.34%
 */
export function formatPercent(
  value: number,
  decimals = 2,
  showSign = true
): string {
  const sign = showSign && value > 0 ? '+' : ''
  return `${sign}${value.toFixed(decimals)}%`
}

/**
 * Format a funding rate specifically.
 * Always 4 decimal places for the small values involved.
 * e.g. +0.0410%, -0.0120%
 */
export function formatRate(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(4)}%`
}

/**
 * Format open interest in compact notation.
 * e.g. $8.2B, $890M, $45K
 */
export function formatOI(value: number): string {
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(1)}B`
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(0)}M`
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`
  }
  return `$${value.toFixed(0)}`
}

/**
 * Format alert age from a creation timestamp.
 * e.g. 32s, 1m 22s, 5m 01s
 */
export function formatAge(createdAtMs: number): string {
  const totalSeconds = Math.floor((Date.now() - createdAtMs) / 1000)
  if (totalSeconds < 60) {
    return `${totalSeconds}s`
  }
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`
}

/**
 * Format countdown to a future timestamp.
 * e.g. 02:14:33
 */
export function formatCountdown(targetMs: number): string {
  const remaining = Math.max(0, targetMs - Date.now())
  const totalSeconds = Math.floor(remaining / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return [hours, minutes, seconds]
    .map((n) => n.toString().padStart(2, '0'))
    .join(':')
}

/**
 * Format a UTC timestamp as HH:MM:SS for the "last tick" display.
 */
export function formatTime(timestampMs: number): string {
  return new Date(timestampMs).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}
