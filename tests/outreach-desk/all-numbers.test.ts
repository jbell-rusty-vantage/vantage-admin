import assert from "node:assert/strict";
import test from "node:test";
import {
  accountsSchema,
  allNumbersCommand,
  allNumbersPaths,
  allNumbersRead,
  leadSearchSchema,
  nudgeCommandBody,
  nudgePreviewSchema,
  nudgeSendSchema,
  numberDetailSchema,
  numbersPageSchema,
  type NumberRow,
} from "../../lib/api/allNumbers";
import { isSalesOutreachApiError } from "../../lib/api/salesOutreach";
import { mockAllNumbersResponse } from "../../lib/api/allNumbersMock";
import { callDuration, callResultPill, leadName, leadStatePill, waitingText } from "../../components/outreach-desk/lib/numbers-format";
import { callSummary, createNumbersMockState, leadLink, type NumbersMockState } from "./fixtures/synthetic-numbers";

/**
 * All Numbers + Accounts (all-numbers/CONTRACT.md §3–4) on the admin side: the client paths and envelope, the mock's
 * stand-in for the server rules (waiting, lead link, paging, commands), and the display helpers.
 */

type Answer = { status: number; body: { ok: boolean; as_of?: string; code?: string; data?: unknown } };
function call(state: NumbersMockState, method: string, path: string, body?: unknown, role = "owner"): Answer {
  const answer = mockAllNumbersResponse({ role, method, path: `api/v1/admin/sales-intelligence/${path}`, body, state });
  assert.ok(answer, `mocked ${method} ${path}`);
  return answer as Answer;
}
const data = <T>(answer: Answer, schema: { parse: (value: unknown) => T }): T => {
  assert.equal(answer.status, 200, JSON.stringify(answer.body));
  return schema.parse(answer.body.data);
};

test("client paths: the BFF scope marker, `view` only when not All, and the page size", () => {
  assert.equal(allNumbersPaths.numbers({ view: "all", q: null }), "numbers?limit=25&scope=production");
  assert.equal(allNumbersPaths.numbers({ view: "waiting", q: "kim", cursor: "c1" }), "numbers?view=waiting&q=kim&cursor=c1&limit=25&scope=production");
  assert.equal(allNumbersPaths.number("a".repeat(24)), `numbers/${"a".repeat(24)}?scope=production`);
  assert.equal(allNumbersPaths.leadSearch("P55 61"), "numbers/lead-search?q=P55+61&scope=production");
  assert.equal(allNumbersPaths.accountAgent("630/1"), "accounts/630%2F1/agent?scope=production");
});

test("reads and commands go through the browser proxy; refusals keep the server code (registry_code too)", async () => {
  const original = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  try {
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), init });
      return Response.json({ ok: true, as_of: "2026-10-01T16:00:00.000Z", data: { items: [] } });
    };
    const read = await allNumbersRead(allNumbersPaths.leadSearch("noah"), leadSearchSchema);
    assert.equal(read.as_of, "2026-10-01T16:00:00.000Z");
    assert.equal(calls[0]!.url, "/api/proxy/api/v1/admin/sales-intelligence/numbers/lead-search?q=noah&scope=production");

    // The generic proxy answers a server refusal as { ok:false, registry_code } on non-desk paths.
    globalThis.fetch = async () => Response.json({ ok: false, error: "Stale", registry_code: "REVISION_CONFLICT" }, { status: 409 });
    await assert.rejects(
      allNumbersCommand(allNumbersPaths.numberLead("a".repeat(24)), { revision: 1, lead: null }, "key-1", numberDetailSchema),
      (error) => isSalesOutreachApiError(error) && error.status === 409 && error.code === "REVISION_CONFLICT",
    );
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), init });
      return Response.json({ ok: false, code: "FORBIDDEN", error: "Owner only" }, { status: 403 });
    };
    await assert.rejects(allNumbersCommand(allNumbersPaths.suggest(), {}, "key-2", accountsSchema), (error) => isSalesOutreachApiError(error) && error.code === "FORBIDDEN");
    const last = calls[calls.length - 1]!;
    assert.equal(last.init?.method, "POST");
    assert.deepEqual(last.init?.headers, { "Content-Type": "application/json", "Idempotency-Key": "key-2" });
  } finally {
    globalThis.fetch = original;
  }
});

