/**
 * OKX WebSocket Adapter (server-side)
 * Identical to lib/exchanges/okx.ts but uses server-ws-manager (Node.js ws library).
 */

import { createWsManager } from "../server-ws-manager";
import type {
  AdapterCallbacks,
  ExchangeAdapter,
  InstrumentInfo,
  NormalizedFundingRate,
} from "../../types";

const WS_URL = "wss://ws.okx.com:8443/ws/v5/public";

export function createOKXAdapter(): ExchangeAdapter {
  let manager: ReturnType<typeof createWsManager> | null = null;
  let callbacks: AdapterCallbacks | null = null;

  let spotInstToBase = new Map<string, string>();
  let swapInstToBase = new Map<string, string>();
  let futuresInstInfo = new Map<
    string,
    { baseAsset: string; expiry: string; expiryLabel: string }
  >();

  function connect(instruments: InstrumentInfo[], cb: AdapterCallbacks) {
    callbacks = cb;
    const okxInstruments = instruments.filter((i) => i.exchange === "OKX");
    if (okxInstruments.length === 0) return;

    callbacks.onStatusChange("OKX", "CONNECTING");

    spotInstToBase = new Map();
    swapInstToBase = new Map();
    futuresInstInfo = new Map();

    const subscriptions: OKXChannel[] = [];

    for (const inst of okxInstruments) {
      if (inst.spotSymbol) {
        spotInstToBase.set(inst.spotSymbol, inst.baseAsset);
        subscriptions.push({ channel: "tickers", instId: inst.spotSymbol });
      }
      if (inst.perpSymbol) {
        swapInstToBase.set(inst.perpSymbol, inst.baseAsset);
        subscriptions.push({ channel: "tickers", instId: inst.perpSymbol });
        subscriptions.push({
          channel: "funding-rate",
          instId: inst.perpSymbol,
        });
      }
      for (const contract of inst.futuresContracts) {
        futuresInstInfo.set(contract.symbol, {
          baseAsset: inst.baseAsset,
          expiry: contract.expiry,
          expiryLabel: contract.expiryLabel,
        });
        subscriptions.push({ channel: "tickers", instId: contract.symbol });
      }
    }

    manager = createWsManager({
      url: WS_URL,
      onOpen: (send) => {
        const BATCH = 100;
        for (let i = 0; i < subscriptions.length; i += BATCH) {
          send(
            JSON.stringify({
              op: "subscribe",
              args: subscriptions.slice(i, i + BATCH),
            }),
          );
        }
        callbacks?.onStatusChange("OKX", "LIVE", manager?.getLatency());
      },
      onMessage: (data) => {
        if (isOKXMsg(data)) {
          handleMessage(data);
        }
      },
      onClose: () => callbacks?.onStatusChange("OKX", "CONNECTING"),
      onError: () => callbacks?.onStatusChange("OKX", "OFFLINE"),
    });

    manager.connect();
  }

  function disconnect() {
    manager?.disconnect();
    manager = null;
    callbacks = null;
  }

  function handleMessage(data: OKXMsg) {
    if (!callbacks) return;

    if ("event" in data && data.event === "ping") {
      manager?.send(JSON.stringify({ op: "pong" }));
      return;
    }

    // After ping check, data must be OKXTickerMsg or OKXFundingRateMsg
    const msgData = data as OKXTickerMsg | OKXFundingRateMsg;
    const channel = msgData.arg?.channel;
    const instId = msgData.arg?.instId;
    if (!channel || !instId || !msgData.data || !Array.isArray(msgData.data))
      return;

    if (channel === "tickers") {
      const tick = msgData.data[0] as { last?: string; ts?: string };
      const price = parseFloat(tick.last ?? "0");
      if (!price) return;
      const ts = parseInt(tick.ts ?? "0") || Date.now();

      const spotBase = spotInstToBase.get(instId);
      if (spotBase) {
        callbacks.onTicker({
          exchange: "OKX",
          baseAsset: spotBase,
          type: "spot",
          lastPrice: price,
          timestamp: ts,
        });
        return;
      }

      const swapBase = swapInstToBase.get(instId);
      if (swapBase) {
        callbacks.onTicker({
          exchange: "OKX",
          baseAsset: swapBase,
          type: "perp",
          lastPrice: price,
          timestamp: ts,
        });
        return;
      }

      const futInfo = futuresInstInfo.get(instId);
      if (futInfo) {
        callbacks.onTicker({
          exchange: "OKX",
          baseAsset: futInfo.baseAsset,
          type: "future",
          expiry: futInfo.expiry,
          expiryLabel: futInfo.expiryLabel,
          lastPrice: price,
          timestamp: ts,
        });
      }
      return;
    }

    if (channel === "funding-rate") {
      const fr = msgData.data[0] as {
        fundingRate?: string;
        nextFundingRate?: string;
        fundingTime?: string;
      };
      const baseAsset = swapInstToBase.get(instId);
      if (!baseAsset) return;

      const funding: NormalizedFundingRate = {
        exchange: "OKX",
        baseAsset,
        fundingRate: parseFloat(fr.fundingRate ?? "0") * 100,
        predictedRate: fr.nextFundingRate
          ? parseFloat(fr.nextFundingRate) * 100
          : undefined,
        nextFundingTime: parseInt(fr.fundingTime ?? "0"),
      };
      callbacks.onFunding(funding);
    }
  }

  return { exchange: "OKX", connect, disconnect };
}

interface OKXChannel {
  channel: string;
  instId: string;
}

interface OKXPingMsg {
  event: "ping";
}

interface OKXTickerMsg {
  arg: { channel: "tickers"; instId: string };
  data: Array<{ last?: string; ts?: string }>;
}

interface OKXFundingRateMsg {
  arg: { channel: "funding-rate"; instId: string };
  data: Array<{
    fundingRate?: string;
    nextFundingRate?: string;
    fundingTime?: string;
  }>;
}

type OKXMsg = OKXPingMsg | OKXTickerMsg | OKXFundingRateMsg;

// Type guard for runtime validation
function isOKXMsg(data: unknown): data is OKXMsg {
  if (typeof data !== "object" || data === null) return false;
  const msg = data as Record<string, unknown>;
  if ("event" in msg && msg.event === "ping") return true;
  if (
    "arg" in msg &&
    "data" in msg &&
    typeof msg.arg === "object" &&
    msg.arg !== null
  ) {
    const arg = msg.arg as Record<string, unknown>;
    return arg.channel === "tickers" || arg.channel === "funding-rate";
  }
  return false;
}
