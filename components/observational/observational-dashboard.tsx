"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { ObservationalOverview } from "./observational-overview";
import { ObservationalEventsTable } from "./observational-events-table";
import { ObservationalIncidentsTable } from "./observational-incidents-table";
import { ObservationalReports } from "./observational-reports";
import { ObservationalNotificationsTable } from "./observational-notifications-table";
import { ObservationalSheetSync } from "./observational-sheet-sync";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "events", label: "Events" },
  { id: "incidents", label: "Incidents" },
  { id: "reports", label: "Reports" },
  { id: "notifications", label: "Notifications" },
  { id: "sheet-sync", label: "Sheet Sync" },
] as const;

export type ObservationalTab = (typeof TABS)[number]["id"];

function parseTab(value: string | null): ObservationalTab {
  return (TABS.some((tab) => tab.id === value) ? value : "overview") as ObservationalTab;
}

export function ObservationalDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = parseTab(searchParams.get("tab"));

  function selectTab(tab: ObservationalTab) {
    // Tabs own different filter vocabularies (event level vs incident status
    // vs notification purpose), so switching tabs drops the previous tab's
    // query params instead of letting them leak into the next request.
    router.push(tab === "overview" ? pathname : `${pathname}?tab=${tab}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Observational</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Server and workflow health: operational events, incidents, owner notifications,
          deterministic reports, and sheet sync status.
        </p>
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg border bg-background p-1" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => selectTab(tab.id)}
            className={cn(
              "rounded-md px-4 py-2 text-sm font-semibold transition-colors",
              activeTab === tab.id
                ? "bg-pale-gold/70 text-navy"
                : "text-steel hover:bg-steel-100 hover:text-navy",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" ? <ObservationalOverview /> : null}
      {activeTab === "events" ? <ObservationalEventsTable /> : null}
      {activeTab === "incidents" ? <ObservationalIncidentsTable /> : null}
      {activeTab === "reports" ? <ObservationalReports /> : null}
      {activeTab === "notifications" ? <ObservationalNotificationsTable /> : null}
      {activeTab === "sheet-sync" ? <ObservationalSheetSync /> : null}
    </div>
  );
}
