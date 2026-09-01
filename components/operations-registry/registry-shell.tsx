"use client";

import type { KeyboardEvent } from "react";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useDashboardRole } from "@/components/layout/dashboard-role-context";
import { CarrierManager } from "@/components/settings/carrier-manager";
import { CplRateManager } from "@/components/settings/cpl-rate-manager";
import { FeedbackMessage } from "@/components/ui/feedback";
import { cn } from "@/lib/utils";
import { AgentsManager } from "./agents-manager";
import { CplManager } from "./cpl-manager";
import { MerchantsManager } from "./merchants-manager";
import { RegistryChanges } from "./registry-changes";
import { RegistryOverview } from "./registry-overview";
import { RingCentralRoutesManager } from "./ringcentral/routes-list";
import { GranotCrmSourcesManager } from "./granot-crm-sources-manager";
import { LeadSourcesManager } from "./lead-sources/lead-sources-manager";
import {
  isLegacyRegistryTab,
  parseRegistryTab,
  REGISTRY_TABS,
  type RegistryTab,
} from "./registry-tabs";

export type { RegistryTab };
export { REGISTRY_TABS };

const TABS = REGISTRY_TABS;

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
  const rawTab = searchParams.get("tab");
  const activeTab = parseRegistryTab(rawTab);
  const readOnly = role !== "owner";

  function selectTab(tab: RegistryTab) {
    const params = new URLSearchParams();
    if (tab !== "overview") {
      params.set("tab", tab);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  useEffect(() => {
    if (isLegacyRegistryTab(rawTab)) {
      selectTab(activeTab);
    }
    // Redirect once when an old ?tab= value is present.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawTab]);

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
          Owner-managed catalog of agents, merchants, lead sources, Granot names, inbound numbers,
          moving carriers, and lead costs. Legacy CPL is a read-only compatibility view. Changes are
          audited and dependency-aware.
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
        {activeTab === "lead-sources" ? <LeadSourcesManager readOnly={readOnly} /> : null}
        {activeTab === "granot-names" ? <GranotCrmSourcesManager readOnly={readOnly} /> : null}
        {activeTab === "inbound-numbers" ? <RingCentralRoutesManager readOnly={readOnly} /> : null}
        {activeTab === "moving-carriers" ? <CarrierManager readOnly={readOnly} /> : null}
        {activeTab === "lead-costs" ? <CplManager readOnly={readOnly} /> : null}
        {activeTab === "legacy-cpl" ? (
          <div className="space-y-3">
            <FeedbackMessage tone="warning">
              Legacy CPL rates are compatibility-only. Prefer{" "}
              <Link href="/operations-registry?tab=lead-costs" className="font-medium underline">
                Operations Registry → Lead costs
              </Link>{" "}
              for schedule edits and corrections.
            </FeedbackMessage>
            <CplRateManager compatibilityMode />
          </div>
        ) : null}
        {activeTab === "changes" ? <RegistryChanges /> : null}
      </div>
    </div>
  );
}
