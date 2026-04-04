import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  formatPrice,
  formatPercent,
  formatRate,
  formatOI,
  formatAge,
  formatCountdown,
  formatTime,
} from "@/lib/formatters";

describe("formatPrice", () => {
  it("should format values >= $1 with 2 decimal places and commas", () => {
    expect(formatPrice(67410.5)).toBe("$67,410.50");
    expect(formatPrice(100)).toBe("$100.00");
    expect(formatPrice(1234567.89)).toBe("$1,234,567.89");
  });

  it("should format values < $1 with 4 decimal places", () => {
    expect(formatPrice(0.0012)).toBe("$0.0012");
    expect(formatPrice(0.5)).toBe("$0.5000");
    expect(formatPrice(0.9999)).toBe("$0.9999");
  });

  it("should handle exactly $1", () => {
    expect(formatPrice(1)).toBe("$1.00");
  });

  it("should handle zero", () => {
    expect(formatPrice(0)).toBe("$0.0000"); // Zero is < $1, so 4 decimals
  });

  it("should handle very small numbers", () => {
    expect(formatPrice(0.0001)).toBe("$0.0001");
    expect(formatPrice(0.00001)).toBe("$0.0000");
  });

  it("should handle large numbers with proper comma formatting", () => {
    expect(formatPrice(1000000)).toBe("$1,000,000.00");
    expect(formatPrice(10000000)).toBe("$10,000,000.00");
  });
});

describe("formatPercent", () => {
  it("should format positive values with + sign", () => {
    expect(formatPercent(0.83)).toBe("+0.83%");
    expect(formatPercent(1.5)).toBe("+1.50%");
  });

  it("should format negative values without + sign", () => {
    expect(formatPercent(-0.34)).toBe("-0.34%");
    expect(formatPercent(-1.5)).toBe("-1.50%");
  });

  it("should format zero without + sign", () => {
    expect(formatPercent(0)).toBe("0.00%");
  });

  it("should round using toFixed (rounds half-up)", () => {
    expect(formatPercent(1.5, 0)).toBe("+2%");
    expect(formatPercent(1.4, 0)).toBe("+1%");
    expect(formatPercent(1.5, 1)).toBe("+1.5%");
    expect(formatPercent(1.567, 3)).toBe("+1.567%");
    expect(formatPercent(0.041, 4)).toBe("+0.0410%");
  });

  it("should support showSign=false option", () => {
    expect(formatPercent(0.83, 2, false)).toBe("0.83%");
    expect(formatPercent(-0.34, 2, false)).toBe("-0.34%");
    expect(formatPercent(0, 2, false)).toBe("0.00%");
  });
});

describe("formatRate", () => {
  it("should format positive rates with + sign", () => {
    expect(formatRate(0.041)).toBe("+0.0410%");
    expect(formatRate(1.5)).toBe("+1.5000%");
  });

  it("should format negative rates without + sign", () => {
    expect(formatRate(-0.012)).toBe("-0.0120%");
    expect(formatRate(-1.5)).toBe("-1.5000%");
  });

  it("should format very small values", () => {
    expect(formatRate(0.0001)).toBe("+0.0001%");
    expect(formatRate(0.00001)).toBe("+0.0000%");
  });

  it("should format zero rate", () => {
    expect(formatRate(0)).toBe("0.0000%");
  });
});

describe("formatOI", () => {
  it("should format billions", () => {
    expect(formatOI(1_000_000_000)).toBe("$1.0B");
    expect(formatOI(8_200_000_000)).toBe("$8.2B");
    expect(formatOI(1_500_000_000)).toBe("$1.5B");
  });

  it("should format millions", () => {
    expect(formatOI(1_000_000)).toBe("$1M");
    expect(formatOI(890_000_000)).toBe("$890M");
    expect(formatOI(50_000_000)).toBe("$50M");
  });

  it("should format thousands", () => {
    expect(formatOI(1_000)).toBe("$1K");
    expect(formatOI(45_000)).toBe("$45K");
    expect(formatOI(999_999)).toBe("$1000K");
  });

  it("should format values less than 1K", () => {
    expect(formatOI(500)).toBe("$500");
    expect(formatOI(999)).toBe("$999");
  });

  it("should handle exact boundaries", () => {
    expect(formatOI(1000)).toBe("$1K");
    expect(formatOI(1000000)).toBe("$1M");
    expect(formatOI(1000000000)).toBe("$1.0B");
  });

  it("should handle zero", () => {
    expect(formatOI(0)).toBe("$0");
  });
});

describe("formatAge", () => {
  const MOCK_NOW = 1000000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(MOCK_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should format age less than 60 seconds", () => {
    expect(formatAge(MOCK_NOW - 32000)).toBe("32s");
    expect(formatAge(MOCK_NOW - 1000)).toBe("1s");
    expect(formatAge(MOCK_NOW - 59000)).toBe("59s");
  });

  it("should format age in minutes and seconds", () => {
    expect(formatAge(MOCK_NOW - 60000)).toBe("1m 00s");
    expect(formatAge(MOCK_NOW - 82000)).toBe("1m 22s");
    expect(formatAge(MOCK_NOW - 300000)).toBe("5m 00s");
  });

  it("should handle exactly 60 seconds", () => {
    expect(formatAge(MOCK_NOW - 60000)).toBe("1m 00s");
  });

  it("should handle exactly 120 seconds", () => {
    expect(formatAge(MOCK_NOW - 120000)).toBe("2m 00s");
  });

  it("should handle future timestamps (negative age)", () => {
    expect(formatAge(MOCK_NOW + 10000)).toBe("-10s"); // Returns negative for future
  });
});

describe("formatCountdown", () => {
  const MOCK_NOW = 1000000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(MOCK_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should format countdown with hours, minutes, seconds", () => {
    const target = MOCK_NOW + (2 * 3600 + 14 * 60 + 33) * 1000;
    expect(formatCountdown(target)).toBe("02:14:33");
  });

  it("should format countdown with zero hours", () => {
    const target = MOCK_NOW + (14 * 60 + 33) * 1000;
    expect(formatCountdown(target)).toBe("00:14:33");
  });

  it("should handle past timestamps (show 00:00:00)", () => {
    const target = MOCK_NOW - 10000;
    expect(formatCountdown(target)).toBe("00:00:00");
  });

  it("should handle exactly at target time", () => {
    expect(formatCountdown(MOCK_NOW)).toBe("00:00:00");
  });
});

describe("formatTime", () => {
  it("should format valid timestamps as HH:MM:SS in local time", () => {
    // Note: formatTime uses local timezone, so we test the format, not specific times
    const timestamp = Date.now();
    const result = formatTime(timestamp);
    expect(result).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it("should produce consistent format for known timestamp", () => {
    // Use a fixed timestamp and verify format
    const timestamp = 1705324245000; // Some fixed timestamp
    const result = formatTime(timestamp);
    expect(result).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    expect(result.length).toBe(8); // HH:MM:SS
  });

  it("should use 24-hour format", () => {
    const timestamp = Date.now();
    const result = formatTime(timestamp);
    const [hours] = result.split(":").map(Number);
    expect(hours).toBeGreaterThanOrEqual(0);
    expect(hours).toBeLessThan(24);
  });
});
