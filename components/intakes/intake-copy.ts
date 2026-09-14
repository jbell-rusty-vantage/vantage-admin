import type { MatchedLeadOrigin } from "@/components/granot-lifecycle/use-matched-lead";
import type {
  BookingIntakeCreatingObservation,
  GranotLifecycleCandidateItem,
  GranotLifecycleCaseListItem,
} from "@/lib/api/granotLifecycle";
import { buildJobTimelineHref } from "@/lib/api/jobNumberTimeline";

export const INTAKES_HREF = "/intakes";
export const INTAKE_CASE_RETURN = "/intakes";

export type IntakeKind = "booking" | "cancellation";

export function intakeKindFromCase(kind: GranotLifecycleCaseListItem["kind"]): IntakeKind {
  return kind === "release" ? "cancellation" : "booking";
}

export function intakeKindLabel(kind: IntakeKind): string {
  return kind === "cancellation" ? "Cancellation intake" : "Booking intake";
}

export function intakeQueueLabel(kind: IntakeKind): string {
  return kind === "cancellation" ? "Cancellation intakes" : "Booking intakes";
}

export function intakeStatusLabel(state: GranotLifecycleCaseListItem["state"]): string {
  return state === "resolved" ? "Finished" : "Waiting for you";
}

export type IntakeOwnerPosture = "finalize" | "review";

export type IntakePostureItem = Pick<
  GranotLifecycleCaseListItem,
  "mode" | "deterministic_booking"
>;

export type IntakeWhyHereItem = IntakePostureItem &
  Pick<GranotLifecycleCaseListItem, "latest_action">;

export const INTAKES_PAGE_BODY =
  "Granot can mark a job Booked or Release. Vantage does not copy those numbers. If there is no Booking yet, finalize it here. If a Booking already exists, the official record is probably already right — choose No Action. Open the case only to change official numbers. Release is not a Cancellation by itself; cancel from Bookings when you mean to.";

export const INTAKE_COMMANDS_OFF =
  "Vantage is not ready to file Bookings from this screen. This Intake keeps waiting.";

export const INTAKE_LIST_LOAD_ERROR = "Unable to load intakes. Try Refresh.";

export const INTAKE_LIST_NO_ACTION = {
  confirm: "Close this intake? The official Booking will not change.",
  success: "Intake closed. No official record changed.",
  conflict: "This intake changed. Refresh and try again.",
  reason_code: "booking_still_valid",
} as const;

export function intakeOwnerPosture(item: IntakePostureItem): IntakeOwnerPosture {
  return item.mode === "review_existing_booking" ? "review" : "finalize";
}

export function intakeCardPrimaryLabel(item: IntakePostureItem): string {
  return intakeOwnerPosture(item) === "review" ? "Possibly Fix Booking" : "Finalize Booking";
}

export function intakeShowsListNoAction(
  item: Pick<GranotLifecycleCaseListItem, "state" | "mode">,
  bookingCommandsEnabled = true,
): boolean {
  return item.state === "open"
    && item.mode === "review_existing_booking"
    && bookingCommandsEnabled;
}

export function intakePublicCancelHref(bookingId: string): string {
  return `/cancellations/new?booked_lead=${encodeURIComponent(bookingId)}`;
}

export function intakeShowsPublicCancel(
  item: Pick<GranotLifecycleCaseListItem, "state" | "mode" | "deterministic_booking">,
): boolean {
  return item.state === "open"
    && item.mode === "review_existing_booking"
    && item.deterministic_booking.present === true
    && Boolean(item.deterministic_booking.id)
    && item.deterministic_booking.public_cancel_allowed === true;
}

export function intakeWorkbenchShowsPublicCancel(detail: {
  state: GranotLifecycleCaseListItem["state"];
  mode: string;
  capabilities: { referral: boolean };
  official_current: {
    booking?: { id?: string; lead_ref?: unknown };
    cancellation?: { id?: string };
  };
}): boolean {
  return detail.state === "open"
    && detail.mode === "review_existing_booking"
    && Boolean(detail.official_current.booking?.id)
    && detail.capabilities.referral !== true
    && Boolean(detail.official_current.booking?.lead_ref)
    && !detail.official_current.cancellation;
}

