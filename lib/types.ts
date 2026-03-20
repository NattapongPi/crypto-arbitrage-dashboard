// ─── Exchange & Status ───────────────────────────────────────────────────────

export type Exchange = 'Binance' | 'Bybit' | 'OKX' | 'Deribit'

export type ExchangeStatus = 'LIVE' | 'SLOW' | 'OFFLINE' | 'CONNECTING'

export interface ExchangeHealth {
  exchange: Exchange
  status: ExchangeStatus
  latency?: number
}

// ─── Signal & Alert ──────────────────────────────────────────────────────────

export type Signal =
  | 'BUY BASIS'
  | 'WATCH'
  | 'INVERTED'
  | 'SKIP'
  | 'LONG SPOT'
  | 'SHORT OPP'
  | 'ENTER'

export type AlertStatus = 'ACTIVE' | 'WATCH' | 'FADING'

export type StrategyType = 'Spot-Fut' | 'Funding' | 'Calendar'

// ─── UI Data Types (consumed by pages) ───────────────────────────────────────

export interface SpotFuturesPair {
  id: string
  exchange: Exchange
  pair: string
  spotPrice: number
  perpPrice: number
  basisPercent: number
  change1min: number
  feeAdjPnl: number
  signal: Signal
}

export interface FundingRatePair {
  id: string
  exchange: Exchange
  pair: string
  currentRate: number
  predictedRate?: number      // Not all exchanges provide this
  nextFundingTime: number     // Unix ms timestamp
  annualized: number
  openInterest?: number       // Raw USD value
  signal: Signal
}

export interface CalendarSpreadPair {
  id: string
  exchange: Exchange
  asset: string
  nearLeg: string             // Display label e.g. "28-Mar"
  farLeg: string              // Display label e.g. "26-Jun"
  nearPrice: number
  farPrice: number
  spreadPercent: number
  annReturn: number           // Raw percentage
  daysToExpiry: number
  feeAdjPnl: number
  signal: Signal
}

export interface SpreadMatrixEntry {
  nearLeg: string
  farLeg: string
  spread: number              // Raw percentage
  dte: string                 // Display string e.g. "8/98"
}

export interface TermStructurePoint {
  expiry: string
  price: number
  label: string
}

export interface LiveAlert {
  id: string
  createdAt: number           // Unix ms timestamp
  exchange: Exchange
  pair: string
  strategy: StrategyType
  spread: number              // Raw percentage
  feeAdjPnl: number           // Raw percentage
  status: AlertStatus
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

export interface SpotFuturesStats {
  activeOpportunities: number
  bestBasis: number           // Raw percentage
  pairsMonitored: number
  feeAdjThreshold: number     // Raw percentage
}

export interface FundingStats {
  highestRate: number         // Raw percentage
  bestAnnualized: number      // Raw percentage
  lowestRate: number          // Raw percentage
  nextFundingTime: number     // Unix ms — nearest across all pairs
}

export interface CalendarStats {
  bestSpread: number          // Raw percentage
  activeSpreads: number
  pairsMonitored: number
  nearestExpiry: string
  nearestDte: number
}

export interface AlertStats {
  activeNow: number
  spotFutures: number
  fundingRate: number
  calendarSpread: number
  fading: number
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface UserSettings {
  fees: {
    makerFeePercent: number
    takerFeePercent: number
    withdrawalFeeUsd: number
  }
  thresholds: {
    minBasisPercent: number
    minAnnualizedPercent: number
    minSpreadPercent: number
  }
  exchanges: Record<Exchange, boolean>
}

// ─── Raw Data from Adapters ────────────────────────────────────────────────────

export type TickerType = 'spot' | 'perp' | 'future'

export interface NormalizedTicker {
  exchange: Exchange
  baseAsset: string           // e.g. "BTC", "ETH"
  type: TickerType
  expiry?: string             // ISO date string for futures e.g. "2025-06-27"
  expiryLabel?: string        // Display label e.g. "27-Jun"
  lastPrice: number
  timestamp: number           // Unix ms
}

export interface NormalizedFundingRate {
  exchange: Exchange
  baseAsset: string
  fundingRate: number         // e.g. 0.041 means 0.041%
  predictedRate?: number
  nextFundingTime: number     // Unix ms
  openInterest?: number       // Raw USD
}

// ─── Instruments ──────────────────────────────────────────────────────────────

export interface FuturesContract {
  symbol: string              // Exchange-specific e.g. "BTCUSDT_250627"
  expiry: string              // ISO date string
  expiryLabel: string         // Display label e.g. "27-Jun"
}

export interface InstrumentInfo {
  exchange: Exchange
  baseAsset: string           // e.g. "BTC"
  spotSymbol?: string         // Exchange-specific spot symbol
  perpSymbol?: string         // Exchange-specific perpetual symbol
  futuresContracts: FuturesContract[]
  volume24hUsd: number        // For sorting top pairs
}

// ─── Price Buffer (for 1-min change tracking) ────────────────────────────────

export interface PriceSnapshot {
  price: number
  timestamp: number
}

// ─── Exchange Adapter Interface ───────────────────────────────────────────────

export interface AdapterCallbacks {
  onTicker: (ticker: NormalizedTicker) => void
  onFunding: (funding: NormalizedFundingRate) => void
  onStatusChange: (exchange: Exchange, status: ExchangeStatus, latency?: number) => void
}

export interface ExchangeAdapter {
  exchange: Exchange
  connect(instruments: InstrumentInfo[], callbacks: AdapterCallbacks): void
  disconnect(): void
}
