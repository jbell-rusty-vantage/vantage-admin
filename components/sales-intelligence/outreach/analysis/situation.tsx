"use client";
/**
 * UI1-TOP: Situation (final spec §11.1, UI-1 §5.2). The card's lines 1–4 and 6–7, the newest analysis's overview
 * (server-cut at 280 characters) with its label, the official status line (`Official: …`, `Granot Priority …`,
 * `Lead cost $…`), and `Records disputed on a call ({n})` from the newest run's presentation. Every word here is a
 * server value or a copy key; the browser derives no state.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import type { OutreachRead } from "@/lib/api/salesIntelligence";
import type { SummaryFindingsSection } from "@/lib/api/salesIntelligenceAssessment";
import { useOutreach } from "../../data/use-outreach";
import { useRunPresentation } from "../../data/use-run";
import { LineOne, LineSeven, LineSix, LineThree, countsText, identityText, outreachHref, routeText, type CardRow } from "../../card";
import { copy } from "../../sales-intelligence-copy";
import { officialRecordHref } from "../../lib/official-record";
import { etDateKey, formatDate, formatExactFull } from "../../lib/time";
import { Region, RegionProgress, SkeletonLines } from "../../primitives";
import { ViewEvidence, refIds } from "./cite";

type Outreach = OutreachRead["data"]["outreach"];
export type Discrepancy = SummaryFindingsSection["story_discrepancies"][number];

const s = copy.ui1.analysis.situation;
const SEP = " · ";

/** The Outreach route's timeline tab, pointed at one event (`story_event_id` is the timeline item id). */
export const timelineEventHref = (outreachId: string, eventId: string) => `${outreachHref(outreachId)}?tab=timeline&event=${encodeURIComponent(eventId)}`;

/** `Lead cost $40`, `Lead cost $35 (legacy price)`, `Lead cost $0 (unpriced)`; null (omitted) when `lead_cost` is null. */
export function leadCostText(cost: Outreach["lead_cost"]): string | null {
  if (!cost) return null;
  const amount = s.leadCost(cost.amount.toLocaleString("en-US", { maximumFractionDigits: 2 }));
  const basis = s.leadCostBasis[cost.basis];
  return basis ? `${amount} ${basis}` : amount;
}

/** `Latest analysis, Sep 22 · 3 conversations` / `From the conversation on Sep 12`; the accessible label carries the exact time. */
export function summaryLabel(summary: NonNullable<Outreach["latest_summary"]>, asOf: string): { text: string; label: string } {
  const make = (date: string) =>
    summary.conversations_covered === 1 ? s.fromConversation(date) : summary.conversations_covered == null ? s.latestNoCount(date) : s.latest(date, summary.conversations_covered);
  return { text: make(formatDate(etDateKey(summary.completed_at), asOf)), label: make(formatExactFull(summary.completed_at)) };
}

function OfficialLine({ outreach }: { outreach: Outreach }) {
  const official = outreach.official;
  const cost = leadCostText(outreach.lead_cost);
  if (!official && !cost) return null;
  const parts: ReactNode[] = [];
  if (official) {
    parts.push(<span key="status" data-official={official.status}>{`${s.official} ${s.status[official.status] ?? official.status}`}</span>);
    if (official.booking_id) {
      parts.push(
        <Link key="booking" className="si-link si-hit si-situation__link" href={officialRecordHref("BookedLead", official.booking_id, outreachHref(outreach.id))}>
          {s.openBooking}
        </Link>,
      );
    }
    if (official.priority) parts.push(<span key="priority" data-priority={official.priority.code}>{s.priority(official.priority.code, official.priority.label)}</span>);
  }
  if (cost) parts.push(<span key="cost" data-lead-cost={outreach.lead_cost?.basis}>{cost}</span>);
  return (
    <p className="si-situation__official">
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 && SEP}
          {part}
        </span>
      ))}
    </p>
  );
}

