import { z } from "zod";
import { salesOutreachErrorFromBody } from "./salesOutreach";

/**
 * All Numbers and Accounts (all-numbers/CONTRACT.md §4): consumer schemas, paths and the BFF client. Owner-only routes
 * under `/api/v1/admin/sales-intelligence/*`, reached through the browser proxy with `scope=production` like every
 * Sales Intelligence call. The server's DTO is the authority: these schemas mirror it and derive nothing. Objects are
 * not strict, so an additive server field never breaks a read. Errors are `SalesOutreachApiError` (the proxy carries
 * the server code as `registry_code`), so the desk's conflict and retry rules apply unchanged.
 */

export const ALL_NUMBERS_SERVER_PATH = "api/v1/admin/sales-intelligence" as const;
export const ALL_NUMBERS_BFF_PATH = `/api/proxy/${ALL_NUMBERS_SERVER_PATH}` as const;
/** Rows per page the desk asks for (the server allows 1–100, default 50). */
export const NUMBERS_PAGE_LIMIT = 25;

export const NUMBER_VIEWS = ["all", "waiting"] as const;
export type NumberView = (typeof NUMBER_VIEWS)[number];
export const LEAD_MODELS = ["FormLead", "CallLead"] as const;
export type LeadModel = (typeof LEAD_MODELS)[number];
export const LEAD_STATES = ["open", "booked", "cancelled"] as const;
export const CALL_DIRECTIONS = ["inbound", "outbound"] as const;
export const CALL_RESULTS = ["answered", "missed", "voicemail"] as const;
export type CallResult = (typeof CALL_RESULTS)[number];
export const ACCOUNT_ROLES = ["sales_rep", "service", "manager", "dialer", "shared", "excluded"] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];

const instant = z.string();

export const leadRefSchema = z.object({
  model: z.enum(LEAD_MODELS),
  id: z.string(),
  name: z.string().nullable(),
  job_no: z.string().nullable(),
  rep_name: z.string().nullable(),
  received_at: instant,
  state: z.enum(LEAD_STATES),
  desk_subject_id: z.string().nullable(),
});
export type LeadRef = z.infer<typeof leadRefSchema>;

export const numberRowSchema = z.object({
  id: z.string(),
  revision: z.number().int(),
  e164: z.string(),
  display: z.string(),
  caller_name: z.string().nullable(),
  source: z.enum(["call", "form_lead"]),
  lead: leadRefSchema.nullable(),
  lead_link: z.enum(["automatic", "owner"]),
  last_call: z
    .object({
      at: instant,
      direction: z.enum(CALL_DIRECTIONS),
      result: z.enum(CALL_RESULTS),
      duration_seconds: z.number().nullable(),
      agent_name: z.string().nullable(),
    })
    .nullable(),
  calls: z.object({ inbound: z.number().int(), outbound: z.number().int(), missed: z.number().int() }),
  waiting_since: instant.nullable(),
  first_seen_at: instant,
  last_activity_at: instant,
});
export type NumberRow = z.infer<typeof numberRowSchema>;

export const numbersPageSchema = z.object({
  items: z.array(numberRowSchema),
  cursor: z.string().nullable(),
  counts: z.object({ all: z.number().int(), waiting: z.number().int() }),
});
export type NumbersPage = z.infer<typeof numbersPageSchema>;

export const numberCallSchema = z.object({
  id: z.string(),
  at: instant,
  direction: z.enum(CALL_DIRECTIONS),
  result: z.enum(CALL_RESULTS),
  duration_seconds: z.number().nullable(),
  agent_name: z.string().nullable(),
  our_number: z.string().nullable(),
  recordings: z.number().int(),
});
export type NumberCall = z.infer<typeof numberCallSchema>;

export const numberDetailSchema = z.object({
  number: numberRowSchema,
  other_leads: z.array(leadRefSchema),
  excluded_leads: z.array(leadRefSchema),
  calls: z.array(numberCallSchema),
  more_calls: z.boolean(),
});
export type NumberDetail = z.infer<typeof numberDetailSchema>;

export const leadSearchItemSchema = leadRefSchema.extend({ phone: z.string().nullable() });
export type LeadSearchItem = z.infer<typeof leadSearchItemSchema>;
export const leadSearchSchema = z.object({ items: z.array(leadSearchItemSchema) });

export const agentRefSchema = z.object({ id: z.string(), name: z.string() });
export type AgentRef = z.infer<typeof agentRefSchema>;

export const accountSchema = z.object({
  extension_id: z.string(),
  extension_number: z.string().nullable(),
  name: z.string().nullable(),
  direct_numbers: z.array(z.string()),
  status: z.string().nullable(),
  in_directory: z.boolean(),
  agent: agentRefSchema.nullable(),
  role: z.enum(ACCOUNT_ROLES).nullable(),
  link_id: z.string().nullable(),
  link_revision: z.number().int().nullable(),
  suggestion: z.object({ agent_id: z.string(), agent_name: z.string() }).nullable(),
  can_message: z.boolean(),
  /**
   * The RingCentral account the extension belongs to. Not in CONTRACT §4.5: the existing `/nudges` command requires
   * it (`nudge.rc_account_id`), so Message stays disabled until the server sends it.
   */
  rc_account_id: z.string().nullable().optional(),
  /**
   * Additive to CONTRACT §4.5: the channels Message can use for this User now, in the server's preference order (empty
   * when `can_message` is false). Optional so an older server still parses; the panel then falls back to Team Messaging.
   */
  message_channels: z.array(z.enum(["team_messaging", "pager"])).optional(),
});
export type Account = z.infer<typeof accountSchema>;

