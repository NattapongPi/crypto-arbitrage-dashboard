import { describe, it, expect } from "vitest";
import {
  determineSpotFuturesSignal,
  determineFundingSignal,
  determineCalendarSignal,
} from "@/lib/arbitrage/signals";
import type { UserSettings } from "@/lib/types";

const defaultThresholds: UserSettings["thresholds"] = {
  minBasisPercent: 0.15,
  minAnnualizedPercent: 15,
  minSpreadPercent: 0.5,
};

describe("determineSpotFuturesSignal", () => {
  it("should return INVERTED when basis < -0.1", () => {
    expect(determineSpotFuturesSignal(-0.11, 0, defaultThresholds)).toBe(
      "INVERTED",
    );
    expect(determineSpotFuturesSignal(-0.5, 0, defaultThresholds)).toBe(
      "INVERTED",
    );
    expect(determineSpotFuturesSignal(-1.0, -0.5, defaultThresholds)).toBe(
      "INVERTED",
    );
  });

  it("should return BUY BASIS when feeAdjPnl >= threshold", () => {
    expect(determineSpotFuturesSignal(0.5, 0.15, defaultThresholds)).toBe(
      "BUY BASIS",
    );
    expect(determineSpotFuturesSignal(1.0, 0.2, defaultThresholds)).toBe(
      "BUY BASIS",
    );
  });

  it("should return WATCH when basis >= threshold * 0.5", () => {
    // threshold * 0.5 = 0.075
    expect(determineSpotFuturesSignal(0.1, 0.05, defaultThresholds)).toBe(
      "WATCH",
    );
    expect(determineSpotFuturesSignal(0.5, 0.1, defaultThresholds)).toBe(
      "WATCH",
    );
  });

  it("should return SKIP when below all thresholds", () => {
    expect(determineSpotFuturesSignal(0.05, 0.05, defaultThresholds)).toBe(
      "SKIP",
    );
    expect(determineSpotFuturesSignal(0, 0, defaultThresholds)).toBe("SKIP");
  });

  it("should handle exact boundary: basis = -0.1", () => {
    // Should not be INVERTED (needs to be < -0.1)
    expect(determineSpotFuturesSignal(-0.1, 0.15, defaultThresholds)).toBe(
      "BUY BASIS",
    );
  });

  it("should handle exact boundary: feeAdjPnl = threshold", () => {
    expect(determineSpotFuturesSignal(0.5, 0.15, defaultThresholds)).toBe(
      "BUY BASIS",
    );
  });

  it("should handle exact boundary: basis = threshold * 0.5", () => {
    // threshold * 0.5 = 0.075
    expect(determineSpotFuturesSignal(0.075, 0.05, defaultThresholds)).toBe(
      "WATCH",
    );
  });

  it("should prioritize INVERTED over other signals", () => {
    // Even if feeAdjPnl is high, inverted market takes priority
    expect(determineSpotFuturesSignal(-0.2, 0.5, defaultThresholds)).toBe(
      "INVERTED",
    );
  });

  it("should prioritize BUY BASIS over WATCH", () => {
    expect(determineSpotFuturesSignal(0.5, 0.15, defaultThresholds)).toBe(
      "BUY BASIS",
    );
  });

  it("should handle zero basis and zero fees", () => {
    expect(determineSpotFuturesSignal(0, 0, defaultThresholds)).toBe("SKIP");
  });

  it("should handle negative basis but not inverted", () => {
    expect(determineSpotFuturesSignal(-0.05, -0.1, defaultThresholds)).toBe(
      "SKIP",
    );
  });
});

