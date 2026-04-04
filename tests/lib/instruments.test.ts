import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { InstrumentInfo } from "@/lib/types";

describe("fetchInstruments", () => {
  const MOCK_NOW = 1000000;
  const CACHE_TTL = 3_600_000; // 1 hour

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(MOCK_NOW);
    global.fetch = vi.fn();
    // Reset the module to clear cache between tests
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("should fetch instruments successfully", async () => {
    const { fetchInstruments } = await import("@/lib/instruments");
    const mockData: InstrumentInfo[] = [
      {
        exchange: "Binance",
        baseAsset: "BTC",
        spotSymbol: "BTCUSDT",
        perpSymbol: "BTCUSDT",
        futuresContracts: [],
        volume24hUsd: 1000000,
      },
    ];

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockData),
    } as Response);

    const result = await fetchInstruments();
    expect(result).toEqual(mockData);
    expect(global.fetch).toHaveBeenCalledWith("/api/instruments");
  });

  it("should return cached data on subsequent calls within TTL", async () => {
    const { fetchInstruments } = await import("@/lib/instruments");
    const mockData: InstrumentInfo[] = [
      {
        exchange: "Binance",
        baseAsset: "BTC",
        spotSymbol: "BTCUSDT",
        perpSymbol: "BTCUSDT",
        futuresContracts: [],
        volume24hUsd: 1000000,
      },
    ];

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockData),
    } as Response);

    // First call
    const result1 = await fetchInstruments();
    expect(result1).toEqual(mockData);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Second call (within TTL)
    vi.setSystemTime(MOCK_NOW + 1000);
    const result2 = await fetchInstruments();
    expect(result2).toEqual(mockData);
    expect(global.fetch).toHaveBeenCalledTimes(1); // Should not fetch again
  });

  it("should refetch after cache TTL expires", async () => {
    const { fetchInstruments } = await import("@/lib/instruments");
    const mockData1: InstrumentInfo[] = [
      {
        exchange: "Binance",
        baseAsset: "BTC",
        spotSymbol: "BTCUSDT",
        perpSymbol: "BTCUSDT",
        futuresContracts: [],
        volume24hUsd: 1000000,
      },
    ];

    const mockData2: InstrumentInfo[] = [
      {
        exchange: "Bybit",
        baseAsset: "ETH",
        spotSymbol: "ETHUSDT",
        perpSymbol: "ETHUSDT",
        futuresContracts: [],
        volume24hUsd: 500000,
      },
    ];

    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData1),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData2),
      } as Response);

    // First fetch
    const result1 = await fetchInstruments();
    expect(result1).toEqual(mockData1);

    // Advance time past TTL
    vi.setSystemTime(MOCK_NOW + CACHE_TTL + 1);

    // Should refetch
    const result2 = await fetchInstruments();
    expect(result2).toEqual(mockData2);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("should fall back to cache on HTTP error", async () => {
    const { fetchInstruments } = await import("@/lib/instruments");
    const mockData: InstrumentInfo[] = [
      {
        exchange: "Binance",
        baseAsset: "BTC",
        spotSymbol: "BTCUSDT",
        perpSymbol: "BTCUSDT",
        futuresContracts: [],
        volume24hUsd: 1000000,
      },
    ];

    // First successful fetch
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockData),
    } as Response);

    await fetchInstruments();

    // Second fetch fails
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);

    const result = await fetchInstruments();
    expect(result).toEqual(mockData); // Should return cached data
  });

  it("should fall back to empty array on HTTP error with no cache", async () => {
    const { fetchInstruments } = await import("@/lib/instruments");
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);

    const result = await fetchInstruments();
    expect(result).toEqual([]);
  });

  it("should fall back to cache on network error", async () => {
    const { fetchInstruments } = await import("@/lib/instruments");
    const mockData: InstrumentInfo[] = [
      {
        exchange: "Binance",
        baseAsset: "BTC",
        spotSymbol: "BTCUSDT",
        perpSymbol: "BTCUSDT",
        futuresContracts: [],
        volume24hUsd: 1000000,
      },
    ];

    // First successful fetch
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockData),
    } as Response);

    await fetchInstruments();

    // Second fetch throws network error
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error("Network error"));

    const result = await fetchInstruments();
    expect(result).toEqual(mockData); // Should return cached data
  });

  it("should return empty array on network error with no cache", async () => {
    const { fetchInstruments } = await import("@/lib/instruments");
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error("Network error"));

    const result = await fetchInstruments();
    expect(result).toEqual([]);
  });

  it("should deduplicate concurrent calls", async () => {
    const { fetchInstruments } = await import("@/lib/instruments");
    const mockData: InstrumentInfo[] = [
      {
        exchange: "Binance",
        baseAsset: "BTC",
        spotSymbol: "BTCUSDT",
        perpSymbol: "BTCUSDT",
        futuresContracts: [],
        volume24hUsd: 1000000,
      },
    ];

    let resolvePromise: ((value: Response) => void) | null = null;
    vi.mocked(global.fetch).mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePromise = resolve;
      }),
    );

    // Start multiple concurrent calls
    const promise1 = fetchInstruments();
    const promise2 = fetchInstruments();
    const promise3 = fetchInstruments();

    // Resolve the fetch
    resolvePromise!({
      ok: true,
      json: () => Promise.resolve(mockData),
    } as Response);

    const [result1, result2, result3] = await Promise.all([
      promise1,
      promise2,
      promise3,
    ]);

    // All should return the same data
    expect(result1).toEqual(mockData);
    expect(result2).toEqual(mockData);
    expect(result3).toEqual(mockData);
    expect(global.fetch).toHaveBeenCalledTimes(1); // Only one fetch
  });
});

