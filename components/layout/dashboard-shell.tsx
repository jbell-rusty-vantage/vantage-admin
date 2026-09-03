"use client";

import { useState } from "react";
import { Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";
import { setLocalStorageBoolean, useLocalStorageBoolean } from "@/lib/state/use-local-storage-boolean";
import { cn } from "@/lib/utils";
import { DASHBOARD_MAIN_ID } from "./dashboard-ids";
import { DashboardRoleProvider } from "./dashboard-role-context";
import { DashboardNav, pageTitleForPath } from "./dashboard-nav";
import { ScopeAwareHeaderControls } from "./scope-aware-header-controls";
import { UserMenu } from "./user-menu";

const sidebarStorageKey = "vantage-admin-sidebar-collapsed";
const ownerOnlyPagePrefixes = [
  "/audit-log",
  "/bookings/reconciliation",
  "/ingestion/granot",
  "/intakes",
  "/live-events",
  "/manual",
] as const;
// /operations-registry is intentionally readable by admin roles (mutations gated in UI/proxy).

export function DashboardShell({
  adminEmail,
  adminRole,
  children,
}: {
  adminEmail: string;
  adminRole: "owner" | "admin";
  children: React.ReactNode;
}) {
  const collapsed = useLocalStorageBoolean(sidebarStorageKey);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const pageAllowed =
    adminRole === "owner" ||
    !ownerOnlyPagePrefixes.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );

  function toggleCollapsed() {
    setLocalStorageBoolean(sidebarStorageKey, !collapsed);
  }

  return (
    <DashboardRoleProvider role={adminRole}>
      <div className="flex h-svh overflow-hidden bg-cool-white">
      <aside
        className={cn(
          "hidden h-full shrink-0 flex-col border-r border-steel-200 bg-white px-2.5 py-4 shadow-sm transition-[width] duration-200 lg:flex",
          collapsed ? "w-14" : "w-56",
        )}
      >
        <div className={cn("mb-3 flex shrink-0 items-center gap-2", collapsed ? "justify-center px-0" : "justify-between px-1")}>
          <div className={collapsed ? "hidden" : undefined}>
            <BrandLogo />
          </div>
          <Button
            variant="ghost"
            className="h-9 w-9 px-0"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <DashboardNav adminRole={adminRole} collapsed={collapsed} />
        </div>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="z-30 flex min-h-16 shrink-0 items-center justify-between gap-4 border-b border-steel-200 bg-white/95 px-6 py-3 shadow-sm backdrop-blur">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <Button
              variant="ghost"
              className="h-9 w-9 shrink-0 px-0 lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="hidden min-w-0 max-w-xs truncate font-heading text-base font-extrabold text-navy lg:block">
              {pageTitleForPath(pathname)}
            </h1>
            <ScopeAwareHeaderControls />
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <UserMenu email={adminEmail} role={adminRole} />
          </div>
        </header>
        <main id={DASHBOARD_MAIN_ID} className="min-h-0 flex-1 overflow-y-auto p-6">
          {pageAllowed ? (
            children
          ) : (
            <div className="rounded-lg border border-steel-200 bg-white p-6 shadow-sm">
              <h1 className="text-xl font-semibold text-navy">Not allowed</h1>
              <p className="mt-2 text-sm text-steel">
                Your admin role does not have access to this page.
              </p>
            </div>
          )}
        </main>
      </div>
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 flex h-full w-64 flex-col border-r bg-white p-4 shadow-xl">
            <div className="mb-4 flex shrink-0 items-start justify-between gap-3">
              <BrandLogo />
              <Button variant="ghost" className="h-9 w-9 px-0" onClick={() => setMobileOpen(false)} aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <DashboardNav adminRole={adminRole} onNavigate={() => setMobileOpen(false)} />
            </div>
          </aside>
        </div>
      ) : null}
      </div>
    </DashboardRoleProvider>
  );
}