export const accountsSchema = z.object({
  directory_at: instant.nullable(),
  accounts: z.array(accountSchema),
  agents: z.array(agentRefSchema),
});
export type AccountsData = z.infer<typeof accountsSchema>;
export const accountCommandSchema = z.object({ account: accountSchema });

/* ── The existing RingCentral message (nudge) commands, unchanged on the server ── */
export const NUDGE_CHANNELS = ["team_messaging", "pager"] as const;
export type NudgeChannel = (typeof NUDGE_CHANNELS)[number];
export const nudgePreviewSchema = z.object({
  body: z.string(),
  allowed_channels: z.array(z.string()),
  recipient: z.object({ directory_name: z.string().nullable().optional(), agent_name: z.string().nullable().optional(), channel: z.string() }).loose(),
});
export type NudgePreview = z.infer<typeof nudgePreviewSchema>;
export const NUDGE_STATUSES = ["pending", "sent", "failed", "unknown_delivery", "fallback_sent"] as const;
export const nudgeSendSchema = z.object({
  operation_id: z.string(),
  replayed: z.boolean(),
  nudge: z.object({ id: z.string(), status: z.enum(NUDGE_STATUSES), delivery_note: z.string(), channel: z.string() }).loose(),
});
export type NudgeSendResult = z.infer<typeof nudgeSendSchema>;

/** The `/nudges` and `/nudges/preview` body for an Account (the Owner's own `review_context` text, pager or Team Messaging). */
export function nudgeCommandBody(account: Pick<Account, "extension_id" | "link_id" | "link_revision" | "rc_account_id">, channel: NudgeChannel, body: string) {
  return {
    nudge: {
      rc_account_id: account.rc_account_id ?? "",
      rc_extension_id: account.extension_id,
      channel,
      template_key: "review_context",
      template_version: 1,
      purpose: "review_context" as const,
      allow_pager_fallback: false,
      body: body.trim(),
      ...(account.link_id ? { rep_identity_link_id: account.link_id } : {}),
    },
    ...(account.link_id && account.link_revision !== null ? { expected_rep_revision: account.link_revision } : {}),
  };
}

/* ── Requests ── */
export type NumbersRequest = { view: NumberView; q: string | null; cursor?: string | null; limit?: number };
export type LinkLeadRequest = { revision: number; lead: { model: LeadModel; id: string } | null; unlink?: { model: LeadModel; id: string } };
export type ConnectAgentRequest = { agent_id: string | null; role?: AccountRole; link_revision?: number };

function withQuery(path: string, query: Record<string, string | number | null | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  params.set("scope", "production");
  return `${path}?${params.toString()}`;
}

export const allNumbersPaths = {
  numbers: (request: NumbersRequest) =>
    withQuery("numbers", { view: request.view === "all" ? null : request.view, q: request.q, cursor: request.cursor, limit: request.limit ?? NUMBERS_PAGE_LIMIT }),
  number: (id: string) => withQuery(`numbers/${encodeURIComponent(id)}`, {}),
  numberLead: (id: string) => withQuery(`numbers/${encodeURIComponent(id)}/lead`, {}),
  leadSearch: (q: string) => withQuery("numbers/lead-search", { q }),
  accounts: () => withQuery("accounts", {}),
  accountAgent: (extensionId: string) => withQuery(`accounts/${encodeURIComponent(extensionId)}/agent`, {}),
  suggest: () => withQuery("accounts/suggest", {}),
  nudgePreview: () => withQuery("nudges/preview", {}),
  nudges: () => withQuery("nudges", {}),
} as const;

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

const envelope = <T extends z.ZodType>(data: T) => z.object({ ok: z.literal(true), as_of: z.string().optional(), data });

/** A read: `{ as_of, data }` (as_of falls back to the response time when a proxy drops it). */
export async function allNumbersRead<T>(path: string, schema: z.ZodType<T>, signal?: AbortSignal): Promise<{ as_of: string; data: T }> {
  const response = await fetch(`${ALL_NUMBERS_BFF_PATH}/${path}`, { signal, cache: "no-store" });
  const body = await readJson(response);
  if (!response.ok || !body || (body as { ok?: unknown }).ok !== true) throw salesOutreachErrorFromBody(response.status, body, "READ_FAILED");
  const parsed = envelope(schema).parse(body);
  return { as_of: parsed.as_of ?? new Date().toISOString(), data: parsed.data };
}

/** A command. Every Sales Intelligence write carries an `Idempotency-Key` (one per user intent). */
export async function allNumbersCommand<T>(path: string, body: unknown, idempotencyKey: string, schema: z.ZodType<T>): Promise<{ as_of: string; data: T }> {
  const response = await fetch(`${ALL_NUMBERS_BFF_PATH}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(body ?? {}),
  });
  const payload = await readJson(response);
  if (!response.ok || !payload || (payload as { ok?: unknown }).ok !== true) throw salesOutreachErrorFromBody(response.status, payload, "COMMAND_FAILED");
  const parsed = envelope(schema).parse(payload);
  return { as_of: parsed.as_of ?? new Date().toISOString(), data: parsed.data };
}
