'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { StatCard, StatCardRow } from '@/components/dashboard/stat-card'
import { DataTable } from '@/components/dashboard/data-table'
import { StatusBadge } from '@/components/dashboard/signal-badge'
import { liveAlertsData, alertStats } from '@/lib/mock-data'
import type { LiveAlert, StrategyType } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const strategies: (StrategyType | 'All')[] = ['All', 'Spot-Fut', 'Funding', 'Calendar']

export default function LiveAlertsPage() {
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyType | 'All'>('All')
  const [minSpread, setMinSpread] = useState('0.20')
  const [sortBy, setSortBy] = useState('Spread (desc)')

  const filteredData = selectedStrategy === 'All'
    ? liveAlertsData
    : liveAlertsData.filter(item => item.strategy === selectedStrategy)

  // Sort by spread (descending)
  const sortedData = [...filteredData].sort((a, b) => {
    const spreadA = parseFloat(a.spread.replace('%', '').replace('+', ''))
    const spreadB = parseFloat(b.spread.replace('%', '').replace('+', ''))
    return sortBy === 'Spread (desc)' ? spreadB - spreadA : spreadA - spreadB
  })

  const columns = [
    {
      key: 'time',
      header: 'Time',
      render: (item: LiveAlert) => (
        <span className="font-mono text-sm text-muted-foreground">{item.time}</span>
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
        <span className="font-mono tabular-nums font-medium text-emerald-400">
          {item.spread}
        </span>
      ),
    },
    {
      key: 'feeAdjPnl',
      header: 'Fee-Adj PnL',
      render: (item: LiveAlert) => (
        <span className="font-mono tabular-nums text-emerald-400">{item.feeAdjPnl}</span>
      ),
    },
    {
      key: 'age',
      header: 'Age',
      render: (item: LiveAlert) => (
        <span className={cn(
          'font-mono text-sm',
          item.age.includes('m') ? 'text-yellow-400' : 'text-muted-foreground'
        )}>
          {item.age}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: LiveAlert) => <StatusBadge status={item.status} />,
    },
    {
      key: 'action',
      header: 'Action',
      render: () => (
        <Button variant="outline" size="sm" className="h-7 text-xs">
          View Details
        </Button>
      ),
    },
  ]

  return (
    <DashboardLayout title="Live Alerts" subtitle="Dashboard">
      <div className="space-y-6">
        {/* Stats Row */}
        <StatCardRow>
          <StatCard
            label="Active Now"
            value={alertStats.activeNow}
            variant="green"
          />
          <StatCard
            label="Spot-Futures"
            value={alertStats.spotFutures}
            variant="cyan"
          />
          <StatCard
            label="Funding Rate"
            value={alertStats.fundingRate}
            variant="purple"
          />
          <StatCard
            label="Calendar Spread"
            value={alertStats.calendarSpread}
            variant="yellow"
          />
          <StatCard
            label="Fading"
            value={alertStats.fading}
            variant="red"
          />
        </StatCardRow>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Filter:</span>
            <div className="flex items-center gap-1">
              {strategies.map((strategy) => (
                <button
                  key={strategy}
                  onClick={() => setSelectedStrategy(strategy)}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
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

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Min Spread:</span>
            <input
              type="text"
              value={minSpread}
              onChange={(e) => setMinSpread(e.target.value)}
              className="w-20 rounded-md border border-border bg-input px-2 py-1 text-sm text-foreground"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-md border border-border bg-input px-2 py-1 text-sm text-foreground"
            >
              <option>Spread (desc)</option>
              <option>Spread (asc)</option>
              <option>Time (newest)</option>
              <option>Age (oldest)</option>
            </select>
          </div>
        </div>

        {/* Active Alerts Table */}
        <div className="rounded-xl border-2 border-yellow-500/30 bg-card">
          <div className="flex items-center gap-2 border-b border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
            <div className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Active Alerts - Updating live</h3>
          </div>
          <DataTable
            data={sortedData}
            columns={columns}
            className="border-0 rounded-t-none"
          />
        </div>
      </div>
    </DashboardLayout>
  )
}
