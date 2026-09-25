"use client";

import { useState } from "react";
import { timelineEventSchema, type TimelineEvent } from "@/lib/api/salesIntelligence";
import {
  EVENT_KINDS, EventRow, GENERIC_KIND, TimelineFilters, TimelinePreviewList, TimelinePreviewSkeleton, TimelineSkeleton, TimelineView, kindEntry, kindsForGroups,
  type TimelineGroup,
} from "@/components/sales-intelligence/timeline";
import { copy } from "@/components/sales-intelligence/sales-intelligence-copy";
import { TL_FIXTURES } from "./timeline-fixtures";
import { GallerySection, Sample, Subhead } from "./section";

// UI1-TL gallery samples: one row per registry kind, the Recorded / Recovered / In progress / Job variants, a day with
// Processing details, the filters, the truncated and empty notes, the dialog preview, the skeletons and 390 px.

const tg = copy.ui1.timeline.gallery;
const parse = (item: unknown): TimelineEvent => timelineEventSchema.parse(item);
const page = (key: "capture" | "live" | "day" | "multiLead" | "preview") => {
  const p = TL_FIXTURES[key];
  return { ...p, items: p.items.map(parse) };
};

/** The fixtures' latest instant, as the as_of for the synthetic rows. */
const SYNTHETIC_AS_OF = "2026-09-24T22:59:28.840Z";
const SYNTHETIC_AT = "2026-09-24T18:12:00.000Z";

/**
 * Synthetic items for kinds no fixture shows: server kinds from `TIMELINE_KIND_ORDER` and the S11-TL / later kinds.
 * Titles follow final spec §10.2 and TL-AUDIT §4; they stand in for server copy and are not UI strings.
 */
const SYNTHETIC: Record<string, { title: string; description: string; actor: { kind: string; name: string | null }; detail?: Record<string, unknown> }> = {
  conversation_recorded: { title: "Conversation recorded", description: "A recording of the call was stored; it hasn't been analyzed yet.", actor: { kind: "worker", name: null } },
  followup_cancelled: { title: "Follow-up cancelled · customer asked to stop", description: "The follow-up \"Call back with the estimate\" was cancelled.", actor: { kind: "owner", name: null }, detail: { reason: "customer asked to stop" } },
  reopened: { title: "Reopened", description: "The Owner reopened the work.", actor: { kind: "owner", name: null }, detail: { reason: "Customer called back" } },
  waiting_set: { title: "Waiting on the customer", description: "The Owner set the work to wait for the customer until Sat Sep 26.", actor: { kind: "owner", name: null } },
  review_resolved: { title: "Review resolved", description: "The Owner resolved the review (missing responsibility).", actor: { kind: "owner", name: null } },
  restriction_set: { title: "Calls paused until Sep 30", description: "The Owner paused calls to this number until Wed Sep 30.", actor: { kind: "owner", name: null }, detail: { reason: "Customer asked for time" } },
  restriction_resolved: { title: "Call pause lifted", description: "The Owner lifted the call pause.", actor: { kind: "owner", name: null } },
  nudge_sent: { title: "Message to Dana Reyes · Sent", description: "The Owner messaged Dana Reyes on RingCentral about the callback.", actor: { kind: "owner", name: null } },
  call_started: { title: "Owner call started", description: "The Owner started the call.", actor: { kind: "owner", name: null } },
  call_ended: { title: "Owner call ended", description: "The Owner ended the call.", actor: { kind: "owner", name: null } },
  analysis_submitted: { title: "Analysis submitted", description: "An analysis run was submitted for this call.", actor: { kind: "intelligence", name: null } },
  duplicate_lead_received: { title: "Form submitted again · MoveBuddy (Duplicate Lead)", description: "The customer submitted the MoveBuddy form again; it was saved as a Duplicate Lead and not sent to Granot.", actor: { kind: "customer", name: "Priya Nair" } },
  lead_details_changed: { title: "Move date changed to Oct 30", description: "The move date changed from Oct 24 to Oct 30 in Granot.", actor: { kind: "granot", name: "Marcus B." } },
  booking_changed: { title: "Booking edited · total binder", description: "The Booking's total binder changed from $4,200 to $4,600.", actor: { kind: "vantage", name: null } },
  cancellation_changed: { title: "Cancellation edited · reason", description: "The Cancellation's reason was edited.", actor: { kind: "vantage", name: null } },
  granot_booking_action: { title: "Granot shows the job Booked", description: "Granot's booking action for Job 5590021 changed to Booked.", actor: { kind: "granot", name: null } },
  auto_assigned: { title: "Assigned to Dana Reyes from the receiver agent in Granot", description: "The work was assigned to Dana Reyes, the receiver agent in Granot.", actor: { kind: "vantage", name: null } },
  followup_rescheduled: { title: "Dana Reyes moved the follow-up to Sep 26, 10:00 AM ET", description: "Dana Reyes moved the follow-up from Sep 25 to Sep 26.", actor: { kind: "rep", name: "Dana Reyes" } },
  analysis_published: { title: "Number analysis updated", description: "Customer wants a quote for a 2 bedroom move in late October.", actor: { kind: "intelligence", name: null } },
  reanalysis_requested: { title: "You asked for a new analysis · current context", description: "The Owner asked for a new analysis of the current context.", actor: { kind: "owner", name: null } },
  analysis_reviewed: { title: "You confirmed 2 findings", description: "The Owner confirmed 2 findings of the newest analysis.", actor: { kind: "owner", name: null } },
  followup_redated: { title: "Follow-up date changed", description: "The follow-up moved from Sep 25 to Sep 27.", actor: { kind: "rep", name: "Dana Reyes" } },
  rep_replied: { title: "Dana Reyes replied · Called her, she wants Friday", description: "Dana Reyes replied in the thread.", actor: { kind: "rep", name: "Dana Reyes" } },
  thread_resolved: { title: "Thread resolved · follow-up completed", description: "The thread was resolved when the follow-up was completed.", actor: { kind: "vantage", name: null } },
};

