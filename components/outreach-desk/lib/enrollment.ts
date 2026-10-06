/**
 * Owner enrollment in Settings (lifecycle repair ADM-4). Pure helpers and the two BFF calls the panels make; no React.
 *
 * - Three lists over `GET /enrollment/candidates` (server B7): "Ready to enroll" (`in_scope`, the report's selection
 *   inside the backfill scope), "Older" (`older`) — both with a one-click Enroll — and a read-only "Needs review"
 *   (`review`) with the reason in words. Pages follow the opaque `next_cursor`; a `CURSOR_EXPIRED` reloads page one.
 * - One-click Enroll = `POST /enrollment/report` for the one Lead (zero writes, a manifest) then `POST /enrollment/apply`
 *   of exactly that manifest, in the cohort `owner-enroll-<New York date>`.
 * - The day's new-lead intake over `GET /enrollment/admissions?business_day` (server B8): counts, refusals by reason and
 *   the newest refusals, every reason in words.
 * Server codes never reach the screen: reasons and statuses read through `outreach-desk-copy.ts`.
 */
import {
  isSalesOutreachApiError,
  newIdempotencyKey,
  salesOutreachAdmissionsSchema,
  salesOutreachCommand,
  salesOutreachEnrollmentApplySchema,
  salesOutreachEnrollmentCandidatesSchema,
  salesOutreachEnrollmentReportSchema,
  salesOutreachPaths,
  salesOutreachRead,
  type SalesOutreachAdmissionsDto,
  type SalesOutreachEnrollmentApplyDto,
  type SalesOutreachEnrollmentCandidate,
  type SalesOutreachEnrollmentCandidatesDto,
} from "@/lib/api/salesOutreach";
import { deskCopy } from "../outreach-desk-copy";
import { absoluteTime, addDays, admissionReasonText, enrollmentReasonText, nyDate, shortDateLabel } from "./format";

const x = deskCopy.settingsExtra;

/** The lists the Owner sees, in tab order (server partitions). */
export const ENROLLMENT_LISTS = ["in_scope", "older", "review"] as const;
export type EnrollmentList = (typeof ENROLLMENT_LISTS)[number];

/** Rows per page (the server allows 1–100; 25 is its default). */
export const ENROLLMENT_PAGE_SIZE = 25;

/** One page of a list. `cursor` is the previous page's opaque `next_cursor` (null = page one). */
export function readEnrollmentPage(list: EnrollmentList, cursor: string | null, signal?: AbortSignal): Promise<SalesOutreachEnrollmentCandidatesDto> {
  return salesOutreachRead(
    salesOutreachPaths.enrollmentCandidates({ partition: list, limit: ENROLLMENT_PAGE_SIZE, cursor: cursor ?? undefined }),
    salesOutreachEnrollmentCandidatesSchema,
    signal,
  );
}

/** A list's next page param: the opaque cursor, or `undefined` at the end. */
export function nextEnrollmentCursor(page: Pick<SalesOutreachEnrollmentCandidatesDto, "next_cursor">): string | undefined {
  return page.next_cursor ?? undefined;
}

/** One candidate row as the table shows it. Only `in_scope` and `older` rows can be enrolled. */
export type EnrollmentRow = {
  key: string;
  lead: SalesOutreachEnrollmentCandidate["lead"];
  job: string;
  name: string | null;
  received: string;
  workflow: string;
  reason: string | null;
  canEnroll: boolean;
};

export function enrollmentRowOf(item: SalesOutreachEnrollmentCandidate): EnrollmentRow {
  return {
    key: `${item.lead.model}:${item.lead.id}`,
    lead: item.lead,
    job: item.job_no ?? deskCopy.lead.jobPending,
    name: item.name,
    received: item.received_date ? shortDateLabel(item.received_date) : deskCopy.text.unknown,
    workflow:
      item.workflow === "quoted" ? deskCopy.workflows.quoted : item.workflow === "new" ? deskCopy.workflows.new : item.priority_raw ? deskCopy.workflows.code(item.priority_raw) : deskCopy.text.unknown,
    reason: enrollmentReasonText(item.partition, item.reason),
    canEnroll: item.partition === "in_scope" || item.partition === "older",
  };
}

/** Every row of the pages loaded so far (a Lead seen on two pages shows once). */
export function enrollmentRowsOf(pages: readonly SalesOutreachEnrollmentCandidatesDto[]): EnrollmentRow[] {
  const seen = new Set<string>();
  const rows: EnrollmentRow[] = [];
  for (const page of pages) {
    for (const item of page.items) {
      const row = enrollmentRowOf(item);
      if (seen.has(row.key)) continue;
      seen.add(row.key);
      rows.push(row);
    }
  }
  return rows;
}

/** The hint above a list, from the server's scope. */
export function enrollmentListHint(list: EnrollmentList, scope: SalesOutreachEnrollmentCandidatesDto["scope"] | null): string {
  if (list === "review") return x.reviewHint;
  if (list === "older") return x.olderHint(scope?.lookback_days ?? null);
  return x.readyHint(scope?.lookback_days ?? null, scope?.include_upcoming_moves === true);
}

export function enrollmentEmptyText(list: EnrollmentList): string {
  return list === "review" ? x.noReview : list === "older" ? x.noOlder : x.noReady;
}

