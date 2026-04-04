import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  tickAlerts,
  mergeAlerts,
  computeAlertStats,
} from "@/lib/arbitrage/alerts";
import type {
  LiveAlert,
  SpotFuturesPair,
  FundingRatePair,
  CalendarSpreadPair,
} from "@/lib/types";

describe("tickAlerts", () => {
  const MOCK_NOW = 1000000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(MOCK_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should keep ACTIVE alerts as ACTIVE when age < 60s", () => {
    const alerts: LiveAlert[] = [
      {
        id: "test-1",
        createdAt: MOCK_NOW - 30000, // 30s ago
        exchange: "Binance",
        pair: "BTCUSDT",
        strategy: "Spot-Fut",
        spread: 0.5,
        feeAdjPnl: 0.3,
        status: "ACTIVE",
      },
    ];

    const result = tickAlerts(alerts);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("ACTIVE");
  });

  it("should transition ACTIVE alerts to WATCH when age >= 60s", () => {
    const alerts: LiveAlert[] = [
      {
        id: "test-1",
        createdAt: MOCK_NOW - 60000, // 60s ago
        exchange: "Binance",
        pair: "BTCUSDT",
        strategy: "Spot-Fut",
        spread: 0.5,
        feeAdjPnl: 0.3,
        status: "ACTIVE",
      },
    ];

    const result = tickAlerts(alerts);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("WATCH");
  });

  it("should transition WATCH alerts to FADING when age >= 180s", () => {
    const alerts: LiveAlert[] = [
      {
        id: "test-1",
        createdAt: MOCK_NOW - 180000, // 180s ago
        exchange: "Binance",
        pair: "BTCUSDT",
        strategy: "Spot-Fut",
        spread: 0.5,
        feeAdjPnl: 0.3,
        status: "WATCH",
      },
    ];

    const result = tickAlerts(alerts);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("FADING");
  });

  it("should remove FADING alerts when age >= 300s", () => {
    const alerts: LiveAlert[] = [
      {
        id: "test-1",
        createdAt: MOCK_NOW - 300000, // 300s ago
        exchange: "Binance",
        pair: "BTCUSDT",
        strategy: "Spot-Fut",
        spread: 0.5,
        feeAdjPnl: 0.3,
        status: "FADING",
      },
    ];

    const result = tickAlerts(alerts);
    expect(result).toHaveLength(0);
  });

  it("should handle alerts at exact threshold boundaries", () => {
    const alerts: LiveAlert[] = [
      {
        id: "test-59s",
        createdAt: MOCK_NOW - 59000,
        exchange: "Binance",
        pair: "BTCUSDT",
        strategy: "Spot-Fut",
        spread: 0.5,
        feeAdjPnl: 0.3,
        status: "ACTIVE",
      },
      {
        id: "test-60s",
        createdAt: MOCK_NOW - 60000,
        exchange: "Binance",
        pair: "ETHUSDT",
        strategy: "Spot-Fut",
        spread: 0.5,
        feeAdjPnl: 0.3,
        status: "ACTIVE",
      },
      {
        id: "test-179s",
        createdAt: MOCK_NOW - 179000,
        exchange: "Bybit",
        pair: "BTCUSDT",
        strategy: "Funding",
        spread: 0.5,
        feeAdjPnl: 0.3,
        status: "WATCH",
      },
      {
        id: "test-180s",
        createdAt: MOCK_NOW - 180000,
        exchange: "Bybit",
        pair: "ETHUSDT",
        strategy: "Funding",
        spread: 0.5,
        feeAdjPnl: 0.3,
        status: "WATCH",
      },
    ];

    const result = tickAlerts(alerts);
    expect(result).toHaveLength(4);
    expect(result.find((a) => a.id === "test-59s")?.status).toBe("ACTIVE");
    expect(result.find((a) => a.id === "test-60s")?.status).toBe("WATCH");
    expect(result.find((a) => a.id === "test-179s")?.status).toBe("WATCH");
    expect(result.find((a) => a.id === "test-180s")?.status).toBe("FADING");
  });

  it("should handle empty alerts array", () => {
    const result = tickAlerts([]);
    expect(result).toHaveLength(0);
  });

  it("should handle mixed status alerts", () => {
    const alerts: LiveAlert[] = [
      {
        id: "test-1",
        createdAt: MOCK_NOW - 30000, // 30s old
        exchange: "Binance",
        pair: "BTCUSDT",
        strategy: "Spot-Fut",
        spread: 0.5,
        feeAdjPnl: 0.3,
        status: "ACTIVE",
      },
      {
        id: "test-2",
        createdAt: MOCK_NOW - 90000, // 90s old
        exchange: "Bybit",
        pair: "ETHUSDT",
        strategy: "Funding",
        spread: 0.3,
        feeAdjPnl: 0.2,
        status: "WATCH",
      },
      {
        id: "test-3",
        createdAt: MOCK_NOW - 200000, // 200s old
        exchange: "OKX",
        pair: "BTCUSDT",
        strategy: "Calendar",
        spread: 0.8,
        feeAdjPnl: 0.5,
        status: "FADING",
      },
    ];

    const result = tickAlerts(alerts);
    // test-1: 30s old (< 60s), stays ACTIVE
    // test-2: 90s old (>= 60s, < 180s), becomes WATCH
    // test-3: 200s old (>= 180s, < 300s), becomes FADING but kept (< 300s)
    expect(result).toHaveLength(3);
    expect(result.find((a) => a.id === "test-1")?.status).toBe("ACTIVE");
    expect(result.find((a) => a.id === "test-2")?.status).toBe("WATCH");
    expect(result.find((a) => a.id === "test-3")?.status).toBe("FADING");
  });
});