export function intakeWhyHere(action: GranotLifecycleCaseListItem["latest_action"]): string {
  switch (action) {
    case "priority_5":
      return "Opened under the retired Priority 5 trigger";
    case "booked":
      return "Granot marked this job Booked.";
    case "release":
      return "Granot released this job.";
    default:
      return "Granot sent an update that needs your review";
  }
}

export function intakeWhyHereForCase(item: IntakeWhyHereItem): string {
  if (item.latest_action === "priority_5") return intakeWhyHere("priority_5");
  if (intakeOwnerPosture(item) === "finalize") {
    return item.latest_action === "release"
      ? "Granot released this job. Vantage still has no Booking."
      : "Granot marked this job Booked. Vantage does not have a Booking yet.";
  }
  return item.latest_action === "release"
    ? "Granot released this job. That may be an edit. It is not a Vantage Cancellation by itself."
    : "Granot sent another Booked on a job Vantage already booked.";
}

export function intakeReleaseHeadline(item: IntakeWhyHereItem): string | undefined {
  if (item.latest_action !== "release") return undefined;
  return intakeWhyHereForCase(item);
}

export function intakeWhatVantageHas(item: Pick<
  GranotLifecycleCaseListItem,
  "kind" | "mode" | "deterministic_booking"
>): string {
  if (item.kind === "release") {
    return item.deterministic_booking.present
      ? "Vantage already has a Booking"
      : "No official Booking yet";
  }

  switch (item.mode) {
    case "review_existing_booking":
      return "Vantage already has a Booking";
    case "create_missing_booking":
    case "create_referral_booking":
      return "No official Booking yet";
    default:
      return item.deterministic_booking.present
        ? "Vantage already has a Booking"
        : "No official Booking yet";
  }
}

export function intakeActionLabel(
  item?: IntakeKind | IntakePostureItem,
): string {
  if (item && typeof item === "object") return intakeCardPrimaryLabel(item);
  return "Finalize Booking";
}

export function intakeNextStep(item: Pick<
  GranotLifecycleCaseListItem,
  "kind" | "mode" | "latest_action" | "deterministic_booking"
>): string {
  if (item.kind === "release") {
    return "Open this case to review official cancellation details.";
  }
  if (intakeOwnerPosture(item) === "review") {
    return "If the official Booking is still right, choose No Action. Open the case only to change official numbers.";
  }
  if (item.latest_action === "release") {
    return "If the sale is real, finalize the Booking. If it should not be filed, open the case and choose No Action.";
  }
  if (item.mode === "create_referral_booking") {
    return "Enter Binder, up to two Agents, Deposit, and Merchant.";
  }
  return "Enter Binder, up to two Agents, Deposit, and Merchant. A High-Confidence Booking Lead attaches on its own. You can save as a Leadless Booking.";
}

export function intakeCaseHowToFinish(input: {
  kind: GranotLifecycleCaseListItem["kind"];
  mode: string;
  state: GranotLifecycleCaseListItem["state"];
  commandsAvailable: boolean;
  latest_action?: GranotLifecycleCaseListItem["latest_action"];
}): { title: string; body: string } | undefined {
  if (input.state !== "open") return undefined;
  if (input.kind === "release") {
    return {
      title: "How to finish this cancellation",
      body: input.commandsAvailable
        ? "Official cancellation and booking fields are below. Granot evidence stays as reference only."
        : INTAKE_COMMANDS_OFF,
    };
  }
  if (!input.commandsAvailable) {
    return {
      title: input.mode === "review_existing_booking"
        ? "How to review this booking"
        : "How to finalize this booking",
      body: INTAKE_COMMANDS_OFF,
    };
  }
  if (input.mode === "review_existing_booking") {
    return {
      title: "How to review this booking",
      body: "This Booking is already official. A new Booked or Release does not change it by itself. Update Book Date, Binder, Agents, Deposit, or Merchant only if those official values are wrong. If nothing official changed, choose No Action. To cancel, use Cancel this booking — do not treat Release as the cancel.",
    };
  }
  return {
    title: "How to finalize this booking",
    body: input.latest_action === "release"
      ? "Granot released this job. Vantage still has no Booking. If the sale is real, enter the official sale here. Granot estimate and payment stay as reference. If it should not be filed, choose No Action."
      : "Granot marked this job Booked. That is not a Vantage Booking. Enter the official sale here. Granot estimate and payment stay as reference.",
  };
}