test("call summary: only inbound calls miss; Waiting on us starts at the earliest miss after the latest handled call", () => {
  const at = (hh: string) => `2026-10-01T${hh}:00:00.000Z`;
  const row = (time: string, direction: "inbound" | "outbound", result: "answered" | "missed" | "voicemail") => ({
    id: time,
    at: at(time),
    direction,
    result,
    duration_seconds: null,
    agent_name: null,
    our_number: null,
    recordings: 0,
  });
  // Newest first, as stored.
  const calls = [row("15", "inbound", "voicemail"), row("14", "inbound", "missed"), row("13", "outbound", "missed"), row("12", "inbound", "missed")];
  const summary = callSummary(calls);
  assert.deepEqual(summary.calls, { inbound: 3, outbound: 1, missed: 3 });
  // The 13:00 outbound attempt (not connected) is still "handled": the wait starts at 14:00.
  assert.equal(summary.waiting_since, at("14"));
  assert.equal(callSummary([row("16", "inbound", "answered"), ...calls]).waiting_since, null);
  assert.equal(callSummary([row("12", "outbound", "missed")]).waiting_since, null);
  assert.equal(callSummary([]).last_call, null);
});

test("lead link: newest exact-phone candidate; an Owner pin holds until a newer candidate; excluded and duplicate never link", () => {
  const state = createNumbersMockState();
  const brooks = state.numbers.find((number) => number.e164 === "+15125550142")!;
  const auto = leadLink(state, brooks);
  assert.equal(auto.lead?.job_no, "P5561042");
  assert.deepEqual(auto.others.map((lead) => lead.job_no), ["P5550991"]); // the duplicate Lead is not a candidate
  // Pin the older Lead: it stays until a candidate is received after the pin.
  const older = auto.others[0]!;
  brooks.link = { source: "owner", set_at: "2026-10-01T16:00:00.000Z", set_by: "owner", pinned: { model: older.model, id: older.id }, excluded: [] };
  assert.equal(leadLink(state, brooks).lead?.job_no, "P5550991");
  assert.equal(leadLink(state, brooks).source, "owner");
  state.leads.push({ ...older, id: "6650a1b2c3d4e5f6072bffff", job_no: "P5569999", received_at: "2026-10-01T17:00:00.000Z", state: "open", desk: null });
  assert.equal(leadLink(state, brooks).lead?.job_no, "P5569999");
  assert.equal(leadLink(state, brooks).source, "automatic");
});

test("GET /numbers: counts ignore q; All newest activity first; Waiting longest wait first; keyset pages; unknown keys 400", () => {
  const state = createNumbersMockState();
  const first = data(call(state, "GET", "numbers?limit=25&scope=production"), numbersPageSchema);
  assert.deepEqual(first.counts, { all: 32, waiting: 7 });
  assert.equal(first.items.length, 25);
  assert.ok(first.cursor);
  const sorted = [...first.items].sort((a, b) => b.last_activity_at.localeCompare(a.last_activity_at));
  assert.deepEqual(first.items.map((row) => row.id), sorted.map((row) => row.id));
  const second = data(call(state, "GET", `numbers?limit=25&cursor=${first.cursor}`), numbersPageSchema);
  assert.equal(second.items.length, 7);
  assert.equal(second.cursor, null);
  assert.equal(new Set([...first.items, ...second.items].map((row) => row.id)).size, 32);

  const waiting = data(call(state, "GET", "numbers?view=waiting"), numbersPageSchema);
  assert.equal(waiting.items.length, 7);
  const since = waiting.items.map((row) => row.waiting_since as string);
  assert.deepEqual(since, [...since].sort());
  assert.equal(waiting.items[0]!.display, "(281) 555-0133");

  const search = (q: string) => data(call(state, "GET", `numbers?q=${encodeURIComponent(q)}`), numbersPageSchema);
  assert.deepEqual(search("555-0148").items.map((row: NumberRow) => row.display), ["(786) 555-0148"]);
  assert.deepEqual(search("wireless").items.map((row) => row.display), ["(786) 555-0148"]);
  assert.deepEqual(search("P5561042").items.map((row) => row.display), ["(512) 555-0142"]);
  assert.ok(search("taylor brooks").items.length >= 1);
  assert.deepEqual(search("Avery").counts, { all: 32, waiting: 7 });

  assert.equal(call(state, "GET", "numbers?sort=oldest").status, 400);
  assert.equal(call(state, "GET", "numbers?limit=101").status, 400);
  assert.equal(call(state, "GET", "numbers", undefined, "manager").status, 403);
});

