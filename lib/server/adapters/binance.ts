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

type BinanceFuturesTickerMsg = {
  e: "24hrTicker";
  E: number;
  s: string;
  c: string;
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
  let futuresManager: ReturnType<typeof createWsManager> | null = null;
  let callbacks: AdapterCallbacks | null = null;

  function connect(instruments: InstrumentInfo[], cb: AdapterCallbacks) {
    callbacks = cb;
    const binanceInstruments = instruments.filter(
      (i) => i.exchange === "Binance",
    );
    if (binanceInstruments.length === 0) return;

    callbacks.onStatusChange("Binance", "CONNECTING");

    const spotStreams = binanceInstruments
      .filter((i) => i.spotSymbol)
      .map((i) => `${i.spotSymbol!.toLowerCase()}@ticker`)
      .slice(0, MAX_STREAMS_PER_CONNECTION);

    spotManager = createWsManager({
      url: SPOT_WS_URL,
      onOpen: (send) => {
        if (spotStreams.length > 0) {
          send(
            JSON.stringify({ method: "SUBSCRIBE", params: spotStreams, id: 1 }),
          );
        }
        callbacks?.onStatusChange("Binance", "LIVE", spotManager?.getLatency());
      },
      onMessage: (data) => {
        if (isBinanceSpotMsg(data)) {
          handleSpotMessage(data);
        }
      },
      onClose: () => callbacks?.onStatusChange("Binance", "CONNECTING"),
      onError: () => callbacks?.onStatusChange("Binance", "OFFLINE"),
    });

    const perpStreams: string[] = [];
    const futuresStreams: string[] = [];

    for (const inst of binanceInstruments) {
      if (inst.perpSymbol) {
        perpStreams.push(`${inst.perpSymbol.toLowerCase()}@ticker`);
        perpStreams.push(`${inst.perpSymbol.toLowerCase()}@markPrice`);
      }
      for (const contract of inst.futuresContracts) {
        futuresStreams.push(`${contract.symbol.toLowerCase()}@ticker`);
      }
    }

    const allFuturesStreams = [...perpStreams, ...futuresStreams].slice(
      0,
      MAX_STREAMS_PER_CONNECTION,
    );

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

    futuresManager = createWsManager({
      url: FUTURES_WS_URL,
      onOpen: (send) => {
        if (allFuturesStreams.length > 0) {
          send(
            JSON.stringify({
              method: "SUBSCRIBE",
              params: allFuturesStreams,
              id: 2,
            }),
          );
        }
      },
      onMessage: (data) => {
        if (isBinanceFuturesMsg(data)) {
          handleFuturesMessage(data, perpToBase, futuresExpiry);
        }
      },
      onClose: () => {},
      onError: () => callbacks?.onStatusChange("Binance", "OFFLINE"),
    });

    spotManager.connect();
    futuresManager.connect();
  }

  function disconnect() {
    spotManager?.disconnect();
    futuresManager?.disconnect();
    spotManager = null;
    futuresManager = null;
    callbacks = null;
  }

  function handleSpotMessage(data: BinanceSpotMessage) {
    if (!callbacks || data.e !== "24hrTicker") return;

    const symbol = data.s?.toUpperCase();
    if (!symbol || !symbol.endsWith("USDT")) return;
    const baseAsset = symbol.slice(0, -4);

    callbacks.onTicker({
      exchange: "Binance",
      baseAsset,
      type: "spot",
      lastPrice: parseFloat(data.c),
      timestamp: data.E ?? Date.now(),
    });
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
        callbacks.onTicker({
          exchange: "Binance",
          baseAsset,
          type: "perp",
          lastPrice: parseFloat(data.c),
          timestamp: data.E ?? Date.now(),
        });
        return;
      }
      const futInfo = futuresExpiry.get(symbol);
      if (futInfo) {
        callbacks.onTicker({
          exchange: "Binance",
          baseAsset: futInfo.baseAsset,
          type: "future",
          expiry: futInfo.expiry,
          expiryLabel: futInfo.expiryLabel,
          lastPrice: parseFloat(data.c),
          timestamp: data.E ?? Date.now(),
        });
      }
      return;
    }

    if (data.e === "markPriceUpdate") {
      const baseAsset = perpToBase.get(symbol);
      if (!baseAsset) return;

      const fundingRate = parseFloat(data.r ?? "0");
      const predictedRate = parseFloat(data.P ?? "0");
      const nextFundingTime = parseInt(data.T ?? "0");

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
