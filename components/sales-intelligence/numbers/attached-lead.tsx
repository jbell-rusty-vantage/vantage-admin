import Link from "next/link";
import type { AttachedLead } from "@/lib/api/salesIntelligence";
import { copy } from "../sales-intelligence-copy";
import { Badge, type Tone } from "../atoms/badge";
import { officialStatusLabel } from "../lib/format";
import { officialRecordHref } from "../lib/official-record";

const n = copy.numbers;

const OFFICIAL_TONE: Record<string, Tone> = { booked: "green", cancelled: "red", bad_lead: "neutral", duplicate: "neutral", no_sync: "amber", open_lead: "blue" };

/**
 * The Number's one attached Lead (server `attached_lead`): only `resolved` names a Lead, with its official status and
 * links to the official Lead, Booking and Cancellation. `multiple` and `none` carry no Lead fact, so none is shown.
 */
export function AttachedLeadLine({ value, returnTo, onReviewMatches }: { value: AttachedLead; returnTo?: string; onReviewMatches?: () => void }) {
  if (value.status === "none") return <span className="si-text--sm si-text--subtle" data-attached-lead="none">{n.noAttachedLead}</span>;
  if (value.status === "multiple") {
    return (
      <span className="si-text--sm si-text--amber" data-attached-lead="multiple">
        {n.multipleLeads}
        {onReviewMatches && (
          <>
            {" "}
            <button type="button" className="si-btn si-btn--link" onClick={onReviewMatches}>{n.tabs.matches}</button>
          </>
        )}
      </span>
    );
  }
  const display = value.lead_display;
  const official = value.official;
  return (
    <span className="si-leadline si-text--sm" data-attached-lead="resolved">
      {display ? (
        <>
          <Link href={officialRecordHref(value.lead_ref.model, value.lead_ref.id, returnTo)}>{display.name ?? n.openLead}</Link>
          {display.job_no && <span> · {n.jobNo(display.job_no)}</span>}
          {display.source_company && <span className="si-text--subtle"> · {display.source_company}</span>}
        </>
      ) : (
        <span className="si-text--subtle">{n.leadGone}</span>
      )}
      {official && (
        <>
          {" "}
          <Badge tone={OFFICIAL_TONE[official.status] ?? "neutral"}>{officialStatusLabel(official.status)}</Badge>
        </>
      )}
    </span>
  );
}

/** The detail version: the same facts plus the official Booking and Cancellation links. */
export function AttachedLeadPanel({ value, returnTo, onReviewMatches }: { value: AttachedLead; returnTo?: string; onReviewMatches?: () => void }) {
  return (
    <section className="si-local-stack" aria-label={n.attachedLead}>
      <h3>{n.attachedLead}</h3>
      <AttachedLeadLine value={value} returnTo={returnTo} onReviewMatches={onReviewMatches} />
      {value.status === "resolved" && (
        <div className="si-local-filters">
          <Link href={officialRecordHref(value.lead_ref.model, value.lead_ref.id, returnTo)}>{n.openLead}</Link>
          {value.official?.booking_id && <Link href={officialRecordHref("BookedLead", value.official.booking_id, returnTo)}>{n.openBooking}</Link>}
          {value.official?.cancellation_id && <Link href={officialRecordHref("CancelledLead", value.official.cancellation_id, returnTo)}>{n.openCancellation}</Link>}
        </div>
      )}
    </section>
  );
}
