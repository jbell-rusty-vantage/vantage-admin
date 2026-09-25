"use client";

import { overviewSchema, type Overview } from "@/lib/api/salesIntelligence";
import { OverviewView, RepMediansBlock } from "@/components/sales-intelligence/overview";
import { ViewerProvider, viewerFromSession } from "@/components/sales-intelligence/rep/viewer";
import { copy } from "@/components/sales-intelligence/sales-intelligence-copy";
import { REP_FIXTURES } from "./rep-fixtures";
import { GallerySection, Sample } from "./section";

const DANA = viewerFromSession({ role: "rep", agent_id: "6ab5ab0d72ee2eb383d940a7" });
const data = overviewSchema.parse(REP_FIXTURES.overview.read).data;
/** The same read with every median null: fewer than 4 contributing reps (V-T3 M9). */
const allNull: Overview = { ...data, team_medians: Object.fromEntries(Object.entries(data.team_medians ?? {}).map(([key, value]) => [key, key === "reps" ? value : null])) };
const noop = () => {};

/** UI2-OVERVIEW (UI-2 §6; A08): the rep's Overview, and the You | Team median block with every median null. */
export function RepOverviewSection() {
  return (
    <GallerySection id="rep-overview" title={copy.ui2.gallery.sections["rep-overview"]}>
      <ViewerProvider viewer={DANA}>
        <Sample label="Rep Overview (Dana Reyes): Your records now · Your desk health · You and the team · Your Lead spend" copyKey={`ui2.overview · ${REP_FIXTURES.overview.source}`} wide>
          <OverviewView data={data} period={{ period: null, from: null, to: null }} preset={{ priority: data.filters.priority ?? [], attachment: null }} onPeriod={noop} onPreset={noop} />
        </Sample>
        <Sample label="Every median null (fewer than 4 contributing reps): `—` and the note" copyKey="ui2.overview.mediansNote" wide>
          <RepMediansBlock data={allNull} />
        </Sample>
      </ViewerProvider>
    </GallerySection>
  );
}
