# ArbRadar — Crypto Arbitrage Dashboard

A real-time cryptocurrency arbitrage opportunity dashboard monitoring spot-futures basis, funding rates, and calendar spreads across major CEX markets.

## Features

- **Spot-Futures Basis** — Track spread between spot and perpetual futures prices across 9 pairs
- **Funding Rate Monitor** — Live & predicted funding rates with annualized return calculations
- **Calendar Spread** — Near/far leg spread analysis with term structure chart and spread matrix
- **Live Alerts** — Real-time opportunity alerts filterable by strategy, exchange, and min spread threshold
- **Exchange Health Bar** — Latency and status tracking for all connected exchanges

## Exchanges

| Exchange | Status | Latency |
| -------- | ------ | ------- |
| Binance  | LIVE   | 45ms    |
| Bybit    | LIVE   | 52ms    |
| OKX      | SLOW   | 180ms   |
| Deribit  | LIVE   | 38ms    |

## Pages

| Route              | Description                                                                |
| ------------------ | -------------------------------------------------------------------------- |
| `/`                | Overview — summary stats and quick-access cards for each strategy          |
| `/spot-futures`    | Spot vs. perp price basis, fee-adjusted PnL, exchange filter               |
| `/funding-rate`    | Current/predicted rates, annualized returns, OI, next settlement countdown |
| `/calendar-spread` | Expiry spread analysis, term structure chart, spread matrix                |
| `/live-alerts`     | Sortable/filterable alert feed with ACTIVE / WATCH / FADING status         |
| `/settings`        | Configuration                                                              |

## Trading Pairs

`BTC-PERP` · `ETH-PERP` · `SOL-PERP` · `BNB-PERP`
Dated contracts: `28-Mar` · `26-Jun` · `26-Sep`

## Signal Types

| Signal      | Meaning                                              |
| ----------- | ---------------------------------------------------- |
| `BUY BASIS` | Strong positive basis — enter long spot / short perp |
| `LONG SPOT` | Spot underpriced relative to perp                    |
| `ENTER`     | Funding or calendar opportunity — enter now          |
| `WATCH`     | Opportunity forming — monitor closely                |
| `INVERTED`  | Basis inverted — negative carry                      |
| `SHORT OPP` | Short-side opportunity                               |
| `SKIP`      | Spread below threshold after fees                    |

## Data Model

Key types from `lib/types.ts`:

- `SpotFuturesPair` — `spotPrice`, `perpPrice`, `basisPercent`, `change1min`, `feeAdjPnl`, `signal`
- `FundingRatePair` — `currentRate`, `predictedRate`, `annualized`, `openInterest`, `nextIn`, `signal`
- `CalendarSpreadPair` — `asset`, `nearLeg`, `farLeg`, `spreadPercent`, `annReturn`, `feeAdjPnl`, `signal`
- `LiveAlert` — `time`, `exchange`, `pair`, `strategy`, `spread`, `feeAdjPnl`, `age`, `status`

Mock data lives in `lib/mock-data.ts` and is ready to be swapped for a live data feed.

## Tech Stack

- [Next.js](https://nextjs.org) (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui
- Space Grotesk + IBM Plex Mono (fonts)
- Vercel Analytics

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deployment

Every merge to `main` auto-deploys via Vercel.
