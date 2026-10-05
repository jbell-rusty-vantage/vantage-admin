/**
 * Server-side mock of All Numbers and Accounts (all-numbers/CONTRACT.md §4.1–4.7, plus the existing `/nudges/preview`
 * and `/nudges`) for the desk's mock mode, backed by `tests/outreach-desk/fixtures/synthetic-numbers.ts`. Unlike the
 * desk mock it keeps state: Link/Unlink, Connect/Change/Disconnect and Suggest matches change what the next read
 * answers, so the flows can be clicked through and tested. `POST __mock/reset` restores the fixtures (tests only; a
 * real server has no such route).
 *
 * Owner only, like the server (the BFF already refuses every other role before the mock answers). Unknown query keys
 * answer 400 and a stale revision 409 `REVISION_CONFLICT`, as the contract says.
 */
import { NUMBER_VIEWS, ACCOUNT_ROLES, NUDGE_CHANNELS, type AccountRole, type LeadModel, type NumberView } from "./allNumbers";
import {
  NUMBERS_AS_OF,
  accountDto,
  activeAgents,
  applyAgentCommand,
  applyLeadCommand,
  createNumbersMockState,
  leadSearch,
  numberDetail,
  numberMatches,
  numberRow,
  suggestMatches,
  type NumbersMockState,
} from "@/tests/outreach-desk/fixtures/synthetic-numbers";

export type MockAllNumbersInput = {
  role: string;
  actor?: string;
  method: string;
  /** Server path, with or without the `api/v1/admin/sales-intelligence` prefix and leading slash. */
  path: string;
  query?: string;
  body?: unknown;
  /** The state to read and change (defaults to the process-wide mock state). */
  state?: NumbersMockState;
};
export type MockAllNumbersResponse = { status: number; body: unknown };

const PREFIX = /^\/?api\/v1\/admin\/sales-intelligence\/?/;
const OBJECT_ID = "[a-f\\d]{24}";

const STATE_KEY = Symbol.for("vantage-admin.all-numbers-mock-state");
type GlobalWithState = typeof globalThis & { [STATE_KEY]?: NumbersMockState };

/** The process-wide mock state (kept on `globalThis` so a dev-server module reload keeps what the Owner changed). */
export function allNumbersMockState(): NumbersMockState {
  const holder = globalThis as GlobalWithState;
  holder[STATE_KEY] ??= createNumbersMockState();
  return holder[STATE_KEY];
}

export function resetAllNumbersMockState(): void {
  (globalThis as GlobalWithState)[STATE_KEY] = createNumbersMockState();
}

const ok = (data: unknown): MockAllNumbersResponse => ({ status: 200, body: { ok: true, as_of: NUMBERS_AS_OF, data } });
const refuse = (status: number, code: string, message: string): MockAllNumbersResponse => ({ status, body: { ok: false, code, error: message, message, request_id: "mock-request" } });
const record = (value: unknown): Record<string, unknown> => (value && typeof value === "object" ? (value as Record<string, unknown>) : {});
const leadKey = (value: unknown): { model: LeadModel; id: string } | null => {
  const r = record(value);
  return (r.model === "FormLead" || r.model === "CallLead") && typeof r.id === "string" ? { model: r.model, id: r.id } : null;
};

/** Rejects any query key the route does not take (`scope` is the BFF's production marker). */
function unknownKeys(params: URLSearchParams, allowed: readonly string[]): boolean {
  return [...params.keys()].some((key) => key !== "scope" && !allowed.includes(key));
}

function accountsData(state: NumbersMockState) {
  return { directory_at: state.directory_at, accounts: state.accounts.map(accountDto), agents: activeAgents() };
}

