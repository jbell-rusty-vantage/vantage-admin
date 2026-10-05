/**
 * Server-side mock of the Sales Outreach Desk API (`/api/v1/admin/sales-outreach/**`), backed by the synthetic
 * fixtures in `tests/outreach-desk/fixtures/synthetic.ts`. It lets the desk be built and screenshotted before the
 * server lands. Pure: no I/O, no clock, no state (commands answer as if accepted but change nothing).
 *
 * It refuses what the server refuses for the role (S1 "Admin DTO handoff"): generic `admin` → 403; a Rep naming
 * another Agent or Unassigned → 403 FORBIDDEN; a Rep reading another Rep's Lead → 404; team, assignment, day
 * override, configuration, restrictions and enrollment by role. Queue filtering/sorting here stands in for the
 * server; the browser never does it.
 */
import {
  SALES_OUTREACH_QUEUE_DEFAULT_LIMIT,
  type SalesOutreachAssignmentResponse,
  type SalesOutreachDayOverrideResponse,
  type SalesOutreachPlanCommandResponse,
  type SalesOutreachQueueDto,
  type SalesOutreachQueueRowDto,
  type SalesOutreachRestrictionCommandResponse,
  type SalesOutreachRole,
} from "./salesOutreach";
import {
  SYNTHETIC_AS_OF,
  SYNTHETIC_REP_AGENT_ID,
  syntheticCapabilities,
  syntheticCommonRead,
  syntheticConfiguration,
  syntheticDetail,
  syntheticEnrollmentCandidates,
  syntheticEnrollmentReport,
  syntheticQueueRows,
  syntheticRepDays,
  syntheticRestrictions,
  syntheticTeam,
  type SyntheticVariant,
} from "@/tests/outreach-desk/fixtures/synthetic";

export type MockSalesOutreachInput = {
  /** The signed-in admin role (`owner`, `manager`, `rep`, or any other role, which the desk refuses). */
  role: string;
  /** A Rep's linked Agent (defaults to the synthetic Rep). Ignored for other roles. */
  agentId?: string | null;
  method: string;
  /** Server path, with or without the `api/v1/admin/sales-outreach` prefix and leading slash. */
  path: string;
  query?: URLSearchParams | string | Record<string, string | undefined>;
  body?: unknown;
  variant?: SyntheticVariant;
};
export type MockSalesOutreachResponse = { status: number; body: unknown };

const PREFIX = /^\/?api\/v1\/admin\/sales-outreach\/?/;
const OBJECT_ID = "[a-f\\d]{24}";

function refuse(status: number, code: string, issues?: Array<{ path: string; code: string }>): MockSalesOutreachResponse {
  return { status, body: { ok: false, code, error: "Sales Outreach request rejected", request_id: "mock-request", ...(issues ? { issues } : {}) } };
}
const ok = (data: unknown): MockSalesOutreachResponse => ({ status: 200, body: { ok: true, data } });

function toParams(query: MockSalesOutreachInput["query"], path: string): URLSearchParams {
  const params = new URLSearchParams(path.includes("?") ? path.slice(path.indexOf("?") + 1) : "");
  if (!query) return params;
  const extra = typeof query === "string" || query instanceof URLSearchParams ? new URLSearchParams(query) : new URLSearchParams(Object.entries(query).filter((entry): entry is [string, string] => entry[1] !== undefined));
  for (const [key, value] of extra) params.set(key, value);
  return params;
}

function digits(value: string | null): string {
  return (value ?? "").replace(/\D/g, "");
}

function matchesSearch(row: SalesOutreachQueueRowDto, search: string): boolean {
  const term = search.trim().toLowerCase();
  if (!term) return true;
  if (row.job_no && row.job_no.toLowerCase().startsWith(term)) return true;
  if (row.name && row.name.toLowerCase().includes(term)) return true;
  const termDigits = digits(term);
  return termDigits.length >= 4 && digits(row.phone).includes(termDigits);
}

