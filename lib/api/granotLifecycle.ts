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
    | "GranotReleaseReconciliationCase"
    | "GranotBookingDiscrepancy"
    | "GranotReleaseDiscrepancy";
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
  merchant_id?: string;
  deposit_amount: number;
  total_binder_amount: number;
  agent_allocations: Array<{ agent_id: string; agent_name: string; binder_amount: number }>;
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
  source?: { id?: string; label?: string };
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
    commands: boolean;
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
  lead_ref: { model: GranotLeadModel; id: string };
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

export type ConfirmGranotBookingBody = {
  expected_case_revision: number;
  selected_lead: { lead_model: GranotLeadModel; lead_id: string };
  out_of_scope_override_reason?: string;
  official_booking_details: {
    book_date: string;
    agent_allocations: Array<{ agent_id: string; binder_amount: number }>;
    total_binder_amount: number;
    deposit_amount: number;
    merchant_id: string;
  };
};

export type BookingOwnerCommandResult = {
  case_id: string;
  case_state: "resolved";
  case_revision: number;
  outcome: "booking_created" | "booking_updated" | "referral_booking_created" | "no_action" | "already_satisfied";
  command_execution_id: string;
  decision_id: string;
  booking_ref?: { id: string; domain_revision: number };
  record_link_ref?: { id: string; domain_revision: number };
  entity_refs: Array<{ model: string; id: string }>;
  replayed: boolean;
};

export type CreateReferralBookingBody = {
  expected_case_revision: number;
  official_booking_details: ConfirmGranotBookingBody["official_booking_details"];
};

export type UpdateGranotBookingBody = {
  expected_case_revision: number;
  expected_booking_revision: number;
  official_booking_details: ConfirmGranotBookingBody["official_booking_details"];
};

export type BookingNoActionReasonCode =
  | "already_handled_elsewhere"
  | "granot_action_not_authoritative"
  | "wrong_customer_or_job"
  | "duplicate_granot_action"
  | "booking_still_valid"
  | "granot_change_only"
  | "insufficient_information"
  | "legacy_data"
  | "other";

export type BookingNoActionBody = {
  expected_case_revision: number;
  reason_code?: BookingNoActionReasonCode;
  reason_text?: string;
};

export type ConfirmGranotCancellationBody = {
  expected_case_revision: number;
  expected_booking_revision: number;
  official_cancellation_details: {
    cancel_date: string;
    refund_amount: number;
    reason?: string;
    notes?: string;
    cancelled_by?: string;
  };
};

export type ReleaseOwnerCommandResult = {
  case_id: string;
  case_state: "resolved";
  case_revision: number;
  outcome: "cancellation_created" | "booking_updated" | "no_action" | "already_satisfied";
  command_execution_id: string;
  decision_id: string;
  booking_ref: { id: string; domain_revision: number };
  cancellation_ref?: { id: string; domain_revision: number };
  record_link_ref?: { id: string; domain_revision: number };
  entity_refs: Array<{ model: string; id: string }>;
  replayed: boolean;
};

