import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  calcBasisPercent,
  calcSpotFuturesFeeAdjPnl,
  calcAnnualizedFunding,
  calcCalendarSpread,
  calcCalendarAnnualizedReturn,
  calcCalendarFeeAdjPnl,
  calcDaysToExpiry,
  calc1MinChange,
} from "@/lib/arbitrage/calculator";
import type { PriceSnapshot } from "@/lib/types";

describe("calcBasisPercent", () => {
  it("should calculate normal basis percentage", () => {
    expect(calcBasisPercent(100, 101)).toBe(1.0);
    expect(calcBasisPercent(1000, 1010)).toBe(1.0);
  });

  it("should return 0 when spot price is zero", () => {
    expect(calcBasisPercent(0, 100)).toBe(0);
  });

  it("should return 0 when spot price is negative", () => {
    expect(calcBasisPercent(-100, 101)).toBe(0);
  });

  it("should handle inverted market (perp < spot)", () => {
    expect(calcBasisPercent(100, 99)).toBe(-1.0);
    expect(calcBasisPercent(1000, 950)).toBe(-5.0);
  });

  it("should handle very small prices", () => {
    expect(calcBasisPercent(0.001, 0.00101)).toBeCloseTo(1.0, 4);
  });

  it("should handle very large prices", () => {
    expect(calcBasisPercent(1000000, 1010000)).toBe(1.0);
  });

  it("should return 0 when prices are identical", () => {
    expect(calcBasisPercent(100, 100)).toBe(0);
  });
});

describe("calcSpotFuturesFeeAdjPnl", () => {
  it("should calculate fee-adjusted PnL with typical fees", () => {
    // basis=1.0%, taker=0.05%, total fees=4*0.05=0.2%
    expect(calcSpotFuturesFeeAdjPnl(1.0, 0.02, 0.05)).toBe(0.8);
  });

  it("should return 0 when basis equals fees exactly", () => {
    // basis=0.2%, total fees=0.2%
    expect(calcSpotFuturesFeeAdjPnl(0.2, 0.02, 0.05)).toBe(0);
  });

  it("should return negative when basis less than fees", () => {
    // basis=0.1%, total fees=0.2%
    expect(calcSpotFuturesFeeAdjPnl(0.1, 0.02, 0.05)).toBe(-0.1);
  });

  it("should handle zero basis", () => {
    expect(calcSpotFuturesFeeAdjPnl(0, 0.02, 0.05)).toBe(-0.2);
  });

  it("should handle different fee structures", () => {
    // total fees = 4 * 0.1 = 0.4%
    expect(calcSpotFuturesFeeAdjPnl(1.0, 0.05, 0.1)).toBe(0.6);
  });
});

describe("calcAnnualizedFunding", () => {
  it("should calculate annualized funding with default 3 periods/day", () => {
    // 0.01% * 3 * 365 = 10.95%
    expect(calcAnnualizedFunding(0.01)).toBe(10.95);
  });

  it("should support custom periodsPerDay", () => {
    // 0.01% * 8 * 365 = 29.2%
    expect(calcAnnualizedFunding(0.01, 8)).toBe(29.2);
  });

  it("should handle zero funding rate", () => {
    expect(calcAnnualizedFunding(0)).toBe(0);
  });

  it("should handle negative funding rate", () => {
    expect(calcAnnualizedFunding(-0.01)).toBe(-10.95);
  });

  it("should handle very small rates", () => {
    expect(calcAnnualizedFunding(0.0001)).toBeCloseTo(0.1095, 4);
  });
});

describe("calcCalendarSpread", () => {
  it("should calculate normal contango spread (far > near)", () => {
    expect(calcCalendarSpread(100, 102)).toBe(2.0);
  });

  it("should handle backwardation (far < near)", () => {
    expect(calcCalendarSpread(100, 98)).toBe(-2.0);
  });

  it("should return 0 when near price is zero", () => {
    expect(calcCalendarSpread(0, 100)).toBe(0);
  });

  it("should return 0 when near price is negative", () => {
    expect(calcCalendarSpread(-100, 101)).toBe(0);
  });

  it("should return 0 when prices are identical", () => {
    expect(calcCalendarSpread(100, 100)).toBe(0);
  });

  it("should handle very small prices", () => {
    expect(calcCalendarSpread(0.01, 0.0102)).toBeCloseTo(2.0, 4);
  });
});

