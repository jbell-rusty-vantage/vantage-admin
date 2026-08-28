import type {
  EnhancedJobTimelineEvent,
  EnhancedJobTimelinePage,
  JobTimelineEvent,
  JobTimelinePage,
} from "../lib/api/jobNumberTimeline";

const GOOGLE_LIMITATION_LABEL =
  "Sheet Sync completion is not current Google destination equality.";
const WORDPRESS_LIMITATION_LABEL =
  "Lead creation is recorded; independent WordPress submission receipt is unavailable.";

export const v1Page: JobTimelinePage = {
  normalized_job_no: "5562924",
  job_no_snapshot: "P5562924",
  proof_shape: "wordpress_born",
  source: {
    source_company_id: "company-1",
    source_company_label: "Moving Place",
    source_granularity_id: "gran-1",
    source_granularity_label: "Moving Place web",
  },
  coverage: {
    lead: "resolved",
    lead_message: "present",
    job_number_at_create: false,
    booking_intake: "open",
    cancellation_intake: "absent",
    official_booking: true,
    official_cancellation: false,
    sheet_sync: "synced",
  },
  current: {
    lead_ref: { model: "FormLead", id: "lead-1" },
    ingestion_origin: "wordpress_form",
    booking_id: "booking-1",
  },
  events: [
    {
      id: "e1",
      kind: "lead_created",
      event_at: "2026-08-01T10:00:00.000Z",
      clock_field: "entity_change.applied_at",
      type_priority: 10,
      coverage: "command_backed",
      headline: "Lead created (wordpress_form)",
      data: {
        ingestion_origin: "wordpress_form",
        command_name: "createFormLead",
        lead_model: "FormLead",
        form_snapshot: {
          submitted_as: "A•••",
          phone_masked: "•••1234",
          email_masked: "a•••@example.invalid",
          move_date: "2026-04-01T00:00:00.000Z",
          move_size: "2 Bedrooms",
          pickup: "NY 10001",
          delivery: "FL 33101",
        },
      },
    },
    {
      id: "e2",
      kind: "lead_message",
      event_at: "2026-08-01T10:01:00.000Z",
      clock_field: "lead_message.delivered_at",
      type_priority: 20,
      coverage: "command_backed",
      headline: "Text delivered (welcome)",
      data: { origin: "public_form", purpose: "welcome", status: "delivered" },
    },
    {
      id: "e3",
      kind: "job_number_acquired",
      event_at: "2026-08-01T12:00:00.000Z",
      clock_field: "entity_change.applied_at",
      type_priority: 30,
      coverage: "command_backed",
      headline: "Job Number acquired",
      data: { acquired_at_create: false },
    },
  ],
};

function enhance(
  event: JobTimelineEvent,
  extras: Pick<EnhancedJobTimelineEvent, "stage" | "evidence_level" | "status" | "causality"> & {
    occurred_at_field?: string;
    summary?: string | null;
    explanation?: string;
    evidence?: EnhancedJobTimelineEvent["evidence"];
  },
): EnhancedJobTimelineEvent {
  return {
    ...event,
    stage: extras.stage,
    evidence_level: extras.evidence_level,
    time: {
      occurred_at: event.event_at,
      occurred_at_field: extras.occurred_at_field ?? event.clock_field,
      recorded_at: event.event_at,
      recorded_at_field: "createdAt",
      precision: "domain",
    },
    summary: extras.summary ?? event.headline,
    status: extras.status,
    correlation: {
      method: "direct_job_number",
      confidence: "exact",
      explanation: extras.explanation ?? "Event is in scope for the typed Job Number.",
    },
    causality: extras.causality,
    evidence: extras.evidence ?? [],
  };
}

