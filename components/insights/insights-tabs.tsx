"use client";
/**
 * Insights (doc 01): two read-only surfaces that both "look at the past". Analytics is charts; Sheets is "send it to
 * Google". The reporting sub-pages keep their `/reporting/*` routes; `/insights/sheets` is their front door.
 */
import { usePathname } from "next/navigation";
import { BarChart3, Sheet } from "lucide-react";
import { Tabs } from "@/components/ui/crm";

export type InsightsTab = "analytics" | "sheets";

export const INSIGHTS_HREFS: Record<InsightsTab, string> = {
  analytics: "/insights",
  sheets: "/insights/sheets",
};

export function insightsTabForPath(pathname: string): InsightsTab {
  if (pathname === "/insights/sheets" || pathname.startsWith("/insights/sheets/") || pathname === "/reporting" || pathname.startsWith("/reporting/")) {
    return "sheets";
  }
  return "analytics";
}

export function InsightsTabs() {
  const pathname = usePathname() ?? "";
  const active = insightsTabForPath(pathname);
  return (
    <Tabs<InsightsTab>
      label="Insights"
      value={active}
      hrefFor={(tab) => INSIGHTS_HREFS[tab]}
      tabs={[
        { value: "analytics", label: "Analytics", icon: BarChart3 },
        { value: "sheets", label: "Sheets", icon: Sheet },
      ]}
    />
  );
}