function queue(role: SalesOutreachRole, agentId: string | null, params: URLSearchParams, variant: SyntheticVariant): MockSalesOutreachResponse {
  if (variant === "m1") return refuse(503, "PROJECTION_PENDING", [{ path: "controls", code: "cadence_disabled" }]);
  if (role === "rep") {
    if (params.get("unassigned") === "true") return refuse(403, "FORBIDDEN", [{ path: "unassigned", code: "rep_unassigned_filter" }]);
    const named = params.get("agent_id");
    if (named && named !== agentId) return refuse(403, "FORBIDDEN", [{ path: "agent_id", code: "foreign_agent" }]);
  }
  const state = params.get("state") ?? "needs_contact";
  const workflow = params.get("workflow") ?? "all";
  const priority = params.get("priority") ?? "all";
  const sort = params.get("sort") ?? "urgency";
  const direction = (params.get("direction") ?? (sort === "last_interaction" ? "asc" : sort === "lead_received" ? "desc" : "asc")) as "asc" | "desc";
  const scopeAgent = role === "rep" ? agentId : params.get("agent_id");
  const unassigned = role !== "rep" && params.get("unassigned") === "true";
  let rows = syntheticQueueRows(variant).filter((row) => {
    if (unassigned) return row.assigned_agent_id === null;
    if (scopeAgent && row.assigned_agent_id !== scopeAgent) return false;
    if (state === "needs_contact" && !row.status_flags.needs_contact) return false;
    if (state === "blocked" && !row.status_flags.blocked) return false;
    if (state === "pending" && !row.status_flags.pending) return false;
    if (workflow !== "all" && row.workflow !== workflow) return false;
    if (priority === "unknown" && row.priority_raw !== null) return false;
    if (priority !== "all" && priority !== "unknown" && row.priority_raw !== priority) return false;
    return matchesSearch(row, params.get("search") ?? "");
  });
  if (sort === "lead_received") {
    rows = [...rows].sort((a, b) => (a.received_at ?? "").localeCompare(b.received_at ?? "") * (direction === "asc" ? 1 : -1));
  } else if (sort === "last_interaction") {
    // Never-contacted first, then oldest (asc) or newest (desc).
    rows = [...rows].sort((a, b) => {
      if (a.last_interaction_at === null || b.last_interaction_at === null) return (a.last_interaction_at === null ? -1 : 0) - (b.last_interaction_at === null ? -1 : 0);
      return a.last_interaction_at.localeCompare(b.last_interaction_at) * (direction === "asc" ? 1 : -1);
    });
  }
  const limit = Math.min(100, Math.max(1, Number(params.get("limit") ?? SALES_OUTREACH_QUEUE_DEFAULT_LIMIT) || SALES_OUTREACH_QUEUE_DEFAULT_LIMIT));
  const cursor = params.get("cursor");
  let offset = 0;
  if (cursor) {
    const match = /^mock:(\d+)$/.exec(cursor);
    if (!match) return refuse(409, "CURSOR_EXPIRED", [{ path: "cursor", code: "invalid" }]);
    offset = Number(match[1]);
  }
  const page = rows.slice(offset, offset + limit);
  const hasMore = offset + limit < rows.length;
  const data: SalesOutreachQueueDto = {
    ...syntheticCommonRead(role, scopeAgent ?? null, variant),
    filters: {
      search: params.get("search")?.trim() || null,
      priority,
      workflow: workflow as SalesOutreachQueueDto["filters"]["workflow"],
      move_date_from: params.get("move_date_from"),
      move_date_to: params.get("move_date_to"),
      move_date_unknown: (params.get("move_date_unknown") as SalesOutreachQueueDto["filters"]["move_date_unknown"]) ?? (params.get("move_date_from") || params.get("move_date_to") ? "exclude" : "include"),
      agent_id: scopeAgent ?? null,
      unassigned,
      state: state as SalesOutreachQueueDto["filters"]["state"],
    },
    sort: sort as SalesOutreachQueueDto["sort"],
    direction,
    limit,
    cadence_exposure: "enforcement",
    enforcement_labels: true,
    rows: page,
    next_cursor: hasMore ? `mock:${offset + limit}` : null,
    has_more: hasMore,
    counts: offset === 0 ? { projection_pending: 0, excluded_unknown_move_date: 0 } : { projection_pending: null, excluded_unknown_move_date: null },
  };
  return ok(data);
}

