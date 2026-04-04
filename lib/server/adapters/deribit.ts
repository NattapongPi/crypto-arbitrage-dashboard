/**
 * Deribit WebSocket Adapter (server-side)
 * Identical to lib/exchanges/deribit.ts but uses server-ws-manager (Node.js ws library).
 */

import { createWsManager } from "../server-ws-manager";
import type {
  AdapterCallbacks,
  ExchangeAdapter,
  InstrumentInfo,
  NormalizedFundingRate,
} from "../../types";

const WS_URL = "wss://www.deribit.com/ws/api/v2";
const HEARTBEAT_INTERVAL_S = 30;

export function createDeribitAdapter(): ExchangeAdapter {
  let manager: ReturnType<typeof createWsManager> | null = null;
  let callbacks: AdapterCallbacks | null = null;
  let rpcId = 1;

  let perpInstToBase = new Map<string, string>();
  let futuresInstInfo = new Map<
    string,
    { baseAsset: string; expiry: string; expiryLabel: string }
  >();

  function nextId() {
    return rpcId++;
  }

  function sendRpc(
    method: string,
    params: Record<string, string | number | boolean | null | string[]>,
  ) {
    manager?.send(
      JSON.stringify({ jsonrpc: "2.0", id: nextId(), method, params }),
    );
  }

  function connect(instruments: InstrumentInfo[], cb: AdapterCallbacks) {
    callbacks = cb;
    const deribitInstruments = instruments.filter(
      (i) => i.exchange === "Deribit",
    );
    if (deribitInstruments.length === 0) return;

    callbacks.onStatusChange("Deribit", "CONNECTING");

    perpInstToBase = new Map();
    futuresInstInfo = new Map();

    const channels: string[] = [];

    for (const inst of deribitInstruments) {
      if (inst.perpSymbol) {
        perpInstToBase.set(inst.perpSymbol, inst.baseAsset);
        channels.push(`ticker.${inst.perpSymbol}.raw`);
      }
      for (const contract of inst.futuresContracts) {
        futuresInstInfo.set(contract.symbol, {
          baseAsset: inst.baseAsset,
          expiry: contract.expiry,
          expiryLabel: contract.expiryLabel,
        });
        channels.push(`ticker.${contract.symbol}.raw`);
      }
    }

    manager = createWsManager({
      url: WS_URL,
      onOpen: () => {
        sendRpc("public/set_heartbeat", { interval: HEARTBEAT_INTERVAL_S });
        sendRpc("public/subscribe", { channels });
        callbacks?.onStatusChange("Deribit", "LIVE", manager?.getLatency());
      },
      onMessage: (data) => {
        if (isDeribitMsg(data)) {
          handleMessage(data);
        }
      },
      onClose: () => callbacks?.onStatusChange("Deribit", "CONNECTING"),
      onError: () => callbacks?.onStatusChange("Deribit", "OFFLINE"),
    });

    manager.connect();
  }

  function disconnect() {
    manager?.disconnect();
    manager = null;
    callbacks = null;
  }

  function handleMessage(data: DeribitMsg) {
    if (!callbacks) return;

    if (data.method === "public/test") {
      sendRpc("public/test", {});
      return;
    }

    if (data.method !== "subscription") return;

    // TypeScript knows this is DeribitTickerMsg
    const tickerMsg = data as DeribitTickerMsg;
    const channel = tickerMsg.params.channel;
    const tickerData = tickerMsg.params.data;
    if (!tickerData) return;

    const instrumentName = channel.split(".")[1];
    if (!instrumentName) return;

    const price = tickerData.last_price;
    const ts = Date.now();

    const perpBase = perpInstToBase.get(instrumentName);
    if (perpBase) {
      if (price) {
        callbacks.onTicker({
          exchange: "Deribit",
          baseAsset: perpBase,
          type: "perp",
          lastPrice: price,
          bidPrice: tickerData.best_bid_price,
          askPrice: tickerData.best_ask_price,
          timestamp: ts,
        });
      }

      // Deribit is a derivatives-only exchange - no real spot market
      // Index price is synthetic and doesn't have bid/ask spreads
      // Spot-futures basis requires real order book data, so we skip spot emission

      const funding8h = tickerData.funding_8h;
      const currentFunding = tickerData.current_funding;
      if (funding8h !== undefined) {
        const funding: NormalizedFundingRate = {
          exchange: "Deribit",
          baseAsset: perpBase,
          fundingRate: (currentFunding ?? funding8h) * 100,
          nextFundingTime: nextDeribitFundingTime(),
          openInterest: tickerData.open_interest,
        };
        callbacks.onFunding(funding);
      }
      return;
    }

    const futInfo = futuresInstInfo.get(instrumentName);
    if (futInfo && price) {
      callbacks.onTicker({
        exchange: "Deribit",
        baseAsset: futInfo.baseAsset,
        type: "future",
        expiry: futInfo.expiry,
        expiryLabel: futInfo.expiryLabel,
        lastPrice: price,
        bidPrice: tickerData.best_bid_price,
        askPrice: tickerData.best_ask_price,
        timestamp: ts,
      });
    }
  }

  return { exchange: "Deribit", connect, disconnect };
}

function nextDeribitFundingTime(): number {
  const now = new Date();
  const utcHours = now.getUTCHours();
  const nextHour = utcHours < 8 ? 8 : utcHours < 16 ? 16 : 24;
  const next = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      nextHour % 24,
    ),
  );
  if (nextHour === 24) next.setUTCDate(next.getUTCDate() + 1);
  return next.getTime();
}

interface DeribitTickerMsg {
  jsonrpc: "2.0";
  method: "subscription";
  params: {
    channel: string;
    data: DeribitTicker;
  };
}

interface DeribitRpcMsg {
  jsonrpc: "2.0";
  method: string;
  id?: number;
  result?: unknown;
}

interface DeribitHeartbeatMsg {
  jsonrpc: "2.0";
  method: "public/test";
}

type DeribitMsg = DeribitTickerMsg | DeribitRpcMsg | DeribitHeartbeatMsg;

// Type guard for runtime validation
function isDeribitMsg(data: unknown): data is DeribitMsg {
  if (typeof data !== "object" || data === null) return false;
  const msg = data as Record<string, unknown>;
  return "jsonrpc" in msg && "method" in msg;
}

interface DeribitTicker {
  last_price?: number;
  best_bid_price?: number; // Best bid price
  best_ask_price?: number; // Best ask price
  index_price?: number;
  funding_8h?: number;
  current_funding?: number;
  open_interest?: number;
}