/** The card's lines 1–4 and 6–7, read from the detail's own `outreach` (the same DTO as an attention row). */
function CardLines({ outreach, asOf }: { outreach: Outreach; asOf: string }) {
  const row: CardRow = { subject_key: "", subject: outreach.subject, outreach, derived: outreach.derived };
  const route = routeText(outreach, asOf);
  return (
    <div className="si-situation__lines" data-lines="1-4,6-7">
      <p className="si-situation__line si-situation__line--1"><LineOne row={row} asOf={asOf} layout="flat" identity={identityText(outreach)} /></p>
      {route && <p className="si-situation__line">{route}</p>}
      <p className="si-situation__line"><LineThree o={outreach} asOf={asOf} /></p>
      <p className="si-situation__line">{countsText(outreach)}</p>
      <p className="si-situation__line"><LineSix o={outreach} asOf={asOf} /></p>
      <p className="si-situation__line"><LineSeven row={row} o={outreach} asOf={asOf} /></p>
    </div>
  );
}

/** Situation without the disputed-records block: lines, overview, official line. */
export function SituationBody({ outreach, asOf, cardLines = true }: { outreach: Outreach; asOf: string; cardLines?: boolean }) {
  const summary = outreach.latest_summary ?? null;
  const label = summary ? summaryLabel(summary, asOf) : null;
  return (
    <div className="si-situation">
      {cardLines && <CardLines outreach={outreach} asOf={asOf} />}
      {summary && label ? (
        <div className="si-situation__summary" data-run-kind={summary.run_kind}>
          <p className="si-situation__label si-text--sm">
            <time dateTime={summary.completed_at} title={formatExactFull(summary.completed_at)} aria-label={label.label}>{label.text}</time>
          </p>
          <p className="si-situation__overview">{summary.overview}</p>
        </div>
      ) : (
        !outreach.newest_run_id && <p className="si-situation__none si-text--subtle" data-empty="no-analysis">{s.none}</p>
      )}
      <OfficialLine outreach={outreach} />
    </div>
  );
}

/** `Records disputed on a call ({n})`: `{claim} · View evidence · Show in timeline`. Omitted when the list is empty. */
export function DisputedRecords({ outreachId, runId, items }: { outreachId: string; runId: string; items: readonly Discrepancy[] }) {
  if (!items.length) return null;
  return (
    <div className="si-situation__disputed" data-disputed={items.length}>
      <h3 className="si-heading si-heading--3">{s.disputed(items.length)}</h3>
      <ul className="si-situation__disputedlist">
        {items.map((item) => (
          <li key={item.story_event_id} className="si-situation__dispute" data-event={item.story_event_id}>
            <span className="si-situation__claim">{item.claim}</span>
            <span className="si-situation__actions">
              <ViewEvidence target={{ source: "run", runId, ids: refIds(item.evidence), label: item.claim }} />
              <Link className="si-link si-hit si-situation__link" href={timelineEventHref(outreachId, item.story_event_id)}>{s.showInTimeline}</Link>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The presentational Situation (the kit rule, UX15): props in, no role, no read. */
export function Situation({ outreach, asOf, discrepancies = [], cardLines = true }: { outreach: Outreach; asOf: string; discrepancies?: readonly Discrepancy[]; cardLines?: boolean }) {
  return (
    <>
      <SituationBody outreach={outreach} asOf={asOf} cardLines={cardLines} />
      {outreach.newest_run_id && <DisputedRecords outreachId={outreach.id} runId={outreach.newest_run_id} items={discrepancies} />}
    </>
  );
}

export function SituationSkeleton() {
  return (
    <div className="si-situation" aria-hidden>
      <SkeletonLines lines={6} widths={["55%", "70%", "80%", "60%", "65%", "50%"]} />
      <SkeletonLines lines={3} widths={["30%", "95%", "85%"]} />
    </div>
  );
}
Situation.Skeleton = SituationSkeleton;

function DisputedFromRun({ outreachId, runId }: { outreachId: string; runId: string }) {
  const { presentation } = useRunPresentation(runId);
  return <DisputedRecords outreachId={outreachId} runId={runId} items={presentation.summary_findings.story_discrepancies} />;
}

/** Reads `GET /outreach/:id`; the disputed block reads the newest run's presentation in its own region. */
export function SituationSection({ outreachId, cardLines = true }: { outreachId: string; cardLines?: boolean }) {
  const { outreach, asOf, isFetching } = useOutreach(outreachId);
  const runId = outreach.newest_run_id ?? null;
  return (
    <>
      <RegionProgress active={isFetching} />
      <SituationBody outreach={outreach} asOf={asOf} cardLines={cardLines} />
      {runId && (
        <Region name="analysis-disputed" skeleton={<SkeletonLines lines={2} />}>
          <DisputedFromRun outreachId={outreach.id} runId={runId} />
        </Region>
      )}
    </>
  );
}