describe("determineFundingSignal", () => {
  it("should return SHORT OPP when fundingRate < -0.005", () => {
    expect(determineFundingSignal(10, -0.006, defaultThresholds)).toBe(
      "SHORT OPP",
    );
    expect(determineFundingSignal(0, -0.01, defaultThresholds)).toBe(
      "SHORT OPP",
    );
  });

  it("should return LONG SPOT when annualized >= threshold", () => {
    expect(determineFundingSignal(15, 0.01, defaultThresholds)).toBe(
      "LONG SPOT",
    );
    expect(determineFundingSignal(20, 0.02, defaultThresholds)).toBe(
      "LONG SPOT",
    );
  });

  it("should return WATCH when annualized >= threshold * 0.5", () => {
    // threshold * 0.5 = 7.5
    expect(determineFundingSignal(10, 0.01, defaultThresholds)).toBe("WATCH");
    expect(determineFundingSignal(8, 0, defaultThresholds)).toBe("WATCH");
  });

  it("should return SKIP when below all thresholds", () => {
    expect(determineFundingSignal(5, 0, defaultThresholds)).toBe("SKIP");
    expect(determineFundingSignal(0, 0, defaultThresholds)).toBe("SKIP");
  });

  it("should handle exact boundary: fundingRate = -0.005", () => {
    // Should not be SHORT OPP (needs to be < -0.005)
    expect(determineFundingSignal(15, -0.005, defaultThresholds)).toBe(
      "LONG SPOT",
    );
  });

  it("should handle exact boundary: annualized = threshold", () => {
    expect(determineFundingSignal(15, 0.01, defaultThresholds)).toBe(
      "LONG SPOT",
    );
  });

  it("should handle exact boundary: annualized = threshold * 0.5", () => {
    // threshold * 0.5 = 7.5
    expect(determineFundingSignal(7.5, 0, defaultThresholds)).toBe("WATCH");
  });

  it("should prioritize SHORT OPP over other signals", () => {
    // Even if annualized is high, very negative funding rate takes priority
    expect(determineFundingSignal(20, -0.01, defaultThresholds)).toBe(
      "SHORT OPP",
    );
  });

  it("should prioritize LONG SPOT over WATCH", () => {
    expect(determineFundingSignal(15, 0.01, defaultThresholds)).toBe(
      "LONG SPOT",
    );
  });

  it("should handle negative annualized", () => {
    expect(determineFundingSignal(-10, 0.01, defaultThresholds)).toBe("SKIP");
  });

  it("should handle zero values", () => {
    expect(determineFundingSignal(0, 0, defaultThresholds)).toBe("SKIP");
  });
});

describe("determineCalendarSignal", () => {
  it("should return ENTER when feeAdjPnl >= threshold", () => {
    expect(determineCalendarSignal(1.0, 0.5, defaultThresholds)).toBe("ENTER");
    expect(determineCalendarSignal(2.0, 0.6, defaultThresholds)).toBe("ENTER");
  });

  it("should return WATCH when spread >= threshold * 0.5", () => {
    // threshold * 0.5 = 0.25
    expect(determineCalendarSignal(0.3, 0.2, defaultThresholds)).toBe("WATCH");
    expect(determineCalendarSignal(0.5, 0.1, defaultThresholds)).toBe("WATCH");
  });

  it("should return SKIP when below all thresholds", () => {
    expect(determineCalendarSignal(0.2, 0.1, defaultThresholds)).toBe("SKIP");
    expect(determineCalendarSignal(0, 0, defaultThresholds)).toBe("SKIP");
  });

  it("should handle exact boundary: feeAdjPnl = threshold", () => {
    expect(determineCalendarSignal(1.0, 0.5, defaultThresholds)).toBe("ENTER");
  });

  it("should handle exact boundary: spread = threshold * 0.5", () => {
    // threshold * 0.5 = 0.25
    expect(determineCalendarSignal(0.25, 0.1, defaultThresholds)).toBe("WATCH");
  });

  it("should prioritize ENTER over WATCH", () => {
    expect(determineCalendarSignal(1.0, 0.5, defaultThresholds)).toBe("ENTER");
  });

  it("should handle zero spread", () => {
    expect(determineCalendarSignal(0, 0, defaultThresholds)).toBe("SKIP");
  });

  it("should handle negative spread", () => {
    expect(determineCalendarSignal(-0.5, -0.3, defaultThresholds)).toBe("SKIP");
  });

  it("should handle spread above threshold but feeAdjPnl below", () => {
    // spread=1.0 >= 0.5 threshold, but feeAdjPnl=0.4 < 0.5 threshold
    // Should be WATCH because feeAdjPnl < threshold
    expect(determineCalendarSignal(1.0, 0.4, defaultThresholds)).toBe("WATCH");
  });
});
