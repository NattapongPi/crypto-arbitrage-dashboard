'use client'

import { createContext, useContext } from 'react'
import { useSettings } from '../hooks/use-settings'
import { useMarketData, type MarketDataState } from '../hooks/use-market-data'
import type { UseSettingsReturn } from '../hooks/use-settings'

// ── Settings context ──────────────────────────────────────────────────────────

const SettingsContext = createContext<UseSettingsReturn | null>(null)

export function useSettingsContext(): UseSettingsReturn {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettingsContext must be used inside <Providers>')
  return ctx
}

// ── Market data context ───────────────────────────────────────────────────────

const MarketDataContext = createContext<MarketDataState | null>(null)

export function useMarketDataContext(): MarketDataState {
  const ctx = useContext(MarketDataContext)
  if (!ctx) throw new Error('useMarketDataContext must be used inside <Providers>')
  return ctx
}

// ── Combined provider ─────────────────────────────────────────────────────────

export function Providers({ children }: { children: React.ReactNode }) {
  const settingsReturn = useSettings()
  const marketData = useMarketData(settingsReturn.settings)

  return (
    <SettingsContext.Provider value={settingsReturn}>
      <MarketDataContext.Provider value={marketData}>
        {children}
      </MarketDataContext.Provider>
    </SettingsContext.Provider>
  )
}
