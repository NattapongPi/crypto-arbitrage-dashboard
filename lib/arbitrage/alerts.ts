/**
 * Alert generation and lifecycle management.
 *
 * Lifecycle:
 *   ACTIVE  → opportunity is fresh (age < 60s) and above threshold
 *   WATCH   → opportunity is aging (60s–180s) or spread is declining
 *   FADING  → age 180s–300s or spread dropped below threshold
 *   removed → age > 300s
 */

import type {
  AlertStats,
  AlertStatus,
  CalendarSpreadPair,
  FundingRatePair,
  LiveAlert,
  SpotFuturesPair,
} from "../types";
import { ALERT_AGE_THRESHOLDS, MAX_ALERTS } from "../constants";

/** Generate a dedup key for an alert. */
function alertKey(exchange: string, pair: string, strategy: string): string {
  return `${exchange}:${pair}:${strategy}`;
}

/**
 * Update alert statuses and remove expired ones.
 * Called every second from the market data hook.
 */
export function tickAlerts(alerts: LiveAlert[]): LiveAlert[] {
  const now = Date.now();
  return alerts
    .map((alert): LiveAlert => {
      const ageSeconds = (now - alert.createdAt) / 1000;

      let status: AlertStatus = alert.status;
      if (ageSeconds >= ALERT_AGE_THRESHOLDS.fading) {
        // Will be filtered out below
        return { ...alert, status: "FADING" };
      } else if (ageSeconds >= ALERT_AGE_THRESHOLDS.watch) {
        status = "FADING";
      } else if (ageSeconds >= ALERT_AGE_THRESHOLDS.active) {
        status = "WATCH";
      }

      return { ...alert, status };
    })
    .filter((alert) => {
      const ageSeconds = (Date.now() - alert.createdAt) / 1000;
      return ageSeconds < ALERT_AGE_THRESHOLDS.fading;
    });
}

/**
 * Merge new opportunities into the existing alert list.
 * Creates new alerts for new opportunities; updates existing ones with latest spread.
 */
export function mergeAlerts(
  existing: LiveAlert[],
  spotFutures: SpotFuturesPair[],
  funding: FundingRatePair[],
  calendar: CalendarSpreadPair[]
): LiveAlert[] {
  const now = Date.now();
  const existingByKey = new Map(
    existing.map((a) => [alertKey(a.exchange, a.pair, a.strategy), a])
  );
  const newAlerts: LiveAlert[] = [];

  // Spot-futures opportunities
  for (const sf of spotFutures) {
    if (sf.signal !== "BUY BASIS" && sf.signal !== "LONG SPOT") continue;
    const key = alertKey(sf.exchange, sf.pair, "Spot-Fut");
    if (!existingByKey.has(key)) {
      newAlerts.push({
        id: `${key}-${now}`,
        createdAt: now,
        exchange: sf.exchange,
        pair: sf.pair,
        strategy: "Spot-Fut",
        spread: sf.basisPercent,
        feeAdjPnl: sf.feeAdjPnl,
        status: "ACTIVE",
      });
      existingByKey.set(key, newAlerts[newAlerts.length - 1]);
    } else {
      // Update spread value on existing alert
      const old = existingByKey.get(key)!;
      existingByKey.set(key, {
        ...old,
        spread: sf.basisPercent,
        feeAdjPnl: sf.feeAdjPnl,
      });
    }
  }

  // Funding opportunities
  for (const fr of funding) {
    if (fr.signal !== "LONG SPOT" && fr.signal !== "SHORT OPP") continue;
    const key = alertKey(fr.exchange, fr.pair, "Funding");
    if (!existingByKey.has(key)) {
      newAlerts.push({
        id: `${key}-${now}`,
        createdAt: now,
        exchange: fr.exchange,
        pair: fr.pair,
        strategy: "Funding",
        spread: fr.currentRate,
        feeAdjPnl: fr.annualized / 365, // daily equivalent
        status: "ACTIVE",
      });
      existingByKey.set(key, newAlerts[newAlerts.length - 1]);
    } else {
      const old = existingByKey.get(key)!;
      existingByKey.set(key, { ...old, spread: fr.currentRate });
    }
  }

  // Calendar spread opportunities
  for (const cs of calendar) {
    if (cs.signal !== "ENTER") continue;
    const pair = `${cs.asset} ${cs.nearLeg}/${cs.farLeg}`;
    const key = alertKey(cs.exchange, pair, "Calendar");
    if (!existingByKey.has(key)) {
      newAlerts.push({
        id: `${key}-${now}`,
        createdAt: now,
        exchange: cs.exchange,
        pair,
        strategy: "Calendar",
        spread: cs.spreadPercent,
        feeAdjPnl: cs.feeAdjPnl,
        status: "ACTIVE",
      });
      existingByKey.set(key, newAlerts[newAlerts.length - 1]);
    } else {
      const old = existingByKey.get(key)!;
      existingByKey.set(key, {
        ...old,
        spread: cs.spreadPercent,
        feeAdjPnl: cs.feeAdjPnl,
      });
    }
  }

  // Remove alerts where the opportunity is gone (signal is SKIP or WATCH and alert is old)
  const activeKeys = new Set([
    ...spotFutures
      .filter((s) => s.signal === "BUY BASIS" || s.signal === "LONG SPOT")
      .map((s) => alertKey(s.exchange, s.pair, "Spot-Fut")),
    ...funding
      .filter((f) => f.signal === "LONG SPOT" || f.signal === "SHORT OPP")
      .map((f) => alertKey(f.exchange, f.pair, "Funding")),
    ...calendar
      .filter((c) => c.signal === "ENTER")
      .map((c) =>
        alertKey(c.exchange, `${c.asset} ${c.nearLeg}/${c.farLeg}`, "Calendar")
      ),
  ]);

  const allAlerts = [...existingByKey.values()]
    .map((alert) => {
      // If the opportunity is gone, accelerate to FADING only after 30s grace period
      // This prevents flickering when prices oscillate around the threshold
      if (!activeKeys.has(alertKey(alert.exchange, alert.pair, alert.strategy))) {
        const ageSeconds = (Date.now() - alert.createdAt) / 1000
        if (ageSeconds >= 30) {
          return { ...alert, status: "FADING" as AlertStatus };
        }
      }
      return alert;
    })
    .filter((alert) => {
      const ageSeconds = (Date.now() - alert.createdAt) / 1000;
      return ageSeconds < ALERT_AGE_THRESHOLDS.fading;
    })
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, MAX_ALERTS);

  return allAlerts;
}

/** Compute alert stats from the current alert list. */
export function computeAlertStats(alerts: LiveAlert[]): AlertStats {
  const active = alerts.filter(
    (a) => a.status === "ACTIVE" || a.status === "WATCH"
  );
  return {
    activeNow: active.length,
    spotFutures: active.filter((a) => a.strategy === "Spot-Fut").length,
    fundingRate: active.filter((a) => a.strategy === "Funding").length,
    calendarSpread: active.filter((a) => a.strategy === "Calendar").length,
    fading: alerts.filter((a) => a.status === "FADING").length,
  };
}
