import { filtersToQueryString, type SerializableFilters } from "./filters";
import type { ApiResponse, PaginatedResult } from "./types";

export type BookingLeadReconciliationStatus = "pending" | "resolved" | "dismissed";

export type BookingLeadReconciliationReason =
  | "no_match"
  | "multiple_matches"
  | "identity_conflict"
  | "source_conflict"
  | "channel_conflict"
  | "duplicate_lead"
  | "lead_already_booked"
  | "lead_cancelled"
  | "matching_unavailable";

export type BookingLeadModel = "FormLead" | "CallLead";

export type BookingLeadSourceResolution =
  | "preserve_lead_source"
  | "apply_submission_source";

export type BookingLeadCandidateMatchMethod =
  | "lid"
  | "job_no"
  | "phone"
  | "email"
  | "normalized_name";

export type BookingLeadCandidateEligibility =
  | "eligible"
  | "duplicate"
  | "booked"
  | "cancelled";

export type BookingLeadCandidateSourceCompatibility =
  | "exact_granularity"
  | "same_company"
  | "unassigned"
  | "conflict";

export const OVERRIDEABLE_RECONCILIATION_WARNINGS = [
  "duplicate_lead",
  "source_conflict",
  "channel_conflict",
  "source_unassigned",
  "same_company_legacy",
  "created_on_unmatched",
] as const;

export type OverrideableReconciliationWarning =
  (typeof OVERRIDEABLE_RECONCILIATION_WARNINGS)[number];

export type BookingLeadCandidateActionabilityInput = {
  eligibility?: BookingLeadCandidateEligibility;
  duplicate?: boolean;
  booked?: boolean | string;
  cancelled?: boolean | string;
  is_current_attachment?: boolean;
  warnings?: readonly string[];
};

export type BookingLeadCandidateActionability = {
  canAct: boolean;
  overrideableWarnings: OverrideableReconciliationWarning[];
  hardBlockReasons: string[];
};

const overrideableWarningSet = new Set<string>(OVERRIDEABLE_RECONCILIATION_WARNINGS);

export function evaluateBookingLeadCandidateActionability(
  candidate: BookingLeadCandidateActionabilityInput,
): BookingLeadCandidateActionability {
  const warnings = new Set(candidate.warnings ?? []);
  if (candidate.eligibility === "duplicate" || candidate.duplicate) {
    warnings.add("duplicate_lead");
  }

  const hardBlockReasons = new Set<string>();
  if ((candidate.eligibility === "booked" || candidate.booked) && !candidate.is_current_attachment) {
    hardBlockReasons.add("lead_already_booked");
  }
  if (candidate.eligibility === "cancelled" || candidate.cancelled) {
    hardBlockReasons.add("lead_cancelled");
  }
  if (candidate.is_current_attachment) {
    hardBlockReasons.add("already_attached_to_this_booking");
  }
  for (const warning of warnings) {
    if (!overrideableWarningSet.has(warning)) {
      hardBlockReasons.add(warning);
    }
  }

  return {
    canAct: hardBlockReasons.size === 0,
    overrideableWarnings: [...warnings].filter(
      (warning): warning is OverrideableReconciliationWarning =>
        overrideableWarningSet.has(warning),
    ),
    hardBlockReasons: [...hardBlockReasons],
  };
}

export type BookingLeadReconciliationCaseSummary = {
  id: string;
  _id: string;
  booking_id: string;
  booking?: {
    id?: string;
    _id?: string;
    job_no?: string;
    lead_name?: string;
    customer_name?: string;
    phone_number?: string;
    source?: string;
    book_date?: string;
    cancelled?: boolean;
    lead_model?: BookingLeadModel | null;
    lead_ref?: string | null;
  };
  status: BookingLeadReconciliationStatus;
  reason: BookingLeadReconciliationReason;
  revision: number;
  candidate_count?: number;
  createdAt: string;
  updatedAt: string;
  submission: {
    submission_id: string;
    lead_name: string;
    phone_number: string;
    email?: string;
    lid?: string;
    job_no: string;
    binder_amount: number;
    deposit_amount: number;
    merchant: string;
    agent: string;
    split_agent?: string;
    book_date: string;
    source_assignment: {
      lead_source_company: string;
      source_granularity_id: string;
      source_granularity_key: string;
      source_company: string;
      source_company_label_snapshot: string;
      source_granularity_label_snapshot: string;
      crm_source_label_snapshot: string;
      channel: "form" | "call";
    };
  };
  retry?: {
    attempt_count: number;
    next_attempt_at?: string;
    leased_until?: string;
    lease_owner?: string;
    last_error?: string;
  };
};