export type GranotDiscrepancyListFilters = Omit<GranotLifecycleCaseListFilters, "mode"> & { reason_code?: string };
export type GranotDiscrepancyListItem = {
  discrepancy_id: string; kind: "booking" | "release"; state: "open" | "resolved";
  reason_code: string; normalized_job_no: string; masked_contact_label: string;
  evidence_count: number; revision: number; evidence_revision: number;
  opened_at: string; last_evidence_at: string; resolved_at?: string;
};
export type GranotDiscrepancyListPage = { items: GranotDiscrepancyListItem[]; next_cursor: string | null };
export type GranotDiscrepancyDetail = GranotDiscrepancyListItem & {
  reason_fingerprint: string; record_link?: SafeRecordLinkProjection; lead_ref?: GranotEntityRef;
  booking_id?: string; cancellation_id?: string;
  evidence: Array<{ observation_id: string; decision_id: string; captured_at: string; action: "priority_5" | "booked" | "release" }>;
  candidates: Array<{ lead_ref: { model: GranotLeadModel; id: string }; confidence: "high" | "medium"; match_method: string; reason_codes: string[]; suggested: boolean }>;
  resolution?: { outcome: "re_evaluated" | "record_link_corrected" | "no_action"; resolved_at: string; reason_code?: string; reason_text?: string };
  capabilities: { re_evaluate: boolean; correct_record_link: boolean; no_action: boolean };
};
export type ReEvaluateDiscrepancyBody = { expected_revision: number };
export type CorrectRecordLinkBody = { expected_revision: number; expected_link_revision: number; selected_lead: { lead_model: GranotLeadModel; lead_id: string }; reason_text: string };
export type DiscrepancyNoActionBody = { expected_revision: number; reason_code?: BookingNoActionReasonCode; reason_text?: string };
export type DiscrepancyOwnerCommandResult = {
  discrepancy_id: string; discrepancy_kind: "booking" | "release"; state: "open" | "resolved";
  revision: number; evidence_revision: number; outcome: "still_conflicting" | "re_evaluated" | "record_link_corrected" | "no_action";
  command_execution_id: string; replacement_record_link_id?: string;
  opened_case_ref?: { model: "GranotBookingReconciliationCase" | "GranotReleaseReconciliationCase"; id: string };
  replayed: boolean;
};

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

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
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

export function asGranotTimelinePage(data: unknown): GranotTimelinePage {
  const page = unwrapEnvelope(data);
  const record = page && typeof page === "object" ? page as Partial<GranotTimelinePage> : {};
  return {
    items: Array.isArray(record.items) ? record.items : [],
    next_cursor: typeof record.next_cursor === "string" ? record.next_cursor : null,
    current: record.current ?? {},
    capabilities: {
      booking_cases: Boolean(record.capabilities?.booking_cases),
      release_cases: Boolean(record.capabilities?.release_cases),
      discrepancies: Boolean(record.capabilities?.discrepancies),
      official_facts: true,
    },
  };
}

export function asGranotLifecycleCaseDetail(data: unknown): GranotLifecycleCaseDetail {
  const raw = unwrapEnvelope(data);
  const record = raw && typeof raw === "object" ? raw as Partial<GranotLifecycleCaseDetail> : {};
  if (typeof record.case_id !== "string" || record.case_id.trim() === "") {
    throw new GranotLifecycleApiError({
      message: "Lifecycle case response was empty. The Admin Preview is not reading the test-database projection.",
      status: 502,
      code: "GRANOT_CASE_PROJECTION_MISSING",
    });
  }
  return {
    ...record,
    official_current: record.official_current ?? {},
    official_draft: record.official_draft ?? {},
    evidence: record.evidence ?? [],
    contacts: record.contacts ?? {},
    observed_context: record.observed_context ?? {
      section_label: "Granot evidence — not official Vantage values",
    },
    candidate_search: record.candidate_search ?? {
      available: false,
      default_scope: "source",
      all_scope_warning: false,
    },
    timeline: asGranotTimelinePage(record.timeline),
    capabilities: record.capabilities ?? {
      commands: false,
      referral: false,
      release_cases: false,
      discrepancies: false,
    },
  } as GranotLifecycleCaseDetail;
}

export function fetchGranotLifecycleCase(caseId: string): Promise<GranotLifecycleCaseDetail> {
  return requestJson(
    proxyUrl(`api/v1/admin/granot-lifecycle/cases/${encodeURIComponent(caseId)}`),
  ).then(asGranotLifecycleCaseDetail);
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
  ).then((data) => {
    const page = unwrapEnvelope(data);
    const record = page && typeof page === "object" ? page as Partial<GranotLifecycleCandidatePage> : {};
    return {
      items: Array.isArray(record.items) ? record.items : [],
      next_cursor: typeof record.next_cursor === "string" ? record.next_cursor : null,
    };
  });
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
  ).then(asGranotTimelinePage);
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
  ).then(asGranotTimelinePage);
}

