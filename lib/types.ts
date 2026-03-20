// Exchange types
export type Exchange = 'Binance' | 'Bybit' | 'OKX' | 'Deribit'

export type ExchangeStatus = 'LIVE' | 'SLOW' | 'OFFLINE'

export interface ExchangeHealth {
  exchange: Exchange
  status: ExchangeStatus
  latency?: number
}

// Signal types for trading recommendations
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

// Spot-Futures Basis types
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

// Funding Rate types
export interface FundingRatePair {
  id: string
  exchange: Exchange
  pair: string
  currentRate: number
  predictedRate: number
  nextIn: string
  annualized: number
  openInterest: string
  signal: Signal
}

// Calendar Spread types
export interface CalendarSpreadPair {
  id: string
  exchange: Exchange
  asset: string
  nearLeg: string
  farLeg: string
  spreadPercent: number
  annReturn: string
  feeAdjPnl: number
  signal: Signal
}

export interface SpreadMatrixEntry {
  nearLeg: string
  farLeg: string
  spread: string
  dte: string
}

export interface TermStructurePoint {
  expiry: string
  price: number
  label: string
}

// Live Alerts types
export interface LiveAlert {
  id: string
  time: string
  exchange: Exchange
  pair: string
  strategy: StrategyType
  spread: string
  feeAdjPnl: string
  age: string
  status: AlertStatus
}

// Dashboard summary stats
export interface DashboardStats {
  activeOpportunities: number
  bestBasis: string
  pairsMonitored: number
  feeAdjThreshold: string
}

export interface FundingStats {
  highestRate: string
  bestAnnualized: string
  lowestRate: string
  nextSettlement: string
}

export interface CalendarStats {
  bestSpread: string
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