function numbers(state: NumbersMockState, params: URLSearchParams): MockAllNumbersResponse {
  if (unknownKeys(params, ["view", "q", "cursor", "limit"])) return refuse(400, "INVALID_INPUT", "Unknown query parameter.");
  const view = (params.get("view") ?? "all") as NumberView;
  if (!(NUMBER_VIEWS as readonly string[]).includes(view)) return refuse(400, "INVALID_INPUT", "Unknown view.");
  const limit = Number(params.get("limit") ?? 50);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) return refuse(400, "INVALID_INPUT", "limit is 1–100.");
  const q = params.get("q") ?? "";
  const rows = state.numbers.map((number) => ({ number, row: numberRow(state, number) }));
  const counts = { all: rows.length, waiting: rows.filter(({ row }) => row.waiting_since !== null).length };
  const matching = rows
    .filter(({ row }) => view === "all" || row.waiting_since !== null)
    .filter(({ number }) => numberMatches(state, number, q))
    .sort((a, b) =>
      view === "waiting"
        ? (a.row.waiting_since ?? "").localeCompare(b.row.waiting_since ?? "") || a.row.id.localeCompare(b.row.id)
        : b.row.last_activity_at.localeCompare(a.row.last_activity_at) || a.row.id.localeCompare(b.row.id),
    );
  let offset = 0;
  const cursor = params.get("cursor");
  if (cursor) {
    const match = /^mock:(\d+)$/.exec(cursor);
    if (!match) return refuse(400, "INVALID_INPUT", "Unknown cursor.");
    offset = Number(match[1]);
  }
  const page = matching.slice(offset, offset + limit).map(({ row }) => row);
  return ok({ items: page, cursor: offset + limit < matching.length ? `mock:${offset + limit}` : null, counts });
}

