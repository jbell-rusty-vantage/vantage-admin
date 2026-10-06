/**
 * Pure helpers for Bookings to finish (doc 06): the card's lines, the Finished-today day filter, the override-reason
 * length rule, the remembered merchant and the review line. No React and no network: the cards, the finish sheet and
 * the Lead picker import these, and `tests/intakes-to-finish.test.ts` pins them.
 */
import { formatAge, formatMoney, formatShortDate, newYorkDayKey } from "@/components/ui/crm/format";
import { parseMoneyInput } from "@/lib/booking/parseMoneyInput";
import type {
  CandidateKnownGranotContact,
  GranotCaseFileSummary,
  GranotLifecycleCandidateItem,
  GranotLifecycleCaseListItem,
} from "./granotLifecycle";

/** The list read: open booking cases, newest Granot evidence first. */
export const TO_FINISH_OPEN_FILTERS = {
  kind: "booking",
  state: "open",
  sort: "last_evidence_at",
  order: "desc",
  limit: 50,
} as const;

/** The Finished-today read: resolved booking cases, newest first; the day filter is applied client side. */
export const TO_FINISH_RESOLVED_FILTERS = {
  kind: "booking",
  state: "resolved",
  sort: "last_evidence_at",
  order: "desc",
  limit: 50,
} as const;

/** Out-of-scope override reason (server contract: 10 to 500 characters). */
export const OVERRIDE_REASON_MIN = 10;
export const OVERRIDE_REASON_MAX = 500;

/** The problem with an override reason, or undefined when its trimmed length is within 10 to 500. */
export function overrideReasonProblem(text: string): string | undefined {
  const length = text.trim().length;
  return length < OVERRIDE_REASON_MIN || length > OVERRIDE_REASON_MAX
    ? `Write ${OVERRIDE_REASON_MIN} to ${OVERRIDE_REASON_MAX} characters explaining why this customer belongs on this job.`
    : undefined;
}

/** How the sheet finishes a case, from the case `mode` the server sets. */
export type FinishMode = "create" | "referral" | "review";

export function finishModeOf(mode: string): FinishMode {
  if (mode === "create_referral_booking") return "referral";
  if (mode === "review_existing_booking") return "review";
  return "create";
}

/** 2 when the server says so, else 2 when the customer label names two people ("Betty Raban / John Donahue"), else 0. */
export function possibleCustomerCount(item: Pick<GranotLifecycleCaseListItem, "customer_label" | "possible_customer_count">): number {
  if (typeof item.possible_customer_count === "number") return item.possible_customer_count >= 2 ? item.possible_customer_count : 0;
  const names = (item.customer_label ?? "")
    .split(/\s+\/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return names.length >= 2 ? names.length : 0;
}

function placeText(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function moneyValue(value: number | string | null | undefined): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string") return parseMoneyInput(value);
  return undefined;
}

/** "$1,978" for the card (whole dollars), "$1,978.40" only when cents matter. */
export function moneyText(value: number | string | null | undefined): string {
  const amount = moneyValue(value);
  if (amount === undefined) return "";
  return formatMoney(amount, { cents: !Number.isInteger(amount) });
}

/** A move date is a calendar day: `2026-10-19` and `2026-10-19T00:00:00Z` both mean Oct 19, not the evening before in New York. */
function calendarDay(value: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})(?:T00:00:00(?:\.0+)?Z)?$/.exec(value.trim());
  return match ? `${match[1]}T12:00:00Z` : value;
}

/**
 * "Tucson, AZ → Sterling, VA · pickup Oct 19 · Granot estimate $1,978 · paid $578". Empty string when the case file
 * summary has nothing to say (the card leaves the slot empty, never a placeholder sentence).
 */
export function moveMoneyLine(summary: GranotCaseFileSummary | null | undefined, now?: Date): string {
  if (!summary) return "";
  const origin = placeText(summary.origin);
  const destination = placeText(summary.destination);
  const route = origin && destination ? `${origin} → ${destination}` : origin || destination;
  const parts: string[] = [];
  if (route) parts.push(route);
  if (summary.pickup) {
    const pickup = formatShortDate(calendarDay(summary.pickup), now);
    if (pickup !== "—") parts.push(`pickup ${pickup}`);
  }
  const estimate = moneyText(summary.total_estimate);
  if (estimate) parts.push(`Granot estimate ${estimate}`);
  const paid = moneyText(summary.customer_payment);
  if (paid) parts.push(`paid ${paid}`);
  return parts.join(" · ");
}

