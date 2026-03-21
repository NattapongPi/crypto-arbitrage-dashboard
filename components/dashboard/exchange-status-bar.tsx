'use client'

import { cn } from '@/lib/utils'
import { useMarketDataContext } from '@/lib/context/market-data-context'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { ExchangeStatus } from '@/lib/types'

const statusConfig: Record<ExchangeStatus, { bg: string; text: string; label: string }> = {
  LIVE:       { bg: 'bg-emerald-500/20', text: 'text-emerald-400',        label: 'LIVE' },
  SLOW:       { bg: 'bg-amber-500/20',   text: 'text-amber-400',          label: 'SLOW' },
  OFFLINE:    { bg: 'bg-red-500/20',     text: 'text-red-400',            label: 'OFFLINE' },
  CONNECTING: { bg: 'bg-muted/40',       text: 'text-muted-foreground',   label: 'CONNECTING' },
}

const exchangeFullNames: Record<string, string> = {
  Binance: 'Binance',
  Bybit:   'Bybit',
  OKX:     'OKX',
  Deribit: 'Deribit',
}

const tooltipDetails: Record<ExchangeStatus, string> = {
  LIVE:       'Exchange is connected and streaming live data.',
  SLOW:       'Exchange is connected but response is slow.',
  OFFLINE:    'Exchange is unreachable. Reconnecting...',
  CONNECTING: 'Establishing connection to exchange...',
}

export function ExchangeStatusBar() {
  const { exchangeHealth } = useMarketDataContext()

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-2">
        {exchangeHealth.map((ex) => {
          const config = statusConfig[ex.status]
          const isConnecting = ex.status === 'CONNECTING'

          return (
            <Tooltip key={ex.exchange}>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium cursor-default select-none',
                    config.bg,
                    config.text
                  )}
                >
                  {/* Status dot */}
                  <span className="relative flex h-2 w-2 shrink-0">
                    {isConnecting ? (
                      // Spinning ring for CONNECTING
                      <span className="absolute inline-flex h-full w-full rounded-full border border-current opacity-60 animate-spin border-t-transparent" />
                    ) : (
                      <>
                        <span
                          className={cn(
                            'absolute inline-flex h-full w-full rounded-full opacity-75',
                            ex.status === 'LIVE'    && 'animate-ping bg-emerald-400',
                            ex.status === 'SLOW'    && 'animate-ping bg-amber-400',
                            ex.status === 'OFFLINE' && 'bg-red-400'
                          )}
                        />
                        <span
                          className={cn(
                            'relative inline-flex h-2 w-2 rounded-full',
                            ex.status === 'LIVE'    && 'bg-emerald-400',
                            ex.status === 'SLOW'    && 'bg-amber-400',
                            ex.status === 'OFFLINE' && 'bg-red-400'
                          )}
                        />
                      </>
                    )}
                  </span>

                  {/* Exchange full name */}
                  <span>{exchangeFullNames[ex.exchange] ?? ex.exchange}</span>

                  {/* Status label */}
                  <span className="uppercase opacity-80">{config.label}</span>

                  {/* Latency (only when LIVE or SLOW) */}
                  {ex.latency != null && (ex.status === 'LIVE' || ex.status === 'SLOW') && (
                    <span className="opacity-60">{ex.latency}ms</span>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                <p className="font-semibold mb-0.5">{ex.exchange}</p>
                <p>{tooltipDetails[ex.status]}</p>
                {ex.latency != null && (
                  <p className="opacity-70 mt-0.5">Latency: {ex.latency}ms</p>
                )}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
