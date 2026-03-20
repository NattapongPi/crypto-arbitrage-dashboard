import type { Exchange, ExchangeAdapter } from '../types'
import { createBinanceAdapter } from './binance'
import { createBybitAdapter } from './bybit'
import { createOKXAdapter } from './okx'
import { createDeribitAdapter } from './deribit'

export function createAdapter(exchange: Exchange): ExchangeAdapter {
  switch (exchange) {
    case 'Binance': return createBinanceAdapter()
    case 'Bybit':   return createBybitAdapter()
    case 'OKX':     return createOKXAdapter()
    case 'Deribit': return createDeribitAdapter()
  }
}

export { createBinanceAdapter } from './binance'
export { createBybitAdapter } from './bybit'
export { createOKXAdapter } from './okx'
export { createDeribitAdapter } from './deribit'