test("rows say who a number is: Unknown, a Form Lead with no calls, an Owner pin, a booked Lead", () => {
  const state = createNumbersMockState();
  const rows = data(call(state, "GET", "numbers?limit=100"), numbersPageSchema).items;
  const by = (display: string) => rows.find((row) => row.display === display)!;
  assert.equal(by("(786) 555-0148").lead, null);
  assert.equal(by("(919) 555-0166").source, "form_lead");
  assert.equal(by("(919) 555-0166").last_call, null);
  assert.equal(by("(646) 555-0199").lead_link, "owner");
  assert.equal(by("(646) 555-0199").lead?.name, "Mia Ortega");
  assert.equal(by("(469) 555-0177").lead?.state, "booked");
  assert.equal(by("(512) 555-0142").lead?.desk_subject_id, "6650a1b2c3d4e5f6071a0001");
  assert.equal(by("(602) 555-0144").last_call?.result, "missed");
  assert.equal(by("(602) 555-0144").waiting_since, null); // an outbound no-answer never makes anyone wait
  // The Owner's Unlink is remembered: the only candidate is excluded, so the number is Unknown.
  assert.equal(by("(801) 555-0112").lead, null);
});

test("POST /numbers/:id/lead: pin, conflict on a stale revision, Unlink excludes and recomputes", () => {
  const state = createNumbersMockState();
  const rows = data(call(state, "GET", "numbers?limit=100"), numbersPageSchema).items;
  const unknown = rows.find((row) => row.display === "(786) 555-0148")!;
  const noah = data(call(state, "GET", "numbers/lead-search?q=noah"), leadSearchSchema).items[0]!;
  assert.equal(noah.name, "Noah Fischer");
  assert.equal(noah.phone, "(801) 555-0112");

  const pinned = data(call(state, "POST", `numbers/${unknown.id}/lead`, { revision: unknown.revision, lead: { model: noah.model, id: noah.id } }), numberDetailSchema);
  assert.equal(pinned.number.lead?.name, "Noah Fischer");
  assert.equal(pinned.number.lead_link, "owner");
  assert.equal(pinned.number.revision, unknown.revision + 1);

  const stale = call(state, "POST", `numbers/${unknown.id}/lead`, { revision: unknown.revision, lead: null, unlink: { model: noah.model, id: noah.id } });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.code, "REVISION_CONFLICT");

  const unlinked = data(call(state, "POST", `numbers/${unknown.id}/lead`, { revision: pinned.number.revision, lead: null, unlink: { model: noah.model, id: noah.id } }), numberDetailSchema);
  assert.equal(unlinked.number.lead, null);
  assert.equal(unlinked.number.lead_link, "automatic");
  assert.deepEqual(unlinked.excluded_leads.map((lead) => lead.name), ["Noah Fischer"]);

  // Exactly one of a non-null lead or unlink.
  assert.equal(call(state, "POST", `numbers/${unknown.id}/lead`, { revision: unlinked.number.revision, lead: null }).status, 400);
  // The picker never lists a duplicate Lead.
  assert.ok(data(call(state, "GET", "numbers/lead-search?q=Taylor%20Brooks"), leadSearchSchema).items.every((lead) => lead.job_no !== null));
});