const GRANOT_ACTION_WORDS: Record<GranotLifecycleCaseListItem["latest_action"], string> = {
  booked: "Granot booked",
  priority_5: "Granot flagged Priority 5",
  release: "Granot released",
};

/** "Granot booked 1h ago" (the age is the time since the newest Granot update on the job). */
export function granotAgeLine(
  item: Pick<GranotLifecycleCaseListItem, "latest_action" | "last_evidence_at">,
  now = Date.now(),
): string {
  return `${GRANOT_ACTION_WORDS[item.latest_action] ?? "Granot updated"} ${formatAge(item.last_evidence_at, now)} ago`;
}

/** Finished today: resolved on today's New York day. A case with no resolved time is never counted. */
export function isFinishedToday(item: Pick<GranotLifecycleCaseListItem, "resolved_at">, now: Date | number = Date.now()): boolean {
  if (!item.resolved_at) return false;
  const day = newYorkDayKey(item.resolved_at);
  return day !== "" && day === newYorkDayKey(now);
}

export function finishedToday<T extends Pick<GranotLifecycleCaseListItem, "resolved_at">>(items: readonly T[], now: Date | number = Date.now()): T[] {
  return items.filter((item) => isFinishedToday(item, now));
}

// ---- The "Use" buttons ---------------------------------------------------------------------------------------------

// ---- Merchant memory ------------------------------------------------------------------------------------------------------
// The Use buttons (Granot's book date, binder and deposit beside each field) and the suggested agent were removed on
// 2026-10-06 at the Owner's ask: Granot's figures are shown as facts in "What Granot sent" and never offered as a
// recommendation, so the Owner's manager is not nudged into copying them.

/** The remembered merchant, only while it is still an active choice. */
export function rememberedMerchantId(
  merchants: readonly { id: string; active?: boolean }[],
  remembered: string | null | undefined,
): string | undefined {
  if (!remembered) return undefined;
  return merchants.find((merchant) => merchant.id === remembered && merchant.active !== false)?.id;
}

export const LAST_MERCHANT_STORAGE_KEY = "vantage-admin-last-merchant";

// ---- The review line and the sheet label ------------------------------------------------------------------------------

/** "Booking for Steve Dority · $1,978.40 binder · $578 deposit · Austin · Stripe" (missing parts are skipped). */
export function reviewLine(input: {
  customer?: string | null;
  jobNo?: string | null;
  leadless?: boolean;
  binder?: number;
  deposit?: number;
  agents?: readonly string[];
  merchant?: string | null;
}): string {
  const who = input.customer?.trim() || (input.jobNo ? `job ${input.jobNo}` : "this job");
  const parts = [`Booking for ${who}`];
  if (input.leadless) parts.push("no lead");
  const binder = moneyText(input.binder);
  if (binder) parts.push(`${binder} binder`);
  const deposit = moneyText(input.deposit);
  if (deposit) parts.push(`${deposit} deposit`);
  const agents = (input.agents ?? []).filter(Boolean);
  if (agents.length) parts.push(agents.join(" + "));
  if (input.merchant?.trim()) parts.push(input.merchant.trim());
  return parts.join(" · ");
}

/** "Sheet: Master Booked (with lead)" or "(leadless)"; the other two modes name what they do. */
export function sheetLabel(mode: FinishMode, hasLead: boolean): string {
  if (mode === "referral") return "Sheet: Master Booked (referral, no lead)";
  if (mode === "review") return "Sheet: Master Booked (update)";
  return hasLead ? "Sheet: Master Booked (with lead)" : "Sheet: Master Booked (leadless)";
}

// ---- The Form submitted / Granot chip ---------------------------------------------------------------------------------

/** "Form submitted ⇄ Granot: same" or "differs"; undefined when Granot has no contact card for the lead. */
export function contactSyncChip(candidate: Pick<GranotLifecycleCandidateItem, "known_contacts" | "lead_ref">): { state: "ok" | "warn"; text: string } | undefined {
  const granot: CandidateKnownGranotContact | undefined = candidate.known_contacts?.granot;
  if (!granot) return undefined;
  const first = candidate.lead_ref.model === "CallLead" ? "Called" : "Form submitted";
  return granot.differs_from_ingested === true
    ? { state: "warn", text: `${first} ⇄ Granot: differs` }
    : { state: "ok", text: `${first} ⇄ Granot: same` };
}