/** The Settings one-click cohort: one per New York day, whichever list the Lead came from. */
export function ownerEnrollCohortId(now: Date): string {
  return `owner-enroll-${nyDate(now)}`;
}

/** Thrown when the report finds the Lead no longer eligible (nothing was written). */
export class EnrollNotEligibleError extends Error {
  constructor() {
    super(x.notEligible);
    this.name = "EnrollNotEligibleError";
  }
}

/** One-click Enroll: report the one Lead (zero writes), then apply exactly the reported manifest. */
export async function enrollOneLead(lead: SalesOutreachEnrollmentCandidate["lead"], now: Date = new Date()): Promise<SalesOutreachEnrollmentApplyDto> {
  const report = await salesOutreachCommand(
    "POST",
    salesOutreachPaths.enrollmentReport(),
    { selection: { mode: "selected", lead_refs: [lead] }, kind: "expansion", cohort_id: ownerEnrollCohortId(now) },
    newIdempotencyKey("enroll-report"),
    salesOutreachEnrollmentReportSchema,
  );
  if (report.lead_refs.length === 0) throw new EnrollNotEligibleError();
  return salesOutreachCommand(
    "POST",
    salesOutreachPaths.enrollmentApply(),
    { kind: "expansion", cohort_id: report.cohort_id, lead_refs: report.lead_refs, manifest_hash: report.manifest_hash },
    newIdempotencyKey("enroll-apply"),
    salesOutreachEnrollmentApplySchema,
  );
}

/** The line after an Enroll: the apply status in words. */
export function enrollOutcomeText(status: string): string {
  return Object.hasOwn(x.enrolledStatus, status) ? x.enrolledStatus[status]! : x.enrolledOther;
}

/** The line after a refused Enroll; server text never shows. */
export function enrollErrorText(error: unknown): string {
  if (error instanceof EnrollNotEligibleError) return x.notEligible;
  if (isSalesOutreachApiError(error)) {
    if (error.issues?.some((issue) => issue.code === "migration_paused")) return x.migrationPaused;
    if (error.status === 403) return deskCopy.errors.forbidden;
    if (error.code === "REVISION_CONFLICT") return deskCopy.errors.conflict;
  }
  return deskCopy.errors.failed(null);
}

/** One day's intake (`business_day` null = today in New York, the server default). */
export function readAdmissions(businessDay: string | null, signal?: AbortSignal): Promise<SalesOutreachAdmissionsDto> {
  return salesOutreachRead(salesOutreachPaths.enrollmentAdmissions({ business_day: businessDay }), salesOutreachAdmissionsSchema, signal);
}

export type AdmissionsView = {
  tiles: { key: string; label: string; value: number }[];
  byReason: { reason: string; text: string; count: number }[];
  refusals: { key: string; lead: string; leadTitle: string; reason: string; when: string; whenTitle: string }[];
  asOf: string;
};

const ADMISSION_TILES = ["admitted_intake", "admitted_review", "admitted_expansion", "deferred"] as const;

/** The admissions panel's content. Refusal reasons merge when two codes read the same words. */
export function admissionsViewOf(dto: SalesOutreachAdmissionsDto): AdmissionsView {
  const a = x.admissions;
  const notAdmitted = Object.values(dto.counts.not_admitted).reduce((sum, n) => sum + n, 0);
  const byText = new Map<string, { reason: string; text: string; count: number }>();
  for (const [reason, count] of Object.entries(dto.counts.not_admitted)) {
    const text = admissionReasonText(reason);
    const current = byText.get(text);
    if (current) current.count += count;
    else byText.set(text, { reason, text, count });
  }
  return {
    tiles: [...ADMISSION_TILES.map((key) => ({ key, label: a.counts[key]!, value: dto.counts[key] })), { key: "not_admitted", label: a.counts.not_admitted!, value: notAdmitted }],
    byReason: [...byText.values()].sort((left, right) => right.count - left.count || left.text.localeCompare(right.text)),
    refusals: dto.recent_refusals.map((refusal, index) => ({
      key: `${refusal.lead.id}:${refusal.at}:${index}`,
      lead: `${a.leadModel[refusal.lead.model] ?? deskCopy.text.unknown} …${refusal.lead.id.slice(-6)}`,
      leadTitle: refusal.lead.id,
      reason: admissionReasonText(refusal.reason),
      when: absoluteTime(refusal.at),
      whenTitle: refusal.at,
    })),
    asOf: a.asOf(absoluteTime(dto.as_of), dto.retention_days),
  };
}

/** The earliest business day the server still answers (it keeps `retention_days` days, today included). */
export function earliestAdmissionsDay(today: string, retentionDays: number): string {
  return addDays(today, -(retentionDays - 1));
}

/** A refused admissions read in words: retention and future-day refusals by issue code; anything else generic. */
export function admissionsErrorText(error: unknown, retentionDays: number): string {
  if (isSalesOutreachApiError(error)) {
    const codes = new Set((error.issues ?? []).map((issue) => issue.code));
    if (codes.has("retention_exceeded")) return x.admissions.retentionExceeded(retentionDays);
    if (codes.has("business_day_in_future")) return x.admissions.futureDay;
    if (error.status === 403) return deskCopy.errors.forbidden;
  }
  return deskCopy.errors.failed(null);
}
