'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { StatCard, StatCardRow } from '@/components/dashboard/stat-card'
import { DataTable } from '@/components/dashboard/data-table'
import { SignalBadge } from '@/components/dashboard/signal-badge'
import { ExchangeFilter } from '@/components/dashboard/exchange-filter'
import { useMarketDataContext } from '@/lib/context/market-data-context'
import { formatRate, formatPercent, formatCountdown, formatOI } from '@/lib/formatters'
import type { Exchange, FundingRatePair } from '@/lib/types'
import { cn } from '@/lib/utils'

export default function FundingRatePage() {
  const { fundingRateData, fundingStats } = useMarketDataContext()
  const [selectedExchange, setSelectedExchange] = useState<Exchange | "All">("All")

  const filteredData = selectedExchange === "All"
    ? fundingRateData
    : fundingRateData.filter((item) => item.exchange === selectedExchange)

  // Countdown driven by the real next funding time
  const [countdown, setCountdown] = useState('--:--:--')
  useEffect(() => {
    function tick() {
      if (!fundingStats.nextFundingTime) return
      setCountdown(formatCountdown(fundingStats.nextFundingTime))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [fundingStats.nextFundingTime])

  const columns = [
    {
      key: 'exchange',
      header: 'Exchange',
      render: (item: FundingRatePair) => (
        <span className="font-medium text-foreground">{item.exchange}</span>
      ),
    },
    {
      key: 'pair',
      header: 'Pair',
      render: (item: FundingRatePair) => (
        <span className="font-mono text-muted-foreground">{item.pair}</span>
      ),
    },
    {
      key: 'currentRate',
      header: 'Current Rate',
      render: (item: FundingRatePair) => (
        <span className={cn('font-mono tabular-nums font-medium', item.currentRate >= 0 ? 'text-emerald-400' : 'text-red-400')}>
          {formatRate(item.currentRate)}
        </span>
      ),
    },
    {
      key: 'predictedRate',
      header: 'Predicted',
      mobileHidden: true,
      render: (item: FundingRatePair) => (
        item.predictedRate !== undefined ? (
          <span className={cn('font-mono tabular-nums', item.predictedRate >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {formatRate(item.predictedRate)}
          </span>
        ) : (
          <span className="font-mono text-muted-foreground">--</span>
        )
      ),
    },
    {
      key: 'nextFundingTime',
      header: 'Next In',
      mobileHidden: true,
      render: (item: FundingRatePair) => (
        <span className="font-mono text-muted-foreground">
          {item.nextFundingTime ? formatCountdown(item.nextFundingTime) : '--'}
        </span>
      ),
    },
    {
      key: 'annualized',
      header: 'Annualized',
      render: (item: FundingRatePair) => (
        <span className={cn('font-mono tabular-nums font-medium', item.annualized >= 0 ? 'text-emerald-400' : 'text-red-400')}>
          {formatPercent(item.annualized, 1)}
        </span>
      ),
    },
    {
      key: 'change1min',
      header: 'Chg 1min',
      mobileHidden: true,
      render: (item: FundingRatePair) => (
        <span className={cn('font-mono tabular-nums',
          item.change1min > 0 ? 'text-emerald-400' :
          item.change1min < 0 ? 'text-red-400' :
          'text-muted-foreground'
        )}>
          {formatPercent(item.change1min)}
        </span>
      ),
    },
    {
      key: 'openInterest',
      header: 'Open Interest',
      mobileHidden: true,
      render: (item: FundingRatePair) => (
        <span className="font-mono text-foreground">
          {item.openInterest !== undefined ? formatOI(item.openInterest) : '--'}
        </span>
      ),
    },
    {
      key: 'signal',
      header: 'Signal',
      render: (item: FundingRatePair) => <SignalBadge signal={item.signal} />,
    },
  ]

  return (
    <DashboardLayout
      title="Funding Rate"
      subtitle={fundingStats.nextFundingTime ? `Next settlement in ${countdown}` : 'Connecting…'}
    >
      <div className="space-y-6">
        <StatCardRow>
          <StatCard label="Highest Rate Now" value={formatRate(fundingStats.highestRate)} variant="green" />
          <StatCard label="Best Annualized" value={formatPercent(fundingStats.bestAnnualized, 1)} variant="cyan" />
          <StatCard label="Lowest (short opp)" value={formatRate(fundingStats.lowestRate)} variant="purple" />
          <StatCard label="Next Settlement" value={countdown} variant="yellow" />
        </StatCardRow>

        <DataTable
          data={filteredData}
          columns={columns}
          title="Live Funding Rates — All Pairs"
          enableColumnToggle={true}
          defaultHiddenColumns={['predictedRate', 'openInterest']}
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
