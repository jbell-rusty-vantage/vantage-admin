import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import type { z } from "zod";
import {
  SALES_OUTREACH_ERROR_CODES,
  SALES_OUTREACH_QUEUE_FILTERS,
  SalesOutreachApiError,
  salesOutreachAssignmentRequestSchema,
  salesOutreachAssignmentResponseSchema,
  salesOutreachCallbackRequestSchema,
  salesOutreachAdmissionsSchema,
  salesOutreachCapabilitiesSchema,
  salesOutreachCommand,
  salesOutreachConfigurationReadSchema,
  salesOutreachDayOverrideRequestSchema,
  salesOutreachDayOverrideResponseSchema,
  salesOutreachDetailSchema,
  salesOutreachEnrollmentCandidatesSchema,
  salesOutreachEnvelope,
  salesOutreachErrorEnvelopeSchema,
  salesOutreachErrorFromBody,
  salesOutreachFreshnessSchema,
  salesOutreachLiveFrameSchema,
  salesOutreachPaths,
  salesOutreachPlanCommandResponseSchema,
  salesOutreachQueueQuery,
  salesOutreachQueueSchema,
  salesOutreachQuotedFollowupRequestSchema,
  salesOutreachRead,
  salesOutreachRepDaysSchema,
  salesOutreachRestrictionAddRequestSchema,
  salesOutreachRestrictionCommandResponseSchema,
  salesOutreachRestrictionConfirmRequestSchema,
  salesOutreachRestrictionLiftRequestSchema,
  salesOutreachRestrictionsResponseSchema,
  salesOutreachTeamSchema,
  onSalesOutreachUnknownValue,
  type SalesOutreachUnknownValue,
} from "./salesOutreach";

const SERVER_FIXTURES = join(process.cwd(), "tests", "outreach-desk", "fixtures", "server");
const readJson = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));

/** Read examples by file-name prefix. Every example must match exactly one rule. */
const READ_RULES: Array<[RegExp, z.ZodType]> = [
  [/^capabilities\./, salesOutreachEnvelope(salesOutreachCapabilitiesSchema)],
  [/^rep-days\./, salesOutreachEnvelope(salesOutreachRepDaysSchema)],
  [/^team\./, salesOutreachEnvelope(salesOutreachTeamSchema)],
  [/^queue\./, salesOutreachEnvelope(salesOutreachQueueSchema)],
  [/^outreach\./, salesOutreachEnvelope(salesOutreachDetailSchema)],
  [/^live\./, salesOutreachLiveFrameSchema],
  [/^error\./, salesOutreachErrorEnvelopeSchema],
  // olr B8 (ADM-4): `GET /enrollment/admissions`.
  [/^enrollment-admissions\./, salesOutreachEnvelope(salesOutreachAdmissionsSchema)],
  // Requested from the server (LANE-D §5, §6); listed ahead so the examples land without a red guard.
  [/^enrollment\.candidates\./, salesOutreachEnvelope(salesOutreachEnrollmentCandidatesSchema)],
  [/^configuration\./, salesOutreachEnvelope(salesOutreachConfigurationReadSchema)],
];

const COMMAND_RULES: Array<[RegExp, z.ZodType | null, z.ZodType]> = [
  [/^quoted-followup\./, salesOutreachQuotedFollowupRequestSchema, salesOutreachEnvelope(salesOutreachPlanCommandResponseSchema)],
  [/^callback\./, salesOutreachCallbackRequestSchema, salesOutreachEnvelope(salesOutreachPlanCommandResponseSchema)],
  [/^assignment\./, salesOutreachAssignmentRequestSchema, salesOutreachEnvelope(salesOutreachAssignmentResponseSchema)],
  [/^day-override\./, salesOutreachDayOverrideRequestSchema, salesOutreachEnvelope(salesOutreachDayOverrideResponseSchema)],
  [/^restrictions\.list\./, null, salesOutreachEnvelope(salesOutreachRestrictionsResponseSchema)],
  [/^restrictions\.add\./, salesOutreachRestrictionAddRequestSchema, salesOutreachEnvelope(salesOutreachRestrictionCommandResponseSchema)],
  [/^restrictions\.confirm\./, salesOutreachRestrictionConfirmRequestSchema, salesOutreachEnvelope(salesOutreachRestrictionCommandResponseSchema)],
  [/^restrictions\.lift\./, salesOutreachRestrictionLiftRequestSchema, salesOutreachEnvelope(salesOutreachRestrictionCommandResponseSchema)],
  [/^error\./, null, salesOutreachErrorEnvelopeSchema],
];

