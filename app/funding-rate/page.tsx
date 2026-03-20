'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { StatCard, StatCardRow } from '@/components/dashboard/stat-card'
import { DataTable } from '@/components/dashboard/data-table'
import { SignalBadge } from '@/components/dashboard/signal-badge'
import { fundingRateData, fundingStats } from '@/lib/mock-data'
import type { FundingRatePair } from '@/lib/types'
import { cn } from '@/lib/utils'

export default function FundingRatePage() {
  const [countdown, setCountdown] = useState(fundingStats.nextSettlement)

  // Simulate countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(prev => {
        const [h, m, s] = prev.split(':').map(Number)
        let totalSeconds = h * 3600 + m * 60 + s - 1
        if (totalSeconds <= 0) totalSeconds = 8 * 3600 // Reset to 8 hours
        const hours = Math.floor(totalSeconds / 3600)
        const minutes = Math.floor((totalSeconds % 3600) / 60)
        const seconds = totalSeconds % 60
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [])

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
        <span className={cn(
          'font-mono tabular-nums font-medium',
          item.currentRate >= 0 ? 'text-emerald-400' : 'text-red-400'
        )}>
          {item.currentRate >= 0 ? '+' : ''}{item.currentRate.toFixed(3)}%
        </span>
      ),
    },
    {
      key: 'predictedRate',
      header: 'Predicted',
      render: (item: FundingRatePair) => (
        <span className={cn(
          'font-mono tabular-nums',
          item.predictedRate >= 0 ? 'text-emerald-400' : 'text-red-400'
        )}>
          {item.predictedRate >= 0 ? '+' : ''}{item.predictedRate.toFixed(3)}%
        </span>
      ),
    },
    {
      key: 'nextIn',
      header: 'Next In',
      render: (item: FundingRatePair) => (
        <span className="font-mono text-muted-foreground">{item.nextIn}</span>
      ),
    },
    {
      key: 'annualized',
      header: 'Annualized',
      render: (item: FundingRatePair) => (
        <span className={cn(
          'font-mono tabular-nums font-medium',
          item.annualized >= 0 ? 'text-emerald-400' : 'text-red-400'
        )}>
          {item.annualized >= 0 ? '+' : ''}{item.annualized.toFixed(1)}%
        </span>
      ),
    },
    {
      key: 'openInterest',
      header: 'Open Interest',
      render: (item: FundingRatePair) => (
        <span className="font-mono text-foreground">{item.openInterest}</span>
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
      subtitle={`Next settlement in ${countdown}`}
    >
      <div className="space-y-6">
        {/* Stats Row */}
        <StatCardRow>
          <StatCard
            label="Highest Rate Now"
            value={fundingStats.highestRate}
            variant="green"
          />
          <StatCard
            label="Best Annualized"
            value={fundingStats.bestAnnualized}
            variant="cyan"
          />
          <StatCard
            label="Lowest (short opp)"
            value={fundingStats.lowestRate}
            variant="purple"
          />
          <StatCard
            label="Next Settlement"
            value={countdown}
            variant="yellow"
          />
        </StatCardRow>

        {/* Data Table */}
        <DataTable
          data={fundingRateData}
          columns={columns}
          title="Live Funding Rates - All Pairs"
        />
      </div>
    </DashboardLayout>
  )
}