export function intakeWaitingEmptyMessage(kind: IntakeKind): string {
  return kind === "booking"
    ? "No booking intakes waiting. When Granot records a Booked or Release job, it shows up here."
    : "Cancellation intakes are retired. New Release jobs appear on booking intakes.";
}

export function intakeMoreWaitingLabel(kind: IntakeKind): string {
  return kind === "cancellation" ? "More cancellation intakes" : "More booking intakes";
}

export function intakeEmptyMessage(kind: IntakeKind, state: "open" | "resolved"): string {
  if (state === "open") {
    return kind === "cancellation"
      ? `${intakeWaitingEmptyMessage(kind)} Press Refresh to check again.`
      : intakeWaitingEmptyMessage(kind);
  }
  return kind === "booking"
    ? "No finished booking intakes match this view."
    : "No finished cancellation intakes match this view.";
}

export function intakeCaseHref(
  caseId: string,
  options?: { tab?: IntakeKind; state?: "open" | "resolved"; job?: string },
): string {
  const params = new URLSearchParams();
  if (options?.tab === "cancellation") params.set("tab", "cancellations");
  if (options?.state === "resolved") params.set("state", "resolved");
  if (options?.job?.trim()) params.set("job", options.job.trim());
  params.set("case", caseId);
  return `${INTAKES_HREF}?${params.toString()}`;
}

export function creatingObservationTitle(
  selection?: "preferred_booked" | "preferred_release" | "latest_creating",
  kind: IntakeKind = "booking",
): string {
  if (selection === "preferred_release") return "Granot Release payload";
  if (selection === "latest_creating") return "Latest Granot payload that created this intake";
  if (selection === "preferred_booked") return "Granot Booked payload";
  return kind === "cancellation" ? "Granot Release payload" : "Granot Booked payload";
}

export function creatingObservationListHint(kind: IntakeKind): string {
  return kind === "cancellation"
    ? "Latest payload that created this cancellation intake"
    : "Latest payload that created this booking intake";
}

export function creatingObservationSummary(input: {
  route_event_class?: string;
  payload_event_type_raw?: string;
  booking_action?: string;
}): string {
  const route = input.route_event_class?.replaceAll("_", " ") ?? "Granot observation";
  const action = input.payload_event_type_raw
    ?? (input.booking_action === "booked" ? "Booked" : input.booking_action);
  return action ? `${route} · ${action}` : route;
}

export function intakeJobHref(normalizedJobNo: string): string {
  return buildJobTimelineHref({ job: normalizedJobNo });
}

export function intakePairingLine(
  pairing?: GranotLifecycleCaseListItem["priority_pairing"],
): { text: string; tone: "quiet" | "warning" } | undefined {
  if (pairing?.pairing === "priority_5_then_booked") {
    return { text: "Priority 5 then Booked", tone: "quiet" };
  }
  if (pairing?.pairing === "booked_without_priority_5") {
    return { text: "Booked without Priority 5", tone: "warning" };
  }
  return undefined;
}

export function intakePairingClassLabel(
  pairing: NonNullable<GranotLifecycleCaseListItem["priority_pairing"]>["pairing"],
): string {
  switch (pairing) {
    case "priority_5_then_booked":
      return "Priority 5 then Booked";
    case "booked_carries_priority_5":
      return "Booked carries Priority 5";
    case "booked_without_priority_5":
      return "Booked without Priority 5";
  }
}

/**
 * Unused owner-path tombstone. `/intakes` no longer has a cancellation queue.
 * Historical Release cases still use `ReleaseOwnerActions` on the technical
 * lifecycle page. Keep this object only so leftover imports compile.
 */