/**
 * The admin's schemas are non-strict (an additive server field must not break a read), so a silently stripped
 * field would hide drift. Parsing must round-trip every server example unchanged: the admin knows every field.
 * Read enums are tolerant (a new value reads as a fallback or is kept as text), so a new value would also hide
 * drift: the guard fails on any unknown-value report too — the admin knows every value.
 */
function assertKnowsEveryField(schema: z.ZodType, value: unknown, file: string) {
  const unknown: SalesOutreachUnknownValue[] = [];
  const stop = onSalesOutreachUnknownValue((event) => unknown.push(event));
  let parsed: ReturnType<typeof schema.safeParse>;
  try {
    parsed = schema.safeParse(value);
  } finally {
    stop();
  }
  assert.ok(parsed.success, `${file}: ${parsed.success ? "" : JSON.stringify(parsed.error.issues.slice(0, 3))}`);
  assert.deepEqual(unknown, [], `${file}: the admin mirror does not list a server enum value`);
  assert.deepEqual(parsed.data, value, `${file}: the admin schema dropped or changed a server field`);
}

test("every server read example parses with the admin schemas and loses no field (drift guard)", () => {
  const files = readdirSync(SERVER_FIXTURES).filter((file) => file.endsWith(".json"));
  assert.ok(files.length >= 20, "the server examples are present");
  for (const file of files) {
    const rules = READ_RULES.filter(([pattern]) => pattern.test(file));
    assert.equal(rules.length, 1, `${file} matches exactly one schema`);
    assertKnowsEveryField(rules[0]![1], readJson(join(SERVER_FIXTURES, file)), file);
  }
});

test("every server command example: request body passes the admin request schema, response round-trips", () => {
  const dir = join(SERVER_FIXTURES, "commands");
  const files = readdirSync(dir).filter((file) => file.endsWith(".json"));
  assert.ok(files.length >= 15);
  for (const file of files) {
    const rules = COMMAND_RULES.filter(([pattern]) => pattern.test(file));
    assert.equal(rules.length, 1, `${file} matches exactly one command rule`);
    const [, requestSchema, responseSchema] = rules[0]!;
    const example = readJson(join(dir, file)) as { request: { body?: unknown }; response: unknown };
    if (requestSchema && example.request.body !== undefined) {
      const parsed = requestSchema.safeParse(example.request.body);
      assert.ok(parsed.success, `${file} request: ${parsed.success ? "" : JSON.stringify(parsed.error.issues)}`);
    }
    assertKnowsEveryField(responseSchema, example.response, `${file} response`);
  }
});

test("freshness: A3-fresh diagnostics round-trip, and a server without them still parses", () => {
  const example = readJson(join(SERVER_FIXTURES, "team.owner.json")) as { data: { freshness: Record<string, Record<string, unknown>> } };
  const freshness = example.data.freshness;
  assert.equal(typeof freshness.calls!.last_confirmation_at, "string", "the copied examples carry the A3-fresh fields");
  assert.deepEqual(salesOutreachFreshnessSchema.parse(freshness), freshness);
  const preA3 = structuredClone(freshness);
  for (const source of ["calls", "sms"]) {
    delete preA3[source]!.last_confirmation_at;
    delete preA3[source]!.last_webhook_at;
  }
  const parsed = salesOutreachFreshnessSchema.parse(preA3);
  assert.equal(parsed.calls.last_confirmation_at, undefined);
  assert.deepEqual(parsed, preA3);
});

test("every server error code is one the admin knows", () => {
  for (const file of readdirSync(SERVER_FIXTURES).filter((name) => name.startsWith("error."))) {
    const body = readJson(join(SERVER_FIXTURES, file)) as { code: string };
    assert.ok((SALES_OUTREACH_ERROR_CODES as readonly string[]).includes(body.code), `${file}: ${body.code}`);
  }
});

test("the queue query keeps only the server's strict keys and drops defaults", () => {
  assert.equal(salesOutreachQueueQuery({}).toString(), "");
  assert.equal(
    salesOutreachQueueQuery({ priority: "all", workflow: "all", state: "needs_contact", sort: "urgency", direction: "desc", unassigned: false, search: "  " }).toString(),
    "",
    "defaults and urgency's fixed direction are not sent",
  );
  const query = salesOutreachQueueQuery({
    search: "  P556  ",
    priority: "1",
    workflow: "quoted",
    move_date_from: "2026-10-01",
    move_date_to: "2026-10-07",
    move_date_unknown: "exclude",
    agent_id: "6650a1b2c3d4e5f607180001",
    state: "all_active",
    sort: "lead_received",
    direction: "asc",
    cursor: "opaque",
    limit: 500,
  });
  assert.equal(query.get("search"), "P556");
  assert.equal(query.get("limit"), "100", "limit is capped at the server maximum");
  assert.equal(query.get("direction"), "asc");
  for (const key of query.keys()) assert.ok((SALES_OUTREACH_QUEUE_FILTERS as readonly string[]).includes(key), key);
  const unassigned = salesOutreachQueueQuery({ agent_id: "6650a1b2c3d4e5f607180001", unassigned: true });
  assert.equal(unassigned.get("unassigned"), "true");
  assert.equal(unassigned.has("agent_id"), false, "agent_id and unassigned are mutually exclusive");
  assert.equal(salesOutreachQueueQuery({ search: "x".repeat(150) }).get("search")!.length, 100);
});

