import type {
  EnhancedJobTimelineEvent,
  StageAssessment,
  TimelineActivity,
  TimelineAttention,
  TimelineDensityView,
} from "@/lib/api/jobNumberTimeline";

const OFFICIAL_KINDS = new Set(["official_booking", "official_cancellation"]);

const CUSTOMER_KINDS = new Set([
  "lead_created",
  "lead_message",
  "job_number_acquired",
  "booking_intake",
  "cancellation_intake",
  "official_booking",
  "official_cancellation",
]);

const SYSTEM_KINDS = new Set([
  "source_received",
  "lead_updated",
  "granot_observation",
  "synchronization_decision",
  "sheet_sync",
]);

export const STAGE_COPY: Record<EnhancedJobTimelineEvent["stage"], string> = {
  origin: "Origin",
  engagement: "Engagement",
  qualification: "Qualification",
  processing: "Processing",
  booking: "Booking",
  cancellation: "Cancellation",
  delivery: "Delivery",
};

export function eventVisibleInDensity(
  event: EnhancedJobTimelineEvent,
  view: TimelineDensityView,
  attention: TimelineAttention[],
  stages: StageAssessment[],
): boolean {
  if (view === "lifecycle" || view === "all") return true;
  if (view === "customer") return CUSTOMER_KINDS.has(event.kind);
  if (view === "system") return SYSTEM_KINDS.has(event.kind);

  const attentionIds = new Set(attention.flatMap((item) => item.event_ids));
  if (attentionIds.has(event.id)) return true;
  const attentionStages = new Set(
    stages.filter((stage) => stage.state === "attention").map((stage) => stage.stage),
  );
  return attentionStages.has(event.stage);
}

export type SpineItem =
  | { type: "event"; event: EnhancedJobTimelineEvent }
  | { type: "cluster"; activity: TimelineActivity; children: EnhancedJobTimelineEvent[] };

export function buildSpineItems(
  events: EnhancedJobTimelineEvent[],
  activities: TimelineActivity[],
  options: { cluster: boolean },
): SpineItem[] {
  if (!options.cluster) {
    return events.map((event) => ({ type: "event" as const, event }));
  }

  const byId = new Map(events.map((event) => [event.id, event]));
  const used = new Set<string>();
  const items: SpineItem[] = [];

  for (const event of events) {
    if (used.has(event.id)) continue;

    if (OFFICIAL_KINDS.has(event.kind)) {
      used.add(event.id);
      items.push({ type: "event", event });
      continue;
    }

    const activity = activities.find(
      (row) => row.activity_id === event.causality.activity_id,
    );
    const siblings: EnhancedJobTimelineEvent[] = [];
    for (const id of activity?.event_ids ?? []) {
      const row = byId.get(id);
      if (row && !OFFICIAL_KINDS.has(row.kind)) siblings.push(row);
    }

    if (activity && siblings.length >= 2) {
      for (const child of siblings) used.add(child.id);
      items.push({ type: "cluster", activity, children: siblings });
      continue;
    }

    used.add(event.id);
    items.push({ type: "event", event });
  }

  return items;
}

export function relatedInActivity(
  event: EnhancedJobTimelineEvent,
  events: EnhancedJobTimelineEvent[],
): EnhancedJobTimelineEvent[] {
  return events.filter(
    (row) =>
      row.id !== event.id
      && row.causality.activity_id === event.causality.activity_id,
  );
}

export function safeChangedFieldGroups(event: EnhancedJobTimelineEvent): string[] {
  const groups = new Set<string>();
  for (const ref of event.evidence) {
    if (ref.source_kind !== "changed_path") continue;
    groups.add(ownerGroupForPath(ref.safe_label));
  }
  const paths = Array.isArray(event.data.changed_paths)
    ? event.data.changed_paths.filter((path): path is string => typeof path === "string")
    : [];
  for (const path of paths) {
    groups.add(ownerGroupForPath(path));
  }
  return [...groups];
}

function ownerGroupForPath(path: string): string {
  if (path === "job_no" || path === "normalized_job_no" || path === "ref_no") {
    return "Job identity";
  }
  if (/name|phone|email|contact/.test(path) && !path.startsWith("source_") && !path.includes("receiver_agent")) {
    return "Contact";
  }
  if (/move_|pickup_|delivery_|destination_|cubic_feet|over_2000|over_4000|^local$/.test(path)) {
    return "Move";
  }
  if (/receiver_agent|assigned|agent/.test(path)) {
    return "Assignment";
  }
  if (/source_|ingestion_|crm_source/.test(path)) {
    return "Attribution";
  }
  if (/quoted|booked|cancelled|granot_priority|post_to_granot/.test(path)) {
    return "Booking state";
  }
  return "Other";
}