function planResponse(subjectId: string, body: Record<string, unknown>, kind: "quoted_date" | "callback", currentRevision: number): MockSalesOutreachResponse {
  if (body.expected_revision !== currentRevision) return refuse(409, "REVISION_CONFLICT", [{ path: "expected_revision", code: "stale" }]);
  const cancel = body.operation === "cancel";
  const appointment = typeof body.appointment_at === "string" ? body.appointment_at : null;
  const data: SalesOutreachPlanCommandResponse = {
    contract_version: "sod-v1",
    subject_id: subjectId,
    plan_revision: currentRevision + 1,
    plan: cancel
      ? null
      : {
          plan_id: "6650a1b2c3d4e5f6071affff",
          kind,
          period_id: kind === "quoted_date" && typeof body.period_id === "string" ? body.period_id : null,
          selected_date: kind === "quoted_date" && typeof body.selected_date === "string" ? body.selected_date : null,
          appointment_at: appointment,
          appointment_local: appointment ? { business_date: appointment.slice(0, 10), minute: 900 } : null,
          due_at: appointment ? new Date(Date.parse(appointment) + 15 * 60_000).toISOString() : "2026-10-06T00:00:00.000Z",
          window_minutes: kind === "callback" ? 15 : null,
          effective_at: SYNTHETIC_AS_OF,
          status: "active",
          revision: currentRevision + 1,
        },
    ended_plan: null,
    changed: true,
    replayed: false,
  };
  return ok(data);
}

