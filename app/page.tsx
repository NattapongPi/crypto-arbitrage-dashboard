import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { StatCard, StatCardRow } from '@/components/dashboard/stat-card'
import { 
  spotFuturesStats, 
  fundingStats, 
  calendarStats, 
  alertStats,
  spotFuturesData,
  fundingRateData,
  calendarSpreadData,
  liveAlertsData
} from '@/lib/mock-data'
import Link from 'next/link'
import { ArrowRight, TrendingUp, Clock, Calendar, Bell } from 'lucide-react'
import { SignalBadge, StatusBadge } from '@/components/dashboard/signal-badge'

export default function OverviewPage() {
  return (
    <DashboardLayout title="Overview" subtitle="Real-time arbitrage opportunities across CEX markets">
      <div className="space-y-8">
        {/* Summary Stats */}
        <StatCardRow>
          <StatCard label="Active Alerts" value={alertStats.activeNow} variant="green" />
          <StatCard label="Spot-Futures" value={alertStats.spotFutures} variant="cyan" />
          <StatCard label="Funding Rate" value={alertStats.fundingRate} variant="purple" />
          <StatCard label="Calendar Spread" value={alertStats.calendarSpread} variant="yellow" />
          <StatCard label="Fading" value={alertStats.fading} variant="red" />
        </StatCardRow>

        {/* Quick Access Cards */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Spot-Futures Preview */}
          <QuickAccessCard 
            title="Spot-Futures Basis"
            icon={TrendingUp}
            href="/spot-futures"
            stat={spotFuturesStats.bestBasis}
            statLabel="Best Basis"
          >
            <div className="space-y-2">
              {spotFuturesData.slice(0, 3).map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-foreground">{item.exchange}</span>
                    <span className="text-sm text-muted-foreground">{item.pair}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono tabular-nums text-emerald-400">+{item.basisPercent.toFixed(2)}%</span>
                    <SignalBadge signal={item.signal} />
                  </div>
                </div>
              ))}
            </div>
          </QuickAccessCard>

          {/* Funding Rate Preview */}
          <QuickAccessCard 
            title="Funding Rate"
            icon={Clock}
            href="/funding-rate"
            stat={fundingStats.bestAnnualized}
            statLabel="Best Annualized"
          >
            <div className="space-y-2">
              {fundingRateData.slice(0, 3).map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-foreground">{item.exchange}</span>
                    <span className="text-sm text-muted-foreground">{item.pair}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-mono tabular-nums ${item.annualized >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {item.annualized >= 0 ? '+' : ''}{item.annualized.toFixed(1)}%
                    </span>
                    <SignalBadge signal={item.signal} />
                  </div>
                </div>
              ))}
            </div>
          </QuickAccessCard>

          {/* Calendar Spread Preview */}
          <QuickAccessCard 
            title="Calendar Spread"
            icon={Calendar}
            href="/calendar-spread"
            stat={calendarStats.bestSpread}
            statLabel="Best Spread"
          >
            <div className="space-y-2">
              {calendarSpreadData.slice(0, 3).map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-foreground">{item.exchange}</span>
                    <span className="text-sm text-muted-foreground">{item.asset} {item.nearLeg}/{item.farLeg}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono tabular-nums text-emerald-400">+{item.spreadPercent.toFixed(2)}%</span>
                    <SignalBadge signal={item.signal} />
                  </div>
                </div>
              ))}
            </div>
          </QuickAccessCard>

          {/* Live Alerts Preview */}
          <QuickAccessCard 
            title="Live Alerts"
            icon={Bell}
            href="/live-alerts"
            stat={alertStats.activeNow.toString()}
            statLabel="Active Now"
          >
            <div className="space-y-2">
              {liveAlertsData.slice(0, 3).map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-muted-foreground">{item.time}</span>
                    <span className="text-sm font-medium text-foreground">{item.exchange}</span>
                    <span className="text-sm text-muted-foreground">{item.pair}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded bg-primary/20 px-1.5 py-0.5 text-xs text-primary">{item.strategy}</span>
                    <StatusBadge status={item.status} />
                  </div>
                </div>
              ))}
            </div>
          </QuickAccessCard>
        </div>
      </div>
    </DashboardLayout>
  )
}

interface QuickAccessCardProps {
  title: string
  icon: React.ElementType
  href: string
  stat: string
  statLabel: string
  children: React.ReactNode
}

function QuickAccessCard({ title, icon: Icon, href, stat, statLabel, children }: QuickAccessCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-lg font-bold text-emerald-400">{stat}</span>
            <span className="ml-2 text-xs text-muted-foreground">{statLabel}</span>
          </div>
          <Link 
            href={href}
            className="flex items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
          >
            View All
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  )
}
