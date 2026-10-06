/**
 * Owner-visible strings and the pure rules of the shared Lead picker (doc 06 "The Lead picker"). No React: the
 * picker renders from these, and `tests/lead-picker.test.ts` pins the scope default, the out-of-scope reason rule
 * and which endpoint each entry point reads.
 */
import { classifyLeadSearch } from "@/lib/api/leads";
import { overrideReasonProblem, OVERRIDE_REASON_MAX, OVERRIDE_REASON_MIN } from "@/lib/api/bookingsToFinish";
import type { GranotLifecycleCandidateItem } from "@/lib/api/granotLifecycle";

export { OVERRIDE_REASON_MAX, OVERRIDE_REASON_MIN, overrideReasonProblem };

export const LEAD_PICKER_COPY = {
  title: "Find the customer",
  searchPlaceholder: "Job number, phone, email or name",
  scopeLabel: "Where to look",
  scopeSource: "This job's source",
  scopeAll: "Every source",
  outsideSourceWarning: "You are looking outside this job's source. Anyone you choose from here needs a written reason.",
  searching: "Searching…",
  loadFailed: "Could not search customers.",
  empty: "No customers match this search.",
  showMore: "Show more customers",
  choose: "Choose",
  chosen: "Chosen",
  strong: "Strong match",
  possible: "Possible match",
  sameSource: "Same source as this job",
  otherSource: "Different source",
  webForm: "Web form",
  phoneCall: "Phone call",
  reasonLabel: "Why this customer belongs on this job",
  reasonHint: "This customer came in through a different source than the job did. Write down what makes them the same person.",
  reasonChoose: "Choose with this reason",
  cancel: "Cancel",
  noPhoneOrEmail: "No phone or email on this lead.",
  bookingModeSoon: "Choosing a booking is not available here yet.",
} as const;

export type LeadPickerScope = "source" | "all";

/** Every picker opens on this job's source; "every source" is a toggle inside it. */
export const LEAD_PICKER_DEFAULT_SCOPE: LeadPickerScope = "source";

/** The reason box appears only when the chosen lead is out of scope (the server's `requires_override_reason`). */
export function leadNeedsReason(candidate: Pick<GranotLifecycleCandidateItem, "requires_override_reason">): boolean {
  return candidate.requires_override_reason === true;
}

/** Whether a choice may go ahead: no reason needed, or a reason of 10 to 500 characters. */
export function choiceProblem(candidate: Pick<GranotLifecycleCandidateItem, "requires_override_reason">, reason: string): string | undefined {
  return leadNeedsReason(candidate) ? overrideReasonProblem(reason) : undefined;
}

/**
 * Which existing endpoint a picker entry point reads (the UI is shared, the endpoints are not):
 * - a case (`caseId`): `fetchGranotLifecycleCandidates` (intake finish sheet; honours the scope chips);
 * - a booking (`bookingId`, no case): `fetchConnectLeadCandidates` (connect an existing booking; the server already
 *   limits it to the booking's own source, so there are no scope chips);
 * - neither: nothing to search, the picker says so instead of guessing an endpoint.
 * `searchBookingLeadCandidates` (Reconciliation) returns a different result shape and is not read by this picker.
 */
export type LeadPickerEndpoint = "case-candidates" | "connect-candidates" | "none";

export function leadPickerEndpoint(input: { caseId?: string | null; bookingId?: string | null }): LeadPickerEndpoint {
  if (input.caseId) return "case-candidates";
  if (input.bookingId) return "connect-candidates";
  return "none";
}

/** Scope chips only exist where the endpoint can honour them. */
export function leadPickerShowsScope(endpoint: LeadPickerEndpoint): boolean {
  return endpoint === "case-candidates";
}

/** The `q` the candidate endpoints take: the shared classifier normalises job numbers and phones, names pass as typed. */
export function leadPickerQuery(text: string | null | undefined): string | undefined {
  const trimmed = text?.trim();
  if (!trimmed) return undefined;
  return classifyLeadSearch(trimmed).value;
}