export function confirmGranotBooking(
  caseId: string,
  body: ConfirmGranotBookingBody,
  idempotencyKey: string,
): Promise<BookingOwnerCommandResult> {
  return requestJson(
    proxyUrl(`api/v1/admin/granot-lifecycle/booking-cases/${encodeURIComponent(caseId)}/confirm-booking`),
    {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(body),
    },
  );
}

export function updateGranotBooking(
  caseId: string,
  body: UpdateGranotBookingBody,
  idempotencyKey: string,
): Promise<BookingOwnerCommandResult> {
  return requestJson(
    proxyUrl(`api/v1/admin/granot-lifecycle/booking-cases/${encodeURIComponent(caseId)}/update-booking`),
    {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(body),
    },
  );
}

export function createGranotReferralBooking(
  caseId: string,
  body: CreateReferralBookingBody,
  idempotencyKey: string,
): Promise<BookingOwnerCommandResult> {
  return requestJson(
    proxyUrl(`api/v1/admin/granot-lifecycle/booking-cases/${encodeURIComponent(caseId)}/create-referral-booking`),
    {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(body),
    },
  );
}

export function resolveGranotBookingNoAction(
  caseId: string,
  body: BookingNoActionBody,
  idempotencyKey: string,
): Promise<BookingOwnerCommandResult> {
  return requestJson(
    proxyUrl(`api/v1/admin/granot-lifecycle/booking-cases/${encodeURIComponent(caseId)}/no-action`),
    {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(body),
    },
  );
}

export function confirmGranotCancellation(
  caseId: string,
  body: ConfirmGranotCancellationBody,
  idempotencyKey: string,
): Promise<ReleaseOwnerCommandResult> {
  return requestJson(
    proxyUrl(`api/v1/admin/granot-lifecycle/release-cases/${encodeURIComponent(caseId)}/confirm-cancellation`),
    {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(body),
    },
  );
}

export function updateGranotReleaseBooking(
  caseId: string,
  body: UpdateGranotBookingBody,
  idempotencyKey: string,
): Promise<ReleaseOwnerCommandResult> {
  return requestJson(
    proxyUrl(`api/v1/admin/granot-lifecycle/release-cases/${encodeURIComponent(caseId)}/update-booking`),
    {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(body),
    },
  );
}

export function resolveGranotReleaseNoAction(
  caseId: string,
  body: BookingNoActionBody,
  idempotencyKey: string,
): Promise<ReleaseOwnerCommandResult> {
  return requestJson(
    proxyUrl(`api/v1/admin/granot-lifecycle/release-cases/${encodeURIComponent(caseId)}/no-action`),
    {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(body),
    },
  );
}

export function fetchGranotLifecycleDiscrepancies(filters: GranotDiscrepancyListFilters = {}): Promise<GranotDiscrepancyListPage> {
  return requestJson<GranotDiscrepancyListPage>(proxyUrl("api/v1/admin/granot-lifecycle/discrepancies", filters as SerializableFilters));
}

export function fetchGranotLifecycleDiscrepancy(id: string): Promise<GranotDiscrepancyDetail> {
  return requestJson<GranotDiscrepancyDetail>(proxyUrl(`api/v1/admin/granot-lifecycle/discrepancies/${encodeURIComponent(id)}`));
}

function discrepancyCommand<TBody>(id: string, action: string, body: TBody, idempotencyKey: string): Promise<DiscrepancyOwnerCommandResult> {
  return requestJson(proxyUrl(`api/v1/admin/granot-lifecycle/discrepancies/${encodeURIComponent(id)}/${action}`), {
    method: "POST", headers: { "Idempotency-Key": idempotencyKey }, body: JSON.stringify(body),
  });
}