export type BookingLeadCandidateSnapshot = {
  name?: string;
  phone_number?: string;
  email?: string;
  lid?: string;
  job_no?: string;
  source_company?: string;
  source_granularity_key?: string;
  booked?: string;
  cancelled?: string;
  duplicate?: boolean;
};

export type BookingLeadCandidate = {
  lead_model: BookingLeadModel;
  lead_id: string;
  confidence: "high" | "medium" | "low";
  match_methods: BookingLeadCandidateMatchMethod[];
  eligibility: BookingLeadCandidateEligibility;
  source_compatibility: BookingLeadCandidateSourceCompatibility;
  warnings: string[];
  snapshot: BookingLeadCandidateSnapshot;
};

export type BookingLeadMatchAttempt = {
  attempted_at: string;
  trigger: "initial" | "delayed_retry" | "owner_refresh";
  outcome: "high_confidence" | "conflict" | "no_match" | "error";
  reason: string;
  candidate_count: number;
  candidate_snapshot_hash: string;
  auto_match_policy_version: string;
  enabled_auto_match_rules: string[];
};

export type BookingLeadResolutionHistoryEntry = {
  action:
    | "auto_attach_delayed"
    | "attach_existing"
    | "create_and_attach"
    | "dismiss"
    | "reopen"
    | "reassign"
    | "update_submission"
    | "booking_cancelled";
  lead_model?: BookingLeadModel;
  lead_id?: string;
  source_resolution?: BookingLeadSourceResolution;
  overridden_warnings?: string[];
  actor: string;
  notes?: string;
  occurred_at: string;
};

export type BookingLeadReconciliationCaseDetail = BookingLeadReconciliationCaseSummary & {
  latest_candidates: BookingLeadCandidate[];
  match_attempts: BookingLeadMatchAttempt[];
  resolution_history: BookingLeadResolutionHistoryEntry[];
  attached_lead?: {
    id?: string;
    _id?: string;
    lead_model?: BookingLeadModel;
    name?: string;
    phone_number?: string;
    email?: string;
    job_no?: string;
  } | null;
  sheet_sync_jobs?: Array<{
    id: string;
    status?: string;
    resource?: string;
    operation?: string;
  }>;
};

export type BookingLeadCandidateSearchFilters = {
  q?: string;
  lead_model?: BookingLeadModel;
  mongo_id?: string;
  lid?: string;
  job_no?: string;
  phone_number?: string;
  name?: string;
  email?: string;
  lead_source_company?: string;
  source_granularity_key?: string;
  duplicate?: boolean;
  booked?: boolean;
  cancelled?: boolean;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
};

export type BookingLeadCandidateSearchResult = {
  id: string;
  _id: string;
  lead_model: BookingLeadModel;
  name?: string;
  phone_number?: string;
  email?: string;
  lid?: string;
  job_no?: string;
  duplicate?: boolean;
  booked?: boolean | string;
  cancelled?: boolean | string;
  is_current_attachment?: boolean;
  source_company?: string;
  source_granularity_key?: string;
  createdAt?: string;
  updatedAt?: string;
  warnings?: string[];
};

export type BookingLeadResolveCommand =
  | {
      action: "attach_existing";
      revision: number;
      lead_model: BookingLeadModel;
      lead_id: string;
      source_resolution?: BookingLeadSourceResolution;
      overridden_warnings?: string[];
      notes?: string;
    }
  | {
      action: "create_and_attach";
      revision: number;
      lead_model: BookingLeadModel;
      lead_fields: Record<string, unknown>;
      notes?: string;
    }
  | {
      action: "dismiss";
      revision: number;
      notes?: string;
    }
  | {
      action: "reassign";
      revision: number;
      lead_model: BookingLeadModel;
      lead_id: string;
      source_resolution?: BookingLeadSourceResolution;
      overridden_warnings?: string[];
      notes?: string;
    };