const created = enhance(v1Page.events[0], {
  stage: "origin",
  evidence_level: "verified_change",
  status: "completed",
  causality: { activity_id: "act-create", caused_by_event_ids: [], resulting_event_ids: ["e2"] },
  explanation: "Lead existed before Job Number; the page walked back from later Job-scoped facts.",
});
const text = enhance(v1Page.events[1], {
  stage: "engagement",
  evidence_level: "external_acknowledgement",
  status: "completed",
  causality: { activity_id: "act-text", caused_by_event_ids: ["e1"], resulting_event_ids: [] },
});
const jobNumber = enhance(v1Page.events[2], {
  stage: "qualification",
  evidence_level: "verified_change",
  status: "completed",
  causality: { activity_id: "act-job", caused_by_event_ids: [], resulting_event_ids: [] },
});
const observation = enhance(
  {
    id: "e4",
    kind: "granot_observation",
    event_at: "2026-08-01T13:00:00.000Z",
    clock_field: "observation.captured_at",
    type_priority: 50,
    coverage: "evidence_only",
    headline: "Granot priority_updated",
    data: { route_event_class: "priority_updated", normalization_result: "usable" },
  },
  {
    stage: "processing",
    evidence_level: "recorded_evidence",
    status: "informational",
    causality: { activity_id: "act-granot", caused_by_event_ids: [], resulting_event_ids: ["e5", "e6"] },
  },
);
const decision = enhance(
  {
    id: "e5",
    kind: "synchronization_decision",
    event_at: "2026-08-01T13:01:00.000Z",
    clock_field: "decision.decided_at",
    type_priority: 60,
    coverage: "evidence_only",
    headline: "Decision applied / lead_synchronized",
    data: { outcome: "applied", reason_code: "lead_synchronized", execution_mode: "live", attempt: 1 },
  },
  {
    stage: "processing",
    evidence_level: "recorded_evidence",
    status: "completed",
    causality: { activity_id: "act-granot", caused_by_event_ids: ["e4"], resulting_event_ids: ["e6"] },
  },
);
const updated = enhance(
  {
    id: "e6",
    kind: "lead_updated",
    event_at: "2026-08-01T13:02:00.000Z",
    clock_field: "entity_change.applied_at",
    type_priority: 40,
    coverage: "command_backed",
    headline: "Lead updated (synchronizeLeadFromGranot)",
    data: { command_name: "synchronizeLeadFromGranot", changed_paths: ["granot_priority"] },
  },
  {
    stage: "qualification",
    evidence_level: "verified_change",
    status: "completed",
    causality: { activity_id: "act-granot", caused_by_event_ids: ["e5"], resulting_event_ids: [] },
    evidence: [{ source_kind: "changed_path", safe_label: "granot_priority", ref: "granot_priority" }],
  },
);
const booking = enhance(
  {
    id: "e7",
    kind: "official_booking",
    event_at: "2026-08-01T14:00:00.000Z",
    clock_field: "booking.book_date",
    type_priority: 90,
    coverage: "official_fact_only",
    headline: "Official Booking recorded",
    data: { booking_id: "booking-1" },
  },
  {
    stage: "booking",
    evidence_level: "official_record",
    status: "completed",
    causality: { activity_id: "act-booking", caused_by_event_ids: [], resulting_event_ids: [] },
  },
);
const cancellation = enhance(
  {
    id: "e8",
    kind: "official_cancellation",
    event_at: "2026-08-01T15:00:00.000Z",
    clock_field: "cancellation.cancel_date",
    type_priority: 100,
    coverage: "official_fact_only",
    headline: "Official Cancellation recorded",
    data: { cancellation_id: "cancel-1" },
  },
  {
    stage: "cancellation",
    evidence_level: "official_record",
    status: "completed",
    causality: { activity_id: "act-cancel", caused_by_event_ids: [], resulting_event_ids: [] },
  },
);
const sheet = enhance(
  {
    id: "e9",
    kind: "sheet_sync",
    event_at: "2026-08-01T14:05:00.000Z",
    clock_field: "sheet_sync.updatedAt",
    type_priority: 110,
    coverage: "evidence_only",
    headline: "Sheet Sync synced (source_lead / form_lead.create)",
    data: { status: "synced", resource: "source_lead", operation: "form_lead.create", entity_model: "FormLead" },
  },
  {
    stage: "delivery",
    evidence_level: "recorded_evidence",
    status: "completed",
    causality: { activity_id: "act-sheet", caused_by_event_ids: [], resulting_event_ids: [] },
  },
);

