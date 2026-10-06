/**
 * Granot updates (doc 17), the pure model. One check = one `run_group_id` (a single-type check is a group of one).
 * Everything the Owner reads on the start page, the check page and Today comes through here, so the words for a
 * field, a match method, a bucket or an outcome are decided once. No React, no fetch; the API client is
 * `lib/api/granotAutomation.ts` and its DTOs are the only input.
 *
 * Words on screen: "Granot updates", "check", "Check Granot". Never "sync", "ingestion", "plan", "run group" or
 * "checksum" (those stay in code and in Audit details).
 */
import type {
  GranotAction,
  GranotOperation,
  GranotReceipt,
  GranotRun,
} from "@/lib/api/granotAutomation";

// ---- Statuses --------------------------------------------------------------------------------------------------

export const TERMINAL_STATUSES: ReadonlySet<string> = new Set(["completed", "completed_with_errors", "failed", "expired"]);
export const APPROVAL_STATUS = "awaiting_approval";
export const IN_FLIGHT_STATUSES: ReadonlySet<string> = new Set(["queued", "collecting", "planning"]);

export function isTerminalStatus(status: string | undefined): boolean {
  return TERMINAL_STATUSES.has(status ?? "");
}

/** Polls the detail (2.5 s) while a run is neither waiting for approval nor finished, exactly as before doc 17. */
export function detailNeedsPolling(status: string | undefined): boolean {
  return Boolean(status) && status !== APPROVAL_STATUS && !isTerminalStatus(status);
}

/** Polls the list (5 s) while any run is still moving. */
export function listNeedsPolling(runs: readonly GranotRun[] | undefined): boolean {
  return (runs ?? []).some((run) => !isTerminalStatus(run.status));
}

export type CheckStatus = "checking" | "awaiting" | "applying" | "done" | "done_with_errors" | "failed" | "expired";

/** One status for the whole check: anything still reading wins, then waiting, then applying, then the worst end. */
export function checkStatusOf(runs: readonly GranotRun[]): CheckStatus {
  const statuses = runs.map((run) => run.status);
  if (statuses.some((status) => IN_FLIGHT_STATUSES.has(status))) return "checking";
  if (statuses.some((status) => status === APPROVAL_STATUS)) return "awaiting";
  if (statuses.some((status) => status === "applying")) return "applying";
  if (statuses.some((status) => status === "failed")) return "failed";
  if (statuses.length > 0 && statuses.every((status) => status === "expired")) return "expired";
  if (statuses.some((status) => status === "completed_with_errors")) return "done_with_errors";
  return "done";
}

// ---- Dates (New York calendar days, `YYYY-MM-DD` keys) ----------------------------------------------------------

const DAY_MS = 86_400_000;
const monthDay = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
const monthDayYear = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });

