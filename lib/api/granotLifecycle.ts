import { filtersToQueryString, type SerializableFilters } from "./filters";
import type { ApiResponse } from "./types";

export type GranotLeadModel = "FormLead" | "CallLead";
export type GranotEntityRef = {
  model:
    | GranotLeadModel
    | "BookedLead"
    | "CancelledLead"
    | "GranotRecordLink"
    | "GranotBookingReconciliationCase"
    | "GranotReleaseReconciliationCase";
  id: string;
};

export type GranotLifecycleCaseListFilters = {
  kind?: "booking" | "release";
  state?: "open" | "resolved";
  mode?: string;
  source_id?: string;
  normalized_job_no?: string;
  opened_from?: string;
  opened_to?: string;
  sort?: "last_evidence_at" | "opened_at";
  order?: "asc" | "desc";
  cursor?: string;
  limit?: number;
};

export type GranotLifecycleCaseListItem = {
  case_id: string;
  kind: "booking" | "release";
  state: "open" | "resolved";
  mode: string;
  sequence_number: number;
  normalized_job_no: string;
  job_no: string;
  source: { id?: string; label?: string };
  masked_contact_label: string;
  latest_action: "priority_5" | "booked" | "release";
  evidence_count: number;
  case_revision: number;
  evidence_revision: number;
  deterministic_booking: { present: boolean; masked_ref?: string };
  opened_at: string;
  last_evidence_at: string;
  resolved_at?: string;
};

export type GranotLifecycleCaseListPage = {
  items: GranotLifecycleCaseListItem[];
  next_cursor: string | null;
};

export type SafeRecordLinkProjection = {
  id: string;
  state: "active" | "superseded";
  disputed: boolean;
  source_scope?: { lead_source_company: string; source_granularity_id: string };
  lead_ref?: GranotEntityRef;
  booking_ref?: string;
  domain_revision: number;
};

export type SafeBookingProjection = {
  id: string;
  normalized_job_no: string;
  job_no: string | null;
  book_date: string;
  customer_name: string | null;
  source: string;
  merchant: string;
  deposit_amount: number;
  total_binder_amount: number;
  agent_allocations: Array<{ agent_name: string; binder_amount: number }>;
  domain_revision: number;
  lead_ref?: GranotEntityRef;
};

export type SafeCancellationProjection = {
  id: string;
  booking_id: string;
  cancel_date: string;
  reason?: string;
  refund_amount: number;
  domain_revision: number;
};

export type GranotTimelineEntry =
  | TimelineEntry<"observation", 10, {
      observation_id: string;
      receipt_id: string;
      normalization_result: "valid" | "valid_with_issues" | "invalid" | "unsupported";
      issue_codes: string[];
    }>
  | TimelineEntry<"priority_effect", 20, {
      observation_id: string;
      decision_id?: string;
      canonical_priority: string;
      changed_paths: string[];
    }>
  | TimelineEntry<"booking_action", 30, {
      observation_id: string;
      decision_id?: string;
      action: "booked" | "release";
    }>
  | TimelineEntry<"decision", 40, {
      decision_id: string;
      observation_id: string;
      execution_mode: "historical_shadow" | "live_shadow" | "live";
      outcome: string;
      reason_code: string;
      target?: GranotEntityRef;
      effects: Array<{ kind: string; ref?: GranotEntityRef; changed_paths?: string[] }>;
    }>
  | TimelineEntry<"case", 50, {
      case_id: string;
      kind: "booking" | "release";
      event: "opened" | "refreshed" | "resolved";
      state: "open" | "resolved";
      mode: string;
      sequence_number: number;
      case_revision: number;
      evidence_revision: number;
      observation_id?: string;
    }>
  | TimelineEntry<"discrepancy", 60, {
      discrepancy_id: string;
      kind: "booking" | "release";
      state: "open" | "resolved";
      reason_code: string;
    }>
  | TimelineEntry<"record_link_change", 70, {
      record_link_id: string;
      event: "established" | "refreshed" | "corrected" | "superseded";
      domain_revision: number;
      lead_ref?: GranotEntityRef;
      booking_ref?: string;
    }>
  | TimelineEntry<"entity_change", 80, {
      change_id: string;
      entity: GranotEntityRef;
      command_execution_id: string;
      revision_before: number;
      revision_after: number;
      changed_paths: string[];
    }>
  | TimelineEntry<"official_booking", 90, {
      booking_id: string;
      normalized_job_no: string;
      domain_revision: number;
      cancellation_id?: string;
    }>
  | TimelineEntry<"official_cancellation", 100, {
      cancellation_id: string;
      booking_id: string;
      domain_revision: number;
    }>;