describe("mergeAlerts", () => {
  const MOCK_NOW = 1000000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(MOCK_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should create new spot-futures alerts for BUY BASIS signals", () => {
    const spotFutures: SpotFuturesPair[] = [
      {
        id: "sf-1",
        exchange: "Binance",
        pair: "BTCUSDT",
        spotPrice: 50000,
        perpPrice: 50500,
        basisPercent: 1.0,
        change1min: 0.1,
        feeAdjPnl: 0.8,
        signal: "BUY BASIS",
      },
    ];

    const result = mergeAlerts([], spotFutures, [], []);
    expect(result).toHaveLength(1);
    expect(result[0].exchange).toBe("Binance");
    expect(result[0].pair).toBe("BTCUSDT");
    expect(result[0].strategy).toBe("Spot-Fut");
    expect(result[0].status).toBe("ACTIVE");
    expect(result[0].spread).toBe(1.0);
    expect(result[0].feeAdjPnl).toBe(0.8);
  });

  it("should create new spot-futures alerts for LONG SPOT signals", () => {
    const spotFutures: SpotFuturesPair[] = [
      {
        id: "sf-1",
        exchange: "Bybit",
        pair: "ETHUSDT",
        spotPrice: 3000,
        perpPrice: 3030,
        basisPercent: 1.0,
        change1min: 0.1,
        feeAdjPnl: 0.8,
        signal: "LONG SPOT",
      },
    ];

    const result = mergeAlerts([], spotFutures, [], []);
    expect(result).toHaveLength(1);
    expect(result[0].strategy).toBe("Spot-Fut");
  });

  it("should create new funding alerts for LONG SPOT signals", () => {
    const funding: FundingRatePair[] = [
      {
        id: "fr-1",
        exchange: "OKX",
        pair: "BTCUSDT",
        currentRate: 0.01,
        nextFundingTime: MOCK_NOW + 28800000,
        annualized: 20,
        signal: "LONG SPOT",
      },
    ];

    const result = mergeAlerts([], [], funding, []);
    expect(result).toHaveLength(1);
    expect(result[0].exchange).toBe("OKX");
    expect(result[0].pair).toBe("BTCUSDT");
    expect(result[0].strategy).toBe("Funding");
    expect(result[0].spread).toBe(0.01);
  });

  it("should create new funding alerts for SHORT OPP signals", () => {
    const funding: FundingRatePair[] = [
      {
        id: "fr-1",
        exchange: "Deribit",
        pair: "ETHUSDT",
        currentRate: -0.01,
        nextFundingTime: MOCK_NOW + 28800000,
        annualized: -10,
        signal: "SHORT OPP",
      },
    ];

    const result = mergeAlerts([], [], funding, []);
    expect(result).toHaveLength(1);
    expect(result[0].strategy).toBe("Funding");
  });

  it("should create new calendar alerts for ENTER signals", () => {
    const calendar: CalendarSpreadPair[] = [
      {
        id: "cs-1",
        exchange: "Binance",
        asset: "BTC",
        nearLeg: "28-Mar",
        farLeg: "26-Jun",
        nearPrice: 50000,
        farPrice: 51000,
        spreadPercent: 2.0,
        annReturn: 10,
        daysToExpiry: 90,
        feeAdjPnl: 1.5,
        signal: "ENTER",
      },
    ];

    const result = mergeAlerts([], [], [], calendar);
    expect(result).toHaveLength(1);
    expect(result[0].exchange).toBe("Binance");
    expect(result[0].pair).toBe("BTC 28-Mar/26-Jun");
    expect(result[0].strategy).toBe("Calendar");
    expect(result[0].spread).toBe(2.0);
  });

  it("should update existing alerts with new spread values", () => {
    const existing: LiveAlert[] = [
      {
        id: "alert-1",
        createdAt: MOCK_NOW - 30000,
        exchange: "Binance",
        pair: "BTCUSDT",
        strategy: "Spot-Fut",
        spread: 0.5,
        feeAdjPnl: 0.3,
        status: "ACTIVE",
      },
    ];

    const spotFutures: SpotFuturesPair[] = [
      {
        id: "sf-1",
        exchange: "Binance",
        pair: "BTCUSDT",
        spotPrice: 50000,
        perpPrice: 51000,
        basisPercent: 2.0,
        change1min: 0.1,
        feeAdjPnl: 1.5,
        signal: "BUY BASIS",
      },
    ];

    const result = mergeAlerts(existing, spotFutures, [], []);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("alert-1");
    expect(result[0].spread).toBe(2.0);
    expect(result[0].feeAdjPnl).toBe(1.5);
  });

  it("should update existing funding alerts with new spread and feeAdjPnl", () => {
    const existing: LiveAlert[] = [
      {
        id: "alert-funding-1",
        createdAt: MOCK_NOW - 30000,
        exchange: "Deribit",
        pair: "BTCUSDT",
        strategy: "Funding",
        spread: -0.01,
        feeAdjPnl: -0.0274, // -10 / 365
        status: "ACTIVE",
      },
    ];

    const funding: FundingRatePair[] = [
      {
        id: "fr-1",
        exchange: "Deribit",
        pair: "BTCUSDT",
        currentRate: -0.02,
        nextFundingTime: MOCK_NOW + 28800000,
        annualized: -20,
        signal: "SHORT OPP",
      },
    ];

    const result = mergeAlerts(existing, [], funding, []);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("alert-funding-1");
    expect(result[0].spread).toBe(-0.02);
    expect(result[0].feeAdjPnl).toBe(-20 / 365);
  });

  it("should mark removed opportunities as FADING after 30s grace period", () => {
    const existing: LiveAlert[] = [
      {
        id: "alert-1",
        createdAt: MOCK_NOW - 31000, // 31s ago
        exchange: "Binance",
        pair: "BTCUSDT",
        strategy: "Spot-Fut",
        spread: 0.5,
        feeAdjPnl: 0.3,
        status: "ACTIVE",
      },
    ];

    // No opportunities in current data
    const result = mergeAlerts(existing, [], [], []);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("FADING");
  });

  it("should keep removed opportunities active during 30s grace period", () => {
    const existing: LiveAlert[] = [
      {
        id: "alert-1",
        createdAt: MOCK_NOW - 29000, // 29s ago
        exchange: "Binance",
        pair: "BTCUSDT",
        strategy: "Spot-Fut",
        spread: 0.5,
        feeAdjPnl: 0.3,
        status: "ACTIVE",
      },
    ];

    // No opportunities in current data
    const result = mergeAlerts(existing, [], [], []);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("ACTIVE"); // Still within grace period
  });

  it("should enforce MAX_ALERTS limit (100)", () => {
    const existing: LiveAlert[] = Array.from({ length: 100 }, (_, i) => ({
      id: `alert-${i}`,
      createdAt: MOCK_NOW - i * 1000,
      exchange: "Binance" as const,
      pair: `PAIR${i}`,
      strategy: "Spot-Fut" as const,
      spread: 0.5,
      feeAdjPnl: 0.3,
      status: "ACTIVE" as const,
    }));

    const spotFutures: SpotFuturesPair[] = [
      {
        id: "sf-new",
        exchange: "Bybit",
        pair: "NEWPAIR",
        spotPrice: 100,
        perpPrice: 101,
        basisPercent: 1.0,
        change1min: 0.1,
        feeAdjPnl: 0.8,
        signal: "BUY BASIS",
      },
    ];

    const result = mergeAlerts(existing, spotFutures, [], []);
    expect(result).toHaveLength(100); // Should not exceed MAX_ALERTS
  });

  it("should handle empty arrays for all strategies", () => {
    const result = mergeAlerts([], [], [], []);
    expect(result).toHaveLength(0);
  });

  it("should filter out SKIP and WATCH signals", () => {
    const spotFutures: SpotFuturesPair[] = [
      {
        id: "sf-1",
        exchange: "Binance",
        pair: "BTCUSDT",
        spotPrice: 50000,
        perpPrice: 50000,
        basisPercent: 0,
        change1min: 0,
        feeAdjPnl: 0,
        signal: "SKIP",
      },
      {
        id: "sf-2",
        exchange: "Bybit",
        pair: "ETHUSDT",
        spotPrice: 3000,
        perpPrice: 3010,
        basisPercent: 0.33,
        change1min: 0.1,
        feeAdjPnl: 0.1,
        signal: "WATCH",
      },
    ];

    const result = mergeAlerts([], spotFutures, [], []);
    expect(result).toHaveLength(0);
  });

  it("should sort alerts by createdAt descending", () => {
    const existing: LiveAlert[] = [
      {
        id: "alert-old",
        createdAt: MOCK_NOW - 10000,
        exchange: "Binance",
        pair: "OLDPAIR",
        strategy: "Spot-Fut",
        spread: 0.5,
        feeAdjPnl: 0.3,
        status: "ACTIVE",
      },
    ];
    const spotFutures: SpotFuturesPair[] = [
      {
        id: "sf-new",
        exchange: "Bybit",
        pair: "NEWPAIR",
        spotPrice: 100,
        perpPrice: 101,
        basisPercent: 1.0,
        change1min: 0.1,
        feeAdjPnl: 0.8,
        signal: "BUY BASIS",
      },
    ];
    const result = mergeAlerts(existing, spotFutures, [], []);
    expect(result).toHaveLength(2);
    expect(result[0].pair).toBe("NEWPAIR"); // New alert first
    expect(result[1].id).toBe("alert-old"); // Old alert second
  });

  it("should merge alerts from multiple strategies without key collisions", () => {
    const spotFutures: SpotFuturesPair[] = [
      {
        id: "sf-1",
        exchange: "Binance",
        pair: "BTCUSDT",
        spotPrice: 50000,
        perpPrice: 50500,
        basisPercent: 1.0,
        change1min: 0.1,
        feeAdjPnl: 0.8,
        signal: "BUY BASIS",
      },
    ];

    const funding: FundingRatePair[] = [
      {
        id: "fr-1",
        exchange: "Binance",
        pair: "BTCUSDT",
        currentRate: 0.01,
        nextFundingTime: MOCK_NOW + 28800000,
        annualized: 10,
        signal: "LONG SPOT",
      },
    ];

    const calendar: CalendarSpreadPair[] = [
      {
        id: "cs-1",
        exchange: "Binance",
        asset: "BTC",
        nearLeg: "28-Mar",
        farLeg: "26-Jun",
        nearPrice: 50000,
        farPrice: 51000,
        spreadPercent: 2.0,
        annReturn: 10,
        daysToExpiry: 90,
        feeAdjPnl: 1.5,
        signal: "ENTER",
      },
    ];

    const result = mergeAlerts([], spotFutures, funding, calendar);
    expect(result).toHaveLength(3);

    // Verify all three strategies are present
    const strategies = result.map((a) => a.strategy);
    expect(strategies).toContain("Spot-Fut");
    expect(strategies).toContain("Funding");
    expect(strategies).toContain("Calendar");

    // Verify correct spread values for each strategy
    const spotFutAlert = result.find((a) => a.strategy === "Spot-Fut");
    expect(spotFutAlert?.spread).toBe(1.0);
    expect(spotFutAlert?.feeAdjPnl).toBe(0.8);

    const fundingAlert = result.find((a) => a.strategy === "Funding");
    expect(fundingAlert?.spread).toBe(0.01);
    expect(fundingAlert?.feeAdjPnl).toBe(10 / 365);

    const calendarAlert = result.find((a) => a.strategy === "Calendar");
    expect(calendarAlert?.spread).toBe(2.0);
    expect(calendarAlert?.feeAdjPnl).toBe(1.5);
  });
});

