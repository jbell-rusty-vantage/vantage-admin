"use client";
/**
 * Setup → Lead costs (doc 19): the Grid (default), Fix past leads and the Old rate book as one `Segmented` held in
 * `?view=grid|fix|old`. `?focus=<feed id>` (also `?feed=`) is the *Set lead cost* deep link: it focuses that row's New
 * amount input. `?entity=<job id>` from old links opens that job under Fix past leads.
 */
import { useSearchParams } from "next/navigation";
import { useUrlState } from "@/components/records";
import { Segmented } from "@/components/ui/crm/primitives";
import { SetupSectionHead, useSetupReadOnly } from "@/components/setup/setup-shell";
import { FixPastLeads } from "./fix-past-leads";
import { LeadCostsGrid } from "./lead-costs-grid";
import { LEAD_COSTS_COPY } from "./lead-costs-copy";
import { OldRateBook } from "./old-rate-book";

export type LeadCostsView = "grid" | "fix" | "old";

export function parseLeadCostsView(value: string | null): LeadCostsView {
  return value === "fix" || value === "old" ? value : "grid";
}

const VIEW_OPTIONS = [
  { value: "grid", label: LEAD_COSTS_COPY.views.grid },
  { value: "fix", label: LEAD_COSTS_COPY.views.fix },
  { value: "old", label: LEAD_COSTS_COPY.views.old },
] as const satisfies readonly { value: LeadCostsView; label: string }[];

const viewPatch = (patch: { view: LeadCostsView }) => ({ view: patch.view === "grid" ? null : patch.view, focus: null, feed: null, entity: null });

export function LeadCostsSection() {
  const searchParams = useSearchParams();
  const readOnly = useSetupReadOnly();
  const setView = useUrlState(viewPatch);
  const view = parseLeadCostsView(searchParams.get("view"));
  const focusFeedId = searchParams.get("focus") ?? searchParams.get("feed");

  return (
    <>
      <SetupSectionHead
        section="lead-costs"
        right={<Segmented<LeadCostsView> label={LEAD_COSTS_COPY.viewsLabel} options={VIEW_OPTIONS} value={view} onChange={(next) => setView({ view: next })} />}
      />
      {view === "grid" ? <LeadCostsGrid readOnly={readOnly} focusFeedId={focusFeedId} /> : null}
      {view === "fix" ? <FixPastLeads readOnly={readOnly} initialJobId={searchParams.get("entity")} /> : null}
      {view === "old" ? <OldRateBook /> : null}
    </>
  );
}