function synthetic(kind: string, group: string): TimelineEvent {
  const s = SYNTHETIC[kind]!;
  return parse({
    id: `synthetic:${kind}`, kind, happened_at: SYNTHETIC_AT, observed_at: SYNTHETIC_AT, title: s.title, description: s.description, group,
    routine: kindEntry(kind).routineDefault, actor: { ...s.actor, agent_id: null }, detail: s.detail ?? {},
  });
}

const GENERIC_ITEM = parse({
  id: "synthetic:made_up_kind", kind: "made_up_kind", happened_at: SYNTHETIC_AT, observed_at: SYNTHETIC_AT, title: "A kind the registry doesn't know",
  description: "Rendered from the server's title, description and group with the generic dot; no detail.", group: "messages", actor: { kind: "vantage", name: null },
});

export type RegistrySample = { kind: string; item: TimelineEvent; asOf: string; source: string; synthetic: boolean };

/** One sample per registry kind: the fixture item when a capture shows the kind, else a synthetic one. */
export function registrySamples(): RegistrySample[] {
  return Object.entries(EVENT_KINDS).map(([kind, e]) => {
    const hit = TL_FIXTURES.kinds[kind];
    return hit
      ? { kind, item: parse(hit.item), asOf: hit.asOf, source: hit.source, synthetic: false }
      : { kind, item: synthetic(kind, e.group), asOf: SYNTHETIC_AS_OF, source: "synthetic", synthetic: true };
  });
}

function RegistryRow({ sample }: { sample: RegistrySample }) {
  const e = kindEntry(sample.kind);
  const Icon = e.icon;
  return (
    <li className="si-gallery__tlentry" data-tl-kind={sample.kind} data-tl-source={e.source} data-tl-pending={e.pending ? "1" : undefined}>
      <span className="si-gallery__tlmeta">
        <code>{sample.kind}</code>
        <span>
          <Icon size={12} aria-hidden /> {Icon.displayName ?? ""}
        </span>
        <span>{e.group}</span>
        {e.routineDefault && <span>{tg.routine}</span>}
        <span>{tg.source[e.source]}</span>
        {e.pending && <strong>{tg.pending(e.pending)}</strong>}
        <code className="si-gallery__key">{sample.source}</code>
      </span>
      <ol className="si-timeline__rows">
        <EventRow item={sample.item} asOf={sample.asOf} />
      </ol>
    </li>
  );
}

function FilterSample() {
  const [groups, setGroups] = useState<TimelineGroup[]>(["calls"]);
  const capture = page("capture");
  return (
    <div data-tl-sample="filters">
      <Sample label={tg.filters} copyKey={`kinds[] = ${kindsForGroups(groups).join(", ") || "(none)"}`} wide>
        <TimelineFilters selected={groups} onChange={setGroups} />
      </Sample>
      <Sample label={tg.filtered} copyKey={capture.source} wide>
        <TimelineView scope="number" items={capture.items} asOf={capture.asOf} filters={<TimelineFilters selected={["calls"]} onChange={() => {}} />} />
      </Sample>
    </div>
  );
}