describe("getInstrumentsByExchange", () => {
  it("should filter instruments by exchange", async () => {
    const { getInstrumentsByExchange } = await import("@/lib/instruments");
    const instruments: InstrumentInfo[] = [
      {
        exchange: "Binance",
        baseAsset: "BTC",
        spotSymbol: "BTCUSDT",
        perpSymbol: "BTCUSDT",
        futuresContracts: [],
        volume24hUsd: 1000000,
      },
      {
        exchange: "Bybit",
        baseAsset: "ETH",
        spotSymbol: "ETHUSDT",
        perpSymbol: "ETHUSDT",
        futuresContracts: [],
        volume24hUsd: 500000,
      },
      {
        exchange: "Binance",
        baseAsset: "ETH",
        spotSymbol: "ETHUSDT",
        perpSymbol: "ETHUSDT",
        futuresContracts: [],
        volume24hUsd: 800000,
      },
    ];

    const binanceInstruments = getInstrumentsByExchange(instruments, "Binance");
    expect(binanceInstruments).toHaveLength(2);
    expect(binanceInstruments.every((i) => i.exchange === "Binance")).toBe(
      true,
    );

    const bybitInstruments = getInstrumentsByExchange(instruments, "Bybit");
    expect(bybitInstruments).toHaveLength(1);
    expect(bybitInstruments[0].exchange).toBe("Bybit");
  });

  it("should return empty array for exchange with no instruments", async () => {
    const { getInstrumentsByExchange } = await import("@/lib/instruments");
    const instruments: InstrumentInfo[] = [
      {
        exchange: "Binance",
        baseAsset: "BTC",
        spotSymbol: "BTCUSDT",
        perpSymbol: "BTCUSDT",
        futuresContracts: [],
        volume24hUsd: 1000000,
      },
    ];

    const result = getInstrumentsByExchange(instruments, "OKX");
    expect(result).toHaveLength(0);
  });

  it("should handle empty array input", async () => {
    const { getInstrumentsByExchange } = await import("@/lib/instruments");
    const result = getInstrumentsByExchange([], "Binance");
    expect(result).toHaveLength(0);
  });

  it("should handle all exchanges present", async () => {
    const { getInstrumentsByExchange } = await import("@/lib/instruments");
    const instruments: InstrumentInfo[] = [
      {
        exchange: "Binance",
        baseAsset: "BTC",
        spotSymbol: "BTCUSDT",
        perpSymbol: "BTCUSDT",
        futuresContracts: [],
        volume24hUsd: 1000000,
      },
      {
        exchange: "Bybit",
        baseAsset: "BTC",
        spotSymbol: "BTCUSDT",
        perpSymbol: "BTCUSDT",
        futuresContracts: [],
        volume24hUsd: 900000,
      },
      {
        exchange: "OKX",
        baseAsset: "BTC",
        spotSymbol: "BTC-USDT",
        perpSymbol: "BTC-USDT-SWAP",
        futuresContracts: [],
        volume24hUsd: 800000,
      },
      {
        exchange: "Deribit",
        baseAsset: "BTC",
        perpSymbol: "BTC-PERPETUAL",
        futuresContracts: [],
        volume24hUsd: 700000,
      },
    ];

    expect(getInstrumentsByExchange(instruments, "Binance")).toHaveLength(1);
    expect(getInstrumentsByExchange(instruments, "Bybit")).toHaveLength(1);
    expect(getInstrumentsByExchange(instruments, "OKX")).toHaveLength(1);
    expect(getInstrumentsByExchange(instruments, "Deribit")).toHaveLength(1);
  });
});
