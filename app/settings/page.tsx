"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  registerNavigationGuard,
  unregisterNavigationGuard,
} from "@/lib/navigation-guard";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSettingsContext } from "@/lib/context/market-data-context";
import type { Exchange, UserSettings } from "@/lib/types";

const EXCHANGES: Exchange[] = ["Binance", "Bybit", "OKX", "Deribit"];

export default function SettingsPage() {
  const router = useRouter();
  const { settings, applySettings, resetToDefaults } = useSettingsContext();

  // Local draft state — only persisted when user clicks Save
  const [draft, setDraft] = useState<UserSettings>(settings);
  const [saved, setSaved] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const isDirty = JSON.stringify(draft) !== JSON.stringify(settings);
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  // Register a navigation guard so DashboardLayout can confirm before leaving
  useEffect(() => {
    registerNavigationGuard((href) => {
      if (!isDirtyRef.current) return true;
      setPendingHref(href);
      setLeaveDialogOpen(true);
      return false;
    });
    return () => unregisterNavigationGuard();
  }, []);

  // Warn on browser tab close / refresh
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirty) e.preventDefault();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  function handleSave() {
    applySettings(draft);
    setSaved(true);
    setLeaveDialogOpen(false);
    setPendingHref(null);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleReset() {
    resetToDefaults();
    setDraft({ ...settings });
    setLeaveDialogOpen(false);
    setPendingHref(null);
  }

  function handleLeaveConfirmed() {
    const href = pendingHref;
    setLeaveDialogOpen(false);
    setPendingHref(null);
    if (href) router.push(href);
  }

  function setFee(key: keyof UserSettings["fees"], value: string) {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    setDraft((d) => ({ ...d, fees: { ...d.fees, [key]: num } }));
  }

  function setThreshold(key: keyof UserSettings["thresholds"], value: string) {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    setDraft((d) => ({ ...d, thresholds: { ...d.thresholds, [key]: num } }));
  }

  function toggleExchange(exchange: Exchange, checked: boolean) {
    setDraft((d) => ({
      ...d,
      exchanges: { ...d.exchanges, [exchange]: checked },
    }));
  }

  return (
    <DashboardLayout
      title="Settings"
      subtitle="Configure your arbitrage dashboard"
    >
      <AlertDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved settings. If you leave now, those changes will be
              discarded.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingHref(null)}>
              Stay on page
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleLeaveConfirmed}>
              Leave anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Alert Thresholds */}
        <Card>
          <CardHeader>
            <CardTitle>Alert Thresholds</CardTitle>
            <CardDescription>
              Minimum spread thresholds — signals and alerts are driven by these
              values
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">
                  Spot-Futures Min Basis (%)
                </label>
                <Input
                  type="number"
                  value={draft.thresholds.minBasisPercent}
                  onChange={(e) =>
                    setThreshold("minBasisPercent", e.target.value)
                  }
                  step="0.01"
                  min="0"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">
                  Funding Rate Min Annualized (%)
                </label>
                <Input
                  type="number"
                  value={draft.thresholds.minAnnualizedPercent}
                  onChange={(e) =>
                    setThreshold("minAnnualizedPercent", e.target.value)
                  }
                  step="1"
                  min="0"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">
                  Calendar Spread Min (%)
                </label>
                <Input
                  type="number"
                  value={draft.thresholds.minSpreadPercent}
                  onChange={(e) =>
                    setThreshold("minSpreadPercent", e.target.value)
                  }
                  step="0.05"
                  min="0"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Exchange Connections */}
        <Card>
          <CardHeader>
            <CardTitle>Exchange Connections</CardTitle>
            <CardDescription>
              Enable or disable exchanges — disabled exchanges disconnect
              immediately
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              {EXCHANGES.map((exchange) => (
                <div
                  key={exchange}
                  className="flex items-center justify-between py-1"
                >
                  <span className="text-sm font-medium text-foreground">
                    {exchange}
                  </span>
                  <Switch
                    checked={draft.exchanges[exchange]}
                    onCheckedChange={(checked) =>
                      toggleExchange(exchange, checked)
                    }
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Fee Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Fee Configuration</CardTitle>
            <CardDescription>
              Your trading fees — used to calculate fee-adjusted PnL on all
              strategies
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">
                  Maker Fee (%)
                </label>
                <Input
                  type="number"
                  value={draft.fees.makerFeePercent}
                  onChange={(e) => setFee("makerFeePercent", e.target.value)}
                  step="0.001"
                  min="0"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">
                  Taker Fee (%)
                </label>
                <Input
                  type="number"
                  value={draft.fees.takerFeePercent}
                  onChange={(e) => setFee("takerFeePercent", e.target.value)}
                  step="0.001"
                  min="0"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">
                  Withdrawal Fee ($)
                </label>
                <Input
                  type="number"
                  value={draft.fees.withdrawalFeeUsd}
                  onChange={(e) => setFee("withdrawalFeeUsd", e.target.value)}
                  step="0.01"
                  min="0"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>Alert notifications — coming soon</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              {["Browser Notifications", "Sound Alerts", "Telegram Alerts"].map(
                (label) => (
                  <div
                    key={label}
                    className="flex items-center justify-between py-1"
                  >
                    <span className="text-sm font-medium text-muted-foreground">
                      {label}
                    </span>
                    <Switch disabled />
                  </div>
                )
              )}
            </div>
          </CardContent>
        </Card>

        {/* Unsaved changes banner */}
        {isDirty && (
          <div className="lg:col-span-2 flex items-center justify-between gap-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-yellow-400" />
              <span className="text-sm font-medium text-yellow-300">
                You have unsaved changes
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDraft(settings)}
                className="text-xs text-yellow-400/70 hover:text-yellow-300 transition-colors cursor-pointer"
              >
                Discard
              </button>
              <Button size="sm" onClick={handleSave}>
                Save now
              </Button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="lg:col-span-2 flex items-center justify-between gap-4">
          <Button variant="outline" onClick={handleReset}>
            Reset to Defaults
          </Button>
          <Button size="lg" onClick={handleSave} disabled={!isDirty}>
            {saved ? "Saved ✓" : "Save Settings"}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
