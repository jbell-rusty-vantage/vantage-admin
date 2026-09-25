"use client";

import { ViewTabs } from "@/components/sales-intelligence/desk/view-tabs";
import { OutreachNotFound } from "@/components/sales-intelligence/outreach/page-states";
import { RepGuide } from "@/components/sales-intelligence/rep/rep-guide";
import { ViewerProvider, viewerFromSession } from "@/components/sales-intelligence/rep/viewer";
import { GallerySection, Sample } from "./section";
import { copy } from "@/components/sales-intelligence/sales-intelligence-copy";

const DANA = viewerFromSession({ role: "rep", agent_id: "6ab5ab0d72ee2eb383d940a7" });

/** UI2-SHELL (UI-2 §1–§2): the rep's view bar on each view, the not-available page and the rep Guide. */
export function RepShellSection() {
  return (
    <GallerySection id="rep-shell" title={copy.ui2.gallery.sections["rep-shell"]}>
      <ViewerProvider viewer={DANA}>
        <Sample label="View bar · My work (landing)" copyKey="ui2.shell.views" wide>
          <ViewTabs active="attention" query="" role="rep" />
        </Sample>
        <Sample label="View bar · Closed" copyKey="ui2.shell.views" wide>
          <ViewTabs active="closed" query="" role="rep" />
        </Sample>
        <Sample label="Not available (out of scope or missing: the same 404)" copyKey="ui2.shell.notAvailable" wide>
          <OutreachNotFound back="/sales-intelligence" />
        </Sample>
        <Sample label="Guide" copyKey="ui2.guide" wide>
          <RepGuide />
        </Sample>
      </ViewerProvider>
    </GallerySection>
  );
}