export const CANCELLATION_INTAKE_STORY = {
  whatGranotSent: {
    title: "What Granot sent us",
    hint: "The update that opened this cancellation, exactly as Granot reported it.",
  },
  finishTheCancellation: {
    title: "Finish the cancellation",
    hint: "Enter official cancel date and refund. Granot numbers stay as reference only.",
  },
  whatVantageAlreadyHas: {
    title: "What Vantage already has on this job",
    hint: "The live Vantage booking and cancellation, if either one exists yet.",
  },
  granotUpdateHistory: {
    title: "Every update Granot sent on this job",
    hint: "One line per update. Nothing is merged or dropped.",
  },
  jobLifecycleTimeline: {
    title: "How this job got here",
    hint: "The full history behind this job, in order. Open it only if you need it.",
  },
} as const;

export const BOOKING_INTAKE_STORY = {
  whatGranotSent: {
    title: "What Granot sent us",
    hint: "The update that opened this booking, exactly as Granot reported it.",
  },
  whoThisIsFor: {
    title: "Who this booking is for",
    hint: "The customer the booking will be filed under. Change it if it is the wrong person.",
  },
  findAnotherCustomer: {
    title: "Find the right customer",
    hint: "Search the website contact or the later Granot contact, or the job number or reference. Picking someone replaces the customer above.",
    searchLabel: "Search the website contact, the later Granot contact, job number, or reference",
    searchPlaceholder: "Website contact, Granot contact, job, or reference",
  },
  contactCycle: {
    line: "Form submitted is what they typed on the website. Granot is the later card from the CRM when we have one.",
    callLine: "Called is the phone contact. Granot is the later card from the CRM when we have one.",
    changed: "Granot later changed this contact.",
  },
  officialBookingDetails: {
    title: "Official Booking details",
    hint: "Enter Binder, up to two Agents, Deposit, and Merchant.",
  },
  finishTheBooking: {
    title: "Official Booking details",
    hint: "Enter Binder, up to two Agents, Deposit, and Merchant.",
  },
  whatVantageAlreadyHas: {
    title: "What Vantage already has on this job",
    hint: "The live Vantage booking and cancellation, if either one exists yet.",
  },
  granotUpdateHistory: {
    title: "Every update Granot sent on this job",
    hint: "One line per update. Nothing is merged or dropped.",
  },
  jobLifecycleTimeline: {
    title: "How this job got here",
    hint: "The full history behind this job, in order. Open it only if you need it.",
  },
} as const;

/** One sentence naming what Granot did and when, for the top of the intake. */
export function granotStatementHeadline(input: {
  jobNo?: string;
  whatGranotCalledIt?: string;
  capturedAt?: string;
}): string {
  const job = input.jobNo?.trim();
  const subject = job ? `job ${job}` : "this job";
  const when = input.capturedAt ? ` on ${new Date(input.capturedAt).toLocaleString()}` : "";
  const called = input.whatGranotCalledIt?.trim();
  if (!called) return `Granot sent an update on ${subject}${when}.`;
  if (called.toLowerCase() === "booked") return `Granot marked ${subject} booked${when}.`;
  if (
    called.toLowerCase() === "release"
    || called.toLowerCase() === "releas"
    || called.toLowerCase() === "cancelled"
    || called.toLowerCase() === "canceled"
  ) {
    return `Granot released ${subject}${when}.`;
  }
  return `Granot sent a “${called}” update on ${subject}${when}.`;
}

export function granotStatementEmptyMessage(): string {
  return "Granot sent this update with no customer, move, or money details on it. The exact message it sent is below.";
}

/** The Priority 5 audit, said the way the Owner would say it out loud. */
export function priorityPairingStory(
  pairing: NonNullable<GranotLifecycleCaseListItem["priority_pairing"]>["pairing"],
): { sentence: string; tone: "quiet" | "warning" } {
  switch (pairing) {
    case "priority_5_then_booked":
      return {
        sentence: "Granot flagged this job a priority 5 first, then marked it booked.",
        tone: "quiet",
      };
    case "booked_carries_priority_5":
      return {
        sentence: "Granot marked this job booked and sent priority 5 in the same update.",
        tone: "quiet",
      };
    case "booked_without_priority_5":
      return {
        sentence: "Granot marked this job booked without ever flagging it a priority 5.",
        tone: "warning",
      };
  }
}

export function matchedCustomerOriginLabel(origin: MatchedLeadOrigin): string {
  switch (origin) {
    case "vantage_matched":
      return "Vantage matched this customer";
    case "owner_chose":
      return "You chose this customer";
    case "none":
      return "No customer matched yet";
  }
}

