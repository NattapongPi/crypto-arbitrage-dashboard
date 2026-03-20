'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { StatCard, StatCardRow } from '@/components/dashboard/stat-card'
import { DataTable } from '@/components/dashboard/data-table'
import { SignalBadge } from '@/components/dashboard/signal-badge'
import { ExchangeFilter } from '@/components/dashboard/exchange-filter'
import { spotFuturesData, spotFuturesStats, formatCurrency } from '@/lib/mock-data'
import type { Exchange, SpotFuturesPair } from '@/lib/types'
import { cn } from '@/lib/utils'

export default function SpotFuturesPage() {
  const [selectedExchange, setSelectedExchange] = useState<Exchange | 'All'>('All')

  const filteredData = selectedExchange === 'All'
    ? spotFuturesData
    : spotFuturesData.filter(item => item.exchange === selectedExchange)

  const columns = [
    {
      key: 'exchange',
      header: 'Exchange',
      render: (item: SpotFuturesPair) => (
        <span className="font-medium text-foreground">{item.exchange}</span>
      ),
    },
    {
      key: 'pair',
      header: 'Pair',
      render: (item: SpotFuturesPair) => (
        <span className="font-mono text-muted-foreground">{item.pair}</span>
      ),
    },
    {
      key: 'spotPrice',
      header: 'Spot Price',
      render: (item: SpotFuturesPair) => (
        <span className="font-mono tabular-nums text-foreground">
          {formatCurrency(item.spotPrice)}
        </span>
      ),
    },
    {
      key: 'perpPrice',
      header: 'Perp Price',
      render: (item: SpotFuturesPair) => (
        <span className="font-mono tabular-nums text-foreground">
          {formatCurrency(item.perpPrice)}
        </span>
      ),
    },
    {
      key: 'basisPercent',
      header: 'Basis %',
      render: (item: SpotFuturesPair) => (
        <span className={cn(
          'font-mono tabular-nums font-medium',
          item.basisPercent >= 0 ? 'text-emerald-400' : 'text-red-400'
        )}>
          {item.basisPercent >= 0 ? '+' : ''}{item.basisPercent.toFixed(2)}%
        </span>
      ),
    },
    {
      key: 'change1min',
      header: 'Chg 1min',
      render: (item: SpotFuturesPair) => (
        <span className={cn(
          'font-mono tabular-nums',
          item.change1min > 0 ? 'text-emerald-400' : item.change1min < 0 ? 'text-red-400' : 'text-muted-foreground'
        )}>
          {item.change1min > 0 ? '+' : ''}{item.change1min.toFixed(2)}%
        </span>
      ),
    },
    {
      key: 'feeAdjPnl',
      header: 'Fee-Adj PnL',
      render: (item: SpotFuturesPair) => (
        <span className={cn(
          'font-mono tabular-nums',
          item.feeAdjPnl >= 0 ? 'text-emerald-400' : 'text-red-400'
        )}>
          {item.feeAdjPnl >= 0 ? '+' : ''}{item.feeAdjPnl.toFixed(2)}%
        </span>
      ),
    },
    {
      key: 'signal',
      header: 'Signal',
      render: (item: SpotFuturesPair) => <SignalBadge signal={item.signal} />,
    },
  ]

  return (
    <DashboardLayout title="Spot-Futures Basis" subtitle="Live Dashboard">
      <div className="space-y-6">
        {/* Stats Row */}
        <StatCardRow>
          <StatCard
            label="Active Opportunities"
            value={spotFuturesStats.activeOpportunities}
            variant="green"
          />
          <StatCard
            label="Best Basis Now"
            value={spotFuturesStats.bestBasis}
            variant="cyan"
          />
          <StatCard
            label="Pairs Monitored"
            value={spotFuturesStats.pairsMonitored}
            variant="purple"
          />
          <StatCard
            label="Fee-Adj Threshold"
            value={spotFuturesStats.feeAdjThreshold}
            variant="yellow"
          />
        </StatCardRow>

        {/* Data Table */}
        <DataTable
          data={filteredData}
          columns={columns}
          title="Live Spot-Futures Pairs"
          headerAction={
            <ExchangeFilter
              selected={selectedExchange}
              onSelect={setSelectedExchange}
            />
          }
        />
      </div>
    </DashboardLayout>
  )
}