describe("calcCalendarAnnualizedReturn", () => {
  it("should calculate annualized return for normal case", () => {
    // spread=2%, holding=90 days: (2/90)*365 = 8.1111%
    expect(calcCalendarAnnualizedReturn(2, 90, 0)).toBeCloseTo(8.1111, 4);
  });

  it("should return 0 for zero holding period", () => {
    expect(calcCalendarAnnualizedReturn(2, 30, 30)).toBe(0);
  });

  it("should return 0 for negative holding period", () => {
    expect(calcCalendarAnnualizedReturn(2, 30, 60)).toBe(0);
  });

  it("should handle near expiry = 0 (spot)", () => {
    // spread=3%, far expiry=180 days, near=0: (3/180)*365 = 6.0833%
    expect(calcCalendarAnnualizedReturn(3, 180, 0)).toBeCloseTo(6.0833, 4);
  });

  it("should handle different expiry combinations", () => {
    // spread=1%, holding=30 days: (1/30)*365 = 12.1667%
    expect(calcCalendarAnnualizedReturn(1, 60, 30)).toBeCloseTo(12.1667, 4);
  });
});

describe("calcCalendarFeeAdjPnl", () => {
  it("should calculate fee-adjusted PnL for normal case", () => {
    // spread=1%, total fees=4*0.05=0.2%
    expect(calcCalendarFeeAdjPnl(1, 0.02, 0.05)).toBe(0.8);
  });

  it("should return 0 when spread equals fees", () => {
    // spread=0.2%, total fees=0.2%
    expect(calcCalendarFeeAdjPnl(0.2, 0.02, 0.05)).toBe(0);
  });

  it("should return negative when spread less than fees", () => {
    // spread=0.1%, total fees=0.2%
    expect(calcCalendarFeeAdjPnl(0.1, 0.02, 0.05)).toBe(-0.1);
  });

  it("should handle different fee structures", () => {
    // total fees = 4 * 0.1 = 0.4%
    expect(calcCalendarFeeAdjPnl(1, 0.05, 0.1)).toBe(0.6);
  });
});

describe("calcDaysToExpiry", () => {
  const MOCK_NOW = new Date("2024-06-01T00:00:00Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(MOCK_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should calculate days to future expiry", () => {
    expect(calcDaysToExpiry("2024-06-28")).toBe(27);
    expect(calcDaysToExpiry("2024-12-27")).toBe(209);
  });

  it("should return 0 for past expiry dates", () => {
    expect(calcDaysToExpiry("2024-05-01")).toBe(0);
  });

  it("should return 0 for today's date", () => {
    expect(calcDaysToExpiry("2024-06-01")).toBe(0);
  });

  it("should handle leap year dates", () => {
    vi.setSystemTime(new Date("2024-02-01T00:00:00Z"));
    expect(calcDaysToExpiry("2024-02-29")).toBe(28);
  });
});

describe("calc1MinChange", () => {
  const MOCK_NOW = 1000000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(MOCK_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should calculate 1-minute change from buffer", () => {
    const buffer: PriceSnapshot[] = [
      { price: 100, timestamp: MOCK_NOW - 60000 },
      { price: 105, timestamp: MOCK_NOW },
    ];
    // (105 - 100) / 100 * 100 = 5%
    expect(calc1MinChange(105, buffer)).toBe(5.0);
  });

  it("should return 0 for empty buffer", () => {
    expect(calc1MinChange(100, [])).toBe(0);
  });

  it("should return 0 for zero current price", () => {
    const buffer: PriceSnapshot[] = [
      { price: 100, timestamp: MOCK_NOW - 60000 },
    ];
    expect(calc1MinChange(0, buffer)).toBe(0);
  });

  it("should return 0 when no snapshots older than 60s", () => {
    const buffer: PriceSnapshot[] = [
      { price: 100, timestamp: MOCK_NOW - 30000 },
      { price: 105, timestamp: MOCK_NOW - 10000 },
    ];
    expect(calc1MinChange(110, buffer)).toBe(0);
  });

  it("should find closest snapshot to 60s ago", () => {
    const buffer: PriceSnapshot[] = [
      { price: 100, timestamp: MOCK_NOW - 90000 },
      { price: 102, timestamp: MOCK_NOW - 61000 }, // closest to 60s ago
      { price: 103, timestamp: MOCK_NOW - 50000 },
      { price: 105, timestamp: MOCK_NOW },
    ];
    // Should use 102 as the past price
    // (105 - 102) / 102 * 100 = 2.9412%
    expect(calc1MinChange(105, buffer)).toBeCloseTo(2.9412, 4);
  });

  it("should handle multiple snapshots and find the best match", () => {
    const buffer: PriceSnapshot[] = [
      { price: 100, timestamp: MOCK_NOW - 120000 }, // 120s ago (>= 60s, will be considered)
      { price: 101, timestamp: MOCK_NOW - 59000 }, // 59s ago (< 60s, SKIPPED)
      { price: 105, timestamp: MOCK_NOW }, // Now (< 60s, SKIPPED)
    ];
    // Should use 100 as the past price (only one >= 60s old)
    // (105 - 100) / 100 * 100 = 5%
    const result = calc1MinChange(105, buffer);
    expect(result).toBe(5.0);
  });
});