describe("computeAlertStats", () => {
  it("should compute correct counts by strategy", () => {
    const alerts: LiveAlert[] = [
      {
        id: "1",
        createdAt: Date.now(),
        exchange: "Binance",
        pair: "BTCUSDT",
        strategy: "Spot-Fut",
        spread: 0.5,
        feeAdjPnl: 0.3,
        status: "ACTIVE",
      },
      {
        id: "2",
        createdAt: Date.now(),
        exchange: "Bybit",
        pair: "ETHUSDT",
        strategy: "Funding",
        spread: 0.3,
        feeAdjPnl: 0.2,
        status: "ACTIVE",
      },
      {
        id: "3",
        createdAt: Date.now(),
        exchange: "OKX",
        pair: "BTC 28-Mar/26-Jun",
        strategy: "Calendar",
        spread: 0.8,
        feeAdjPnl: 0.5,
        status: "WATCH",
      },
    ];

    const stats = computeAlertStats(alerts);
    expect(stats.activeNow).toBe(3);
    expect(stats.spotFutures).toBe(1);
    expect(stats.fundingRate).toBe(1);
    expect(stats.calendarSpread).toBe(1);
    expect(stats.fading).toBe(0);
  });

  it("should count ACTIVE + WATCH as active", () => {
    const alerts: LiveAlert[] = [
      {
        id: "1",
        createdAt: Date.now(),
        exchange: "Binance",
        pair: "BTCUSDT",
        strategy: "Spot-Fut",
        spread: 0.5,
        feeAdjPnl: 0.3,
        status: "ACTIVE",
      },
      {
        id: "2",
        createdAt: Date.now(),
        exchange: "Bybit",
        pair: "ETHUSDT",
        strategy: "Spot-Fut",
        spread: 0.3,
        feeAdjPnl: 0.2,
        status: "WATCH",
      },
      {
        id: "3",
        createdAt: Date.now(),
        exchange: "OKX",
        pair: "BTC 28-Mar/26-Jun",
        strategy: "Calendar",
        spread: 0.8,
        feeAdjPnl: 0.5,
        status: "FADING",
      },
    ];

    const stats = computeAlertStats(alerts);
    expect(stats.activeNow).toBe(2); // Only ACTIVE + WATCH
    expect(stats.fading).toBe(1);
  });

  it("should handle empty alerts array", () => {
    const stats = computeAlertStats([]);
    expect(stats.activeNow).toBe(0);
    expect(stats.spotFutures).toBe(0);
    expect(stats.fundingRate).toBe(0);
    expect(stats.calendarSpread).toBe(0);
    expect(stats.fading).toBe(0);
  });
});
