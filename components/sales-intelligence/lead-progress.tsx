"use client";

import Link from "next/link";
import type { AttachedLeadProgress, LeadProgress, Outreach } from "@/lib/api/salesIntelligence";
import { copy } from "./sales-intelligence-copy";
import { formatExactFull as formatDateTime } from "./lib/time"; // FIX-UI1 m1: `ET`, never `EDT`/`EST` (UI-0 §2.1)
import { officialRecordHref } from "./lib/official-record";
import { attachedLeadView, bookedClosure, closureText, priorityText, progressExplanation, quotedText } from "./lib/lead-progress";
import { callBlockerSentence, offeredActions } from "./lib/owner-now";
import { commandLabels } from "./lib/commands";
import { Button } from "./atoms/button";

const lp = copy.leadProgress;

/** `Granot Priority: 1 (Quoted) · Quoted: Yes`. Quoted is shown as sent, never corrected from Priority. */
function PriorityQuoted({ progress }: { progress: Pick<LeadProgress, "granot_priority" | "priority_label" | "quoted"> }) {
  return (
    <span className="si-leadprogress__line">
      {lp.priority}: {priorityText(progress)}
      {" · "}
      <span title={progress.quoted === true ? lp.quotedRetained : undefined}>
        {lp.quoted}: {quotedText(progress.quoted)}
      </span>
    </span>
  );
}

/** Outreach card line (§7 row 1). An older server sends no `lead_progress`: render nothing new. */
export function LeadProgressLine({ record }: { record: Outreach | null | undefined }) {
  const progress = record?.lead_progress;
  if (!progress) return null;
  const explanation = progressExplanation(progress, record?.state);
  const closure = closureText(progress.closure);
  return (
    <span className="si-leadprogress si-text--sm">
      <PriorityQuoted progress={progress} />
      {explanation && <span className="si-text--subtle">{explanation}</span>}
      {!explanation && closure && record?.state === "closed" && <span className="si-text--subtle">{closure}</span>}
    </span>
  );
}

/** §11.2.6: the open record was closed by its official Booking. The panel stays where it is. */
export function BookedNotice({ record, returnTo }: { record: Outreach | null | undefined; returnTo?: string }) {
  const booking = bookedClosure(record);
  if (!booking) return null;
  return (
    <div className="si-local-notice si-booked" role="status">
      <strong>{lp.bookedRemoved}</strong>
      <span className="si-text--sm">{lp.bookedRemovedSoWhat}</span>
      <Link href={officialRecordHref("BookedLead", booking.id, returnTo)}>{lp.openBooking}</Link>
    </div>
  );
}

type Availability = Outreach["allowed_actions"][number];

function DispositionCommand({ item, record, onCommand }: { item: Availability; record: Outreach; onCommand: (command: string) => void }) {
  const why = item.enabled
    ? null
    : callBlockerSentence(item.action, record, item.blocker_codes, copy.call.blockers, copy.call.blockerCodes) || copy.errors.loadFailed;
  return (
    <span className="si-leadprogress__command">
      <Button size="sm" variant="secondary" disabled={!item.enabled} onClick={() => onCommand(item.action)}>
        {commandLabels[item.action]}
      </Button>
      {why && <span className="si-text--sm si-text--subtle">{why}</span>}
    </span>
  );
}

/**
 * Summary/detail (§7 row 5): work basis, known accepted update time, Priority/Quoted,
 * the separate no-call line, closure, override and reopen review. Controls come purely
 * from `allowed_actions`.
 */
export function LeadProgressSection({
  record,
  onCommand,
}: {
  record: Outreach | null | undefined;
  onCommand?: (command: string) => void;
}) {
  const progress = record?.lead_progress;
  if (!record || !progress) return null;
  const closure = closureText(progress.closure);
  const explanation = progressExplanation(progress, record.state);
  const origin = progress.source_origin ? lp.origin[progress.source_origin] ?? null : null;
  const updated = progress.source_applied_at
    ? [lp.leadUpdatedAt(formatDateTime(progress.source_applied_at)), origin].filter(Boolean).join(" ")
    : lp.leadUpdatedUnknown;
  const controls = onCommand
    ? offeredActions(record.allowed_actions).filter((item) => item.action === "override_disposition" || (item.action === "reopen" && (progress.closure || progress.reopen_review_id)))
    : [];
  return (
    <section className="si-leadprogress si-leadprogress--detail" aria-label={lp.heading}>
      <span className="si-ownership__label">{lp.heading}</span>
      <p><PriorityQuoted progress={progress} /></p>
      <p className="si-text--sm">{lp.disposition}: {progress.disposition_label}</p>
      <p className="si-text--sm">{lp.basis}: {progress.basis_label ?? lp.noBasis}</p>
      <p className="si-text--sm si-text--subtle">{updated}</p>
      {progress.provenance === "uncertain" && <p className="si-text--sm si-text--amber">{lp.uncertain}</p>}
      {explanation && <p className="si-text--sm">{explanation}</p>}
      {progress.no_call_observed && <p className="si-text--sm">{lp.noCallObserved}</p>}
      {closure && (
        <p className="si-text--sm">
          <strong>{closure}</strong>
          {progress.closure?.closed_at ? ` · ${lp.closedAt(formatDateTime(progress.closure.closed_at))}` : ""}
        </p>
      )}
      {progress.override && (
        <p className="si-text--sm">
          {lp.override(progress.override.decided_by, formatDateTime(progress.override.decided_at))}
          <br />
          {lp.overrideReason(progress.override.reason)}
        </p>
      )}
      {progress.reopen_review_id && <p className="si-text--sm si-text--amber">{lp.reopenReview}</p>}
      <p className="si-field__hint">{lp.asOf(formatDateTime(progress.projected_at))}</p>
      {!!controls.length && onCommand && (
        <div className="si-local-filters" aria-label={lp.controls}>
          {controls.map((item) => <DispositionCommand key={item.action} item={item} record={record} onCommand={onCommand} />)}
        </div>
      )}
    </section>
  );
}

/** Number card (§7 rows 2–4, §11.3). Absent `attached_lead_progress` is an older server: nothing new. */
export function AttachedLeadLine({
  value,
  returnTo,
  onReviewMatches,
}: {
  value: AttachedLeadProgress | undefined;
  returnTo?: string;
  onReviewMatches: () => void;
}) {
  const view = attachedLeadView(value);
  if (!view) return null;
  if (view.kind === "multiple") {
    return (
      <span className="si-leadprogress si-text--sm">
        <button type="button" className="si-btn si-btn--link" onClick={onReviewMatches} title={lp.multipleSoWhat}>
          {lp.multiple}
        </button>
      </span>
    );
  }
  if (view.kind === "none") {
    return (
      <span className="si-leadprogress si-text--sm">
        <span>{lp.none}</span>
        <span className="si-text--subtle">{lp.noneSoWhat}</span>
      </span>
    );
  }
  const progress = value?.lead_progress;
  return (
    <span className="si-leadprogress si-text--sm">
      {view.who && <span className="si-text--subtle">{lp.forLead(view.who)}</span>}
      {progress ? <PriorityQuoted progress={progress} /> : <span>{view.line}</span>}
      {view.booked && (
        <span>
          {view.booked}
          {view.bookingId && (
            <>
              {" · "}
              <Link href={officialRecordHref("BookedLead", view.bookingId, returnTo)}>{lp.openBooking}</Link>
            </>
          )}
        </span>
      )}
    </span>
  );
}
