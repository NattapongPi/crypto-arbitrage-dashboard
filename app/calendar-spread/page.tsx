'use client'

import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { StatCard, StatCardRow } from '@/components/dashboard/stat-card'
import { DataTable } from '@/components/dashboard/data-table'
import { SignalBadge } from '@/components/dashboard/signal-badge'
import { TermStructureChart } from '@/components/dashboard/term-structure-chart'
import { SpreadMatrix } from '@/components/dashboard/spread-matrix'
import { calendarSpreadData, calendarStats } from '@/lib/mock-data'
import type { CalendarSpreadPair } from '@/lib/types'
import { cn } from '@/lib/utils'

export default function CalendarSpreadPage() {
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
      header: 'Near Leg',
      render: (item: CalendarSpreadPair) => (
        <span className="font-mono text-cyan-400">{item.nearLeg}</span>
      ),
    },
    {
      key: 'farLeg',
      header: 'Far Leg',
      render: (item: CalendarSpreadPair) => (
        <span className="font-mono text-cyan-400">{item.farLeg}</span>
      ),
    },
    {
      key: 'spreadPercent',
      header: 'Spread %',
      render: (item: CalendarSpreadPair) => (
        <span className="font-mono tabular-nums font-medium text-emerald-400">
          +{item.spreadPercent.toFixed(2)}%
        </span>
      ),
    },
    {
      key: 'annReturn',
      header: 'Ann. Return',
      mobileHidden: true,
      render: (item: CalendarSpreadPair) => (
        <span className="font-mono tabular-nums text-emerald-400">{item.annReturn}</span>
      ),
    },
    {
      key: 'feeAdjPnl',
      header: 'Fee-Adj PnL',
      mobileHidden: true,
      render: (item: CalendarSpreadPair) => (
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
      render: (item: CalendarSpreadPair) => <SignalBadge signal={item.signal} />,
    },
  ]

  return (
    <DashboardLayout 
      title="Calendar Spread" 
      subtitle="Expiries: 28-Mar 26-Jun 26-Sep"
    >
      <div className="space-y-6">
        {/* Stats Row */}
        <StatCardRow>
          <StatCard
            label="Best Spread Now"
            value={calendarStats.bestSpread}
            variant="green"
          />
          <StatCard
            label="Active Spreads"
            value={calendarStats.activeSpreads}
            variant="cyan"
          />
          <StatCard
            label="Pairs Monitored"
            value={calendarStats.pairsMonitored}
            variant="purple"
          />
          <StatCard
            label="Nearest Expiry (DTE)"
            value={`${calendarStats.nearestDte} days ${calendarStats.nearestExpiry}`}
            variant="yellow"
          />
        </StatCardRow>

        {/* Charts Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          <TermStructureChart />
          <SpreadMatrix />
        </div>

        {/* Data Table */}
        <DataTable
          data={calendarSpreadData}
          columns={columns}
          title="Live Spread Detail - All Pairs"
        />
      </div>
    </DashboardLayout>
  )
}
