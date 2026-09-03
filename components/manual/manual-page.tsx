"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { ConnectBookingSection } from "./connect-booking-section";
import { CreateLeadForm } from "./create-lead-form";
import { MANUAL_COPY } from "./manual-copy";
import { MANUAL_TABS, manualTabHref, parseManualTab } from "./manual-tabs";

export function ManualPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = parseManualTab(searchParams.get("tab"));

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Manual</h1>
        <p className="mt-1 text-sm text-muted-foreground">{MANUAL_COPY.pageHint}</p>
      </div>
      <div className="flex flex-wrap gap-1 rounded-lg border bg-background p-1" role="tablist">
        {MANUAL_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => router.push(tab.id === "create" ? pathname : manualTabHref(tab.id))}
            className={cn(
              "rounded-md px-4 py-2 text-sm font-semibold transition-colors",
              activeTab === tab.id
                ? "bg-pale-gold/70 text-navy"
                : "text-steel hover:bg-steel-100 hover:text-navy",
            )}
          >
            {tab.id === "create" ? MANUAL_COPY.createTab : MANUAL_COPY.attachTab}
          </button>
        ))}
      </div>
      {activeTab === "create" ? (
        <section className="rounded-lg border bg-background p-4">
          <CreateLeadForm />
        </section>
      ) : (
        <section className="rounded-lg border bg-background p-4">
          <ConnectBookingSection />
        </section>
      )}
    </div>
  );
}
