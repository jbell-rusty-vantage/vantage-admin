"use client";

import Link from "next/link";
import { useState } from "react";
import { CarrierManager } from "@/components/settings/carrier-manager";
import { CplRateManager } from "@/components/settings/cpl-rate-manager";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback";

const tabs = [
  {
    id: "moving-carriers",
    label: "Moving Carriers",
    description: "Carrier DOT/MC collection, manual edits, and CSV imports for the main site table.",
  },
  {
    id: "legacy-cpl",
    label: "Legacy CPL",
    description: "Read-only compatibility view of seeded CPL rates. New edits belong in Operations Registry.",
  },
] as const;

type SettingsTabId = (typeof tabs)[number]["id"];

export function SettingsTabs() {
  const [activeTab, setActiveTab] = useState<SettingsTabId>("moving-carriers");
  const active = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  return (
    <div className="space-y-4">
      <FeedbackMessage tone="info">
        Agents, merchants, source companies, granularities, RingCentral queue numbers, and CPL
        schedules are managed in{" "}
        <Link href="/operations-registry" className="font-medium underline">
          Operations Registry
        </Link>
        . This page keeps moving-carrier maintenance and legacy CPL compatibility only.
      </FeedbackMessage>

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
      {activeTab === "moving-carriers" ? <CarrierManager /> : null}
      {activeTab === "legacy-cpl" ? (
        <div className="space-y-3">
          <FeedbackMessage tone="warning">
            Legacy CPL rates are compatibility-only. Prefer{" "}
            <Link href="/operations-registry?tab=cpl" className="font-medium underline">
              Operations Registry → CPL
            </Link>{" "}
            for schedule edits and corrections.
          </FeedbackMessage>
          <CplRateManager compatibilityMode />
        </div>
      ) : null}
    </div>
  );
}
