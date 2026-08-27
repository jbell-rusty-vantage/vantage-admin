"use client";

import { filtersToQueryString, type SerializableFilters } from "./filters";
import type { ApiResponse } from "./types";

export type JobTimelineEventKind =
  | "source_received"
  | "lead_created"
  | "lead_message"
  | "job_number_acquired"
  | "lead_updated"
  | "granot_observation"
  | "synchronization_decision"
  | "booking_intake"
  | "cancellation_intake"
  | "official_booking"
  | "official_cancellation"
  | "sheet_sync";

export type JobTimelineStage =
  | "origin"
  | "engagement"
  | "qualification"
  | "processing"
  | "booking"
  | "cancellation"
  | "delivery";

export type EvidenceLevel =
  | "verified_change"
  | "official_record"
  | "recorded_evidence"
  | "external_acknowledgement"
  | "limitation";

export type JobTimelineOutcome =
  | "lead_active"
  | "booking_intake_open"
  | "booked"
  | "cancellation_intake_open"
  | "cancelled"
  | "contradictory"
  | "unknown";

export type StageAssessmentState =
  | "complete"
  | "active"
  | "not_started"
  | "not_applicable"
  | "attention"
  | "unverifiable";

export type StageAssessment = {
  stage: JobTimelineStage;
  state: StageAssessmentState;
  label: string;
  reason_code: string;
  event_ids: string[];
};

export type TimelineEventTime = {
  occurred_at: string;
  occurred_at_field: string;
  recorded_at: string | null;
  recorded_at_field: string | null;
  precision: "provider" | "domain" | "capture" | "storage_fallback";
};

export type TimelineCorrelation = {
  method:
    | "direct_job_number"
    | "equivalent_job_number"
    | "record_link"
    | "lead_reference"
    | "booking_reference"
    | "observation_reference"
    | "entity_change_reference"
    | "sheet_entity_reference";
  confidence: "exact" | "walked_back" | "limited";
  explanation: string;
};

export type TimelineCausality = {
  activity_id: string;
  caused_by_event_ids: string[];
  resulting_event_ids: string[];
};

export type TimelineEvidenceRef = {
  source_kind: string;
  safe_label: string;
  ref: string;
};

export type TimelineAttentionCode =
  | "LEAD_UNRESOLVED"
  | "BOOKING_CASE_RESOLVED_WITHOUT_FACT"
  | "CANCELLATION_CASE_RESOLVED_WITHOUT_FACT"
  | "ORPHAN_CANCELLATION_REFERENCE"
  | "SHEET_SYNC_PENDING_TOO_LONG"
  | "SHEET_SYNC_TERMINAL_FAILURE"
  | "CONTRADICTORY_OFFICIAL_STATE"
  | "SOURCE_SCOPE_CONFLICT"
  | "PROCESSING_EVIDENCE_GAP";

export type TimelineLimitationCode =
  | "WORDPRESS_RECEIPT_UNAVAILABLE"
  | "RINGCENTRAL_CURSOR_BOUNDED"
  | "GOOGLE_DESTINATION_UNVERIFIED"
  | "MOVE_COMPLETION_UNAVAILABLE"
  | "MULTI_QUERY_READ"
  | "TIMELINE_TRUNCATED";

export type TimelineAttention = {
  code: TimelineAttentionCode;
  reason_code: TimelineAttentionCode;
  label: string;
  event_ids: string[];
};

export type TimelineLimitation = {
  code: TimelineLimitationCode;
  reason_code: TimelineLimitationCode;
  label: string;
  event_ids: string[];
  counts_by_stage?: Partial<Record<JobTimelineStage, number>>;
};

export type TimelineActivity = {
  activity_id: string;
  heading: string;
  event_ids: string[];
  started_at: string;
  ended_at: string;
};

export const TIMELINE_DENSITY_VIEWS = [
  "lifecycle",
  "all",
  "attention",
  "customer",
  "system",
] as const;

export type TimelineDensityView = (typeof TIMELINE_DENSITY_VIEWS)[number];

export const DEFAULT_TIMELINE_VIEW: TimelineDensityView = "lifecycle";

export function parseTimelineView(value: string | null | undefined): TimelineDensityView {
  return TIMELINE_DENSITY_VIEWS.includes(value as TimelineDensityView)
    ? (value as TimelineDensityView)
    : DEFAULT_TIMELINE_VIEW;
}

export type JobTimelineCoverageFlag =
  | "command_backed"
  | "official_fact_only"
  | "evidence_only";

export type JobTimelineProofShape =
  | "granot_born"
  | "wordpress_born"
  | "ringcentral_born"
  | "other";

export type JobTimelineLeadModel = "FormLead" | "CallLead";

export type JobTimelineEvent = {
  id: string;
  kind: JobTimelineEventKind;
  event_at: string;
  clock_field: string;
  type_priority: number;
  coverage: JobTimelineCoverageFlag;
  headline: string;
  data: Record<string, unknown>;
};

export type EnhancedJobTimelineEvent = JobTimelineEvent & {
  stage: JobTimelineStage;
  evidence_level: EvidenceLevel;
  time: TimelineEventTime;
  summary: string | null;
  status: "completed" | "active" | "pending" | "failed" | "informational";
  correlation: TimelineCorrelation;
  causality: TimelineCausality;
  evidence: TimelineEvidenceRef[];
};

