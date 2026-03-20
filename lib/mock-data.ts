import type {
  ExchangeHealth,
  SpotFuturesPair,
  FundingRatePair,
  CalendarSpreadPair,
  SpreadMatrixEntry,
  TermStructurePoint,
  LiveAlert,
  DashboardStats,
  FundingStats,
  CalendarStats,
  AlertStats,
} from './types'

// Exchange health status
export const exchangeHealth: ExchangeHealth[] = [
  { exchange: 'Binance', status: 'LIVE', latency: 45 },
  { exchange: 'Bybit', status: 'LIVE', latency: 52 },
  { exchange: 'OKX', status: 'SLOW', latency: 180 },
  { exchange: 'Deribit', status: 'LIVE', latency: 38 },
]

// Spot-Futures Basis Data
export const spotFuturesData: SpotFuturesPair[] = [
  { id: '1', exchange: 'Binance', pair: 'BTC-PERP', spotPrice: 67410, perpPrice: 67970, basisPercent: 0.83, change1min: 0.04, feeAdjPnl: 0.61, signal: 'BUY BASIS' },
  { id: '2', exchange: 'Binance', pair: 'ETH-PERP', spotPrice: 3512, perpPrice: 3530, basisPercent: 0.51, change1min: -0.02, feeAdjPnl: 0.29, signal: 'WATCH' },
  { id: '3', exchange: 'Bybit', pair: 'BTC-PERP', spotPrice: 67395, perpPrice: 67850, basisPercent: 0.67, change1min: 0.01, feeAdjPnl: 0.45, signal: 'BUY BASIS' },
  { id: '4', exchange: 'OKX', pair: 'ETH-PERP', spotPrice: 3510, perpPrice: 3498, basisPercent: -0.34, change1min: -0.05, feeAdjPnl: -0.56, signal: 'INVERTED' },
  { id: '5', exchange: 'Deribit', pair: 'BTC-PERP', spotPrice: 67420, perpPrice: 67740, basisPercent: 0.47, change1min: 0.02, feeAdjPnl: 0.25, signal: 'WATCH' },
  { id: '6', exchange: 'Bybit', pair: 'ETH-PERP', spotPrice: 3509, perpPrice: 3527, basisPercent: 0.51, change1min: 0.03, feeAdjPnl: 0.29, signal: 'BUY BASIS' },
  { id: '7', exchange: 'Deribit', pair: 'ETH-PERP', spotPrice: 3511, perpPrice: 3524, basisPercent: 0.37, change1min: -0.01, feeAdjPnl: 0.15, signal: 'WATCH' },
  { id: '8', exchange: 'OKX', pair: 'SOL-PERP', spotPrice: 142.30, perpPrice: 143.10, basisPercent: 0.56, change1min: 0.06, feeAdjPnl: 0.34, signal: 'BUY BASIS' },
  { id: '9', exchange: 'Binance', pair: 'SOL-PERP', spotPrice: 142.15, perpPrice: 142.40, basisPercent: 0.18, change1min: 0.00, feeAdjPnl: -0.02, signal: 'SKIP' },
]

export const spotFuturesStats: DashboardStats = {
  activeOpportunities: 7,
  bestBasis: '+0.83%',
  pairsMonitored: 24,
  feeAdjThreshold: '0.15%',
}

// Funding Rate Data
export const fundingRateData: FundingRatePair[] = [
  { id: '1', exchange: 'Binance', pair: 'BTC-PERP', currentRate: 0.041, predictedRate: 0.038, nextIn: '2h 14m', annualized: 44.9, openInterest: '$8.2B', signal: 'LONG SPOT' },
  { id: '2', exchange: 'Bybit', pair: 'BTC-PERP', currentRate: 0.035, predictedRate: 0.032, nextIn: '2h 14m', annualized: 38.3, openInterest: '$5.1B', signal: 'LONG SPOT' },
  { id: '3', exchange: 'Binance', pair: 'ETH-PERP', currentRate: 0.028, predictedRate: 0.025, nextIn: '2h 14m', annualized: 30.7, openInterest: '$3.8B', signal: 'LONG SPOT' },
  { id: '4', exchange: 'Deribit', pair: 'BTC-PERP', currentRate: 0.021, predictedRate: 0.019, nextIn: '2h 14m', annualized: 23.0, openInterest: '$1.2B', signal: 'WATCH' },
  { id: '5', exchange: 'OKX', pair: 'BTC-PERP', currentRate: -0.012, predictedRate: -0.008, nextIn: '2h 14m', annualized: -13.1, openInterest: '$980M', signal: 'SHORT OPP' },
  { id: '6', exchange: 'Bybit', pair: 'ETH-PERP', currentRate: 0.019, predictedRate: 0.022, nextIn: '2h 14m', annualized: 20.8, openInterest: '$2.1B', signal: 'WATCH' },
  { id: '7', exchange: 'OKX', pair: 'ETH-PERP', currentRate: 0.015, predictedRate: 0.014, nextIn: '2h 14m', annualized: 16.4, openInterest: '$740M', signal: 'WATCH' },
  { id: '8', exchange: 'Deribit', pair: 'ETH-PERP', currentRate: 0.028, predictedRate: 0.025, nextIn: '2h 14m', annualized: 30.7, openInterest: '$890M', signal: 'LONG SPOT' },
  { id: '9', exchange: 'Binance', pair: 'SOL-PERP', currentRate: 0.008, predictedRate: 0.007, nextIn: '2h 14m', annualized: 8.8, openInterest: '$620M', signal: 'SKIP' },
]

