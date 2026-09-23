import type { AttachedLeadProgress, LeadProgress, Outreach } from "@/lib/api/salesIntelligence";
import { copy } from "../sales-intelligence-copy";

/**
 * LP-04 (§7, §11.2–11.3). Display text for server-owned Lead progress. Nothing here
 * derives a disposition, a band or Quoted from Priority: every value is read as sent.
 */
const lp = copy.leadProgress;

/** "1 (Quoted)", "9 (Unknown meaning)", or the label alone when no code is set ("Not set"). */
export function priorityText(progress: Pick<LeadProgress, "granot_priority" | "priority_label">): string {
  return lp.priorityValue(progress.granot_priority, progress.priority_label || lp.unknown);
}

export function quotedText(quoted: boolean | null | undefined): string {
  if (quoted === true) return lp.yes;
  if (quoted === false) return lp.no;
  return lp.unknown;
}

export function progressLine(progress: Pick<LeadProgress, "granot_priority" | "priority_label" | "quoted">): string {
  return lp.line(priorityText(progress), quotedText(progress.quoted));
}

/** The short "why it opened" explanation shows only while the record is open. */
export function progressExplanation(progress: LeadProgress | null | undefined, state: string | undefined): string | null {
  if (!progress?.explanation || state === "closed") return null;
  return progress.explanation;
}

export function closureText(closure: LeadProgress["closure"] | undefined): string | null {
  if (!closure) return null;
  return lp.closure[closure.basis] ?? `Closed: ${closure.basis.replaceAll("_", " ")}`;
}

/** §11.2.6: the open record's official Booking closed it. Read from the server's state, reason and links. */
export function bookedClosure(record: Outreach | null | undefined): { id: string } | null {
  if (!record || record.state !== "closed" || record.reason !== "booked") return null;
  const booking = record.related_record_links?.find((item) => item.model === "BookedLead");
  return booking ? { id: booking.id } : null;
}

export type AttachedLeadView =
  | { kind: "resolved"; who: string | null; line: string; quotedTrue: boolean; booked: string | null; bookingId: string | null }
  | { kind: "multiple" }
  | { kind: "none" }
  | null;

/** Number card (§7 rows 2–4, §11.3). Absent means an older server: show nothing new. */
export function attachedLeadView(value: AttachedLeadProgress | undefined): AttachedLeadView {
  if (!value) return null;
  if (value.status === "multiple") return { kind: "multiple" };
  if (value.status === "none") return { kind: "none" };
  const display = value.lead_display;
  const who = display && (display.name || display.job_no)
    ? [display.name, display.job_no ? `Job ${display.job_no}` : null].filter(Boolean).join(" · ")
    : null;
  const progress = value.lead_progress;
  const line = progress ? progressLine(progress) : lp.line(lp.unknown, lp.unknown);
  const booking = value.booking;
  const booked = booking === undefined ? null : booking === null ? lp.notBooked : booking.cancelled ? lp.bookedCancelled : lp.booked;
  return { kind: "resolved", who, line, quotedTrue: progress?.quoted === true, booked, bookingId: booking?.id ?? null };
}
