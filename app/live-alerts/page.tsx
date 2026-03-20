'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { StatCard, StatCardRow } from '@/components/dashboard/stat-card'
import { DataTable } from '@/components/dashboard/data-table'
import { StatusBadge } from '@/components/dashboard/signal-badge'
import { useMarketDataContext } from '@/lib/context/market-data-context'
import { formatPercent, formatAge, formatTime } from '@/lib/formatters'
import type { LiveAlert, StrategyType } from '@/lib/types'
import { cn } from '@/lib/utils'

const strategies: (StrategyType | 'All')[] = ['All', 'Spot-Fut', 'Funding', 'Calendar']

type SortOption = 'Spread (desc)' | 'Spread (asc)' | 'Time (newest)' | 'Age (oldest)'

export default function LiveAlertsPage() {
  const { alerts, alertStats } = useMarketDataContext()
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyType | 'All'>('All')
  const [minSpread, setMinSpread] = useState('0.20')
  const [sortBy, setSortBy] = useState<SortOption>('Spread (desc)')

  const minSpreadNum = parseFloat(minSpread) || 0

  const filteredData = alerts.filter((item) => {
    if (selectedStrategy !== 'All' && item.strategy !== selectedStrategy) return false
    if (item.spread < minSpreadNum) return false
    return true
  })

  const sortedData = [...filteredData].sort((a, b) => {
    if (sortBy === 'Spread (desc)') return b.spread - a.spread
    if (sortBy === 'Spread (asc)') return a.spread - b.spread
    if (sortBy === 'Time (newest)') return b.createdAt - a.createdAt
    if (sortBy === 'Age (oldest)') return a.createdAt - b.createdAt
    return 0
  })

  const columns = [
    {
      key: 'createdAt',
      header: 'Time',
      mobileHidden: true,
      render: (item: LiveAlert) => (
        <span className="font-mono text-sm text-muted-foreground">{formatTime(item.createdAt)}</span>
      ),
    },
    {
      key: 'exchange',
      header: 'Exchange',
      render: (item: LiveAlert) => (
        <span className="font-medium text-foreground">{item.exchange}</span>
      ),
    },
    {
      key: 'pair',
      header: 'Pair',
      render: (item: LiveAlert) => (
        <span className="font-mono font-medium text-foreground">{item.pair}</span>
      ),
    },
    {
      key: 'strategy',
      header: 'Strategy',
      render: (item: LiveAlert) => (
        <span className={cn(
          'rounded px-2 py-0.5 text-xs font-medium',
          item.strategy === 'Spot-Fut' && 'bg-cyan-500/20 text-cyan-400',
          item.strategy === 'Funding' && 'bg-emerald-500/20 text-emerald-400',
          item.strategy === 'Calendar' && 'bg-purple-500/20 text-purple-400'
        )}>
          {item.strategy}
        </span>
      ),
    },
    {
      key: 'spread',
      header: 'Spread',
      render: (item: LiveAlert) => (
        <span className={cn('font-mono tabular-nums font-medium', item.spread >= 0 ? 'text-emerald-400' : 'text-red-400')}>
          {formatPercent(item.spread)}
        </span>
      ),
    },
    {
      key: 'feeAdjPnl',
      header: 'Fee-Adj PnL',
      mobileHidden: true,
      render: (item: LiveAlert) => (
        <span className={cn('font-mono tabular-nums', item.feeAdjPnl >= 0 ? 'text-emerald-400' : 'text-red-400')}>
          {formatPercent(item.feeAdjPnl)}
        </span>
      ),
    },
    {
      key: 'age',
      header: 'Age',
      mobileHidden: true,
      render: (item: LiveAlert) => {
        const age = formatAge(item.createdAt)
        return (
          <span className={cn('font-mono text-sm', age.includes('m') ? 'text-yellow-400' : 'text-muted-foreground')}>
            {age}
          </span>
        )
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: LiveAlert) => <StatusBadge status={item.status} />,
    },
  ]

  return (
    <DashboardLayout title="Live Alerts" subtitle="Dashboard">
      <div className="space-y-4 sm:space-y-6">
        <StatCardRow cols5>
          <StatCard label="Active Now" value={alertStats.activeNow} variant="green" />
          <StatCard label="Spot-Futures" value={alertStats.spotFutures} variant="cyan" />
          <StatCard label="Funding Rate" value={alertStats.fundingRate} variant="purple" />
          <StatCard label="Calendar Spread" value={alertStats.calendarSpread} variant="yellow" />
          <StatCard label="Fading" value={alertStats.fading} variant="red" />
        </StatCardRow>

        {/* Filters */}
        <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-xs text-muted-foreground sm:text-sm">Filter:</span>
              <div className="flex items-center gap-1">
                {strategies.map((strategy) => (
                  <button
                    key={strategy}
                    onClick={() => setSelectedStrategy(strategy)}
                    className={cn(
                      'shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                      selectedStrategy === strategy
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                    )}
                  >
                    {strategy}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-xs text-muted-foreground sm:text-sm">Min Spread:</span>
                <input
                  type="number"
                  value={minSpread}
                  onChange={(e) => setMinSpread(e.target.value)}
                  step="0.05"
                  min="0"
                  className="w-20 rounded-md border border-border bg-input px-2 py-1 text-sm text-foreground"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="shrink-0 text-xs text-muted-foreground sm:text-sm">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="rounded-md border border-border bg-input px-2 py-1 text-sm text-foreground"
                >
                  <option>Spread (desc)</option>
                  <option>Spread (asc)</option>
                  <option>Time (newest)</option>
                  <option>Age (oldest)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Active Alerts Table */}
        <div className="rounded-xl border-2 border-yellow-500/30 bg-card">
          <div className="flex items-center gap-2 border-b border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
            <div className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Active Alerts — Updating live</h3>
          </div>
          <DataTable data={sortedData} columns={columns} className="border-0 rounded-t-none" />
        </div>
      </div>
    </DashboardLayout>
  )
}