const STAGES: EnhancedJobTimelinePage["stage_assessments"] = [
  { stage: "origin", state: "complete", label: "Lead recorded", reason_code: "LEAD_RECORDED", event_ids: ["e1"] },
  { stage: "engagement", state: "complete", label: "Text delivered", reason_code: "TEXT_DELIVERED", event_ids: ["e2"] },
  { stage: "qualification", state: "complete", label: "Job Number known", reason_code: "JOB_NUMBER_KNOWN", event_ids: ["e3"] },
  { stage: "processing", state: "complete", label: "Granot evidence evaluated", reason_code: "GRANOT_EVIDENCE_EVALUATED", event_ids: ["e4", "e5"] },
  { stage: "booking", state: "complete", label: "Booked", reason_code: "BOOKING_OFFICIAL", event_ids: ["e7"] },
  { stage: "cancellation", state: "complete", label: "Cancelled", reason_code: "CANCELLATION_OFFICIAL", event_ids: ["e8"] },
  { stage: "delivery", state: "unverifiable", label: "Google not verified", reason_code: "GOOGLE_DESTINATION_UNVERIFIED", event_ids: ["e9"] },
];

function pageFrom(
  events: EnhancedJobTimelineEvent[],
  extras: Partial<EnhancedJobTimelinePage> = {},
): EnhancedJobTimelinePage {
  return {
    ...v1Page,
    coverage: {
      ...v1Page.coverage,
      official_cancellation: true,
      cancellation_intake: "resolved",
    },
    schema_version: "job_timeline.v2",
    assembled_at: "2026-08-27T16:00:00.000Z",
    current_outcome: "cancelled",
    summary: {
      headline: "Cancelled",
      origin_label: "Moving Place web",
      latest_activity_at: events[events.length - 1]?.event_at ?? null,
      event_count: events.length,
      attention_count: extras.attention?.length ?? 0,
    },
    freshness: {
      mongo_read_at: "2026-08-27T16:00:00.000Z",
      consistency: "multi_query_best_effort",
      ringcentral_covered_through: null,
      ringcentral_cursor_lag_seconds: null,
      google_destination_readback: "not_performed",
    },
    stage_assessments: STAGES,
    attention: [],
    limitations: [
      {
        code: "GOOGLE_DESTINATION_UNVERIFIED",
        reason_code: "GOOGLE_DESTINATION_UNVERIFIED",
        label: GOOGLE_LIMITATION_LABEL,
        event_ids: ["e9"],
      },
      {
        code: "WORDPRESS_RECEIPT_UNAVAILABLE",
        reason_code: "WORDPRESS_RECEIPT_UNAVAILABLE",
        label: WORDPRESS_LIMITATION_LABEL,
        event_ids: ["e1"],
      },
      {
        code: "MULTI_QUERY_READ",
        reason_code: "MULTI_QUERY_READ",
        label: "This page is assembled across multiple reads, not one database snapshot.",
        event_ids: [],
      },
    ],
    activities: [
      {
        activity_id: "act-granot",
        heading: "Granot priority_updated",
        event_ids: ["e4", "e5", "e6"],
        started_at: "2026-08-01T13:00:00.000Z",
        ended_at: "2026-08-01T13:02:00.000Z",
      },
    ],
    events,
    ...extras,
  };
}

export const v2Page = pageFrom([
  created,
  text,
  jobNumber,
  observation,
  decision,
  updated,
  booking,
  sheet,
  cancellation,
]);

export const v2PageWithAttention: EnhancedJobTimelinePage = pageFrom(
  [created, text, jobNumber, observation, decision, updated],
  {
    current_outcome: "lead_active",
    summary: {
      headline: "Lead recorded",
      origin_label: "Moving Place web",
      latest_activity_at: updated.event_at,
      event_count: 6,
      attention_count: 1,
    },
    stage_assessments: STAGES.map((stage) =>
      stage.stage === "processing"
        ? { ...stage, state: "attention" as const, label: "Granot evidence incomplete", reason_code: "PROCESSING_EVIDENCE_GAP" }
        : stage.stage === "booking"
          ? { ...stage, state: "not_started" as const, label: "Not yet booked", reason_code: "BOOKING_NOT_STARTED", event_ids: [] }
          : stage.stage === "cancellation"
            ? { ...stage, state: "not_started" as const, label: "No cancellation activity", reason_code: "CANCELLATION_NOT_STARTED", event_ids: [] }
            : stage,
    ),
    attention: [
      {
        code: "PROCESSING_EVIDENCE_GAP",
        reason_code: "PROCESSING_EVIDENCE_GAP",
        label: "A claimed applied Decision lacks its required EntityChange.",
        event_ids: ["e5"],
      },
    ],
  },
);

export { GOOGLE_LIMITATION_LABEL, WORDPRESS_LIMITATION_LABEL };
