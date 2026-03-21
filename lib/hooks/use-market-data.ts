/**
 * Core market data hook.
 *
 * Manages:
 *   - Fetching instrument lists from /api/instruments on startup
 *   - Creating/destroying WebSocket adapters per enabled exchange
 *   - Accumulating raw tickers and funding rates
 *   - Throttled recalculation of all derived UI data (every 500ms)
 *   - 1-second alert tick (aging + status transitions)
 *   - Exchange health tracking via adapter callbacks
 *   - Reconnection on tab visibility change
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { createAdapter } from "../exchanges";
import { onProxyLatency } from "../exchanges/proxy-adapter";
import { fetchInstruments } from "../instruments";
import {
  calcBasisPercent,
  calcSpotFuturesFeeAdjPnl,
  calcAnnualizedFunding,
  calcCalendarSpread,
  calcCalendarAnnualizedReturn,
  calcCalendarFeeAdjPnl,
  calcDaysToExpiry,
  calc1MinChange,
} from "../arbitrage/calculator";
import {
  determineSpotFuturesSignal,
  determineFundingSignal,
  determineCalendarSignal,
} from "../arbitrage/signals";
import {
  mergeAlerts,
  tickAlerts,
  computeAlertStats,
} from "../arbitrage/alerts";
import {
  CALC_THROTTLE_MS,
  ALERT_TICK_MS,
  PRICE_BUFFER_WINDOW_MS,
} from "../constants";
import type {
  AdapterCallbacks,
  AlertStats,
  CalendarSpreadPair,
  CalendarStats,
  Exchange,
  ExchangeAdapter,
  ExchangeHealth,
  FundingRatePair,
  FundingStats,
  InstrumentInfo,
  LiveAlert,
  NormalizedFundingRate,
  NormalizedTicker,
  PriceSnapshot,
  SpotFuturesPair,
  SpotFuturesStats,
  SpreadMatrixEntry,
  TermStructurePoint,
  UserSettings,
} from "../types";

// ── State shape ────────────────────────────────────────────────────────────────

export interface MarketDataState {
  // Connection state
  isConnecting: boolean;
  exchangeHealth: ExchangeHealth[];
  proxyLatency: number | undefined;
  lastTickTime: number;

  // Derived UI data
  spotFuturesData: SpotFuturesPair[];
  fundingRateData: FundingRatePair[];
  calendarSpreadData: CalendarSpreadPair[];
  termStructure: TermStructurePoint[];
  spreadMatrix: SpreadMatrixEntry[];
  alerts: LiveAlert[];

  // Stats
  spotFuturesStats: SpotFuturesStats;
  fundingStats: FundingStats;
  calendarStats: CalendarStats;
  alertStats: AlertStats;
}

const EMPTY_STATE: MarketDataState = {
  isConnecting: true,
  exchangeHealth: [
    { exchange: "Binance", status: "CONNECTING" },
    { exchange: "Bybit", status: "CONNECTING" },
    { exchange: "OKX", status: "CONNECTING" },
    { exchange: "Deribit", status: "CONNECTING" },
  ],
  proxyLatency: undefined,
  lastTickTime: 0,
  spotFuturesData: [],
  fundingRateData: [],
  calendarSpreadData: [],
  termStructure: [],
  spreadMatrix: [],
  alerts: [],
  spotFuturesStats: {
    activeOpportunities: 0,
    bestBasis: 0,
    pairsMonitored: 0,
    feeAdjThreshold: 0,
  },
  fundingStats: {
    highestRate: 0,
    bestAnnualized: 0,
    lowestRate: 0,
    nextFundingTime: 0,
  },
  calendarStats: {
    bestSpread: 0,
    activeSpreads: 0,
    pairsMonitored: 0,
    nearestExpiry: "--",
    nearestDte: 0,
  },
  alertStats: {
    activeNow: 0,
    spotFutures: 0,
    fundingRate: 0,
    calendarSpread: 0,
    fading: 0,
  },
};

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useMarketData(settings: UserSettings): MarketDataState {
  const [state, setState] = useState<MarketDataState>(EMPTY_STATE);

  // Raw data stored in refs (not state) to avoid re-renders on every tick
  const tickers = useRef(new Map<string, NormalizedTicker>());
  const fundingRates = useRef(new Map<string, NormalizedFundingRate>());
  const priceBuffers = useRef(new Map<string, PriceSnapshot[]>());
  const alerts = useRef<LiveAlert[]>([]);
  const exchangeHealth = useRef<ExchangeHealth[]>(EMPTY_STATE.exchangeHealth);
  const proxyLatencyRef = useRef<number | undefined>(undefined);
  const adapters = useRef(new Map<string, ExchangeAdapter>());
  const instruments = useRef<InstrumentInfo[]>([]);
  const calcTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alertTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const settingsRef = useRef(settings);
  const lastTickTimeRef = useRef(0);

  // Always keep settingsRef current without triggering effects
  settingsRef.current = settings;

  // ── Key builders ─────────────────────────────────────────────────────────────

  const tickerKey = (t: NormalizedTicker) =>
    `${t.exchange}:${t.baseAsset}:${t.type}${t.expiry ? ":" + t.expiry : ""}`;

  const fundingKey = (f: NormalizedFundingRate) =>
    `${f.exchange}:${f.baseAsset}`;

  const bufferKey = (exchange: string, baseAsset: string, type: string) =>
    `${exchange}:${baseAsset}:${type}`;

  // ── Price buffer management ───────────────────────────────────────────────────

  function pushToBuffer(key: string, price: number) {
    const now = Date.now();
    if (!priceBuffers.current.has(key)) priceBuffers.current.set(key, []);
    const buf = priceBuffers.current.get(key)!;
    buf.push({ price, timestamp: now });
    // Trim entries older than 2 minutes
    const cutoff = now - PRICE_BUFFER_WINDOW_MS * 2;
    const firstValid = buf.findIndex((s) => s.timestamp >= cutoff);
    if (firstValid > 0) priceBuffers.current.set(key, buf.slice(firstValid));
  }

  // ── Recalculation ─────────────────────────────────────────────────────────────

  const recalculate = useCallback(() => {
    const s = settingsRef.current;
    const { fees, thresholds } = s;

    // ─ Spot-Futures ──────────────────────────────────────────────────────────
    const spotFuturesData: SpotFuturesPair[] = [];
    const seenAssets = new Set<string>();

    // Find all (exchange, baseAsset) combos that have both spot and perp
    for (const [, ticker] of tickers.current) {
      if (ticker.type !== "spot") continue;
      const perpKey = `${ticker.exchange}:${ticker.baseAsset}:perp`;
      const perpTicker = tickers.current.get(perpKey);
      if (!perpTicker) continue;

      const pairKey = `${ticker.exchange}:${ticker.baseAsset}`;
      if (seenAssets.has(pairKey)) continue;
      seenAssets.add(pairKey);

      const basis = calcBasisPercent(ticker.lastPrice, perpTicker.lastPrice);
      const feeAdj = calcSpotFuturesFeeAdjPnl(
        basis,
        fees.makerFeePercent,
        fees.takerFeePercent
      );
      const bufKey = bufferKey(ticker.exchange, ticker.baseAsset, "spot");
      const change1min = calc1MinChange(
        ticker.lastPrice,
        priceBuffers.current.get(bufKey) ?? []
      );
      const signal = determineSpotFuturesSignal(basis, feeAdj, thresholds);

      spotFuturesData.push({
        id: pairKey,
        exchange: ticker.exchange,
        pair: `${ticker.baseAsset}-PERP`,
        spotPrice: ticker.lastPrice,
        perpPrice: perpTicker.lastPrice,
        basisPercent: basis,
        change1min,
        feeAdjPnl: feeAdj,
        signal,
      });
    }

    // Sort by basis% descending
    spotFuturesData.sort((a, b) => b.basisPercent - a.basisPercent);

    // Spot-futures stats
    const opportunities = spotFuturesData.filter(
      (d) => d.signal === "BUY BASIS" || d.signal === "LONG SPOT"
    );
    const bestBasis = spotFuturesData.reduce(
      (max, d) => Math.max(max, d.basisPercent),
      0
    );
    const spotFuturesStats: SpotFuturesStats = {
      activeOpportunities: opportunities.length,
      bestBasis,
      pairsMonitored: spotFuturesData.length,
      feeAdjThreshold: thresholds.minBasisPercent,
    };

    // ─ Funding Rate ───────────────────────────────────────────────────────────
    const fundingRateData: FundingRatePair[] = [];

    for (const [, fr] of fundingRates.current) {
      if (!s.exchanges[fr.exchange]) continue;
      const annualized = calcAnnualizedFunding(fr.fundingRate);
      const signal = determineFundingSignal(
        annualized,
        fr.fundingRate,
        thresholds
      );

      fundingRateData.push({
        id: fundingKey(fr),
        exchange: fr.exchange,
        pair: `${fr.baseAsset}-PERP`,
        currentRate: fr.fundingRate,
        predictedRate: fr.predictedRate,
        nextFundingTime: fr.nextFundingTime,
        annualized,
        openInterest: fr.openInterest,
        signal,
      });
    }

    fundingRateData.sort((a, b) => b.annualized - a.annualized);

    const nextFundingTime = fundingRateData.reduce(
      (min, d) =>
        d.nextFundingTime && (!min || d.nextFundingTime < min)
          ? d.nextFundingTime
          : min,
      0
    );
    const fundingStats: FundingStats = {
      highestRate: fundingRateData[0]?.currentRate ?? 0,
      bestAnnualized: fundingRateData[0]?.annualized ?? 0,
      lowestRate: fundingRateData[fundingRateData.length - 1]?.currentRate ?? 0,
      nextFundingTime,
    };

    // ─ Calendar Spread ────────────────────────────────────────────────────────
    const calendarSpreadData: CalendarSpreadPair[] = [];
    const spreadMatrixEntries: SpreadMatrixEntry[] = [];
    const termStructureMap = new Map<string, TermStructurePoint[]>();

    // Pre-build a map of futures grouped by "exchange:baseAsset" → sorted list of futures tickers.
    // This avoids an O(n²) scan inside the loop below.
    const futuresByAsset = new Map<string, NormalizedTicker[]>();
    for (const ticker of tickers.current.values()) {
      if (ticker.type !== "future" || !ticker.expiry) continue;
      if (!s.exchanges[ticker.exchange]) continue;
      const key = `${ticker.exchange}:${ticker.baseAsset}`;
      if (!futuresByAsset.has(key)) futuresByAsset.set(key, []);
      futuresByAsset.get(key)!.push(ticker);
    }
    // Sort each group by expiry ascending once
    for (const group of futuresByAsset.values()) {
      group.sort((a, b) => a.expiry!.localeCompare(b.expiry!));
    }

    // Find all futures pairs and compute spreads
    for (const [, farTicker] of tickers.current) {
      if (farTicker.type !== "future" || !farTicker.expiry) continue;
      if (!s.exchanges[farTicker.exchange]) continue;

      // Get spot price as near reference
      const spotKey = `${farTicker.exchange}:${farTicker.baseAsset}:spot`;
      const spotTicker = tickers.current.get(spotKey);

      // Near-leg: first future with an earlier expiry in the pre-sorted group
      const assetGroup =
        futuresByAsset.get(`${farTicker.exchange}:${farTicker.baseAsset}`) ??
        [];
      const nearTickerForCalendar = assetGroup.find(
        (t) => t.expiry! < farTicker.expiry!
      );

      // Spot vs Far leg spread
      if (spotTicker) {
        const spreadPercent = calcCalendarSpread(
          spotTicker.lastPrice,
          farTicker.lastPrice
        );
        const daysToFar = calcDaysToExpiry(farTicker.expiry);
        const annReturn = calcCalendarAnnualizedReturn(
          spreadPercent,
          daysToFar
        );
        const feeAdj = calcCalendarFeeAdjPnl(
          spreadPercent,
          fees.makerFeePercent,
          fees.takerFeePercent
        );
        const signal = determineCalendarSignal(
          spreadPercent,
          feeAdj,
          thresholds
        );

        calendarSpreadData.push({
          id: `${farTicker.exchange}:${farTicker.baseAsset}:spot:${farTicker.expiry}`,
          exchange: farTicker.exchange,
          asset: farTicker.baseAsset,
          nearLeg: "Spot",
          farLeg: farTicker.expiryLabel ?? farTicker.expiry,
          nearPrice: spotTicker.lastPrice,
          farPrice: farTicker.lastPrice,
          spreadPercent,
          annReturn,
          daysToExpiry: daysToFar,
          feeAdjPnl: feeAdj,
          signal,
        });

        spreadMatrixEntries.push({
          nearLeg: "Spot",
          farLeg: farTicker.expiryLabel ?? farTicker.expiry,
          spread: spreadPercent,
          dte: `-/${daysToFar}`,
        });
      }

      // Near leg vs Far leg spread
      if (nearTickerForCalendar) {
        const spreadPercent = calcCalendarSpread(
          nearTickerForCalendar.lastPrice,
          farTicker.lastPrice
        );
        const daysToNear = calcDaysToExpiry(nearTickerForCalendar.expiry!);
        const daysToFar = calcDaysToExpiry(farTicker.expiry);
        const annReturn = calcCalendarAnnualizedReturn(
          spreadPercent,
          daysToFar,
          daysToNear
        );
        const feeAdj = calcCalendarFeeAdjPnl(
          spreadPercent,
          fees.makerFeePercent,
          fees.takerFeePercent
        );
        const signal = determineCalendarSignal(
          spreadPercent,
          feeAdj,
          thresholds
        );

        calendarSpreadData.push({
          id: `${farTicker.exchange}:${farTicker.baseAsset}:${nearTickerForCalendar.expiry}:${farTicker.expiry}`,
          exchange: farTicker.exchange,
          asset: farTicker.baseAsset,
          nearLeg:
            nearTickerForCalendar.expiryLabel ?? nearTickerForCalendar.expiry!,
          farLeg: farTicker.expiryLabel ?? farTicker.expiry,
          nearPrice: nearTickerForCalendar.lastPrice,
          farPrice: farTicker.lastPrice,
          spreadPercent,
          annReturn,
          daysToExpiry: daysToFar,
          feeAdjPnl: feeAdj,
          signal,
        });

        spreadMatrixEntries.push({
          nearLeg:
            nearTickerForCalendar.expiryLabel ?? nearTickerForCalendar.expiry!,
          farLeg: farTicker.expiryLabel ?? farTicker.expiry,
          spread: spreadPercent,
          dte: `${daysToNear}/${daysToFar}`,
        });
      }

      // Build term structure per (exchange, baseAsset)
      const tsKey = `${farTicker.exchange}:${farTicker.baseAsset}`;
      if (!termStructureMap.has(tsKey)) termStructureMap.set(tsKey, []);
      termStructureMap.get(tsKey)!.push({
        expiry: farTicker.expiry,
        price: farTicker.lastPrice,
        label: farTicker.expiryLabel ?? farTicker.expiry,
      });
    }

    // Sort calendar spreads by spread% descending
    calendarSpreadData.sort((a, b) => b.spreadPercent - a.spreadPercent);

    // Term structure: use BTC from Deribit as the primary chart source (most liquid)
    // Fall back to any exchange
    const preferredTs =
      termStructureMap.get("Deribit:BTC") ??
      termStructureMap.get("Binance:BTC") ??
      termStructureMap.values().next().value ??
      [];

    const termStructure: TermStructurePoint[] = preferredTs.sort(
      (a: TermStructurePoint, b: TermStructurePoint) =>
        a.expiry.localeCompare(b.expiry)
    );

    const calendarStats: CalendarStats = {
      bestSpread: calendarSpreadData[0]?.spreadPercent ?? 0,
      activeSpreads: calendarSpreadData.filter((d) => d.signal === "ENTER")
        .length,
      pairsMonitored: calendarSpreadData.length,
      nearestExpiry: calendarSpreadData[0]?.nearLeg ?? "--",
      nearestDte: calendarSpreadData[0]?.daysToExpiry ?? 0,
    };

    // ─ Alerts ─────────────────────────────────────────────────────────────────
    const updatedAlerts = mergeAlerts(
      alerts.current,
      spotFuturesData,
      fundingRateData,
      calendarSpreadData
    );
    alerts.current = updatedAlerts;
    const alertStats = computeAlertStats(updatedAlerts);

    // ─ Update state ───────────────────────────────────────────────────────────
    setState((prev) => ({
      ...prev,
      isConnecting: exchangeHealth.current.every(
        (e) => e.status === "CONNECTING"
      ),
      exchangeHealth: [...exchangeHealth.current],
      proxyLatency: proxyLatencyRef.current,
      lastTickTime: lastTickTimeRef.current,
      spotFuturesData,
      fundingRateData,
      calendarSpreadData,
      termStructure,
      spreadMatrix: spreadMatrixEntries.slice(0, 20),
      alerts: updatedAlerts,
      spotFuturesStats,
      fundingStats,
      calendarStats,
      alertStats,
    }));
  }, []);

  // Throttled version — fires at most every CALC_THROTTLE_MS
  const scheduleRecalc = useCallback(() => {
    if (calcTimer.current) return;
    calcTimer.current = setTimeout(() => {
      calcTimer.current = null;
      recalculate();
    }, CALC_THROTTLE_MS);
  }, [recalculate]);

  // ── Adapter callbacks ─────────────────────────────────────────────────────────

  const callbacks: AdapterCallbacks = {
    onTicker(ticker) {
      tickers.current.set(tickerKey(ticker), ticker);
      pushToBuffer(
        bufferKey(ticker.exchange, ticker.baseAsset, ticker.type),
        ticker.lastPrice
      );
      lastTickTimeRef.current = ticker.timestamp;
      scheduleRecalc();
    },
    onFunding(funding) {
      fundingRates.current.set(fundingKey(funding), funding);
      scheduleRecalc();
    },
    onStatusChange(exchange, status, latency) {
      const idx = exchangeHealth.current.findIndex(
        (h) => h.exchange === exchange
      );
      if (idx === -1) {
        exchangeHealth.current.push({ exchange, status, latency });
      } else {
        exchangeHealth.current[idx] = { exchange, status, latency };
      }
      setState((prev) => ({
        ...prev,
        exchangeHealth: [...exchangeHealth.current],
      }));
    },
  };

  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  // ── Connect/disconnect adapters when enabled exchanges change ─────────────────

  useEffect(() => {
    async function init() {
      // Fetch instruments once on first load; returns cached data instantly after that
      if (instruments.current.length === 0) {
        instruments.current = await fetchInstruments();
      }

      // Disconnect adapters for exchanges that were just disabled
      for (const [exchange, adapter] of adapters.current) {
        if (!settings.exchanges[exchange as keyof typeof settings.exchanges]) {
          adapter.disconnect();
          adapters.current.delete(exchange);
          // Clear stale tickers and funding rates for this exchange
          for (const key of tickers.current.keys()) {
            if (key.startsWith(exchange + ":")) tickers.current.delete(key);
          }
          for (const key of fundingRates.current.keys()) {
            if (key.startsWith(exchange + ":"))
              fundingRates.current.delete(key);
          }
          // Update status bar immediately
          callbacksRef.current.onStatusChange(exchange as Exchange, "OFFLINE");
        }
      }

      // Connect adapters for newly enabled exchanges
      for (const [exchange, enabled] of Object.entries(settings.exchanges)) {
        if (!enabled) continue;
        if (adapters.current.has(exchange)) continue; // already connected
        const adapter = createAdapter(
          exchange as keyof typeof settings.exchanges
        );
        adapters.current.set(exchange, adapter);
        adapter.connect(instruments.current, callbacksRef.current);
      }

      // Recalculate immediately so disabled exchange data disappears from tables
      scheduleRecalc();
    }

    init();
  }, [settings.exchanges, scheduleRecalc]);

  // Recalculate when fees/thresholds change (without reconnecting)
  useEffect(() => {
    scheduleRecalc();
  }, [settings.fees, settings.thresholds, scheduleRecalc]);

  // ── Alert tick (1 second) ─────────────────────────────────────────────────────

  useEffect(() => {
    alertTimer.current = setInterval(() => {
      alerts.current = tickAlerts(alerts.current);
      const alertStats = computeAlertStats(alerts.current);
      setState((prev) => ({
        ...prev,
        alerts: [...alerts.current],
        alertStats,
      }));
    }, ALERT_TICK_MS);

    return () => {
      if (alertTimer.current) clearInterval(alertTimer.current);
    };
  }, []);

  // ── Proxy latency updates ─────────────────────────────────────────────────────

  useEffect(() => {
    return onProxyLatency((ms) => {
      proxyLatencyRef.current = ms;
      setState((prev) => ({ ...prev, proxyLatency: ms }));
    });
  }, []);

  // ── Reconnect on tab focus ────────────────────────────────────────────────────

  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "visible") {
        // Reconnect any closed adapters
        for (const [, adapter] of adapters.current) {
          adapter.connect(instruments.current, callbacksRef.current);
        }
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  // ── Cleanup on unmount ────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      for (const [, adapter] of adapters.current) adapter.disconnect();
      if (calcTimer.current) clearTimeout(calcTimer.current);
      if (alertTimer.current) clearInterval(alertTimer.current);
    };
  }, []);

  return state;
}
