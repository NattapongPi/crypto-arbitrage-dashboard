/**
 * Binance WebSocket Adapter
 *
 * Manages two connections:
 *   - Spot: wss://stream.binance.com:9443/ws (for spot prices)
 *   - Futures: wss://fstream.binance.com/ws (for perp prices + funding rates + quarterly futures)
 *
 * Binance handles WS-level ping/pong automatically in browsers.
 * We subscribe via JSON message after connection opens.
 */

import { createWsManager } from "./ws-manager";
import type {
  AdapterCallbacks,
  ExchangeAdapter,
  InstrumentInfo,
  NormalizedFundingRate,
} from "../types";

const SPOT_WS_URL = "wss://stream.binance.com:9443/ws";
const FUTURES_WS_URL = "wss://fstream.binance.com/ws";

// Binance allows up to 1024 streams per connection
const MAX_STREAMS_PER_CONNECTION = 1024;

export function createBinanceAdapter(): ExchangeAdapter {
  let spotManager: ReturnType<typeof createWsManager> | null = null;
  let futuresManager: ReturnType<typeof createWsManager> | null = null;
  let callbacks: AdapterCallbacks | null = null;

  function connect(instruments: InstrumentInfo[], cb: AdapterCallbacks) {
    callbacks = cb;
    const binanceInstruments = instruments.filter(
      (i) => i.exchange === "Binance"
    );
    if (binanceInstruments.length === 0) return;

    callbacks.onStatusChange("Binance", "CONNECTING");

    // ── Spot streams ──────────────────────────────────────────────────────────
    const spotStreams = binanceInstruments
      .filter((i) => i.spotSymbol)
      .map((i) => `${i.spotSymbol!.toLowerCase()}@ticker`)
      .slice(0, MAX_STREAMS_PER_CONNECTION);

    spotManager = createWsManager({
      url: SPOT_WS_URL,
      onOpen: (send) => {
        if (spotStreams.length > 0) {
          send(
            JSON.stringify({ method: "SUBSCRIBE", params: spotStreams, id: 1 })
          );
        }
        callbacks?.onStatusChange("Binance", "LIVE", spotManager?.getLatency());
      },
      onMessage: (data) => handleSpotMessage(data as BinanceTickerMsg),
      onClose: () => callbacks?.onStatusChange("Binance", "CONNECTING"),
      onError: () => callbacks?.onStatusChange("Binance", "OFFLINE"),
    });

    // ── Futures streams (perps + quarterly + markPrice for funding) ──────────
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
      MAX_STREAMS_PER_CONNECTION
    );

    // Build a symbol → expiry info map for futures
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

    // Build perp symbol → baseAsset map
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
            })
          );
        }
      },
      onMessage: (data) =>
        handleFuturesMessage(
          data as BinanceFuturesMsg,
          perpToBase,
          futuresExpiry
        ),
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

  // ── Message handlers ────────────────────────────────────────────────────────

  function handleSpotMessage(data: BinanceTickerMsg) {
    if (!callbacks || !data?.e) return;
    // Subscription confirmations have no 'e' field
    if (data.e !== "24hrTicker") return;

    const symbol = data.s?.toUpperCase(); // e.g. "BTCUSDT"
    if (!symbol || !symbol.endsWith("USDT")) return;
    const baseAsset = symbol.slice(0, -4); // strip "USDT"

    callbacks.onTicker({
      exchange: "Binance",
      baseAsset,
      type: "spot",
      lastPrice: parseFloat(data.c),
      timestamp: data.E ?? Date.now(),
    });
  }

  function handleFuturesMessage(
    data: BinanceFuturesMsg,
    perpToBase: Map<string, string>,
    futuresExpiry: Map<
      string,
      { expiry: string; expiryLabel: string; baseAsset: string }
    >
  ) {
    if (!callbacks || !data?.e) return;

    const symbol = data.s?.toUpperCase();
    if (!symbol) return;

    if (data.e === "24hrTicker") {
      // Perp or quarterly futures price
      const baseAsset = perpToBase.get(symbol);
      if (baseAsset) {
        // It's a perpetual
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
      // Funding rate data
      const baseAsset = perpToBase.get(symbol);
      if (!baseAsset) return;

      const fundingRate = parseFloat((data as BinanceMarkPriceMsg).r ?? "0");
      const predictedRate = parseFloat((data as BinanceMarkPriceMsg).P ?? "0");
      const nextFundingTime = parseInt((data as BinanceMarkPriceMsg).T ?? "0");

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

// ── Binance message types ─────────────────────────────────────────────────────

interface BinanceTickerMsg {
  e: string; // Event type
  E: number; // Event time
  s: string; // Symbol
  c: string; // Last price
}

type BinanceFuturesMsg = BinanceTickerMsg;

interface BinanceMarkPriceMsg extends BinanceFuturesMsg {
  r: string; // Funding rate
  P: string; // Estimated settle price (predicted next funding rate)
  T: string; // Next funding time
}
