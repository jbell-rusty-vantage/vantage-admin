"use client";

import type { KeyboardEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useDashboardRole } from "@/components/layout/dashboard-role-context";
import { FeedbackMessage } from "@/components/ui/feedback";
import { cn } from "@/lib/utils";
import { AgentsManager } from "./agents-manager";
import { CplManager } from "./cpl-manager";
import { MerchantsManager } from "./merchants-manager";
import { RegistryChanges } from "./registry-changes";
import { RegistryOverview } from "./registry-overview";
import { RingCentralRoutesManager } from "./ringcentral/routes-list";
import { SourceCompaniesManager } from "./source-companies-manager";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "agents", label: "Agents" },
  { id: "merchants", label: "Merchants" },
  { id: "sources", label: "Sources" },
  { id: "ringcentral", label: "RingCentral" },
  { id: "cpl", label: "CPL" },
  { id: "changes", label: "Changes" },
] as const;

export type RegistryTab = (typeof TABS)[number]["id"];

function parseTab(value: string | null): RegistryTab {
  return (TABS.some((tab) => tab.id === value) ? value : "overview") as RegistryTab;
}

function panelId(tab: RegistryTab) {
  return `registry-panel-${tab}`;
}

function tabId(tab: RegistryTab) {
  return `registry-tab-${tab}`;
}

export function RegistryShell() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const role = useDashboardRole();
  const activeTab = parseTab(searchParams.get("tab"));
  const readOnly = role !== "owner";

  function selectTab(tab: RegistryTab) {
    const params = new URLSearchParams();
    if (tab !== "overview") {
      params.set("tab", tab);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "Home" && event.key !== "End") {
      return;
    }
    event.preventDefault();
    let next = index;
    if (event.key === "ArrowRight") {
      next = (index + 1) % TABS.length;
    } else if (event.key === "ArrowLeft") {
      next = (index - 1 + TABS.length) % TABS.length;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = TABS.length - 1;
    }
    selectTab(TABS[next]!.id);
    document.getElementById(tabId(TABS[next]!.id))?.focus();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Operations Registry</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Owner-managed catalog of agents, merchants, source companies, granularities, RingCentral
          queue numbers, and CPL schedules. Changes are audited and dependency-aware.
        </p>
      </div>

      {readOnly ? (
        <FeedbackMessage tone="warning">
          Read-only view. Registry mutations require the owner role. Health evidence and change
          history remain available for inspection.
        </FeedbackMessage>
      ) : null}

      <div
        className="flex flex-wrap gap-1 rounded-lg border bg-background p-1"
        role="tablist"
        aria-label="Operations Registry sections"
      >
        {TABS.map((tab, index) => (
          <button
            key={tab.id}
            id={tabId(tab.id)}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={panelId(tab.id)}
            tabIndex={activeTab === tab.id ? 0 : -1}
            onClick={() => selectTab(tab.id)}
            onKeyDown={(event) => onTabKeyDown(event, index)}
            className={cn(
              "rounded-md px-4 py-2 text-sm font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              activeTab === tab.id
                ? "bg-pale-gold/70 text-navy"
                : "text-steel hover:bg-steel-100 hover:text-navy",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        id={panelId(activeTab)}
        role="tabpanel"
        aria-labelledby={tabId(activeTab)}
        className="outline-none"
      >
        {activeTab === "overview" ? <RegistryOverview /> : null}
        {activeTab === "agents" ? <AgentsManager readOnly={readOnly} /> : null}
        {activeTab === "merchants" ? <MerchantsManager readOnly={readOnly} /> : null}
        {activeTab === "sources" ? <SourceCompaniesManager readOnly={readOnly} /> : null}
        {activeTab === "ringcentral" ? <RingCentralRoutesManager readOnly={readOnly} /> : null}
        {activeTab === "cpl" ? <CplManager readOnly={readOnly} /> : null}
        {activeTab === "changes" ? <RegistryChanges /> : null}
      </div>
    </div>
  );
}