export function reEvaluateGranotDiscrepancy(id: string, body: ReEvaluateDiscrepancyBody, key: string) {
  return discrepancyCommand(id, "re-evaluate", body, key);
}
export function correctGranotRecordLink(id: string, body: CorrectRecordLinkBody, key: string) {
  return discrepancyCommand(id, "correct-record-link", body, key);
}
export function resolveGranotDiscrepancyNoAction(id: string, body: DiscrepancyNoActionBody, key: string) {
  return discrepancyCommand(id, "no-action", body, key);
}

export const GRANOT_LIFECYCLE_FLAG_NAMES = [
  "GRANOT_LIFECYCLE_PROCESSING_ENABLED",
  "GRANOT_LIFECYCLE_SHADOW_MODE",
  "GRANOT_LIFECYCLE_LEAD_WRITES_ENABLED",
  "GRANOT_LIFECYCLE_LEAD_CREATION_ENABLED",
  "GRANOT_LIFECYCLE_BOOKING_CASES_ENABLED",
  "GRANOT_LIFECYCLE_BOOKING_COMMANDS_ENABLED",
  "GRANOT_LIFECYCLE_RELEASE_CASES_ENABLED",
  "GRANOT_LIFECYCLE_RELEASE_COMMANDS_ENABLED",
  "GRANOT_LIFECYCLE_REFERRAL_BOOKING_ENABLED",
  "GRANOT_LIFECYCLE_EMAIL_ENABLED",
] as const;

export type GranotLifecycleFlagName = (typeof GRANOT_LIFECYCLE_FLAG_NAMES)[number];
export type GranotLifecycleAlertState = "ok" | "firing" | "insufficient_data";
export type GranotLifecycleAlertUnit = "count" | "milliseconds" | "ratio";

export type GranotLifecycleHealthAlert = {
  code: string;
  scope_ref?: string;
  state: GranotLifecycleAlertState;
  observed_value: number | null;
  threshold: number;
  unit: GranotLifecycleAlertUnit;
  since?: string;
};

export type GranotLifecycleHealth = {
  generated_at: string;
  flags: Record<GranotLifecycleFlagName, boolean>;
  activation: { present: boolean; id?: string; activated_at?: string; processor_version?: string };
  receipts: {
    by_work_state: Record<string, number>;
    due_count: number;
    oldest_due_at: string | null;
    oldest_due_age_ms: number | null;
    claimed_count: number;
    expired_claim_count: number;
    dead_letter_count: number;
  };
  decisions_last_24h: Array<{
    execution_mode: string;
    outcome: string;
    reason_code: string;
    count: number;
  }>;
  open_cases: Array<{ kind: "booking" | "release"; mode: string; count: number }>;
  open_discrepancies: Array<{ kind: "booking" | "release"; reason_code: string; count: number }>;
  command_conflicts_last_24h: Array<{ code: string; count: number }>;
  record_links: { active: number; disputed: number };
  last_queue_run: { at: string; status: "completed" | "failed" } | null;
  last_cron_run: { at: string; status: "completed" | "failed" } | null;
  ringcentral: {
    state_present: boolean;
    last_run_at: string | null;
    last_run_status: "success" | "error" | null;
    cursor_to: string | null;
    lease: {
      held: boolean;
      acquired_at: string | null;
      expires_at: string | null;
      age_ms: number | null;
      expired: boolean;
    };
    last_runtime_ms: number | null;
    last_adopted_count: number | null;
    last_adoption_conflict_count: number | null;
    last_throttled_count: number | null;
  };
  alerts: GranotLifecycleHealthAlert[];
};

const ALERT_STATES = new Set<GranotLifecycleAlertState>(["ok", "firing", "insufficient_data"]);
const ALERT_UNITS = new Set<GranotLifecycleAlertUnit>(["count", "milliseconds", "ratio"]);

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