/** `MM/DD/YYYY` (the Granot route format the server echoes) to a `YYYY-MM-DD` day key. */
export function fromGranotApiDate(value: string | undefined | null): string | null {
  const match = value?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[1]}-${match[2]}` : null;
}

export function isDayKey(value: string | null | undefined): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function dayToMs(key: string): number {
  return Date.parse(`${key}T12:00:00Z`);
}

export function addDays(key: string, days: number): string {
  const date = new Date(dayToMs(key) + days * DAY_MS);
  return date.toISOString().slice(0, 10);
}

/** Inclusive calendar days in a window; 0 when either end is missing or reversed. */
export function windowDays(from: string | null, to: string | null): number {
  if (!isDayKey(from) || !isDayKey(to) || from > to) return 0;
  return Math.round((dayToMs(to) - dayToMs(from)) / DAY_MS) + 1;
}

/** "Oct 3" (same year as `todayKey`) or "Oct 3, 2025". */
export function dayWords(key: string | null, todayKey?: string): string {
  if (!isDayKey(key)) return "—";
  const date = new Date(dayToMs(key));
  return todayKey && todayKey.slice(0, 4) !== key.slice(0, 4) ? monthDayYear.format(date) : monthDay.format(date);
}

/** "Oct 3 – Oct 5", "Oct 5" for a one-day window, "—" when unknown. */
export function windowWords(from: string | null, to: string | null, todayKey?: string): string {
  if (!isDayKey(from) && !isDayKey(to)) return "—";
  if (!isDayKey(from)) return dayWords(to, todayKey);
  if (!isDayKey(to) || from === to) return dayWords(from, todayKey);
  return `${dayWords(from, todayKey)} – ${dayWords(to, todayKey)}`;
}

export type WindowPreset = "since" | "today" | "yesterday" | "last7" | "custom";

export type DayWindow = { from: string; to: string };

/**
 * "Since last check": from the `to` day of the newest applied check of the same lead types, through today. `null`
 * until a check of one of those types has been applied.
 */
export function sinceLastCheck(runs: readonly GranotRun[], operations: readonly GranotOperation[], todayKey: string): DayWindow | null {
  const applied = runs
    .filter((run) => (run.status === "completed" || run.status === "completed_with_errors") && run.workflow !== "preview")
    .filter((run) => run.operation !== undefined && operations.includes(run.operation))
    .map((run) => ({ run, to: fromGranotApiDate(run.to) ?? (isDayKey(run.to) ? run.to : null), created: Date.parse(run.created_at ?? "") || 0 }))
    .filter((entry): entry is { run: GranotRun; to: string; created: number } => entry.to !== null)
    .sort((a, b) => b.created - a.created);
  const newest = applied[0];
  if (!newest) return null;
  return { from: newest.to > todayKey ? todayKey : newest.to, to: todayKey };
}

export function presetWindow(preset: WindowPreset, todayKey: string, runs: readonly GranotRun[], operations: readonly GranotOperation[]): DayWindow | null {
  switch (preset) {
    case "today":
      return { from: todayKey, to: todayKey };
    case "yesterday": {
      const day = addDays(todayKey, -1);
      return { from: day, to: day };
    }
    case "last7":
      return { from: addDays(todayKey, -6), to: todayKey };
    case "since":
      return sinceLastCheck(runs, operations, todayKey);
    default:
      return null;
  }
}

/** Windows over this many days get the "Large windows take longer…" line (allowed, just said). */
export const LARGE_WINDOW_DAYS = 31;

// ---- Field words ----------------------------------------------------------------------------------------------------

/** Every field name the Owner sees goes through this map (doc 17). Unknown names are humanised, never printed raw. */
export const FIELD_WORDS: Readonly<Record<string, string>> = {
  quoted: "Quoted",
  cubic_feet: "Cubic feet",
  pickup_city: "Pickup city",
  pickup_zip: "Pickup zip",
  pickup_state: "Pickup state",
  delivery_city: "Delivery city",
  destination_zip: "Delivery zip",
  delivery_state: "Delivery state",
  receiver_agent: "Rep",
  move_date: "Move date",
  move_size: "Move size",
  job_no: "Job number",
  granot_contact_snapshot: "Job details",
  "booking.customer": "Booked call linked",
  "customer.create_or_link": "Customer linked",
  booking_linked: "Booked call linked",
  booked_call: "Booked call linked",
};

/** Patch keys that ride along with `receiver_agent` and are never a row of their own. */
const HIDDEN_PATCH_KEYS = new Set([
  "receiver_agent_name_snapshot",
  "receiver_agent_source",
  "receiver_agent_source_value",
  "receiver_agent_set_at",
]);

export function fieldWords(field: string): string {
  const known = FIELD_WORDS[field];
  if (known) return known;
  const words = field.replace(/[._]+/g, " ").replace(/\s+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Field";
}

/** A stored value in words: booleans are yes / no, empty is `null` (shown as "—"). */
export function valueWords(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : null;
  if (typeof value === "string") return value.trim() ? value.trim() : null;
  if (Array.isArray(value)) return value.length ? value.map((item) => valueWords(item) ?? "").filter(Boolean).join(", ") : null;
  return null;
}

export type FieldChange = { field: string; label: string; before: string | null; after: string | null };

/**
 * What an action changes, per field: Form updates from `expected → patch`; Call actions from `preview.changes`
 * (names only until the server sends values, doc 17 G2; `{ field, before, after }` objects are read when present).
 */
export function whatChanges(action: GranotAction): FieldChange[] {
  if (action.patch) {
    const patch = action.patch;
    const expected = action.expected ?? {};
    return Object.keys(patch)
      .filter((key) => !HIDDEN_PATCH_KEYS.has(key))
      .map((key) => {
        const after = key === "receiver_agent" ? valueWords(patch.receiver_agent_name_snapshot) ?? valueWords(patch[key]) : valueWords(patch[key]);
        return { field: key, label: fieldWords(key), before: valueWords(expected[key]), after };
      });
  }
  const changes = action.preview?.changes;
  if (!Array.isArray(changes)) return [];
  const rows: FieldChange[] = [];
  for (const entry of changes) {
    if (typeof entry === "string" && entry.trim()) {
      rows.push({ field: entry, label: fieldWords(entry), before: null, after: null });
    } else if (entry && typeof entry === "object") {
      const record = entry as Record<string, unknown>;
      const field = typeof record.field === "string" ? record.field : "";
      if (!field) continue;
      rows.push({ field, label: fieldWords(field), before: valueWords(record.before), after: valueWords(record.after) });
    }
  }
  return rows;
}

/** "Quoted no → yes · Cubic feet — → 850"; "—" when nothing is known. */
export function changesWords(changes: readonly FieldChange[]): string {
  if (changes.length === 0) return "—";
  return changes
    .map((change) => {
      if (change.before === null && change.after === null) return change.label;
      return `${change.label} ${change.before ?? "—"} → ${change.after ?? "—"}`;
    })
    .join(" · ");
}

// ---- Rows -------------------------------------------------------------------------------------------------------------

/** The Granot job number: an explicit field first, else the digits at the end of the row id (`…:P5563337`). */
export function jobNoOf(action: GranotAction): string | null {
  const explicit = action.job_no ?? action.display?.job_no;
  if (explicit && explicit.trim()) return explicit.trim();
  const rowId = action.source_row_id ?? action.action_id ?? "";
  const last = rowId.split(":").pop() ?? "";
  const digits = last.replace(/^\D+/, "");
  return /^\d{5,}$/.test(digits) ? digits : null;
}

export type MatchedBy = { label: string; warn: boolean; warnings: string[] };

/** Ref no · Lead id · Phone · Fallback; phone and fallback matches carry the amber warning (doc 17). */
export function matchedBy(action: GranotAction): MatchedBy {
  const warnings = action.warnings ?? [];
  switch (action.match_method) {
    case "ref_no_exact":
      return { label: "Ref no", warn: false, warnings };
    case "mongo_id":
      return { label: "Lead id", warn: false, warnings };
    case "fallback":
      return { label: "Fallback", warn: true, warnings };
    case "phone_only":
      return { label: "Phone", warn: true, warnings };
    case "phone_and_job_no":
      return { label: "Phone + job #", warn: warnings.length > 0, warnings };
    case "job_no_only":
      return { label: "Job #", warn: warnings.length > 0, warnings };
    case "job_no_with_booking":
      return { label: "Job # + booking", warn: warnings.length > 0, warnings };
    case "none":
    case undefined:
      return { label: "Not matched", warn: false, warnings };
    default:
      return { label: fieldWords(action.match_method), warn: warnings.length > 0, warnings };
  }
}

export function isFallbackMatch(action: GranotAction): boolean {
  return action.match_method === "fallback" || action.match_method === "phone_only";
}

export type Bucket = "ready" | "look" | "missing" | "same";

const BUCKET_BY_STATUS: Readonly<Record<string, Bucket>> = {
  update: "ready",
  updateable: "ready",
  conflict: "look",
  invalid: "look",
  failed: "look",
  booking_missing: "look",
  no_match: "missing",
  unchanged: "same",
  updated: "same",
};

/** Ready / Needs a look / Not found / No change, from the Form classification or the Call preview status. */
export function bucketOf(action: GranotAction): Bucket {
  const status = action.classification ?? action.status ?? "";
  const bucket = BUCKET_BY_STATUS[status];
  if (bucket) return bucket;
  return action.syncable === true ? "ready" : "look";
}

export type BucketCounts = Record<Bucket, number> & { readyForm: number; readyCall: number };

function emptyBuckets(): BucketCounts {
  return { ready: 0, look: 0, missing: 0, same: 0, readyForm: 0, readyCall: 0 };
}

/**
 * The four summary numbers. Counted from the actions when the detail is loaded, else from the plan counters the list
 * already carries (Form `update / conflict / no_match / unchanged`, Call preview statuses), so Today and the start
 * page can say "N updates ready" without the detail.
 */
export function fourBuckets(runs: readonly GranotRun[]): BucketCounts {
  const counts = emptyBuckets();
  for (const run of runs) {
    const readyKey = run.operation === "call_leads" ? "readyCall" : "readyForm";
    if (run.actions) {
      for (const action of run.actions) {
        const bucket = bucketOf(action);
        counts[bucket] += 1;
        if (bucket === "ready") counts[readyKey] += 1;
      }
      continue;
    }
    for (const [status, value] of Object.entries(run.operation_status_counts ?? {})) {
      const bucket = BUCKET_BY_STATUS[status];
      if (!bucket) continue;
      counts[bucket] += value;
      if (bucket === "ready") counts[readyKey] += value;
    }
  }
  return counts;
}

// ---- Checks (one per run group) ------------------------------------------------------------------------------------------

export type GranotCheck = {
  /** The `run_group_id`, or the run id for a run created outside a group. */
  id: string;
  runs: GranotRun[];
  operations: GranotOperation[];
  from: string | null;
  to: string | null;
  status: CheckStatus;
  created_at: string | null;
  /** The earliest plan expiry across the check's runs. */
  expires_at: string | null;
  /** Every Granot name the check asked for (observed or not). */
  source_labels: string[];
  buckets: BucketCounts;
  /** Approved updates the server has received (the sum of `receipt_count`). */
  receipt_count: number;
};

function createdMs(run: GranotRun): number {
  return Date.parse(run.created_at ?? "") || 0;
}

export function checkOf(runs: readonly GranotRun[]): GranotCheck {
  const ordered = [...runs].sort((a, b) => createdMs(a) - createdMs(b));
  const first = ordered[0];
  const operations = [...new Set(ordered.map((run) => run.operation).filter((operation): operation is GranotOperation => operation === "form_leads" || operation === "call_leads"))];
  const from = ordered.map((run) => fromGranotApiDate(run.from) ?? (isDayKey(run.from) ? run.from : null)).find((value) => value !== null) ?? null;
  const to = ordered.map((run) => fromGranotApiDate(run.to) ?? (isDayKey(run.to) ? run.to : null)).find((value) => value !== null) ?? null;
  const expiries = ordered.map((run) => Date.parse(run.expires_at ?? "")).filter((value) => Number.isFinite(value) && value > 0);
  const labels = new Set<string>();
  for (const run of ordered) {
    for (const label of run.collection?.discovered_source_labels ?? []) labels.add(label);
    for (const label of run.collection?.not_observed_source_labels ?? []) labels.add(label);
    for (const summary of run.collection_summaries ?? []) if (summary.source_label) labels.add(summary.source_label);
  }
  return {
    id: first?.run_group_id ?? first?.run_id ?? "",
    runs: ordered,
    operations: operations.sort((a, b) => (a === "form_leads" ? -1 : b === "form_leads" ? 1 : 0)),
    from,
    to,
    status: checkStatusOf(ordered),
    created_at: first?.created_at ?? null,
    expires_at: expiries.length ? new Date(Math.min(...expiries)).toISOString() : null,
    source_labels: [...labels].sort((a, b) => a.localeCompare(b)),
    buckets: fourBuckets(ordered),
    receipt_count: ordered.reduce((sum, run) => sum + (run.receipt_count ?? 0), 0),
  };
}

/** One check per `run_group_id`, newest first. */
export function checksOf(runs: readonly GranotRun[]): GranotCheck[] {
  const groups = new Map<string, GranotRun[]>();
  for (const run of runs) {
    const key = run.run_group_id ?? run.run_id;
    const list = groups.get(key);
    if (list) list.push(run);
    else groups.set(key, [run]);
  }
  return [...groups.values()].map(checkOf).sort((a, b) => (Date.parse(b.created_at ?? "") || 0) - (Date.parse(a.created_at ?? "") || 0));
}

/** The check a URL names: its group id, or the id of one of its runs (old `?run=` links). */
export function checkById(runs: readonly GranotRun[], id: string): GranotCheck | null {
  const byGroup = runs.filter((run) => run.run_group_id === id);
  if (byGroup.length > 0) return checkOf(byGroup);
  const byRun = runs.find((run) => run.run_id === id);
  if (!byRun) return null;
  return checkOf(byRun.run_group_id ? runs.filter((run) => run.run_group_id === byRun.run_group_id) : [byRun]);
}

/** The checks waiting for the Owner, newest first (Today's slot and the Automations badge). */
export function waitingChecks(runs: readonly GranotRun[]): GranotCheck[] {
  return checksOf(runs).filter((check) => check.status === "awaiting");
}

/** "23 h", "40 min", or `null` when there is no expiry; "expired" once it has passed. */
export function expiresInWords(expiresAt: string | null | undefined, nowMs: number): string | null {
  const at = Date.parse(expiresAt ?? "");
  if (!Number.isFinite(at) || at <= 0) return null;
  const left = at - nowMs;
  if (left <= 0) return "expired";
  const minutes = Math.round(left / 60_000);
  if (minutes < 60) return `${Math.max(1, minutes)} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h`;
  return `${Math.round(hours / 24)} days`;
}

export function leadTypeWords(operations: readonly GranotOperation[]): string {
  const form = operations.includes("form_leads");
  const call = operations.includes("call_leads");
  if (form && call) return "form + call";
  if (form) return "form";
  if (call) return "call";
  return "—";
}

export function operationWords(operation: GranotOperation | string | undefined): string {
  return operation === "call_leads" ? "Call leads" : operation === "form_leads" ? "Form leads" : "Leads";
}

// ---- Results ------------------------------------------------------------------------------------------------------------

export type ResultKind = "applied" | "same" | "failed" | "pending";

const PENDING_OUTCOMES = new Set(["accepted_for_processing", "pending_match"]);
const SAME_OUTCOMES = new Set(["already_current", "already_applied", "unchanged", "skipped_terminal"]);

export function resultKindOf(receipt: GranotReceipt): ResultKind {
  if (receipt.pending || PENDING_OUTCOMES.has(receipt.outcome)) return "pending";
  if (receipt.outcome === "applied") return "applied";
  if (SAME_OUTCOMES.has(receipt.outcome)) return "same";
  return "failed";
}

const ERROR_WORDS: Readonly<Record<string, string>> = {
  expected_mismatch: "Lead changed since the check · check again",
  stale_target: "Lead changed since the check · check again",
  target_missing: "The lead is gone · check again",
  technical_failure: "A technical problem stopped this update",
  dead_letter: "A technical problem stopped this update",
  idempotency_conflict: "This update was already sent once",
  apply_disabled: "Applying updates is switched off on the server",
};

/** The result of one update in words: "Applied", "Already current", "Waiting to match", or a sentence for an error. */
export function receiptOutcomeWords(receipt: GranotReceipt): string {
  switch (resultKindOf(receipt)) {
    case "applied":
      return "Applied";
    case "same":
      return "Already current";
    case "pending":
      return "Waiting to match";
    default: {
      const code = receipt.error_code ?? receipt.outcome;
      return ERROR_WORDS[code] ?? `Could not apply · ${fieldWords(code).toLowerCase()}`;
    }
  }
}

export type ResultCounts = Record<ResultKind, number> & { total: number };

export function resultCounts(runs: readonly GranotRun[]): ResultCounts {
  const counts: ResultCounts = { applied: 0, same: 0, failed: 0, pending: 0, total: 0 };
  for (const run of runs) {
    for (const receipt of run.receipts ?? []) {
      counts[resultKindOf(receipt)] += 1;
      counts.total += 1;
    }
  }
  return counts;
}

export type ResultRow = {
  key: string;
  run_id: string;
  operation: GranotOperation | undefined;
  action: GranotAction | null;
  receipt: GranotReceipt;
  kind: ResultKind;
  words: string;
  job_no: string | null;
  changes: FieldChange[];
};

/** Each receipt joined to its planned action, so every result line says which lead and which fields. */
export function resultRows(runs: readonly GranotRun[]): ResultRow[] {
  const rows: ResultRow[] = [];
  for (const run of runs) {
    const actions = new Map((run.actions ?? []).map((action) => [action.action_id, action]));
    for (const receipt of run.receipts ?? []) {
      const action = actions.get(receipt.action_id) ?? null;
      rows.push({
        key: `${run.run_id}:${receipt.action_id}`,
        run_id: run.run_id,
        operation: run.operation,
        action,
        receipt,
        kind: resultKindOf(receipt),
        words: receiptOutcomeWords(receipt),
        job_no: action ? jobNoOf(action) : null,
        changes: action ? whatChanges(action) : [],
      });
    }
  }
  return rows;
}

/** Ready actions the Owner left unticked (no receipt), for the "Not selected" tab. */
export function notSelectedActions(runs: readonly GranotRun[]): Array<{ run: GranotRun; action: GranotAction }> {
  const rows: Array<{ run: GranotRun; action: GranotAction }> = [];
  for (const run of runs) {
    const receipted = new Set((run.receipts ?? []).map((receipt) => receipt.action_id));
    for (const action of run.actions ?? []) {
      if (action.syncable === true && !receipted.has(action.action_id)) rows.push({ run, action });
    }
  }
  return rows;
}

/** Progress while applying: receipts that are no longer pending over receipts in total. */
export function applyProgress(runs: readonly GranotRun[]): { done: number; total: number } {
  const counts = resultCounts(runs);
  return { done: counts.total - counts.pending, total: counts.total };
}

function csvCell(value: string | null | undefined): string {
  const text = value ?? "";
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** The result rows as CSV (job, lead, field, before, after, result), one line per field; produced in the browser. */
export function resultsCsv(runs: readonly GranotRun[], leadLabel: (row: ResultRow) => string = (row) => row.action?.display?.lead_label ?? row.action?.lead_id ?? ""): string {
  const lines = ["job,lead,field,before,after,result"];
  for (const row of resultRows(runs)) {
    const lead = leadLabel(row);
    const result = `${row.words}${row.receipt.applied_at ? ` ${row.receipt.applied_at}` : ""}`;
    if (row.changes.length === 0) {
      lines.push([row.job_no, lead, "", "", "", result].map(csvCell).join(","));
      continue;
    }
    for (const change of row.changes) {
      lines.push([row.job_no, lead, change.label, change.before, change.after, result].map(csvCell).join(","));
    }
  }
  return `${lines.join("\r\n")}\r\n`;
}

// ---- Approval -----------------------------------------------------------------------------------------------------------

export type SelectedAction = { operation: GranotOperation | undefined; action: GranotAction };

/** "Form leads 14: quoted ×9, cubic feet ×9. Call leads 9: job details ×9." for the confirmation dialog. */
export function approvalSummary(selected: readonly SelectedAction[]): string {
  const parts: string[] = [];
  for (const operation of ["form_leads", "call_leads"] as const) {
    const rows = selected.filter((entry) => entry.operation === operation);
    if (rows.length === 0) continue;
    const perField = new Map<string, number>();
    for (const { action } of rows) {
      for (const change of whatChanges(action)) perField.set(change.label, (perField.get(change.label) ?? 0) + 1);
    }
    const fields = [...perField.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([label, count]) => `${label.toLowerCase()} ×${count}`)
      .join(", ");
    parts.push(`${operationWords(operation)} ${rows.length}${fields ? `: ${fields}` : ""}.`);
  }
  return parts.join(" ");
}

/** The first eight characters of a checksum, the only part the dialog shows (the whole value binds the approval). */
export function planShortId(checksum: string | null | undefined): string {
  return (checksum ?? "").slice(0, 8);
}

// ---- Failures -----------------------------------------------------------------------------------------------------------

const FAILURE_SENTENCES: Readonly<Record<string, string>> = {
  invalid_session: "Granot rejected the sign-in; we retried once.",
  schema_drift: "Granot changed a page layout; the check stopped safely.",
  provider_error: "Granot did not answer.",
  response_too_large: "Granot sent a page too large to read; try a shorter window.",
  invalid_request: "Granot did not accept the dates; try a different window.",
};

/** A collector failure in plain words (doc 17); the generic sentence when the server gives no code. */
export function collectorFailureSentence(code: string | undefined | null): string {
  if (!code) return "The check stopped before it finished.";
  return FAILURE_SENTENCES[code.toLowerCase()] ?? "The check stopped before it finished.";
}

// ---- History ------------------------------------------------------------------------------------------------------------

export type HistoryFilter = "all" | "waiting" | "done" | "failed";

/** The outcome of a check in words, for the history row and the hub line. */
export function outcomeWords(check: GranotCheck): string {
  const results = resultCounts(check.runs);
  switch (check.status) {
    case "checking":
      return "Checking Granot";
    case "awaiting":
      return check.buckets.ready === 1 ? "Waiting for approval · 1 update ready" : `Waiting for approval · ${check.buckets.ready} updates ready`;
    case "applying":
      return results.total > 0 ? `Applying ${results.total - results.pending} of ${results.total}` : "Applying";
    case "expired":
      return "Expired (not approved)";
    case "failed":
      return "Failed";
    case "done_with_errors":
      return results.total > 0 ? `Applied ${results.applied} of ${results.total} · some failed` : "Finished with errors";
    default:
      if (results.total > 0) return `Applied ${results.applied} of ${results.total}`;
      if (check.receipt_count > 0) return check.receipt_count === 1 ? "Applied 1 update" : `Applied ${check.receipt_count} updates`;
      return "No updates needed";
  }
}

export function matchesHistoryFilter(check: GranotCheck, filter: HistoryFilter): boolean {
  switch (filter) {
    case "waiting":
      return check.status === "awaiting";
    case "done":
      return check.status === "done" || check.status === "done_with_errors" || check.status === "applying";
    case "failed":
      return check.status === "failed" || check.status === "expired";
    default:
      return true;
  }
}

export type HistoryRow = {
  id: string;
  created_at: string | null;
  window: string;
  lead_types: string;
  sources: number;
  outcome: string;
  status: CheckStatus;
};

/** One row per check, newest first, no ids on screen beyond the link target. */
export function historyRows(runs: readonly GranotRun[], filter: HistoryFilter = "all", todayKey?: string): HistoryRow[] {
  return checksOf(runs)
    .filter((check) => matchesHistoryFilter(check, filter))
    .map((check) => ({
      id: check.id,
      created_at: check.created_at,
      window: windowWords(check.from, check.to, todayKey),
      lead_types: leadTypeWords(check.operations),
      sources: check.source_labels.length,
      outcome: outcomeWords(check),
      status: check.status,
    }));
}

// ---- Choices (Try again / Check again) ----------------------------------------------------------------------------------

export type CheckChoices = {
  from: string;
  to: string;
  operations: GranotOperation[];
  source_labels: string[];
  date_factor: "OPEN" | "BOOK";
};

/**
 * The choices a check was made with, read back from its runs (the server does not echo `date_factor`, doc 17 G6, so
 * Opened is assumed unless the page remembered the choice).
 */
export function checkChoices(check: GranotCheck): CheckChoices | null {
  if (!check.from || !check.to || check.operations.length === 0) return null;
  return { from: check.from, to: check.to, operations: [...check.operations], source_labels: [...check.source_labels], date_factor: "OPEN" };
}

/** The health line for Setup → Connections and the hub: "Last check Oct 5 9:12 AM · applied 21". */
export function lastCheckSummary(runs: readonly GranotRun[]): { check: GranotCheck; applied: number } | null {
  const check = checksOf(runs)[0];
  if (!check) return null;
  const results = resultCounts(check.runs);
  return { check, applied: results.total > 0 ? results.applied : check.receipt_count };
}
