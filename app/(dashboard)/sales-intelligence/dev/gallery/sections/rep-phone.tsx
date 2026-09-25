"use client";

import { attentionRowSchema, outreachReadSchema } from "@/lib/api/salesIntelligence";
import { OutreachCard } from "@/components/sales-intelligence/card";
import { parseDeskUrl } from "@/components/sales-intelligence/data/url-state";
import { JumpSelect } from "@/components/sales-intelligence/primitives";
import { FilterSheet, RailRegions, railRegionsFor } from "@/components/sales-intelligence/rail";
import { Sheet } from "@/components/sales-intelligence/primitives";
import { RepFollowupSheet } from "@/components/sales-intelligence/rep/followup-actions";
import { ViewerProvider, viewerFromSession } from "@/components/sales-intelligence/rep/viewer";
import { copy } from "@/components/sales-intelligence/sales-intelligence-copy";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { REP_FIXTURES } from "./rep-fixtures";
import { GallerySection, Sample, Subhead } from "./section";

const DANA = viewerFromSession({ role: "rep", agent_id: "6ab5ab0d72ee2eb383d940a7" });
const ph = copy.ui2.phone;
const ANALYSIS_ITEMS = [
  { id: "situation", label: copy.ui1.analysis.frame.sections.situation },
  { id: "scores", label: copy.ui1.analysis.frame.sections.scores },
  { id: "move-details", label: copy.ui1.analysis.frame.sections.move },
  { id: "findings", label: copy.ui1.analysis.frame.sections.findings },
  { id: "conversations", label: copy.ui1.analysis.frame.sections.conversations },
];
const noop = () => {};

/**
 * UI2-PHONE (UI-2 §7; A11): the 390 px pieces. Turn on the gallery's `390 px frame` to see the stacked card; the sheets are
 * shown in place (`inline`) so a screenshot reads without opening them. The real `Filters` button opens the bottom sheet.
 */
export function RepPhoneSection() {
  const [client] = useState(() => new QueryClient());
  const [value, setValue] = useState(() => parseDeskUrl(new URLSearchParams("view=all_outreach&band=2"), "rep"));
  const regions = railRegionsFor("all_outreach", true);
  const own = outreachReadSchema.parse(REP_FIXTURES.details.own!.read);
  const ownFollowup = own.data.outreach.followups.find((f) => f.status === "open")!;
  return (
    <GallerySection id="rep-phone" title={copy.ui2.gallery.sections["rep-phone"]}>
      <QueryClientProvider client={client}>
        <ViewerProvider viewer={DANA}>
          <Subhead>Card (stacked lines, two full-width actions below 480 px)</Subhead>
          <Sample label="Rep card at 390 px" copyKey={`ui2.scope.open · ${REP_FIXTURES.rows.yours!.source}`}>
            <div style={{ maxWidth: 390 }}>
              <OutreachCard row={attentionRowSchema.parse(REP_FIXTURES.rows.yours!.row)} asOf={REP_FIXTURES.asOf} layout="flat" view="all_outreach" />
            </div>
          </Sample>
          <Subhead>Filters (bottom sheet)</Subhead>
          <Sample label="The Filters button (opens the real sheet)" copyKey="ui2.phone.filters · ui2.phone.filtersCount">
            <FilterSheet regions={regions} value={value} onChange={(patch) => setValue((old) => ({ ...old, ...patch }))} reps={[]} asOf={REP_FIXTURES.asOf} alwaysShown />
          </Sample>
          <Sample label="The sheet, in place: Clear all · Show results, 44 px rows" copyKey="ui2.phone.filtersTitle · ui2.phone.clearAll · ui2.phone.showResults" wide>
            <Sheet
              open
              inline
              variant="bottom"
              onClose={noop}
              title={ph.filtersTitle}
              footer={(
                <>
                  <button type="button" className="si-btn si-btn--secondary si-btn--md si-hit">{ph.clearAll}</button>
                  <button type="button" className="si-btn si-btn--primary si-btn--md si-hit">{ph.showResults}</button>
                </>
              )}
            >
              <RailRegions regions={regions} value={value} onChange={(patch) => setValue((old) => ({ ...old, ...patch }))} reps={[]} asOf={REP_FIXTURES.asOf} />
            </Sheet>
          </Sample>
          <Subhead>Analysis sub-nav below 768 px</Subhead>
          <Sample label="Jump to (a rep's sections: no Full output)" copyKey="ui2.phone.jumpTo">
            <JumpSelect items={ANALYSIS_ITEMS} label={ph.jumpTo} className="si-jump--static" />
          </Sample>
          <Subhead>Follow-up sheet (full screen at 390 px)</Subhead>
          <Sample label="Change date, note filled: Send enabled once a date is picked" copyKey="ui2.followup.titles.patch_followup" wide>
            <div style={{ maxWidth: 390 }}>
              <RepFollowupSheet action="patch_followup" followup={ownFollowup} outreachId={own.data.outreach.id} asOf={own.as_of} open onClose={noop} onDone={noop} initialNote="Customer asked for Monday" send={() => Promise.resolve()} inline />
            </div>
          </Sample>
        </ViewerProvider>
      </QueryClientProvider>
    </GallerySection>
  );
}
