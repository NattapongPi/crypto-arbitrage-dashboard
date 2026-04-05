/**
 * Binance WebSocket Adapter (server-side)
 * Identical to lib/exchanges/binance.ts but uses server-ws-manager (Node.js ws library).
 */

import { createWsManager } from "../server-ws-manager";
import type {
  AdapterCallbacks,
  ExchangeAdapter,
  InstrumentInfo,
  NormalizedFundingRate,
} from "../../types";

const SPOT_WS_URL = "wss://stream.binance.com:9443/ws";
const FUTURES_WS_URL = "wss://fstream.binance.com/ws";
const MAX_STREAMS_PER_CONNECTION = 1024;

// Binance message types
type BinanceSpotMessage = {
  e: "24hrTicker";
  E: number;
  s: string;
  c: string;
};

type BinanceBookTickerMsg = {
  e: "bookTicker";
  u: number; // order book updateId
  s: string; // symbol
  b: string; // best bid price
  B: string; // best bid qty
  a: string; // best ask price
  A: string; // best ask qty
};

type BinanceFuturesTickerMsg = {
  e: "24hrTicker";
  E: number;
  s: string;
  c: string;
  b: string; // Best bid price
  a: string; // Best ask price
};

type BinanceMarkPriceMsg = {
  e: "markPriceUpdate";
  s: string;
  r: string;
  P: string;
  T: string;
};

type BinanceFuturesMessage = BinanceFuturesTickerMsg | BinanceMarkPriceMsg;

// Type guard functions for runtime validation
function isBinanceSpotMsg(data: unknown): data is BinanceSpotMessage {
  if (typeof data !== "object" || data === null) return false;
  const msg = data as Record<string, unknown>;
  return (
    msg.e === "24hrTicker" &&
    typeof msg.s === "string" &&
    typeof msg.c === "string"
  );
}

function isBinanceBookTickerMsg(data: unknown): data is BinanceBookTickerMsg {
  if (typeof data !== "object" || data === null) return false;
  const msg = data as Record<string, unknown>;
  // bookTicker messages may or may not have the 'e' field when subscribed via combined streams
  // Check for the presence of bookTicker-specific fields: u (updateId), b (bid), a (ask)
  const hasBookTickerFields =
    typeof msg.u === "number" &&
    typeof msg.s === "string" &&
    typeof msg.b === "string" &&
    typeof msg.a === "string";

  // Either has e="bookTicker" OR has the bookTicker field structure
  return msg.e === "bookTicker" || hasBookTickerFields;
}

function isBinanceFuturesMsg(data: unknown): data is BinanceFuturesMessage {
  if (typeof data !== "object" || data === null) return false;
  const msg = data as Record<string, unknown>;
  if (msg.e === "24hrTicker") {
    return typeof msg.s === "string" && typeof msg.c === "string";
  }
  if (msg.e === "markPriceUpdate") {
    return typeof msg.s === "string" && typeof msg.r === "string";
  }
  return false;
}

