'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { StatCard, StatCardRow } from '@/components/dashboard/stat-card'
import { DataTable } from '@/components/dashboard/data-table'
import { SignalBadge } from '@/components/dashboard/signal-badge'
import { TermStructureChart } from '@/components/dashboard/term-structure-chart'
import { useMarketDataContext } from '@/lib/context/market-data-context'
import { formatPercent } from '@/lib/formatters'
import type { CalendarSpreadPair } from '@/lib/types'
import { cn } from '@/lib/utils'

export default function CalendarSpreadPage() {
  const { calendarSpreadData, calendarStats, termStructure } = useMarketDataContext()

  // Build list of available assets for the chart selector
  const availableAssets = [...new Set(calendarSpreadData.map((d) => d.asset))].sort()
  const [selectedAsset, setSelectedAsset] = useState<string>('BTC')

  const chartAsset = availableAssets.includes(selectedAsset) ? selectedAsset : (availableAssets[0] ?? 'BTC')

  // Filter term structure points to the selected asset
  // termStructure is already filtered to one asset in the hook — re-derive per asset from spread data
  const assetTermPoints = calendarSpreadData
    .filter((d) => d.asset === chartAsset && d.nearLeg === 'Spot')
    .map((d) => ({ expiry: d.farLeg, price: d.farPrice, label: d.farLeg }))
    // Add spot as the first point
  const spotPrice = calendarSpreadData.find((d) => d.asset === chartAsset && d.nearLeg === 'Spot')?.nearPrice
  const chartData = spotPrice
    ? [{ expiry: 'Spot', price: spotPrice, label: 'Spot' }, ...assetTermPoints]
    : assetTermPoints.length > 0 ? assetTermPoints : termStructure

  const columns = [
    {
      key: 'exchange',
      header: 'Exchange',
      render: (item: CalendarSpreadPair) => (
        <span className="font-medium text-foreground">{item.exchange}</span>
      ),
    },
    {
      key: 'asset',
      header: 'Asset',
      render: (item: CalendarSpreadPair) => (
        <span className="font-mono font-medium text-foreground">{item.asset}</span>
      ),
    },
    {
      key: 'nearLeg',
      header: 'Buy (Near)',
      render: (item: CalendarSpreadPair) => (
        <span className="font-mono text-cyan-400">{item.nearLeg}</span>
      ),
    },
    {
      key: 'farLeg',
      header: 'Sell (Far)',
      render: (item: CalendarSpreadPair) => (
        <span className="font-mono text-cyan-400">{item.farLeg}</span>
      ),
    },
    {
      key: 'spreadPercent',
      header: 'Spread',
      render: (item: CalendarSpreadPair) => (
        <span className={cn('font-mono tabular-nums font-medium', item.spreadPercent >= 0 ? 'text-emerald-400' : 'text-red-400')}>
          {formatPercent(item.spreadPercent)}
        </span>
      ),
    },
    {
      key: 'annReturn',
      header: 'Ann. Return',
      mobileHidden: true,
      render: (item: CalendarSpreadPair) => (
        <span className={cn('font-mono tabular-nums', item.annReturn >= 0 ? 'text-emerald-400' : 'text-red-400')}>
          {formatPercent(item.annReturn, 2)}/yr
        </span>
      ),
    },
    {
      key: 'feeAdjPnl',
      header: 'After Fees',
      mobileHidden: true,
      render: (item: CalendarSpreadPair) => (
        <span className={cn('font-mono tabular-nums', item.feeAdjPnl >= 0 ? 'text-emerald-400' : 'text-red-400')}>
          {formatPercent(item.feeAdjPnl)}
        </span>
      ),
    },
    {
      key: 'signal',
      header: 'Signal',
      render: (item: CalendarSpreadPair) => <SignalBadge signal={item.signal} />,
    },
  ]

  return (
    <DashboardLayout title="Calendar Spread" subtitle="Buy near-dated futures, sell far-dated futures to capture the spread">
      <div className="space-y-6">
        <StatCardRow>
          <StatCard label="Best Spread Now" value={formatPercent(calendarStats.bestSpread)} variant="green" />
          <StatCard label="Opportunities" value={calendarStats.activeSpreads} variant="cyan" />
          <StatCard label="Pairs Monitored" value={calendarStats.pairsMonitored} variant="purple" />
          <StatCard
            label="Next Expiry"
            value={calendarStats.nearestDte ? `${calendarStats.nearestExpiry} (${calendarStats.nearestDte}d)` : '--'}
            variant="yellow"
          />
        </StatCardRow>

        <TermStructureChart
          data={chartData}
          asset={chartAsset}
          availableAssets={availableAssets}
          onAssetChange={setSelectedAsset}
        />

        <DataTable data={calendarSpreadData} columns={columns} title="All Calendar Spread Opportunities" />
      </div>
    </DashboardLayout>
  )
}
