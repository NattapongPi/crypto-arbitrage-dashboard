export const DEFAULT_SETTINGS = {
  fees: {
    makerFeePercent: 0.02,
    takerFeePercent: 0.05,
    withdrawalFeeUsd: 0,
  },
  thresholds: {
    minBasisPercent: 0.15,
    minAnnualizedPercent: 15,
    minSpreadPercent: 0.5,
  },
  exchanges: {
    Binance: true,
    Bybit: true,
    OKX: true,
    Deribit: true,
  },
} as const

export const RECONNECT_BASE_DELAY_MS = 1000
export const RECONNECT_MAX_DELAY_MS = 30_000

// Rolling window for 1-minute price change tracking
export const PRICE_BUFFER_WINDOW_MS = 60_000

// Alert age thresholds in seconds
export const ALERT_AGE_THRESHOLDS = {
  active: 60,
  watch: 180,
  fading: 300,
} as const

export const MAX_ALERTS = 100
export const INSTRUMENTS_CACHE_TTL_MS = 3_600_000 // 1 hour
export const CALC_THROTTLE_MS = 1000
export const MAX_PAIRS_PER_EXCHANGE = 200

// How often the alert engine runs (1 second)
export const ALERT_TICK_MS = 1_000

// Funding rate periods per day (8-hour intervals = 3x daily)
export const FUNDING_PERIODS_PER_DAY = 3