/** The mock answer for one All Numbers / Accounts request, or null when the path is not one of them. */
export function mockAllNumbersResponse(input: MockAllNumbersInput): MockAllNumbersResponse | null {
  const method = input.method.toUpperCase();
  const rawPath = input.path.split("?")[0]!.replace(PREFIX, "").replace(/\/+$/, "");
  const params = new URLSearchParams(input.query ?? (input.path.includes("?") ? input.path.slice(input.path.indexOf("?") + 1) : ""));
  const route = (verb: string, pattern: string) => method === verb && new RegExp(`^${pattern}$`).exec(rawPath);
  const handled = /^(numbers|accounts|nudges|__mock)(\/|$)/.test(rawPath);
  if (!handled) return null;
  if (input.role !== "owner") return refuse(403, "FORBIDDEN", "Owner only.");
  const state = input.state ?? allNumbersMockState();
  const body = record(input.body);
  const actor = input.actor ?? "owner";
  let match: RegExpExecArray | null | false;

  if (route("POST", "__mock/reset")) {
    if (!input.state) resetAllNumbersMockState();
    return ok({ reset: true });
  }

  if (route("GET", "numbers")) return numbers(state, params);

  if (route("GET", "numbers/lead-search")) {
    if (unknownKeys(params, ["q"])) return refuse(400, "INVALID_INPUT", "Unknown query parameter.");
    return ok({ items: leadSearch(state, params.get("q") ?? "") });
  }

  if ((match = route("GET", `numbers/(${OBJECT_ID})`))) {
    if (unknownKeys(params, [])) return refuse(400, "INVALID_INPUT", "Unknown query parameter.");
    const id = match[1];
    const number = state.numbers.find((row) => row.id === id);
    return number ? ok(numberDetail(state, number)) : refuse(404, "NOT_FOUND", "Number not found.");
  }

  if ((match = route("POST", `numbers/(${OBJECT_ID})/lead`))) {
    const id = match[1];
    const number = state.numbers.find((row) => row.id === id);
    if (!number) return refuse(404, "NOT_FOUND", "Number not found.");
    if (typeof body.revision !== "number") return refuse(400, "INVALID_INPUT", "revision is required.");
    const lead = body.lead === null || body.lead === undefined ? null : leadKey(body.lead);
    const unlink = body.unlink === undefined ? undefined : leadKey(body.unlink);
    if ((lead === null) === (unlink === undefined || unlink === null)) return refuse(400, "INVALID_INPUT", "Send exactly one of lead or unlink.");
    if (body.revision !== number.revision) return refuse(409, "REVISION_CONFLICT", "This number changed. Reload it and try again.");
    const result = applyLeadCommand(state, number, { lead, unlink: unlink ?? undefined }, actor);
    if (result === "lead_not_found") return refuse(404, "LEAD_NOT_FOUND", "Lead not found.");
    return ok(numberDetail(state, number));
  }

  if (route("GET", "accounts")) {
    if (unknownKeys(params, [])) return refuse(400, "INVALID_INPUT", "Unknown query parameter.");
    return ok(accountsData(state));
  }

  if (route("POST", "accounts/suggest")) {
    suggestMatches(state);
    return ok(accountsData(state));
  }

  if ((match = route("POST", "accounts/([^/]+)/agent"))) {
    const extensionId = decodeURIComponent(match[1]!);
    const account = state.accounts.find((row) => row.extension_id === extensionId);
    if (!account) return refuse(404, "NOT_FOUND", "Account not found.");
    const agentId = body.agent_id === null ? null : typeof body.agent_id === "string" ? body.agent_id : undefined;
    if (agentId === undefined) return refuse(400, "INVALID_INPUT", "agent_id is required.");
    const role = body.role === undefined ? undefined : (ACCOUNT_ROLES as readonly string[]).includes(String(body.role)) ? (body.role as AccountRole) : null;
    if (role === null) return refuse(400, "INVALID_INPUT", "Unknown role.");
    if (body.link_revision !== undefined && body.link_revision !== account.link_revision) {
      return refuse(409, "REVISION_CONFLICT", "This account changed. Reload it and try again.");
    }
    if (applyAgentCommand(state, account, agentId, role) === "agent_not_found") return refuse(404, "AGENT_NOT_FOUND", "Agent not found.");
    return ok({ account: accountDto(account) });
  }

  if ((match = route("POST", "nudges(/preview)?"))) {
    const nudge = record(body.nudge);
    const account = state.accounts.find((row) => row.extension_id === nudge.rc_extension_id);
    if (!account || !account.can_message || nudge.rc_account_id !== account.rc_account_id) return refuse(409, "NUDGE_CONFIGURATION_UNAVAILABLE", "This user can't be messaged.");
    const text = typeof nudge.body === "string" ? nudge.body.trim() : "";
    if (!text || text.length > 1000 || !(NUDGE_CHANNELS as readonly string[]).includes(String(nudge.channel))) return refuse(400, "INVALID_INPUT", "Check the message.");
    if (Boolean(nudge.rep_identity_link_id) !== (body.expected_rep_revision !== undefined)) return refuse(400, "INVALID_INPUT", "Link and revision go together.");
    if (nudge.rep_identity_link_id && (nudge.rep_identity_link_id !== account.link_id || body.expected_rep_revision !== account.link_revision)) {
      return refuse(409, "REVISION_CONFLICT", "This account changed. Reload it and try again.");
    }
    const allowed = account.agent ? ["team_messaging", "pager"] : ["pager"];
    if (!allowed.includes(String(nudge.channel))) return refuse(409, "NUDGE_CONFIGURATION_UNAVAILABLE", "That channel isn't available for this user.");
    if (match[1]) {
      return ok({
        body: text,
        template_key: "review_context",
        template_version: 1,
        purpose: "review_context",
        expected_rep_revision: account.link_revision,
        recipient: {
          rc_account_id: account.rc_account_id,
          rc_extension_id: account.extension_id,
          directory_name: account.name,
          agent_id: account.agent?.id ?? null,
          agent_name: account.agent?.name ?? null,
          rep_identity_link_id: account.link_id,
          channel: nudge.channel,
        },
        allowed_channels: allowed,
        destination_evidence: "stored_checked",
        provider_destination_verified: false,
        send_time_revalidation_required: true,
        authorizes_send: false,
      });
    }
    state.sequence += 1;
    const id = `6650a1b2c3d4e5f60760${state.sequence.toString(16).padStart(4, "0")}`;
    return {
      status: 200,
      body: {
        ok: true,
        data: {
          operation_id: id,
          replayed: false,
          nudge: { id, revision: 1, channel: nudge.channel, status: "sent", delivery_note: "Delivered to RingCentral.", body_as_sent: text, automatic_resend: false },
        },
      },
    };
  }

  return refuse(404, "NOT_FOUND", "Not found.");
}
