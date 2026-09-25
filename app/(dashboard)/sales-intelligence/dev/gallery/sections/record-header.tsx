"use client";

import { outreachReadSchema, type Outreach } from "@/lib/api/salesIntelligence";
import { OutreachNotFound, OutreachRouteSkeleton, RecordHeaderView } from "@/components/sales-intelligence/outreach";
import { RecordProvenance } from "@/components/sales-intelligence/lead-provenance";
import { copy } from "@/components/sales-intelligence/sales-intelligence-copy";
import { formatExact } from "@/components/sales-intelligence/lib/time";
import { RECORD_HEADER_FIXTURES } from "./record-header-fixtures";
import { GallerySection, Sample, Subhead } from "./section";

const g = copy.ui1.outreach.gallery;
const noop = () => {};
const RETURN = "/sales-intelligence/outreach/gallery?tab=analysis";

function read(key: keyof typeof RECORD_HEADER_FIXTURES) {
  const entry = RECORD_HEADER_FIXTURES[key];
  const parsed = outreachReadSchema.parse(entry.read);
  return { outreach: parsed.data.outreach, asOf: parsed.as_of, source: entry.source };
}

/** Synthetic provenance variants of the Owner Kept record (the S11 fixtures carry the real `is_the_lead`). */
function withProvenance(o: Outreach, state: string, noNumber = false): Outreach {
  return { ...o, primary_number: noNumber ? null : o.primary_number, derived: { ...o.derived, provenance_state: state } };
}

const PROVENANCE: { id: string; state: string; noNumber?: boolean }[] = [
  { id: "is_the_lead", state: "is_the_lead" },
  { id: "is_the_lead_no_number", state: "is_the_lead", noNumber: true },
  { id: "needs_a_lead", state: "needs_a_lead" },
  { id: "ambiguous", state: "ambiguous" },
  { id: "attached_by_you", state: "attached_by_you" },
];

export function RecordHeaderSection() {
  const kept = read("ownerKept");
  const live = read("liveCall");
  return (
    <GallerySection id="record-header" title={copy.ui1.gallery.sections["record-header"]}>
      <Subhead>{g.header}</Subhead>
      <Sample copyKey={kept.source} wide>
        <RecordHeaderView outreach={kept.outreach} asOf={kept.asOf} returnTo={RETURN} onCommand={noop} onMessageRep={noop} messageRepDisabledReason={null} />
      </Sample>
      <Subhead>{g.live}</Subhead>
      <Sample copyKey={live.source} wide>
        <RecordHeaderView outreach={live.outreach} asOf={live.asOf} returnTo={RETURN} onCommand={noop} onMessageRep={noop} messageRepDisabledReason={copy.ui1.chat.noRep} />
      </Sample>
      <Subhead>{g.provenanceTitle}</Subhead>
      {PROVENANCE.map((p) => (
        <Sample key={p.id} label={g.states[p.id]} copyKey="copy.ui1.outreach.provenance">
          <RecordProvenance record={withProvenance(kept.outreach, p.state, p.noNumber)} asOfText={(t) => formatExact(t, kept.asOf)} />
        </Sample>
      ))}
      <Subhead>{g.skeleton}</Subhead>
      <Sample wide>
        <OutreachRouteSkeleton />
      </Sample>
      <Subhead>{g.notFound}</Subhead>
      <Sample copyKey="copy.ui1.outreach.notFound">
        <OutreachNotFound back="/sales-intelligence" />
      </Sample>
    </GallerySection>
  );
}