export const fundingStats: FundingStats = {
  highestRate: '+0.041%',
  bestAnnualized: '+44.9%',
  lowestRate: '-0.012%',
  nextSettlement: '02:14:33',
}

// Calendar Spread Data
export const calendarSpreadData: CalendarSpreadPair[] = [
  { id: '1', exchange: 'Deribit', asset: 'BTC', nearLeg: '28-Mar', farLeg: '26-Jun', spreadPercent: 1.20, annReturn: '+4.88%/yr', feeAdjPnl: 0.98, signal: 'ENTER' },
  { id: '2', exchange: 'Binance', asset: 'BTC', nearLeg: '28-Mar', farLeg: '26-Sep', spreadPercent: 2.41, annReturn: '+4.64%/yr', feeAdjPnl: 2.05, signal: 'ENTER' },
  { id: '3', exchange: 'OKX', asset: 'ETH', nearLeg: '26-Jun', farLeg: '26-Sep', spreadPercent: 0.44, annReturn: '+1.79%/yr', feeAdjPnl: 0.22, signal: 'WATCH' },
  { id: '4', exchange: 'Bybit', asset: 'SOL', nearLeg: '28-Mar', farLeg: '26-Jun', spreadPercent: 0.67, annReturn: '+2.73%/yr', feeAdjPnl: -0.02, signal: 'SKIP' },
]

export const spreadMatrix: SpreadMatrixEntry[] = [
  { nearLeg: '28-Mar', farLeg: '26-Jun', spread: '+1.20%', dte: '8/98' },
  { nearLeg: '28-Mar', farLeg: '26-Sep', spread: '+2.41%', dte: '8/190' },
  { nearLeg: '26-Jun', farLeg: '26-Sep', spread: '+1.18%', dte: '98/190' },
  { nearLeg: 'Spot', farLeg: '26-Jun', spread: '+2.10%', dte: '-/98' },
  { nearLeg: 'Spot', farLeg: '28-Mar', spread: '+0.83%', dte: '-/8' },
]

export const termStructure: TermStructurePoint[] = [
  { expiry: 'Spot', price: 67050, label: '$67.0k' },
  { expiry: 'Mar', price: 67500, label: 'Mar' },
  { expiry: 'Jun', price: 68000, label: 'Jun' },
  { expiry: 'Sep', price: 68500, label: 'Sep' },
]

export const calendarStats: CalendarStats = {
  bestSpread: '+1.20%',
  activeSpreads: 5,
  pairsMonitored: 12,
  nearestExpiry: '28-Mar',
  nearestDte: 8,
}

// Live Alerts Data
export const liveAlertsData: LiveAlert[] = [
  { id: '1', time: '14:32:01', exchange: 'Binance', pair: 'BTC-PERP', strategy: 'Spot-Fut', spread: '+0.83%', feeAdjPnl: '+0.61%', age: '31s', status: 'ACTIVE' },
  { id: '2', time: '14:31:55', exchange: 'Deribit', pair: 'ETH-0328', strategy: 'Calendar', spread: '+1.20%', feeAdjPnl: '+0.89%', age: '37s', status: 'ACTIVE' },
  { id: '3', time: '14:31:48', exchange: 'OKX', pair: 'BTC-PERP', strategy: 'Funding', spread: '+0.041%', feeAdjPnl: '+0.29%', age: '44s', status: 'WATCH' },
  { id: '4', time: '14:31:40', exchange: 'Bybit', pair: 'ETH-PERP', strategy: 'Spot-Fut', spread: '+0.52%', feeAdjPnl: '+0.38%', age: '52s', status: 'ACTIVE' },
  { id: '5', time: '14:31:30', exchange: 'Binance', pair: 'SOL-PERP', strategy: 'Spot-Fut', spread: '+0.56%', feeAdjPnl: '+0.34%', age: '1m 02s', status: 'ACTIVE' },
  { id: '6', time: '14:31:10', exchange: 'Deribit', pair: 'BTC-0628', strategy: 'Calendar', spread: '+0.31%', feeAdjPnl: '+0.09%', age: '1m 22s', status: 'FADING' },
  { id: '7', time: '14:30:58', exchange: 'Binance', pair: 'BNB-PERP', strategy: 'Funding', spread: '+0.022%', feeAdjPnl: '+0.10%', age: '1m 34s', status: 'FADING' },
]

export const alertStats: AlertStats = {
  activeNow: 12,
  spotFutures: 5,
  fundingRate: 4,
  calendarSpread: 3,
  fading: 2,
}

// Helper function to generate random price fluctuations for simulation
export function generatePriceFluctuation(basePrice: number, volatility: number = 0.001): number {
  const change = (Math.random() - 0.5) * 2 * volatility * basePrice
  return basePrice + change
}

// Helper to format currency
export function formatCurrency(value: number, decimals: number = 2): string {
  if (value >= 1000) {
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`
  }
  return `$${value.toFixed(decimals)}`
}

// Helper to format percentage
export function formatPercent(value: number, showSign: boolean = true): string {
  const sign = showSign && value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}
