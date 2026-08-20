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

export function intakeActionLabel(kind: IntakeKind): string {
  return kind === "cancellation" ? "Review cancellation" : "Finish booking";
}

export function intakeNextStep(item: Pick<GranotLifecycleCaseListItem, "kind" | "mode">): string {
  if (item.kind === "release") {
    return "Open this case to review official cancellation details.";
  }
  switch (item.mode) {
    case "create_missing_booking":
      return "Open this case to choose a lead and enter official binder, deposit, agents, and merchant.";
    case "review_existing_booking":
      return "Open this case to review the official booking values.";
    case "create_referral_booking":
      return "Open this case to enter official binder, deposit, agents, and merchant.";
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
        ? "Official booking values are below. Use the same agent and merchant catalog as a normal booking, or leave official records unchanged."
        : "Vantage already has an official booking on this job. The official form appears here when owner booking work is enabled.",
    };
  }
  return {
    title: "How to finish this booking",
    body: input.commandsAvailable
      ? "The matching lead is already filled in below — check the name, phone, email, job number, and reference. If it is the wrong customer, use the lead search beside the form. Then enter official binder, deposit, agents, and merchant from the same Operations Registry catalog as a normal booking. Granot estimate and payment numbers stay as reference only."
      : "This case is waiting for official binder, deposit, agents, and merchant. The official form appears here when owner booking work is enabled.",
  };
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

export function intakeJobHref(normalizedJobNo: string): string {
  return `/ingestion/granot/lifecycle/jobs/${encodeURIComponent(normalizedJobNo)}`;
}

export function isAllowedIntakeReturn(value: string | undefined | null): value is string {
  if (!value) return false;
  if (value === INTAKE_CASE_RETURN) return true;
  if (!value.startsWith(`${INTAKE_CASE_RETURN}?`)) return false;
  return !value.includes("://") && !value.includes("//");
}
