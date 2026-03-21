import type { Exchange, ExchangeAdapter } from '../types'
import { createProxyAdapter } from './proxy-adapter'

export function createAdapter(exchange: Exchange): ExchangeAdapter {
  return createProxyAdapter(exchange)
}
