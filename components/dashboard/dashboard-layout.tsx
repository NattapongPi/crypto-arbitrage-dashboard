"use client";

import { usePathname, useRouter } from "next/navigation";
import { checkNavigationGuard } from "@/lib/navigation-guard";
import { useState, useEffect, useTransition } from "react";
import { cn } from "@/lib/utils";
import { ExchangeStatusBar } from "./exchange-status-bar";
import { useMarketDataContext } from "@/lib/context/market-data-context";
import { formatTime } from "@/lib/formatters";
import {
  Settings,
  Activity,
  TrendingUp,
  Clock,
  Bell,
  Menu,
  X,
  Calendar,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Overview", icon: Activity },
  { href: "/spot-futures", label: "Spot-Futures", icon: TrendingUp },
  { href: "/funding-rate", label: "Funding Rate", icon: Clock },
  { href: "/calendar-spread", label: "Calendar Spread", icon: Calendar },
  { href: "/live-alerts", label: "Live Alerts", icon: Bell },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export function DashboardLayout({
  children,
  title,
  subtitle,
}: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [, startTransition] = useTransition();

  function navigate(href: string) {
    if (!checkNavigationGuard(href)) return;
    startTransition(() => router.push(href));
  }

  // Prefetch all nav routes on mount so Turbopack compiles them in the background.
  // This makes subsequent navigation instant instead of blocking on first visit.
  useEffect(() => {
    const allRoutes = [...navItems.map((i) => i.href), "/settings"];
    allRoutes.forEach((href) => router.prefetch(href));
  }, [router]);

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-backdrop-filter:bg-card/80">
        <div className="flex h-14 items-center justify-between gap-3 px-3 sm:h-16 sm:px-6">
          {/* Left: hamburger (mobile) + logo */}
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 cursor-pointer"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary sm:h-8 sm:w-8">
                <Activity className="h-4 w-4 text-primary-foreground sm:h-5 sm:w-5" />
              </div>
              <span className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
                ArbRadar
              </span>
            </button>
            {/* Exchange status — hidden on smallest screens */}
            <div className="hidden sm:flex">
              <ExchangeStatusBar />
            </div>
          </div>

          {/* Right: last tick */}
          <LastTickTime />
        </div>
        {/* Exchange status on mobile — full-width row below header */}
        <div className="flex items-center gap-1.5 overflow-x-auto border-t border-border px-3 py-1.5 sm:hidden">
          <ExchangeStatusBar />
        </div>
      </header>

      <div className="flex">
        {/* Sidebar — desktop */}
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-56 shrink-0 flex-col border-r border-border bg-sidebar lg:flex">
          <nav className="flex flex-col gap-1 p-4">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <button
                  key={item.href}
                  onClick={() => navigate(item.href)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-left w-full cursor-pointer",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>
          <div className="mt-auto border-t border-sidebar-border p-4">
            <button
              onClick={() => navigate("/settings")}
              className={cn(
                "flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
                pathname === "/settings"
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <Settings className="h-4 w-4" />
              Settings
            </button>
          </div>
        </aside>

        {/* Mobile drawer overlay */}
        {drawerOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Mobile drawer */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar transition-transform duration-300 ease-in-out lg:hidden",
            drawerOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex h-14 items-center justify-between px-4 border-b border-sidebar-border">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
                <Activity className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold tracking-tight text-sidebar-foreground">
                ArbRadar
              </span>
            </div>
            <button
              onClick={() => setDrawerOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="flex flex-col gap-1 p-4">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <button
                  key={item.href}
                  onClick={() => {
                    navigate(item.href);
                    setDrawerOpen(false);
                  }}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-left w-full cursor-pointer",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>
          <div className="mt-auto border-t border-sidebar-border p-4">
            <button
              onClick={() => {
                navigate("/settings");
                setDrawerOpen(false);
              }}
              className={cn(
                "flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
                pathname === "/settings"
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <Settings className="h-4 w-4" />
              Settings
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="min-w-0 flex-1 overflow-x-hidden">
          <div className="p-4 sm:p-6">
            <div className="mb-4 sm:mb-6">
              <h1 className="text-xl font-bold text-foreground sm:text-2xl">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
              )}
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function LastTickTime() {
  const { lastTickTime } = useMarketDataContext();
  const [clockTime, setClockTime] = useState<string | null>(null);

  // Fallback clock when no WS ticks have arrived yet
  useEffect(() => {
    if (lastTickTime) return;
    const fmt = () => new Date().toLocaleTimeString("en-GB", { hour12: false });
    setClockTime(fmt());
    const id = setInterval(() => setClockTime(fmt()), 1000);
    return () => clearInterval(id);
  }, [lastTickTime]);

  const display = lastTickTime
    ? formatTime(lastTickTime)
    : (clockTime ?? "--:--:--");

  return (
    <div className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground sm:text-sm">
      <span className="hidden sm:inline">Last tick:</span>
      <span className="font-mono text-foreground">{display}</span>
    </div>
  );
}