export function createBinanceAdapter(): ExchangeAdapter {
  let spotManager: ReturnType<typeof createWsManager> | null = null;
  const futuresManagers: ReturnType<typeof createWsManager>[] = [];
  let callbacks: AdapterCallbacks | null = null;

  // Local cache for spot bid/ask prices from bookTicker stream
  const spotBidAskCache = new Map<string, { bid: number; ask: number }>();
  // Store latest spot prices to re-emit once bookTicker arrives
  const pendingSpotTickers = new Map<string, BinanceSpotMessage>();
  // Local cache for perp bid/ask prices from bookTicker stream
  const perpBidAskCache = new Map<string, { bid: number; ask: number }>();
  // Store latest perp prices to re-emit once bookTicker arrives
  const pendingPerpTickers = new Map<string, BinanceFuturesTickerMsg>();

  function connect(instruments: InstrumentInfo[], cb: AdapterCallbacks) {
    callbacks = cb;
    const binanceInstruments = instruments.filter(
      (i) => i.exchange === "Binance",
    );
    if (binanceInstruments.length === 0) return;

    callbacks.onStatusChange("Binance", "CONNECTING");

    const spotStreams = binanceInstruments
      .filter((i) => i.spotSymbol)
      .map((i) => `${i.spotSymbol!.toLowerCase()}@ticker`);

    // Add bookTicker streams for bid/ask prices - limit to avoid exceeding stream limits
    const spotBookTickerStreams = binanceInstruments
      .filter((i) => i.spotSymbol)
      .map((i) => `${i.spotSymbol!.toLowerCase()}@bookTicker`);

    // Combine and limit total streams to stay within Binance's 1024 limit per connection
    const allSpotStreams = [...spotStreams, ...spotBookTickerStreams].slice(
      0,
      MAX_STREAMS_PER_CONNECTION,
    );

    spotManager = createWsManager({
      url: SPOT_WS_URL,
      onOpen: (send) => {
        if (allSpotStreams.length > 0) {
          send(
            JSON.stringify({
              method: "SUBSCRIBE",
              params: allSpotStreams,
              id: 1,
            }),
          );
        }
        callbacks?.onStatusChange("Binance", "LIVE", spotManager?.getLatency());
      },
      onMessage: (data) => {
        if (isBinanceSpotMsg(data)) {
          handleSpotMessage(data);
        } else if (isBinanceBookTickerMsg(data)) {
          handleBookTickerMessage(data);
        }
      },
      onClose: () => {
        callbacks?.onStatusChange("Binance", "CONNECTING");
      },
      onError: (err) => {
        console.error("[Binance] Spot WebSocket error:", err);
        callbacks?.onStatusChange("Binance", "OFFLINE");
      },
    });

    const perpStreams: string[] = [];
    const perpBookTickerStreams: string[] = [];
    const futuresStreams: string[] = [];

    for (const inst of binanceInstruments) {
      if (inst.perpSymbol) {
        perpStreams.push(`${inst.perpSymbol.toLowerCase()}@ticker`);
        perpStreams.push(`${inst.perpSymbol.toLowerCase()}@markPrice`);
        perpBookTickerStreams.push(
          `${inst.perpSymbol.toLowerCase()}@bookTicker`,
        );
      }
      for (const contract of inst.futuresContracts) {
        futuresStreams.push(`${contract.symbol.toLowerCase()}@ticker`);
      }
    }

    const allFuturesStreams = [
      ...perpStreams,
      ...perpBookTickerStreams,
      ...futuresStreams,
    ];

    // Split streams into multiple connections to avoid Binance's practical limit
    // (theoretical limit is 1024, but connections fail with 600+ streams)
    const STREAMS_PER_CONNECTION = 250;
    const streamChunks: string[][] = [];
    for (let i = 0; i < allFuturesStreams.length; i += STREAMS_PER_CONNECTION) {
      streamChunks.push(allFuturesStreams.slice(i, i + STREAMS_PER_CONNECTION));
    }

    const futuresExpiry = new Map<
      string,
      { expiry: string; expiryLabel: string; baseAsset: string }
    >();
    for (const inst of binanceInstruments) {
      for (const contract of inst.futuresContracts) {
        futuresExpiry.set(contract.symbol.toUpperCase(), {
          expiry: contract.expiry,
          expiryLabel: contract.expiryLabel,
          baseAsset: inst.baseAsset,
        });
      }
    }

    const perpToBase = new Map<string, string>();
    for (const inst of binanceInstruments) {
      if (inst.perpSymbol)
        perpToBase.set(inst.perpSymbol.toUpperCase(), inst.baseAsset);
    }

    // Create multiple WebSocket connections for futures
    for (let i = 0; i < streamChunks.length; i++) {
      const chunk = streamChunks[i];
      const manager = createWsManager({
        url: FUTURES_WS_URL,
        onOpen: (send) => {
          if (chunk.length > 0) {
            send(
              JSON.stringify({
                method: "SUBSCRIBE",
                params: chunk,
                id: 2 + i,
              }),
            );
          }
        },
        onMessage: (data) => {
          if (isBinanceFuturesMsg(data)) {
            handleFuturesMessage(data, perpToBase, futuresExpiry);
          } else if (isBinanceBookTickerMsg(data)) {
            // Handle perp bookTicker messages
            const symbol = (data as Record<string, unknown>).s as string;
            if (symbol && perpToBase.has(symbol.toUpperCase())) {
              handlePerpBookTickerMessage(data as BinanceBookTickerMsg);
            }
          }
        },
        onClose: () => {},
        onError: (err) => {
          console.error(
            `[Binance] Futures WS #${i + 1} error:`,
            err.message || err,
          );
          callbacks?.onStatusChange("Binance", "OFFLINE");
        },
      });
      futuresManagers.push(manager);
    }

    spotManager.connect();
    futuresManagers.forEach((m) => m.connect());
  }

  function disconnect() {
    spotManager?.disconnect();
    futuresManagers.forEach((m) => m.disconnect());
    spotManager = null;
    futuresManagers.length = 0;
    callbacks = null;
    spotBidAskCache.clear();
    pendingSpotTickers.clear();
    perpBidAskCache.clear();
    pendingPerpTickers.clear();
  }

  function handleSpotMessage(data: BinanceSpotMessage) {
    if (!callbacks || data.e !== "24hrTicker") return;

    const symbol = data.s?.toUpperCase();
    if (!symbol || !symbol.endsWith("USDT")) return;
    const baseAsset = symbol.slice(0, -4);

    // Get cached bid/ask from bookTicker stream
    const cached = spotBidAskCache.get(baseAsset);

    if (cached) {
      // BookTicker already arrived, emit with bid/ask
      callbacks.onTicker({
        exchange: "Binance",
        baseAsset,
        type: "spot",
        lastPrice: parseFloat(data.c),
        bidPrice: cached.bid,
        askPrice: cached.ask,
        timestamp: data.E ?? Date.now(),
      });
    } else {
      // BookTicker not arrived yet, store and emit without bid/ask
      pendingSpotTickers.set(baseAsset, data);
      callbacks.onTicker({
        exchange: "Binance",
        baseAsset,
        type: "spot",
        lastPrice: parseFloat(data.c),
        bidPrice: undefined,
        askPrice: undefined,
        timestamp: data.E ?? Date.now(),
      });
    }
  }

  function handleBookTickerMessage(data: BinanceBookTickerMsg) {
    if (!callbacks) return;

    const symbol = data.s?.toUpperCase();
    if (!symbol || !symbol.endsWith("USDT")) return;
    const baseAsset = symbol.slice(0, -4);

    const bid = parseFloat(data.b);
    const ask = parseFloat(data.a);

    // Update cache with validation
    if (!Number.isNaN(bid) && !Number.isNaN(ask) && bid > 0 && ask > 0) {
      spotBidAskCache.set(baseAsset, { bid, ask });

      // If we have a pending spot ticker for this asset, re-emit it with bid/ask
      const pending = pendingSpotTickers.get(baseAsset);
      if (pending) {
        callbacks.onTicker({
          exchange: "Binance",
          baseAsset,
          type: "spot",
          lastPrice: parseFloat(pending.c),
          bidPrice: bid,
          askPrice: ask,
          timestamp: pending.E ?? Date.now(),
        });
        pendingSpotTickers.delete(baseAsset);
      }
    }
  }

  function handlePerpBookTickerMessage(data: BinanceBookTickerMsg) {
    if (!callbacks) return;

    // bookTicker messages from combined streams may not have 'e' field
    const isBookTicker =
      data.e === "bookTicker" ||
      (typeof (data as Record<string, unknown>).u === "number" &&
        typeof (data as Record<string, unknown>).b === "string" &&
        typeof (data as Record<string, unknown>).a === "string");

    if (!isBookTicker) return;

    const symbol = data.s?.toUpperCase();
    if (!symbol || !symbol.endsWith("USDT")) return;
    const baseAsset = symbol.slice(0, -4);

    const bid = parseFloat(data.b);
    const ask = parseFloat(data.a);

    // Update cache with validation
    if (!Number.isNaN(bid) && !Number.isNaN(ask) && bid > 0 && ask > 0) {
      perpBidAskCache.set(baseAsset, { bid, ask });

      // If we have a pending perp ticker for this asset, re-emit it with bid/ask
      const pending = pendingPerpTickers.get(baseAsset);
      if (pending) {
        callbacks.onTicker({
          exchange: "Binance",
          baseAsset,
          type: "perp",
          lastPrice: parseFloat(pending.c),
          bidPrice: bid,
          askPrice: ask,
          timestamp: pending.E ?? Date.now(),
        });
        pendingPerpTickers.delete(baseAsset);
      }
    }
  }

  function handleFuturesMessage(
    data: BinanceFuturesMessage,
    perpToBase: Map<string, string>,
    futuresExpiry: Map<
      string,
      { expiry: string; expiryLabel: string; baseAsset: string }
    >,
  ) {
    if (!callbacks) return;

    const symbol = data.s?.toUpperCase();
    if (!symbol) return;

    if (data.e === "24hrTicker") {
      const baseAsset = perpToBase.get(symbol);
      if (baseAsset) {
        // Check cache for bid/ask from bookTicker stream
        const cached = perpBidAskCache.get(baseAsset);

        if (cached) {
          // BookTicker already arrived, emit with bid/ask
          callbacks.onTicker({
            exchange: "Binance",
            baseAsset,
            type: "perp",
            lastPrice: parseFloat(data.c),
            bidPrice: cached.bid,
            askPrice: cached.ask,
            timestamp: data.E ?? Date.now(),
          });
        } else {
          // BookTicker not arrived yet, store and emit without bid/ask
          pendingPerpTickers.set(baseAsset, data);
          callbacks.onTicker({
            exchange: "Binance",
            baseAsset,
            type: "perp",
            lastPrice: parseFloat(data.c),
            bidPrice: undefined,
            askPrice: undefined,
            timestamp: data.E ?? Date.now(),
          });
        }
        return;
      }
      const futInfo = futuresExpiry.get(symbol);
      if (futInfo) {
        const bid = parseFloat(data.b);
        const ask = parseFloat(data.a);
        callbacks.onTicker({
          exchange: "Binance",
          baseAsset: futInfo.baseAsset,
          type: "future",
          expiry: futInfo.expiry,
          expiryLabel: futInfo.expiryLabel,
          lastPrice: parseFloat(data.c),
          bidPrice: !Number.isNaN(bid) && bid > 0 ? bid : undefined,
          askPrice: !Number.isNaN(ask) && ask > 0 ? ask : undefined,
          timestamp: data.E ?? Date.now(),
        });
      }
      return;
    }

    if (data.e === "markPriceUpdate") {
      const baseAsset = perpToBase.get(symbol);
      if (!baseAsset) return;

      // Binance sends funding rate as decimal (e.g., 0.00041000 = 0.041%)
      // Convert to percentage format expected by the system
      const fundingRate = parseFloat(data.r ?? "0") * 100;
      const predictedRate = parseFloat(data.P ?? "0") * 100;
      const nextFundingTime = parseInt(data.T ?? "0");

      // Guard against invalid data
      if (!nextFundingTime) return;

      const funding: NormalizedFundingRate = {
        exchange: "Binance",
        baseAsset,
        fundingRate,
        predictedRate,
        nextFundingTime,
      };
      callbacks.onFunding(funding);
    }
  }

  return { exchange: "Binance", connect, disconnect };
}