export function matchConfidenceLabel(
  confidence: GranotLifecycleCandidateItem["confidence"],
): string {
  return confidence === "high" ? "Strong match" : "Possible match";
}

export function matchConfidenceHint(
  confidence: GranotLifecycleCandidateItem["confidence"],
): string {
  return confidence === "high"
    ? "Everything Granot sent lines up with this customer."
    : "Some of what Granot sent lines up with this customer. Check the name and phone before you file it.";
}

export const INTAKE_LEAD_OPTIONAL = {
  noStoredLeadTitle: "No stored lead",
  noStrongMatch:
    "No strong match. You can search, or save the booking now and connect a lead later from Bookings.",
  willAttachHigh: "This customer will be attached when you file the booking.",
  filingUnder: "Filing this booking under",
  reviewNoLead: "No lead — Master Booked only",
  leadlessCreated:
    "Booking saved to Master Booked. No stored lead was attached. You can connect a lead later from Bookings.",
  attachedCreated: "Booking created successfully.",
} as const;

export function noMatchedCustomerMessage(searching: boolean): string {
  return searching
    ? "Looking for the customer this job belongs to…"
    : INTAKE_LEAD_OPTIONAL.noStrongMatch;
}

export function granotUpdateActionLabel(
  action: GranotLifecycleCaseListItem["latest_action"],
): string {
  switch (action) {
    case "booked":
      return "Granot marked the job booked";
    case "release":
      return "Granot released the job";
    case "priority_5":
      return "Granot flagged the job a priority 5";
  }
}

export function granotUpdateReadingLabel(
  result: "valid" | "valid_with_issues" | "invalid" | "unsupported" | undefined,
): string {
  switch (result) {
    case "valid":
      return "Vantage read it cleanly";
    case "valid_with_issues":
      return "Vantage read it, but some fields looked wrong";
    case "invalid":
      return "Vantage could not read it";
    case "unsupported":
      return "Vantage does not act on this kind of update";
    default:
      return "Vantage has not recorded how it read this one";
  }
}

export function granotUpdateCountLine(count: number): string {
  return count === 1 ? "1 update from Granot" : `${count} updates from Granot`;
}

export function creatingObservationSelectionHint(
  selection: BookingIntakeCreatingObservation["selection"],
): string {
  if (selection === "preferred_release") {
    return "This is the Release update Granot sent. It is what opened this intake.";
  }
  return selection === "latest_creating"
    ? "Granot never sent a Booked update on this job, so this is the most recent update it did send."
    : "This is the Booked update Granot sent. It is what opened this booking.";
}

export function isAllowedIntakeReturn(value: string | undefined | null): value is string {
  if (!value) return false;
  if (value === INTAKE_CASE_RETURN) return true;
  if (!value.startsWith(`${INTAKE_CASE_RETURN}?`)) return false;
  return !value.includes("://") && !value.includes("//");
}

export function intakeListNoActionConflictCopy(code: string | undefined): string {
  if (code === "GRANOT_CASE_REVISION_CONFLICT") return INTAKE_LIST_NO_ACTION.conflict;
  return intakeOwnerCommandConflictCopy(code);
}

/** Owner-visible 409 copy for No Action, Update Existing Booking, and Confirm Granot Cancellation. */
export function intakeOwnerCommandConflictCopy(code: string | undefined): string {
  const shown = code ?? "conflict";
  switch (code) {
    case "GRANOT_CASE_REVISION_CONFLICT":
      return `The case revision or latest-action posture changed (${shown}). Facts were refreshed. Unsent fields were preserved. Review and submit again.`;
    case "GRANOT_IDENTITY_CONFLICT":
      return `This intake’s identity or Referral evidence no longer matches (${shown}). Facts were refreshed. This is not a revision change. Review and submit again.`;
    case "DOMAIN_REVISION_CONFLICT":
      return `The Booking revision changed (${shown}). Facts were refreshed. Unsent fields were preserved. Review and submit again.`;
    default:
      return `Facts were refreshed (${shown}). Unsent fields were preserved. Review and submit again.`;
  }
}