type TimelineEntry<T extends string, P extends number, D> = {
  id: string;
  type: T;
  event_at: string;
  type_priority: P;
  data: D;
};

export type GranotTimelinePage = {
  items: GranotTimelineEntry[];
  next_cursor: string | null;
  current: {
    record_link?: SafeRecordLinkProjection;
    booking?: SafeBookingProjection;
    cancellation?: SafeCancellationProjection;
  };
  capabilities: {
    booking_cases: boolean;
    release_cases: boolean;
    discrepancies: boolean;
    official_facts: true;
  };
};

export type GranotLifecycleCaseDetail = {
  case_id: string;
  kind: "booking" | "release";
  state: "open" | "resolved";
  mode: string;
  sequence_number: number;
  case_revision: number;
  evidence_revision: number;
  normalized_job_no: string;
  job_no: string;
  opened_at: string;
  last_evidence_at: string;
  resolved_at?: string;
  source_scope?: {
    granot_crm_source_id: string;
    lead_source_company: string;
    source_granularity_id: string;
  };
  evidence: Array<{
    observation_id: string;
    decision_id: string;
    captured_at: string;
    action: "priority_5" | "booked" | "release";
    normalization_result?: "valid" | "valid_with_issues" | "invalid" | "unsupported";
    decision_outcome?: string;
    decision_reason_code?: string;
  }>;
  observed_context: {
    section_label: "Granot evidence — not official Vantage values";
    contact?: SafeContact;
    move_date?: string;
    estimated_cubic_feet?: number;
    estimate?: string;
    payment?: string;
    balance?: string;
    granot_priority?: string;
    granot_username?: string;
  };
  contacts: {
    submitted_or_ingested?: SafeContact;
    accepted_granot?: SafeContact;
  };
  suggestion?: {
    lead_ref: GranotEntityRef;
    confidence: "high" | "medium";
    match_method: string;
    reason_codes: string[];
  };
  candidate_search: {
    available: boolean;
    default_scope: "source";
    all_scope_warning: boolean;
  };
  record_link?: SafeRecordLinkProjection;
  official_current: {
    booking?: SafeBookingProjection;
    cancellation?: SafeCancellationProjection;
  };
  official_draft: Record<string, never>;
  employee_booking_lead_reconciliation?: {
    case_id: string;
    status: string;
    href: string;
  };
  timeline: GranotTimelinePage;
  capabilities: {
    commands: false;
    referral: boolean;
    release_cases: boolean;
    discrepancies: boolean;
  };
};

export type SafeContact = { name?: string; phone_number?: string; email?: string };

export type GranotLifecycleCandidateFilters = {
  scope?: "source" | "all";
  lead_model?: GranotLeadModel;
  q?: string;
  cursor?: string;
  limit?: number;
};

export type GranotLifecycleCandidateItem = {
  lead_ref: GranotEntityRef;
  masked_contact_label: string;
  job_no?: string;
  reference?: string;
  source: {
    lead_source_company?: string;
    source_company_label?: string;
    source_granularity_id?: string;
    source_granularity_label?: string;
  };
  confidence: "high" | "medium";
  reason_codes: string[];
  match_method: string;
  in_source_scope: boolean;
  eligibility: "eligible";
  suggested: boolean;
  requires_override_reason: boolean;
};

export type GranotLifecycleCandidatePage = {
  items: GranotLifecycleCandidateItem[];
  next_cursor: string | null;
};

export type GranotTimelineFilters = { cursor?: string; limit?: number };

