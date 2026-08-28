import type { MatchedLeadOrigin } from "@/components/granot-lifecycle/use-matched-lead";
import type {
  BookingIntakeCreatingObservation,
  GranotLifecycleCandidateItem,
  GranotLifecycleCaseListItem,
} from "@/lib/api/granotLifecycle";

export const INTAKES_HREF = "/intakes";
export const INTAKE_CASE_RETURN = "/intakes";

export type IntakeKind = "booking" | "cancellation";

export function intakeKindFromCase(kind: GranotLifecycleCaseListItem["kind"]): IntakeKind {
  return kind === "release" ? "cancellation" : "booking";
}

export function intakeKindLabel(kind: IntakeKind): string {
  return kind === "cancellation" ? "Cancellation intake" : "Booking intake";
}

export function intakeStatusLabel(state: GranotLifecycleCaseListItem["state"]): string {
  return state === "resolved" ? "Finished" : "Waiting for you";
}

export function intakeWhyHere(action: GranotLifecycleCaseListItem["latest_action"]): string {
  switch (action) {
    case "priority_5":
      return "Opened under the retired Priority 5 trigger";
    case "booked":
      return "Granot recorded a booking";
    case "release":
      return "Granot recorded a cancellation";
    default:
      return "Granot sent an update that needs your review";
  }
}

export function intakeWhatVantageHas(item: Pick<
  GranotLifecycleCaseListItem,
  "kind" | "mode" | "deterministic_booking"
>): string {
  if (item.kind === "release") {
    return item.deterministic_booking.present
      ? "Vantage has an official booking on this job"
      : "No official Vantage booking on this job";
  }

  switch (item.mode) {
    case "create_missing_booking":
      return "No official Vantage booking yet";
    case "review_existing_booking":
      return "Vantage already has a booking";
    case "create_referral_booking":
      return "Referral booking — no lead attached";
    default:
      return item.deterministic_booking.present
        ? "Vantage already has a booking"
        : "No official Vantage booking yet";
  }
}

export function intakeActionLabel(kind: IntakeKind): string {
  return kind === "cancellation" ? "Review cancellation" : "Finish booking";
}

export function intakeNextStep(item: Pick<GranotLifecycleCaseListItem, "kind" | "mode">): string {
  if (item.kind === "release") {
    return "Open this case to review official cancellation details.";
  }
  switch (item.mode) {
    case "create_missing_booking":
      return "Enter binder, up to two agents, deposit, and merchant. A high-confidence lead attaches automatically. You can save without a lead.";
    case "review_existing_booking":
      return "Review or update the official booking. Binder is one amount, split evenly across the agents you pick.";
    case "create_referral_booking":
      return "Open this case to enter one binder amount, up to two agents, deposit, and merchant.";
    default:
      return "Open this case to finish official booking details.";
  }
}

export function intakeCaseHowToFinish(input: {
  kind: GranotLifecycleCaseListItem["kind"];
  mode: string;
  state: GranotLifecycleCaseListItem["state"];
  commandsAvailable: boolean;
}): { title: string; body: string } | undefined {
  if (input.state !== "open") return undefined;
  if (input.kind === "release") {
    return {
      title: "How to finish this cancellation",
      body: input.commandsAvailable
        ? "Official cancellation and booking fields are below. Granot evidence stays as reference only."
        : "This case is waiting for official cancellation details. The official form appears here when owner cancellation work is enabled.",
    };
  }
  if (input.mode === "review_existing_booking") {
    return {
      title: "How to finish this booking",
      body: input.commandsAvailable
        ? "Review or update the official booking. Binder is one amount, split evenly across the agents you pick. Use the same catalog as a normal booking, or leave official records unchanged."
        : "Vantage already has an official booking on this job. The official form appears here when owner booking work is enabled.",
    };
  }
  return {
    title: "How to finish this booking",
    body: input.commandsAvailable
        ? "Enter binder, up to two agents, deposit, and merchant. A high-confidence lead attaches automatically. You can save without a lead. If the customer is wrong, search for the right one before you file it. Granot estimate and payment numbers stay as reference only."
        : "This case is waiting for one binder amount, up to two agents, deposit, and merchant. The official form appears here when owner booking work is enabled.",
  };
}

export function intakeEmptyMessage(kind: IntakeKind, state: "open" | "resolved"): string {
  if (kind === "booking") {
    return state === "open"
      ? "No booking intakes waiting. When Granot records a Booked job, it will show up here."
      : "No finished booking intakes match this view.";
  }
  return state === "open"
    ? "No cancellation intakes waiting. When Granot cancels a job, it will show up here. Press Refresh to check again."
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
  if (selection === "preferred_release") return "Granot cancellation payload";
  if (selection === "latest_creating") return "Latest Granot payload that created this intake";
  if (selection === "preferred_booked") return "Granot Booked payload";
  return kind === "cancellation" ? "Granot cancellation payload" : "Granot Booked payload";
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
  return `/ingestion/granot/lifecycle/jobs/${encodeURIComponent(normalizedJobNo)}`;
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
 * A booking intake is read top to bottom as one story: what Granot sent, who it
 * is for, what you do about it, and — underneath — the paper trail. These are
 * the words that name each part of that story on screen.
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
    changed: "Granot later changed this contact.",
  },
  finishTheBooking: {
    title: "Finish the booking",
    hint: "Enter one binder amount, up to two agents, deposit, and merchant.",
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
  if (called.toLowerCase() === "release" || called.toLowerCase() === "cancelled") {
    return `Granot cancelled ${subject}${when}.`;
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
      return "Granot cancelled the job";
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
    return "This is the cancellation update Granot sent. It is what opened this intake.";
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