export function TimelineSection() {
  const g = copy.ui1.gallery;
  const samples = registrySamples();
  const capture = page("capture");
  const live = page("live");
  const day = page("day");
  const multi = page("multiLead");
  const preview = page("preview");
  return (
    <GallerySection id="timeline" title={g.sections.timeline}>
      <Subhead>{tg.registry}</Subhead>
      <p className="si-gallery__note">{tg.registryNote}</p>
      <ol className="si-gallery__tlregistry" data-tl-sample="registry">
        {samples.map((sample) => (
          <RegistryRow key={sample.kind} sample={sample} />
        ))}
        <li className="si-gallery__tlentry" data-tl-kind="(generic)" data-tl-source="generic">
          <span className="si-gallery__tlmeta">
            <code>made_up_kind</code>
            <span>{tg.generic}</span>
            <span>{GENERIC_KIND.icon.displayName ?? ""}</span>
          </span>
          <ol className="si-timeline__rows">
            <EventRow item={GENERIC_ITEM} asOf={SYNTHETIC_AS_OF} />
          </ol>
        </li>
      </ol>

      <Subhead>{tg.variants}</Subhead>
      <div data-tl-sample="variants">
        <Sample label={tg.variantCalls} copyKey={capture.source} wide>
          <ol className="si-timeline__rows">
            {capture.items.map((item) => (
              <EventRow key={item.id} item={item} asOf={capture.asOf} />
            ))}
          </ol>
        </Sample>
        <Sample label={tg.variantLive} copyKey={live.source} wide>
          <ol className="si-timeline__rows">
            {live.items.filter((item) => item.call?.in_progress).map((item) => (
              <EventRow key={item.id} item={item} asOf={live.asOf} />
            ))}
          </ol>
        </Sample>
        <Sample label={tg.variantJob} copyKey={multi.source} wide>
          <TimelineView scope="number" items={multi.items} asOf={multi.asOf} />
        </Sample>
      </div>

      <Subhead>{tg.day}</Subhead>
      <div data-tl-sample="day">
        <Sample copyKey={day.source} wide>
          <TimelineView scope="outreach" items={day.items} asOf={day.asOf} hasMore onLoadMore={() => {}} filters={<TimelineFilters selected={[]} onChange={() => {}} />} />
        </Sample>
      </div>

      <Subhead>{tg.filters}</Subhead>
      <FilterSample />

      <Subhead>{tg.truncated}</Subhead>
      <div data-tl-sample="truncated">
        <Sample copyKey="copy.ui1.timeline.truncated (synthetic truncated_sources)" wide>
          <TimelineView scope="outreach" items={live.items.slice(0, 2)} asOf={live.asOf} truncatedSources={["granot_changes"]} loadMoreFailed />
        </Sample>
      </div>
      <Subhead>{tg.empty}</Subhead>
      <div data-tl-sample="empty">
        <Sample copyKey="copy.ui1.timeline.empty" wide>
          <TimelineView scope="outreach" items={[]} asOf={live.asOf} />
        </Sample>
      </div>

      <Subhead>{tg.preview}</Subhead>
      <div data-tl-sample="preview">
        <Sample copyKey={preview.source} wide>
          <div className="si-gallery__progressbox">
            <TimelinePreviewList outreachId="6ab448740705ca95222b4b0d" items={preview.items} asOf={preview.asOf} />
          </div>
        </Sample>
      </div>

      <Subhead>{tg.skeleton}</Subhead>
      <div data-tl-sample="skeleton">
        <Sample label="Timeline.Skeleton" wide>
          <TimelineSkeleton />
        </Sample>
        <Sample label="TimelinePreview.Skeleton" wide>
          <TimelinePreviewSkeleton />
        </Sample>
      </div>

      <Subhead>{tg.phone}</Subhead>
      <div className="si-gallery__frame" data-frame="390" data-tl-sample="phone">
        <TimelineView scope="outreach" items={day.items} asOf={day.asOf} hasMore onLoadMore={() => {}} truncatedSources={["granot_changes"]} filters={<TimelineFilters selected={["work"]} onChange={() => {}} />} />
        <TimelinePreviewList outreachId="6ab448740705ca95222b4b0d" items={preview.items} asOf={preview.asOf} />
      </div>
    </GallerySection>
  );
}
