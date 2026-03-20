'use client'

import { cn } from '@/lib/utils'
import { useMarketDataContext } from '@/lib/context/market-data-context'
import type { ExchangeStatus } from '@/lib/types'

const statusConfig: Record<ExchangeStatus, { bg: string; text: string; label: string }> = {
  LIVE:       { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'LIVE' },
  SLOW:       { bg: 'bg-amber-500/20',   text: 'text-amber-400',   label: 'SLOW' },
  OFFLINE:    { bg: 'bg-red-500/20',     text: 'text-red-400',     label: 'OFFLINE' },
  CONNECTING: { bg: 'bg-muted/40',       text: 'text-muted-foreground', label: 'CONN...' },
}

const exchangeLabels: Record<string, string> = {
  Binance: 'BIN',
  Bybit: 'BYB',
  OKX: 'OKX',
  Deribit: 'DBT',
}

export function ExchangeStatusBar() {
  const { exchangeHealth } = useMarketDataContext()
  return (
    <div className="flex items-center gap-2">
      {exchangeHealth.map((ex) => {
        const config = statusConfig[ex.status]
        return (
          <div
            key={ex.exchange}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium',
              config.bg,
              config.text
            )}
          >
            <span className="relative flex h-2 w-2">
              <span
                className={cn(
                  'absolute inline-flex h-full w-full rounded-full opacity-75',
                  ex.status === 'LIVE' && 'animate-ping bg-emerald-400',
                  ex.status === 'SLOW' && 'bg-amber-400',
                  ex.status === 'OFFLINE' && 'bg-red-400'
                )}
              />
              <span
                className={cn(
                  'relative inline-flex h-2 w-2 rounded-full',
                  ex.status === 'LIVE' && 'bg-emerald-400',
                  ex.status === 'SLOW' && 'bg-amber-400',
                  ex.status === 'OFFLINE' && 'bg-red-400'
                )}
              />
            </span>
            <span>{exchangeLabels[ex.exchange]}</span>
            <span className="uppercase">{config.label}</span>
          </div>
        )
      })}
    </div>
  )
}