test("read paths are relative to the desk namespace", () => {
  assert.equal(salesOutreachPaths.queue(), "queue");
  assert.equal(salesOutreachPaths.queue({ state: "all_active" }), "queue?state=all_active");
  assert.equal(salesOutreachPaths.repDays({ business_day: "2026-10-01", agent_id: undefined }), "rep-days?business_day=2026-10-01");
  assert.equal(salesOutreachPaths.detail("6650a1b2c3d4e5f6071a0001"), "outreach/6650a1b2c3d4e5f6071a0001");
  assert.equal(salesOutreachPaths.dayOverride("6650a1b2c3d4e5f607180001"), "goals/6650a1b2c3d4e5f607180001/day-override");
});

test("a refusal body becomes a typed error; a non-envelope body is read leniently", () => {
  const forbidden = salesOutreachErrorFromBody(403, { ok: false, code: "FORBIDDEN", error: "Sales Outreach request rejected", request_id: "req-1" }, "READ_FAILED");
  assert.equal(forbidden.code, "FORBIDDEN");
  assert.equal(forbidden.requestId, "req-1");
  assert.equal(forbidden.revokesAccess, true);
  const proxy = salesOutreachErrorFromBody(401, { ok: false, error: "Unauthorized." }, "READ_FAILED");
  assert.equal(proxy.code, "READ_FAILED");
  assert.equal(proxy.message, "Unauthorized.");
  const html = salesOutreachErrorFromBody(502, null, "READ_FAILED");
  assert.equal(html.code, "READ_FAILED");
  assert.equal(salesOutreachErrorFromBody(503, { ok: false, code: "PROJECTION_PENDING" }, "READ_FAILED").unavailable, true);
});

test("salesOutreachRead calls the BFF and unwraps data; a refusal throws SalesOutreachApiError", async () => {
  const original = globalThis.fetch;
  const calls: string[] = [];
  try {
    const capabilities = readJson(join(SERVER_FIXTURES, "capabilities.rep.json"));
    globalThis.fetch = async (url) => {
      calls.push(String(url));
      return Response.json(capabilities);
    };
    const data = await salesOutreachRead(salesOutreachPaths.capabilities(), salesOutreachCapabilitiesSchema);
    assert.equal(data.scope.role, "rep");
    assert.equal(calls[0], "/api/proxy/api/v1/admin/sales-outreach/capabilities");

    globalThis.fetch = async () => Response.json(readJson(join(SERVER_FIXTURES, "error.cursor-expired.json")), { status: 409 });
    await assert.rejects(salesOutreachRead("queue?cursor=x", salesOutreachQueueSchema), (error: unknown) => {
      assert.ok(error instanceof SalesOutreachApiError);
      assert.equal(error.status, 409);
      assert.equal(error.code, "CURSOR_EXPIRED");
      assert.equal(error.issues?.[0]?.code, "assignment_changed");
      return true;
    });
  } finally {
    globalThis.fetch = original;
  }
});

test("salesOutreachCommand sends the Idempotency-Key and JSON body", async () => {
  const original = globalThis.fetch;
  const seen: Array<{ url: string; init: RequestInit }> = [];
  try {
    const example = readJson(join(SERVER_FIXTURES, "commands", "assignment.manager.json")) as { request: { body: unknown }; response: unknown };
    globalThis.fetch = async (url, init) => {
      seen.push({ url: String(url), init: init! });
      return Response.json(example.response);
    };
    const result = await salesOutreachCommand("PATCH", salesOutreachPaths.assignment("6650a1b2c3d4e5f607182a01"), example.request.body, "key-1", salesOutreachAssignmentResponseSchema);
    assert.equal(result.changed, true);
    assert.equal(seen[0]!.init.method, "PATCH");
    assert.deepEqual(seen[0]!.init.headers, { "Content-Type": "application/json", "Idempotency-Key": "key-1" });
    assert.deepEqual(JSON.parse(String(seen[0]!.init.body)), example.request.body);
  } finally {
    globalThis.fetch = original;
  }
});
