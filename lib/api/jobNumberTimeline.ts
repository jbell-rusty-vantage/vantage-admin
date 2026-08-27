"use client";

import { filtersToQueryString, type SerializableFilters } from "./filters";
import type { ApiResponse } from "./types";

export type JobTimelineEventKind =
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

export type JobTimelineResolvedScope = {
  kind: "lead" | "record_link" | "decision" | "observation_route";
  source_granularity_id: string | null;
  source_granularity_label: string | null;
  source_company_id?: string | null;
  owner_label?: string | null;
};

export type JobTimelineAssembleResult =
  | { status: "ok"; page: JobTimelinePage }
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
}): string {
  const params = new URLSearchParams();
  if (input.job?.trim()) params.set("job", input.job.trim());
  if (input.source_granularity_id?.trim()) {
    params.set("source_granularity_id", input.source_granularity_id.trim());
  }
  if (input.source_company_id?.trim()) {
    params.set("source_company_id", input.source_company_id.trim());
  }
  const query = params.toString();
  return query ? `${JOB_TIMELINE_HREF}?${query}` : JOB_TIMELINE_HREF;
}
