import type { GranotLifecycleCaseListItem } from "@/lib/api/granotLifecycle";

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
      return "Granot set this lead to priority 5 (booked)";
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

export function intakeEmptyMessage(kind: IntakeKind, state: "open" | "resolved"): string {
  if (kind === "booking") {
    return state === "open"
      ? "No booking intakes waiting. When Granot sets a lead to priority 5 or records a booking, it will show up here. Press Refresh to check again."
      : "No finished booking intakes match this view.";
  }
  return state === "open"
    ? "No cancellation intakes waiting. When Granot cancels a job, it will show up here. Press Refresh to check again."
    : "No finished cancellation intakes match this view.";
}

export function intakeCaseHref(caseId: string): string {
  return `/ingestion/granot/lifecycle/cases/${encodeURIComponent(caseId)}?return=${encodeURIComponent(INTAKE_CASE_RETURN)}`;
}

export function intakeJobHref(normalizedJobNo: string): string {
  return `/ingestion/granot/lifecycle/jobs/${encodeURIComponent(normalizedJobNo)}`;
}

export function isAllowedIntakeReturn(value: string | undefined | null): value is typeof INTAKE_CASE_RETURN {
  return value === INTAKE_CASE_RETURN;
}