/** The mock answer for one desk request. */
export function mockSalesOutreachResponse(input: MockSalesOutreachInput): MockSalesOutreachResponse {
  const variant = input.variant ?? "desk";
  const method = input.method.toUpperCase();
  const rawPath = input.path.split("?")[0]!.replace(PREFIX, "").replace(/\/+$/, "");
  const params = toParams(input.query, input.path);
  if (input.role !== "owner" && input.role !== "manager" && input.role !== "rep") return refuse(403, "FORBIDDEN");
  const role = input.role as SalesOutreachRole;
  const agentId = role === "rep" ? (input.agentId ?? SYNTHETIC_REP_AGENT_ID) : null;
  const coordinator = role !== "rep";
  const body = (input.body && typeof input.body === "object" ? input.body : {}) as Record<string, unknown>;
  const route = (verb: string, pattern: string) => method === verb && new RegExp(`^${pattern}$`).exec(rawPath);
  let match: RegExpExecArray | null | false;

  if (route("GET", "capabilities")) return ok(syntheticCapabilities(role, variant));

  if (route("GET", "rep-days")) {
    const named = params.get("agent_id");
    if (role === "rep" && named && named !== agentId) return refuse(403, "FORBIDDEN", [{ path: "agent_id", code: "foreign_agent" }]);
    return ok(syntheticRepDays({ role, agentId: role === "rep" ? agentId : named, variant }));
  }

  if (route("GET", "team")) {
    if (!coordinator) return refuse(403, "FORBIDDEN");
    return ok(syntheticTeam({ role: role as "owner" | "manager", variant }));
  }

  if (route("GET", "queue")) return queue(role, agentId, params, variant);

  if ((match = route("GET", `outreach/(${OBJECT_ID})`))) {
    const detail = syntheticDetail({ subjectId: match[1]!, role, variant });
    if (!detail || (role === "rep" && detail.assignment.assigned_agent_id !== agentId)) return refuse(404, "NOT_FOUND");
    return ok(detail);
  }

  if ((match = route("PATCH", `outreach/(${OBJECT_ID})/(quoted-followup|callback)`))) {
    const detail = syntheticDetail({ subjectId: match[1]!, role, variant });
    if (!detail || (role === "rep" && detail.assignment.assigned_agent_id !== agentId)) return refuse(404, "NOT_FOUND");
    return planResponse(match[1]!, body, match[2] === "callback" ? "callback" : "quoted_date", detail.plan.plan_revision);
  }

  if ((match = route("PATCH", `outreach/(${OBJECT_ID})/assignment`))) {
    if (!coordinator) return refuse(403, "FORBIDDEN");
    const detail = syntheticDetail({ subjectId: match[1]!, role, variant });
    if (!detail) return refuse(404, "NOT_FOUND");
    if (body.expected_revision !== detail.assignment.assignment_revision) return refuse(409, "REVISION_CONFLICT", [{ path: "expected_revision", code: "stale" }]);
    const target = typeof body.agent_id === "string" ? body.agent_id : null;
    const data: SalesOutreachAssignmentResponse = {
      contract_version: "sod-v1",
      subject_id: match[1]!,
      assigned_agent_id: target,
      previous_agent_id: detail.assignment.assigned_agent_id,
      assignment_revision: detail.assignment.assignment_revision + 1,
      lead_revision: 12,
      receiver_agent_source: target ? "manual" : null,
      changed: target !== detail.assignment.assigned_agent_id,
      replayed: false,
    };
    return ok(data);
  }

  if ((match = route("PATCH", `goals/(${OBJECT_ID})/day-override`))) {
    if (!coordinator) return refuse(403, "FORBIDDEN");
    if (role === "manager" && typeof body.business_date === "string" && body.business_date < SYNTHETIC_AS_OF.slice(0, 10)) {
      return refuse(403, "FORBIDDEN", [{ path: "business_date", code: "historical_edit_owner_only" }]);
    }
    const data: SalesOutreachDayOverrideResponse = {
      contract_version: "sod-v1",
      agent_id: match[1]!,
      business_date: String(body.business_date ?? SYNTHETIC_AS_OF.slice(0, 10)),
      override: { goal: Number(body.goal ?? 0), reason: body.reason === "partial_day" ? "partial_day" : "absence" },
      previous: null,
      revision: 4,
      version: "sod-cfg-synthetic-2",
      changed: true,
      replayed: false,
    };
    return ok(data);
  }

  // Everything below is Owner-only.
  const ownerOnly = /^(configuration|restrictions|enrollment)(\/|$)/.test(rawPath);
  if (ownerOnly && role !== "owner") return refuse(403, "FORBIDDEN");

  if (route("GET", "configuration")) return ok(syntheticConfiguration(variant));
  if (route("PATCH", "configuration")) {
    if (body.expected_revision !== syntheticConfiguration(variant).revision) return refuse(409, "REVISION_CONFLICT", [{ path: "expected_revision", code: "stale" }]);
    return ok({ contract_version: "sod-v1", revision: 4, version: "sod-cfg-synthetic-2", content_hash: "d".repeat(64), changed: true, replayed: false });
  }

  if (route("GET", "restrictions")) return ok(syntheticRestrictions());
  if ((match = route("POST", `restrictions(?:/(${OBJECT_ID})/(confirm|lift))?`))) {
    const [, restrictionId, action] = match;
    const current = syntheticRestrictions().restrictions.find((row) => row.restriction_id === restrictionId) ?? syntheticRestrictions().restrictions[0]!;
    const data: SalesOutreachRestrictionCommandResponse = {
      contract_version: "sod-v1",
      restriction:
        action === "lift"
          ? { ...current, state: "resolved", needs_review: false, resolved_at: SYNTHETIC_AS_OF, resolved_by: "owner", resolution_reason: String(body.reason ?? ""), revision: current.revision + 1 }
          : action === "confirm"
            ? { ...current, needs_review: false, confirmed_at: SYNTHETIC_AS_OF, confirmed_by: "owner", revision: current.revision + 1 }
            : { ...current, restriction_id: "6650a1b2c3d4e5f6071afffe", origin: "owner", needs_review: false, reason: String(body.reason ?? ""), revision: 1 },
      changed: true,
      replayed: false,
    };
    return ok(data);
  }

  if (route("GET", "enrollment/candidates")) {
    const partition = (params.get("partition") ?? "older") as Parameters<typeof syntheticEnrollmentCandidates>[0];
    return ok(syntheticEnrollmentCandidates(partition));
  }
  if (route("POST", "enrollment/report")) return ok(syntheticEnrollmentReport());
  if (route("POST", "enrollment/apply")) return refuse(503, "SERVICE_UNAVAILABLE", [{ path: "migration.paused", code: "migration_paused" }]);
  if (route("POST", "enrollment/verify")) {
    return ok({ contract_version: "sod-v1", mode: "verify", run_key: String(body.run_key ?? "mock"), run_status: "completed", complete: true, consistent: true, counts: { enrolled_by_run: 2, enrolled_elsewhere: 0, not_enrolled: 0 }, mismatches: [] });
  }

  return refuse(404, "NOT_FOUND");
}
