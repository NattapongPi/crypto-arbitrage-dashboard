'use client'

import { cn } from '@/lib/utils'
import type { Exchange } from '@/lib/types'

const exchanges: (Exchange | 'All')[] = ['All', 'Binance', 'Bybit', 'OKX', 'Deribit']

interface ExchangeFilterProps {
  selected: Exchange | 'All'
  onSelect: (exchange: Exchange | 'All') => void
}

export function ExchangeFilter({ selected, onSelect }: ExchangeFilterProps) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
      {exchanges.map((ex) => (
        <button
          key={ex}
          onClick={() => onSelect(ex)}
          className={cn(
            'shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
            selected === ex
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
          )}
        >
          {ex}
        </button>
      ))}
    </div>
  )
}