test("Accounts: connect a suggestion, change with a role, disconnect, a stale link revision, Suggest matches", () => {
  const state = createNumbersMockState();
  const read = () => data(call(state, "GET", "accounts"), accountsSchema);
  const initial = read();
  assert.deepEqual(initial.agents.map((agent) => agent.name), [...initial.agents.map((agent) => agent.name)].sort());
  const drew = initial.accounts.find((account) => account.extension_number === "105")!;
  assert.equal(drew.agent, null);
  assert.equal(drew.suggestion?.agent_name, "Drew Lane");
  const missing = initial.accounts.find((account) => !account.in_directory)!;
  assert.equal(missing.can_message, false);

  const connected = data(call(state, "POST", `accounts/${drew.extension_id}/agent`, { agent_id: drew.suggestion!.agent_id }), { parse: (value: unknown) => value as { account: typeof drew } });
  assert.equal(connected.account.agent?.name, "Drew Lane");
  assert.equal(connected.account.role, "sales_rep");
  assert.equal(connected.account.suggestion, null);

  const casey = initial.accounts.find((account) => account.extension_number === "104")!;
  const morgan = initial.agents.find((agent) => agent.name === "Morgan Blake")!;
  assert.equal(call(state, "POST", `accounts/${casey.extension_id}/agent`, { agent_id: morgan.id, role: "manager", link_revision: 99 }).status, 409);
  const changed = call(state, "POST", `accounts/${casey.extension_id}/agent`, { agent_id: morgan.id, role: "manager", link_revision: casey.link_revision });
  assert.equal(changed.status, 200);
  const afterChange = read().accounts.find((account) => account.extension_id === casey.extension_id)!;
  assert.equal(afterChange.agent?.name, "Morgan Blake");
  assert.equal(afterChange.role, "manager");
  assert.notEqual(afterChange.link_id, casey.link_id);

  const disconnected = call(state, "POST", `accounts/${afterChange.extension_id}/agent`, { agent_id: null, link_revision: afterChange.link_revision });
  assert.equal(disconnected.status, 200);
  assert.equal(read().accounts.find((account) => account.extension_id === casey.extension_id)!.agent, null);

  const robin = read().accounts.find((account) => account.extension_number === "106")!;
  assert.equal(robin.suggestion, null);
  const suggested = data(call(state, "POST", "accounts/suggest", {}), accountsSchema);
  assert.equal(suggested.accounts.find((account) => account.extension_number === "106")!.suggestion?.agent_name, "Robin Hale");
});

test("Message: preview then send with the link's revision; a non-messageable user is refused", () => {
  const state = createNumbersMockState();
  const alex = data(call(state, "GET", "accounts"), accountsSchema).accounts.find((account) => account.extension_number === "101")!;
  const body = nudgeCommandBody(alex, "pager", "  Please review today's missed callers.  ");
  assert.equal(body.nudge.body, "Please review today's missed callers.");
  assert.equal(body.nudge.rep_identity_link_id, alex.link_id);
  assert.equal(body.expected_rep_revision, alex.link_revision);
  const preview = data(call(state, "POST", "nudges/preview", body), nudgePreviewSchema);
  assert.equal(preview.body, "Please review today's missed callers.");
  assert.ok(preview.allowed_channels.includes("pager"));
  const sent = data(call(state, "POST", "nudges", body), nudgeSendSchema);
  assert.equal(sent.nudge.status, "sent");
  assert.equal(call(state, "POST", "nudges", { ...body, expected_rep_revision: 99 }).status, 409);

  const unlinked = data(call(state, "GET", "accounts"), accountsSchema).accounts.find((account) => account.extension_number === "110")!;
  const pagerOnly = nudgeCommandBody(unlinked, "pager", "Hello");
  assert.equal("expected_rep_revision" in pagerOnly, false);
  assert.equal(call(state, "POST", "nudges/preview", pagerOnly).status, 200);
  assert.equal(call(state, "POST", "nudges/preview", nudgeCommandBody(unlinked, "team_messaging", "Hello")).status, 409);
});

test("display helpers: result pills, durations, waiting time from as_of, lead names", () => {
  assert.deepEqual(callResultPill("inbound", "missed"), { text: "Missed", variant: "red" });
  assert.deepEqual(callResultPill("inbound", "voicemail"), { text: "Voicemail", variant: "amber" });
  assert.deepEqual(callResultPill("outbound", "missed"), { text: "No answer", variant: "neutral" });
  assert.deepEqual(callResultPill("outbound", "answered"), { text: "Answered", variant: "green" });
  assert.equal(callDuration(null), null);
  assert.equal(callDuration(41), "41 s");
  assert.equal(callDuration(312), "5 min 12 s");
  assert.equal(callDuration(120), "2 min");
  assert.equal(waitingText(null, "2026-10-01T16:00:00.000Z"), null);
  assert.deepEqual(waitingText("2026-10-01T15:45:00.000Z", "2026-10-01T16:00:00.000Z"), { text: "15 minutes", tone: "amber" });
  assert.deepEqual(waitingText("2026-09-28T15:00:00.000Z", "2026-10-01T16:00:00.000Z"), { text: "3 days", tone: "red" });
  assert.equal(leadName({ name: null, job_no: "P1" }), "Job P1");
  assert.equal(leadName({ name: " ", job_no: null }), "Unnamed lead");
  assert.equal(leadStatePill("open"), null);
  assert.equal(leadStatePill("booked")?.text, "Booked");
});