export type JobTimelinePage = {
  normalized_job_no: string;
  job_no_snapshot: string | null;
  proof_shape: JobTimelineProofShape;
  source: {
    source_company_id: string | null;
    source_company_label: string | null;
    source_granularity_id: string | null;
    source_granularity_label: string | null;
  };
  coverage: {
    lead: "resolved" | "unresolved";
    lead_message: "present" | "absent";
    job_number_at_create: boolean;
    booking_intake: "absent" | "open" | "resolved";
    cancellation_intake: "absent" | "open" | "resolved";
    official_booking: boolean;
    official_cancellation: boolean;
    sheet_sync: "absent" | "pending" | "synced" | "failed" | "mixed";
  };
  current: {
    lead_ref?: { model: JobTimelineLeadModel; id: string };
    ingestion_origin?: string;
    record_link_id?: string;
    booking_id?: string;
    cancellation_id?: string;
  };
  events: JobTimelineEvent[];
};

export type EnhancedJobTimelinePage = Omit<JobTimelinePage, "events"> & {
  schema_version: "job_timeline.v2";
  assembled_at: string;
  current_outcome: JobTimelineOutcome;
  summary: {
    headline: string;
    origin_label: string;
    latest_activity_at: string | null;
    event_count: number;
    attention_count: number;
  };
  freshness: {
    mongo_read_at: string;
    consistency: "multi_query_best_effort";
    ringcentral_covered_through: string | null;
    ringcentral_cursor_lag_seconds: number | null;
    google_destination_readback: "not_performed";
  };
  stage_assessments: StageAssessment[];
  attention: TimelineAttention[];
  limitations: TimelineLimitation[];
  activities: TimelineActivity[];
  events: EnhancedJobTimelineEvent[];
};

export function isEnhancedJobTimelinePage(
  page: JobTimelinePage | EnhancedJobTimelinePage,
): page is EnhancedJobTimelinePage {
  return "schema_version" in page && page.schema_version === "job_timeline.v2";
}

export function isEnhancedJobTimelineEvent(
  event: JobTimelineEvent,
): event is EnhancedJobTimelineEvent {
  return (
    "time" in event
    && "causality" in event
    && "evidence_level" in event
    && "stage" in event
  );
}

export type JobTimelineResolvedScope = {
  kind: "lead" | "record_link" | "decision" | "observation_route";
  source_granularity_id: string | null;
  source_granularity_label: string | null;
  source_company_id?: string | null;
  owner_label?: string | null;
};

export type JobTimelineAssembleResult =
  | { status: "ok"; page: JobTimelinePage | EnhancedJobTimelinePage }
  | { status: "invalid_job_number"; normalized_job_no: null }
  | { status: "not_found"; normalized_job_no: string }
  | {
      status: "filtered_out";
      normalized_job_no: string;
      scopes: JobTimelineResolvedScope[];
    };

export type JobNumberTimelineFilters = {
  job_no: string;
  source_granularity_id?: string;
  source_company_id?: string;
};

export const JOB_TIMELINE_HREF = "/job-timeline";

export const PROOF_SHAPE_LABELS: Record<JobTimelineProofShape, string> = {
  granot_born: "Granot-born",
  wordpress_born: "WordPress-born",
  ringcentral_born: "RingCentral-born",
  other: "Other",
};

function proxyUrl(path: string, filters?: SerializableFilters): string {
  const normalized = path.startsWith("/") ? path.slice(1) : path;
  return `/api/proxy/${normalized}${filters ? filtersToQueryString(filters) : ""}`;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  let payload: ApiResponse<T> | undefined;
  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    payload = undefined;
  }

  if (!response.ok || !payload || !payload.ok) {
    const rawMessage = payload && !payload.ok ? payload.error : response.statusText;
    throw new Error(rawMessage?.trim() || `Request failed (${response.status}).`);
  }

  return payload.data;
}

export function fetchJobNumberTimeline(
  filters: JobNumberTimelineFilters,
): Promise<JobTimelineAssembleResult> {
  const job_no = filters.job_no.trim();
  return requestJson(
    proxyUrl("api/v1/admin/job-number-timeline", {
      job_no,
      source_granularity_id: filters.source_granularity_id?.trim() || undefined,
      source_company_id: filters.source_company_id?.trim() || undefined,
    }),
  );
}

export function buildJobTimelineHref(input: {
  job?: string;
  source_granularity_id?: string;
  source_company_id?: string;
  view?: TimelineDensityView;
}): string {
  const params = new URLSearchParams();
  if (input.job?.trim()) params.set("job", input.job.trim());
  if (input.source_granularity_id?.trim()) {
    params.set("source_granularity_id", input.source_granularity_id.trim());
  }
  if (input.source_company_id?.trim()) {
    params.set("source_company_id", input.source_company_id.trim());
  }
  if (input.view && input.view !== DEFAULT_TIMELINE_VIEW) {
    params.set("view", input.view);
  }
  const query = params.toString();
  return query ? `${JOB_TIMELINE_HREF}?${query}` : JOB_TIMELINE_HREF;
}
