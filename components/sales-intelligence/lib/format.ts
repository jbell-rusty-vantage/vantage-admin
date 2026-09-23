import { BANDS, copy } from "../sales-intelligence-copy";

/** Adapted export display helpers; no ticking, ranking, deadlines or staffed-clock calculation. */
export const cx = (...values: (string | false | null | undefined)[]) => values.filter(Boolean).join(" ");

const date = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});

export const formatDateTime = (value: string | null | undefined) =>
  value ? date.format(new Date(value)) : copy.time.notObserved;

const day = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
  month: "short",
  day: "numeric",
});

export const formatDay = (value: string | null | undefined) =>
  value ? day.format(new Date(value)) : copy.time.notObserved;

const display: Record<string, string> = {
  ...copy.reasons,
  ...copy.outreachState,
  customer: copy.classification.customer,
  company: copy.classification.company,
  non_customer: copy.classification.non_customer,
  allowed: copy.eligibility.allowed,
  temporarily_blocked: copy.eligibility.temporarily_blocked,
  human_conversation: copy.contactType.human_conversation,
  ...copy.result,
  ...copy.direction,
  ...copy.followupKind,
  ...copy.followupOrigin,
  ...copy.attachment,
  restriction: "Calling paused",
  disposition_review: copy.reviewCauseShort.disposition_review,
  disposition_reopen: copy.reviewCauseShort.disposition_reopen,
  review_only: "Review only",
  suppressed: copy.eligibility.suppressed,
  owner_confirmed: "Confirmed by you",
  likely: "Likely",
  exact: "Exact",
  unsure: "Unsure",
  rejected: "Rejected",
  attached: "Attached",
  candidate: "Candidate",
  ambiguous: "Ambiguous",
  customer_wanted: "Customer wanted",
  money_and_dates: "Money and dates",
  outcome: "Outcome",
  commitments: "Commitments",
  discrepancies: "Discrepancies",
  completed: "Completed",
  customer_called: "Customer called",
  left_voicemail: "Left voicemail",
  spoke_with_customer: "Spoke with customer",
  connected_contact_unknown: "Connected—contact unknown",
  owner_dismissed: "Dismissed",
  lost: "Lost",
  not_sales: "Not a sale",
};

export const labels: Record<string, string> = display;

export const label = (value: string) => display[value] ?? value.replaceAll("_", " ");

export const reviewCauseLabel = (value: string) =>
  copy.reviewCause[value as keyof typeof copy.reviewCause] ?? label(value);

export const reviewCauseCardLabel = (value: string) =>
  copy.reviewCauseShort[value as keyof typeof copy.reviewCauseShort] ?? reviewCauseLabel(value);

export const classificationLabel = (value: string) =>
  copy.classification[value as keyof typeof copy.classification] ?? label(value);

export const eligibilityLabel = (value: string) =>
  copy.eligibility[value as keyof typeof copy.eligibility] ?? label(value);

export const contactTypeLabel = (value: string) =>
  copy.contactType[value as keyof typeof copy.contactType] ?? label(value);

export const bandLabel = (band: number) => BANDS[band as keyof typeof BANDS] ?? `Band ${band}`;

/** Format a server-supplied duration. Does not invent clocks or ranking. */
export function formatAge(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "";
  if (ms < 60_000) return "under 1m";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function formatSuppliedAge(wallMs: number, staffedMs: number): string {
  const wall = formatAge(wallMs);
  const staffed = formatAge(staffedMs);
  if (!wall) return "";
  if (staffed && staffed !== wall) return copy.time.agoStaffed(wall, staffed);
  return copy.time.ago(wall);
}

export function leadMatchSummary(attached: number, candidates: number): string {
  if (!attached && !candidates) return copy.lead.noLead;
  const parts: string[] = [];
  if (attached) parts.push(attached === 1 ? "1 attached" : `${attached} attached`);
  if (candidates) parts.push(candidates === 1 ? "1 candidate" : `${candidates} candidates`);
  return parts.join(" · ");
}
