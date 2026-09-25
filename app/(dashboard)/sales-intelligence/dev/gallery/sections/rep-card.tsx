"use client";

import { attentionRowSchema, outreachReadSchema, type AttentionRow } from "@/lib/api/salesIntelligence";
import { ChipView, OutreachCard } from "@/components/sales-intelligence/card";
import { RecordHeaderView, headerChips, headerRow } from "@/components/sales-intelligence/outreach";
import { PreviewBody } from "@/components/sales-intelligence/preview-dialog";
import { ViewerProvider, viewerFromSession } from "@/components/sales-intelligence/rep/viewer";
import { copy } from "@/components/sales-intelligence/sales-intelligence-copy";
import { REP_FIXTURES } from "./rep-fixtures";
import { GallerySection, Sample, Subhead } from "./section";

const DANA = viewerFromSession({ role: "rep", agent_id: "6ab5ab0d72ee2eb383d940a7" });
const row = (key: string): AttentionRow => attentionRowSchema.parse(REP_FIXTURES.rows[key]!.row);
const sFindings = outreachReadSchema.parse(REP_FIXTURES.details.sFindings!.read);
/**
 * The S-findings record with a `restriction` blocker, to show the rep's `Don't call` chip (no date). The chip is shown on
 * its own with a `rep-` id: the gallery's chip test reads the first `data-chip="blocker-restriction"` on the page, and
 * the rep sections come before the chip section.
 */
const blocked = { ...sFindings.data.outreach, derived: { ...sFindings.data.outreach.derived, call_blockers: ["restriction"] } };
const repChips = headerChips(headerRow(blocked), sFindings.as_of, { until: "2026-10-01T16:00:00.000Z" }, true, { rep: true }).map((chip) => ({ ...chip, id: `rep-${chip.id}` }));

const LINE_SEVEN: [string, string][] = [
  ["yours", "Yours (assigned to the rep; wins over another rep's promise)"],
  ["promisedByYou", "Promised by you (another rep is assigned)"],
  ["assignedToOther", "Assigned to {name} (in scope through a follow-up)"],
  ["unassigned", "Unassigned"],
];

/** UI2-SCOPE (UI-2 §3; A04, A05): the card's line 7 and actions for a rep, the rep's record header and side dialog. */
export function RepCardSection() {
  return (
    <GallerySection id="rep-card" title={copy.ui2.gallery.sections["rep-card"]}>
      <ViewerProvider viewer={DANA}>
        <Subhead>Card · line 7 and actions (Dana Reyes)</Subhead>
        {LINE_SEVEN.map(([key, label]) => (
          <Sample key={key} label={label} copyKey={`ui2.scope.${key === "assignedToOther" || key === "unassigned" ? "(ui1.card)" : key} · ${REP_FIXTURES.rows[key]!.source}`} wide>
            <OutreachCard row={row(key)} asOf={REP_FIXTURES.asOf} layout="flat" view="all_outreach" />
          </Sample>
        ))}
        <Sample label="Closed card · Open only" copyKey="ui2.scope.open" wide>
          <OutreachCard row={row("yours")} asOf={REP_FIXTURES.asOf} layout="flat" view="closed" />
        </Sample>
        <Subhead>Record header · no Owner controls</Subhead>
        <Sample label="Call blocker chip for a rep: no date (the Number read is Owner-only), no tip" copyKey="ui2.scope.dontCallNoDate">
          <span className="si-chiprow">{repChips.map((chip) => <ChipView key={chip.id} chip={chip} />)}</span>
        </Sample>
        <Sample label="Provenance line and line 7, no commands / Message rep / Lead progress controls / related records" copyKey={REP_FIXTURES.details.sFindings!.source} wide>
          <RecordHeaderView outreach={sFindings.data.outreach} asOf={sFindings.as_of} returnTo="/sales-intelligence" />
        </Sample>
        <Subhead>Side dialog · no Apply</Subhead>
        <Sample label="Quick look (timeline preview omitted here)" copyKey="ui1.card · ui2.scope" wide>
          <div className="si-gallery__progressbox">
            <PreviewBody row={row("promisedByYou")} asOf={REP_FIXTURES.asOf} />
          </div>
        </Sample>
      </ViewerProvider>
    </GallerySection>
  );
}