export type UpdatePendingEmployeeBookingBody = {
  revision: number;
  lead_name?: string;
  phone_number?: string;
  email?: string;
  lid?: string;
  job_no?: string;
  lead_source_company_id?: string;
  source_granularity_key?: string;
  book_date?: string;
  agent?: string;
  split_agent?: string;
  binder_amount?: number;
  deposit_amount?: number;
  merchant?: string;
  notes?: string;
};

function proxyUrl(path: string, filters?: SerializableFilters): string {
  const normalized = path.startsWith("/") ? path.slice(1) : path;
  return `/api/proxy/${normalized}${filters ? filtersToQueryString(filters) : ""}`;
}

export class BookingLeadReconciliationApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "BookingLeadReconciliationApiError";
    this.status = status;
  }
}

export function isStaleBookingLeadReconciliationError(
  error: unknown,
): error is BookingLeadReconciliationApiError {
  return (
    error instanceof BookingLeadReconciliationApiError &&
    error.status === 409 &&
    /\bstale\b/i.test(error.message)
  );
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
    const message = payload && !payload.ok ? payload.error : `Request failed (${response.status}).`;
    throw new BookingLeadReconciliationApiError(message, response.status);
  }

  return payload.data;
}

export function fetchBookingLeadReconciliationCases(
  filters: SerializableFilters,
): Promise<PaginatedResult<BookingLeadReconciliationCaseSummary>> {
  return requestJson<PaginatedResult<BookingLeadReconciliationCaseSummary>>(
    proxyUrl("api/v1/admin/booking-lead-reconciliations", filters),
  );
}

export function fetchBookingLeadReconciliationCase(
  id: string,
): Promise<BookingLeadReconciliationCaseDetail> {
  return requestJson<BookingLeadReconciliationCaseDetail>(
    proxyUrl(`api/v1/admin/booking-lead-reconciliations/${encodeURIComponent(id)}`),
  );
}

export function searchBookingLeadCandidates(
  caseId: string,
  filters: BookingLeadCandidateSearchFilters,
): Promise<PaginatedResult<BookingLeadCandidateSearchResult>> {
  return requestJson<PaginatedResult<BookingLeadCandidateSearchResult>>(
    proxyUrl(`api/v1/admin/booking-lead-reconciliations/${encodeURIComponent(caseId)}/candidates/search`),
    {
      method: "POST",
      body: JSON.stringify(filters),
    },
  );
}

export function refreshBookingLeadCandidates(
  caseId: string,
  revision: number,
): Promise<BookingLeadReconciliationCaseDetail> {
  return requestJson<BookingLeadReconciliationCaseDetail>(
    proxyUrl(`api/v1/admin/booking-lead-reconciliations/${encodeURIComponent(caseId)}/candidates/refresh`),
    {
      method: "POST",
      body: JSON.stringify({ revision }),
    },
  );
}

export function updatePendingEmployeeBooking(
  caseId: string,
  body: UpdatePendingEmployeeBookingBody,
): Promise<BookingLeadReconciliationCaseDetail> {
  return requestJson<BookingLeadReconciliationCaseDetail>(
    proxyUrl(`api/v1/admin/booking-lead-reconciliations/${encodeURIComponent(caseId)}/booking`),
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
  );
}

export function resolveBookingLeadReconciliation(
  caseId: string,
  body: BookingLeadResolveCommand,
): Promise<BookingLeadReconciliationCaseDetail> {
  return requestJson<BookingLeadReconciliationCaseDetail>(
    proxyUrl(`api/v1/admin/booking-lead-reconciliations/${encodeURIComponent(caseId)}/resolve`),
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

export function reopenBookingLeadReconciliation(
  caseId: string,
  revision: number,
  notes?: string,
): Promise<BookingLeadReconciliationCaseDetail> {
  return requestJson<BookingLeadReconciliationCaseDetail>(
    proxyUrl(`api/v1/admin/booking-lead-reconciliations/${encodeURIComponent(caseId)}/reopen`),
    {
      method: "POST",
      body: JSON.stringify({ revision, notes }),
    },
  );
}