export function asGranotLifecycleHealth(data: unknown): GranotLifecycleHealth {
  const record = unwrapEnvelope(data);
  if (!record || typeof record !== "object" || Array.isArray(record)) throw invalidHealthProjection();
  const raw = record as Record<string, unknown>;
  for (const key of ["flags", "activation", "receipts", "record_links", "ringcentral"] as const) {
    if (!raw[key] || typeof raw[key] !== "object" || Array.isArray(raw[key])) throw invalidHealthProjection();
  }
  for (const key of ["decisions_last_24h", "open_cases", "open_discrepancies", "command_conflicts_last_24h", "alerts"] as const) {
    if (!Array.isArray(raw[key])) throw invalidHealthProjection();
  }
  if (!asString(raw.generated_at) || Number.isNaN(Date.parse(String(raw.generated_at)))) throw invalidHealthProjection();
  const flagsRaw = raw.flags && typeof raw.flags === "object" ? raw.flags as Record<string, unknown> : {};
  if (GRANOT_LIFECYCLE_FLAG_NAMES.some((name) => typeof flagsRaw[name] !== "boolean")) throw invalidHealthProjection();
  const flags = Object.fromEntries(
    GRANOT_LIFECYCLE_FLAG_NAMES.map((name) => [name, flagsRaw[name] === true]),
  ) as Record<GranotLifecycleFlagName, boolean>;
  const activationRaw = raw.activation && typeof raw.activation === "object"
    ? raw.activation as Record<string, unknown>
    : {};
  const receiptsRaw = raw.receipts && typeof raw.receipts === "object"
    ? raw.receipts as Record<string, unknown>
    : {};
  const workStates = receiptsRaw.by_work_state && typeof receiptsRaw.by_work_state === "object"
    ? receiptsRaw.by_work_state as Record<string, unknown>
    : {};
  const ringRaw = raw.ringcentral && typeof raw.ringcentral === "object"
    ? raw.ringcentral as Record<string, unknown>
    : {};
  const leaseRaw = ringRaw.lease && typeof ringRaw.lease === "object"
    ? ringRaw.lease as Record<string, unknown>
    : {};
  const linksRaw = raw.record_links && typeof raw.record_links === "object"
    ? raw.record_links as Record<string, unknown>
    : {};
  return {
    generated_at: asString(raw.generated_at) ?? "",
    flags,
    activation: {
      present: activationRaw.present === true,
      id: asString(activationRaw.id),
      activated_at: asString(activationRaw.activated_at),
      processor_version: asString(activationRaw.processor_version),
    },
    receipts: {
      by_work_state: Object.fromEntries(
        Object.entries(workStates).map(([state, count]) => [state, asNumber(count)]),
      ),
      due_count: asNumber(receiptsRaw.due_count),
      oldest_due_at: asString(receiptsRaw.oldest_due_at) ?? null,
      oldest_due_age_ms: asNullableNumber(receiptsRaw.oldest_due_age_ms),
      claimed_count: asNumber(receiptsRaw.claimed_count),
      expired_claim_count: asNumber(receiptsRaw.expired_claim_count),
      dead_letter_count: asNumber(receiptsRaw.dead_letter_count),
    },
    decisions_last_24h: Array.isArray(raw.decisions_last_24h)
      ? raw.decisions_last_24h.flatMap((row) => {
          if (!row || typeof row !== "object") return [];
          const item = row as Record<string, unknown>;
          return [{
            execution_mode: asString(item.execution_mode) ?? "",
            outcome: asString(item.outcome) ?? "",
            reason_code: asString(item.reason_code) ?? "",
            count: asNumber(item.count),
          }];
        })
      : [],
    open_cases: Array.isArray(raw.open_cases)
      ? raw.open_cases.flatMap((row) => {
          if (!row || typeof row !== "object") return [];
          const item = row as Record<string, unknown>;
          const kind = item.kind === "release" ? "release" as const : item.kind === "booking" ? "booking" as const : null;
          if (!kind) return [];
          return [{ kind, mode: asString(item.mode) ?? "", count: asNumber(item.count) }];
        })
      : [],
    open_discrepancies: Array.isArray(raw.open_discrepancies)
      ? raw.open_discrepancies.flatMap((row) => {
          if (!row || typeof row !== "object") return [];
          const item = row as Record<string, unknown>;
          const kind = item.kind === "release" ? "release" as const : item.kind === "booking" ? "booking" as const : null;
          if (!kind) return [];
          return [{ kind, reason_code: asString(item.reason_code) ?? "", count: asNumber(item.count) }];
        })
      : [],
    command_conflicts_last_24h: Array.isArray(raw.command_conflicts_last_24h)
      ? raw.command_conflicts_last_24h.flatMap((row) => {
          if (!row || typeof row !== "object") return [];
          const item = row as Record<string, unknown>;
          const code = asString(item.code);
          return code ? [{ code, count: asNumber(item.count) }] : [];
        })
      : [],
    record_links: { active: asNumber(linksRaw.active), disputed: asNumber(linksRaw.disputed) },
    last_queue_run: asLastRun(raw.last_queue_run),
    last_cron_run: asLastRun(raw.last_cron_run),
    ringcentral: {
      state_present: ringRaw.state_present === true,
      last_run_at: asString(ringRaw.last_run_at) ?? null,
      last_run_status: ringRaw.last_run_status === "success" || ringRaw.last_run_status === "error"
        ? ringRaw.last_run_status
        : null,
      cursor_to: asString(ringRaw.cursor_to) ?? null,
      lease: {
        held: leaseRaw.held === true,
        acquired_at: asString(leaseRaw.acquired_at) ?? null,
        expires_at: asString(leaseRaw.expires_at) ?? null,
        age_ms: asNullableNumber(leaseRaw.age_ms),
        expired: leaseRaw.expired === true,
      },
      last_runtime_ms: asNullableNumber(ringRaw.last_runtime_ms),
      last_adopted_count: asNullableNumber(ringRaw.last_adopted_count),
      last_adoption_conflict_count: asNullableNumber(ringRaw.last_adoption_conflict_count),
      last_throttled_count: asNullableNumber(ringRaw.last_throttled_count),
    },
    alerts: Array.isArray(raw.alerts)
      ? raw.alerts.flatMap((row) => {
          if (!row || typeof row !== "object") return [];
          const item = row as Record<string, unknown>;
          const state = ALERT_STATES.has(item.state as GranotLifecycleAlertState)
            ? item.state as GranotLifecycleAlertState
            : "insufficient_data";
          const unit = ALERT_UNITS.has(item.unit as GranotLifecycleAlertUnit)
            ? item.unit as GranotLifecycleAlertUnit
            : "count";
          const code = asString(item.code);
          if (!code) return [];
          return [{
            code,
            scope_ref: asString(item.scope_ref),
            state,
            observed_value: asNullableNumber(item.observed_value),
            threshold: asNumber(item.threshold),
            unit,
            since: asString(item.since),
          }];
        })
      : [],
  };
}

function invalidHealthProjection(): GranotLifecycleApiError {
  return new GranotLifecycleApiError({
    message: "Lifecycle health response was malformed; no health state was inferred.",
    status: 502,
    code: "GRANOT_HEALTH_PROJECTION_INVALID",
  });
}

function asLastRun(value: unknown): { at: string; status: "completed" | "failed" } | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const at = asString(record.at);
  if (!at) return null;
  return { at, status: record.status === "failed" ? "failed" : "completed" };
}

export function fetchGranotLifecycleHealth(): Promise<GranotLifecycleHealth> {
  return requestJson(proxyUrl("api/v1/admin/granot-lifecycle/operations/health")).then(asGranotLifecycleHealth);
}
