"use client";

import type { ReactNode } from "react";
import { attentionRowSchema, type AttentionRow } from "@/lib/api/salesIntelligence";
import { OutreachCard, type OutreachCardProps } from "@/components/sales-intelligence/card";
import { PreviewBody } from "@/components/sales-intelligence/preview-dialog";
import { BandBadge } from "@/components/sales-intelligence/primitives";
import { copy } from "@/components/sales-intelligence/sales-intelligence-copy";
import { formatRelative } from "@/components/sales-intelligence/lib/time";
import { CARD_FIXTURES } from "./card-fixtures";
import { GallerySection, Sample, Subhead } from "./section";

type FixtureKey = keyof typeof CARD_FIXTURES & string;
const noop = () => {};
const cg = copy.ui1.card.gallery;

function fixture(key: FixtureKey): { row: AttentionRow; asOf: string; source: string } {
  const entry = CARD_FIXTURES[key]!;
  return { row: attentionRowSchema.parse(entry.row), asOf: entry.asOf, source: entry.source };
}

const LAST_CALL = copy.ui1.data.sorts.last_call;
/** The sort line's value as the desk would pass it: the row's `sort_keys.last_call`, relative to `as_of`. */
function leadLastCall(): string | null {
  const { row, asOf } = fixture("lead");
  return row.sort_keys?.last_call ? formatRelative(row.sort_keys.last_call, asOf) : null;
}

/** Documented synthetic variants: no fixture row has `call_progress` without `live_call`, or a `restriction` blocker. */
function ownerCallingOnly(row: AttentionRow): AttentionRow {
  return { ...row, outreach: row.outreach ? { ...row.outreach, live_call: null } : null };
}
function withRestriction(row: AttentionRow): AttentionRow {
  return { ...row, derived: { ...row.derived, call_blockers: ["restriction", ...row.derived.call_blockers] } };
}

export type CardSample = {
  id: string;
  fixture: FixtureKey;
  source?: string;
  transform?: (row: AttentionRow) => AttentionRow;
  props?: Partial<OutreachCardProps>;
};

/** Every card state the brief lists, each from a fixture row (UI1-CARD evidence names the row). */
export const CARD_SAMPLES: CardSample[] = [
  { id: "lead", fixture: "lead", props: { layout: "flat" } },
  { id: "number-only", fixture: "numberOnly" },
  { id: "number-review", fixture: "numberReview" },
  { id: "nulls", fixture: "nulls" },
  { id: "live", fixture: "live" },
  { id: "live-both", fixture: "liveAndOwner" },
  { id: "owner-calling", fixture: "liveAndOwner", transform: ownerCallingOnly, source: "synthetic from S5c T3 Live Caller" },
  { id: "blocker", fixture: "uncertain5" },
  { id: "blocker-restriction", fixture: "uncertain5", transform: withRestriction, source: "synthetic from S6 T3 P5 Uncertain" },
  { id: "disagree-newer", fixture: "disagreeNewer" },
  { id: "stale", fixture: "stale" },
  { id: "retry", fixture: "retry" },
  { id: "default", fixture: "default" },
  { id: "suggestion", fixture: "suggestion" },
  { id: "crm-receiver", fixture: "crmReceiver" },
  { id: "promised", fixture: "promised" },
  { id: "closed", fixture: "closed", props: { view: "closed", layout: "flat" } },
  { id: "sort-line", fixture: "lead", props: { layout: "flat", sortLine: { label: LAST_CALL.label, value: leadLastCall(), nullLabel: LAST_CALL.null } } },
  { id: "sort-line-null", fixture: "nulls", props: { layout: "flat", sortLine: { label: LAST_CALL.label, value: null, nullLabel: LAST_CALL.null } } },
];

function Card({ sample }: { sample: CardSample }) {
  const { row, asOf } = fixture(sample.fixture);
  return (
    <OutreachCard
      row={sample.transform ? sample.transform(row) : row}
      asOf={asOf}
      layout="grouped"
      view="all_outreach"
      onOpen={noop}
      onMessageRep={noop}
      onApplySuggestion={noop}
      {...sample.props}
    />
  );
}

function SampleCard({ sample }: { sample: CardSample }): ReactNode {
  const source = sample.source ?? CARD_FIXTURES[sample.fixture]!.source;
  return (
    <div data-card-sample={sample.id}>
      <Sample label={cg.samples[sample.id] ?? sample.id} copyKey={source} wide>
        <Card sample={sample} />
      </Sample>
    </div>
  );
}

const PHONE = ["lead", "live", "number-only", "blocker"];

export function CardSection() {
  const g = copy.ui1.gallery;
  const grouped = fixture("lead");
  const band = grouped.row.derived.attention_band;
  const preview = fixture("liveAndOwner");
  return (
    <GallerySection id="card" title={g.sections.card}>
      <p className="si-gallery__note">{cg.note}</p>
      <Subhead>{cg.states}</Subhead>
      <div className="si-gallery__body">
        {CARD_SAMPLES.map((sample) => (
          <SampleCard key={sample.id} sample={sample} />
        ))}
      </div>
      <Subhead>{cg.groupedVsFlat}</Subhead>
      <div className="si-gallery__grid" data-card-sample="grouped-vs-flat">
        <Sample label={cg.grouped} copyKey={grouped.source} wide>
          {band != null && band >= 1 && band <= 7 && <BandBadge band={band as 1 | 2 | 3 | 4 | 5 | 6 | 7} variant="header" count={1} />}
          <OutreachCard row={grouped.row} asOf={grouped.asOf} layout="grouped" view="attention" onOpen={noop} onMessageRep={noop} />
        </Sample>
        <Sample label={cg.flat} copyKey={grouped.source} wide>
          <OutreachCard row={grouped.row} asOf={grouped.asOf} layout="flat" view="all_outreach" onOpen={noop} onMessageRep={noop} />
        </Sample>
      </div>
      <Subhead>{cg.skeleton}</Subhead>
      <div data-card-sample="skeleton">
        <Sample label={cg.skeletonLabel} copyKey="CardShell.Skeleton" wide>
          <OutreachCard.Skeleton />
        </Sample>
      </div>
      <Subhead>{cg.dialog}</Subhead>
      <div data-card-sample="preview">
        <Sample label={cg.dialogLabel} copyKey={preview.source} wide>
          <div className="si-gallery__progressbox">
            <PreviewBody row={preview.row} asOf={preview.asOf} />
          </div>
        </Sample>
      </div>
      <Subhead>{cg.phone}</Subhead>
      <div className="si-gallery__frame" data-frame="390" data-card-sample="phone">
        <div className="si-gallery__body">
          {CARD_SAMPLES.filter((s) => PHONE.includes(s.id)).map((sample) => (
            <Card key={sample.id} sample={sample} />
          ))}
          <OutreachCard.Skeleton />
        </div>
      </div>
    </GallerySection>
  );
}
