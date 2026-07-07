"use client";

import { useMemo, useState } from "react";
import { CatalogManager } from "@/components/settings/catalog-manager";
import { CplRateManager } from "@/components/settings/cpl-rate-manager";
import { SourceCompanyManager } from "@/components/settings/source-company-manager";
import { Button } from "@/components/ui/button";

const tabs = [
  {
    id: "source-company",
    label: "Source Company",
    description: "Strategic catalog for labels, granularities, CPL, RingCentral, and sheet routing.",
  },
  {
    id: "catalog",
    label: "Catalog",
    description: "Agents and merchants used by booking workflows and owner filters.",
  },
  {
    id: "cpl-rate",
    label: "CPL Rate",
    description: "Legacy compatibility rates. Prefer Source Company granularities for new edits.",
  },
] as const;

type SettingsTabId = (typeof tabs)[number]["id"];

export function SettingsTabs() {
  const [activeTab, setActiveTab] = useState<SettingsTabId>("source-company");
  const active = useMemo(
    () => tabs.find((tab) => tab.id === activeTab) ?? tabs[0],
    [activeTab],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 rounded-lg border bg-muted/30 p-2">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            type="button"
            variant={activeTab === tab.id ? "default" : "ghost"}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </Button>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">{active.description}</p>
      {activeTab === "source-company" ? <SourceCompanyManager /> : null}
      {activeTab === "catalog" ? <CatalogManager /> : null}
      {activeTab === "cpl-rate" ? <CplRateManager compatibilityMode /> : null}
    </div>
  );
}