export class GranotLifecycleApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly requestId?: string;
  readonly issues?: unknown;

  constructor(input: {
    message: string;
    status: number;
    code?: string;
    requestId?: string;
    issues?: unknown;
  }) {
    super(input.message);
    this.name = "GranotLifecycleApiError";
    this.status = input.status;
    this.code = input.code;
    this.requestId = input.requestId;
    this.issues = input.issues;
  }
}

function proxyUrl(path: string, filters?: SerializableFilters): string {
  const normalized = path.startsWith("/") ? path.slice(1) : path;
  return `/api/proxy/${normalized}${filters ? filtersToQueryString(filters) : ""}`;
}

async function requestJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "include" });
  let payload: (ApiResponse<T> & { code?: string }) | undefined;
  try {
    payload = (await response.json()) as ApiResponse<T> & { code?: string };
  } catch {
    payload = undefined;
  }

  if (!response.ok || !payload || !payload.ok) {
    const failure = payload && !payload.ok ? payload : undefined;
    throw new GranotLifecycleApiError({
      message: failure?.error ?? `Request failed (${response.status}).`,
      status: response.status,
      code: failure?.registry_code ?? failure?.code,
      requestId: failure?.request_id,
      issues: failure?.issues,
    });
  }
  return unwrapEnvelope(payload.data);
}

function unwrapEnvelope<T>(value: unknown): T {
  let current = value;
  for (let depth = 0; depth < 2; depth += 1) {
    if (
      current &&
      typeof current === "object" &&
      "ok" in current &&
      (current as { ok: unknown }).ok === true &&
      "data" in current
    ) {
      current = (current as { data: unknown }).data;
      continue;
    }
    break;
  }
  return current as T;
}

export function asGranotLifecycleCaseListPage(data: unknown): GranotLifecycleCaseListPage {
  const page = unwrapEnvelope(data);
  if (Array.isArray(page)) {
    return { items: page as GranotLifecycleCaseListItem[], next_cursor: null };
  }
  if (page && typeof page === "object") {
    const record = page as Partial<GranotLifecycleCaseListPage> & { cases?: unknown };
    const items = record.items ?? record.cases;
    return {
      items: Array.isArray(items) ? items : [],
      next_cursor: typeof record.next_cursor === "string" ? record.next_cursor : null,
    };
  }
  return { items: [], next_cursor: null };
}

export function fetchGranotLifecycleCases(
  filters: GranotLifecycleCaseListFilters = {},
): Promise<GranotLifecycleCaseListPage> {
  return requestJson(
    proxyUrl("api/v1/admin/granot-lifecycle/cases", filters as SerializableFilters),
  ).then(asGranotLifecycleCaseListPage);
}

export function fetchGranotLifecycleCase(caseId: string): Promise<GranotLifecycleCaseDetail> {
  return requestJson(
    proxyUrl(`api/v1/admin/granot-lifecycle/cases/${encodeURIComponent(caseId)}`),
  );
}

export function fetchGranotLifecycleCandidates(
  caseId: string,
  filters: GranotLifecycleCandidateFilters = {},
): Promise<GranotLifecycleCandidatePage> {
  const normalized = {
    ...filters,
    q: filters.q?.trim() || undefined,
  };
  return requestJson(
    proxyUrl(
      `api/v1/admin/granot-lifecycle/cases/${encodeURIComponent(caseId)}/candidates`,
      normalized as SerializableFilters,
    ),
  );
}

export function fetchGranotJobTimeline(
  jobNo: string,
  filters: GranotTimelineFilters = {},
): Promise<GranotTimelinePage> {
  return requestJson(
    proxyUrl(
      `api/v1/admin/granot-lifecycle/jobs/${encodeURIComponent(jobNo)}`,
      filters as SerializableFilters,
    ),
  );
}

export function fetchGranotLeadTimeline(
  leadModel: GranotLeadModel,
  leadId: string,
  filters: GranotTimelineFilters = {},
): Promise<GranotTimelinePage> {
  return requestJson(
    proxyUrl(
      `api/v1/admin/leads/${encodeURIComponent(leadModel)}/${encodeURIComponent(leadId)}/lifecycle`,
      filters as SerializableFilters,
    ),
  );
}
