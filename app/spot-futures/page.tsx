"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { StatCard, StatCardRow } from "@/components/dashboard/stat-card";
import { DataTable } from "@/components/dashboard/data-table";
import { SignalBadge } from "@/components/dashboard/signal-badge";
import { ExchangeFilter } from "@/components/dashboard/exchange-filter";
import { useMarketDataContext } from "@/lib/context/market-data-context";
import { formatPrice, formatPercent } from "@/lib/formatters";
import type { Exchange, SpotFuturesPair } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function SpotFuturesPage() {
  const { spotFuturesData, spotFuturesStats } = useMarketDataContext();
  const [selectedExchange, setSelectedExchange] = useState<Exchange | "All">(
    "All",
  );

  const filteredData =
    selectedExchange === "All"
      ? spotFuturesData
      : spotFuturesData.filter((item) => item.exchange === selectedExchange);

  const columns = [
    {
      key: "exchange",
      header: "Exchange",
      render: (item: SpotFuturesPair) => (
        <span className="font-medium text-foreground">{item.exchange}</span>
      ),
    },
    {
      key: "pair",
      header: "Pair",
      render: (item: SpotFuturesPair) => (
        <span className="font-mono text-muted-foreground">{item.pair}</span>
      ),
    },
    {
      key: "spotPrice",
      header: "Spot Price",
      mobileHidden: true,
      render: (item: SpotFuturesPair) => (
        <span className="font-mono tabular-nums text-foreground">
          {formatPrice(item.spotPrice)}
        </span>
      ),
    },
    {
      key: "spotBid",
      header: "Spot Bid",
      mobileHidden: true,
      render: (item: SpotFuturesPair) => (
        <span className="font-mono tabular-nums text-foreground">
          {item.spotBid !== undefined ? formatPrice(item.spotBid) : "-"}
        </span>
      ),
    },
    {
      key: "spotAsk",
      header: "Spot Ask",
      mobileHidden: true,
      render: (item: SpotFuturesPair) => (
        <span className="font-mono tabular-nums text-foreground">
          {item.spotAsk !== undefined ? formatPrice(item.spotAsk) : "-"}
        </span>
      ),
    },
    {
      key: "perpPrice",
      header: "Perp Price",
      mobileHidden: true,
      render: (item: SpotFuturesPair) => (
        <span className="font-mono tabular-nums text-foreground">
          {formatPrice(item.perpPrice)}
        </span>
      ),
    },
    {
      key: "perpBid",
      header: "Perp Bid",
      mobileHidden: true,
      render: (item: SpotFuturesPair) => (
        <span className="font-mono tabular-nums text-foreground">
          {item.perpBid !== undefined ? formatPrice(item.perpBid) : "-"}
        </span>
      ),
    },
    {
      key: "perpAsk",
      header: "Perp Ask",
      mobileHidden: true,
      render: (item: SpotFuturesPair) => (
        <span className="font-mono tabular-nums text-foreground">
          {item.perpAsk !== undefined ? formatPrice(item.perpAsk) : "-"}
        </span>
      ),
    },
    {
      key: "basisPercent",
      header: "Basis %",
      render: (item: SpotFuturesPair) => (
        <span
          className={cn(
            "font-mono tabular-nums font-medium",
            item.basisPercent >= 0 ? "text-emerald-400" : "text-red-400",
          )}
        >
          {formatPercent(item.basisPercent)}
        </span>
      ),
    },
    {
      key: "change1min",
      header: "Chg 1min",
      mobileHidden: true,
      render: (item: SpotFuturesPair) => (
        <span
          className={cn(
            "font-mono tabular-nums",
            item.change1min > 0
              ? "text-emerald-400"
              : item.change1min < 0
                ? "text-red-400"
                : "text-muted-foreground",
          )}
        >
          {formatPercent(item.change1min)}
        </span>
      ),
    },
    {
      key: "feeAdjPnl",
      header: "Fee-Adj PnL",
      render: (item: SpotFuturesPair) => (
        <span
          className={cn(
            "font-mono tabular-nums",
            item.feeAdjPnl >= 0 ? "text-emerald-400" : "text-red-400",
          )}
        >
          {formatPercent(item.feeAdjPnl)}
        </span>
      ),
    },
    {
      key: "signal",
      header: "Signal",
      render: (item: SpotFuturesPair) => <SignalBadge signal={item.signal} />,
    },
  ];

  return (
    <DashboardLayout title="Spot-Futures Basis" subtitle="Live Dashboard">
      <div className="space-y-6">
        <StatCardRow>
          <StatCard
            label="Active Opportunities"
            value={spotFuturesStats.activeOpportunities}
            variant="green"
          />
          <StatCard
            label="Best Basis Now"
            value={formatPercent(spotFuturesStats.bestBasis)}
            variant="cyan"
          />
          <StatCard
            label="Pairs Monitored"
            value={spotFuturesStats.pairsMonitored}
            variant="purple"
          />
          <StatCard
            label="Fee-Adj Threshold"
            value={formatPercent(spotFuturesStats.feeAdjThreshold)}
            variant="yellow"
          />
        </StatCardRow>

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
  );
}
