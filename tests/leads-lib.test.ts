import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyLeadSearch,
  effectiveLeadKinds,
  leadListFilters,
  mergeLeadPages,
  type LeadFilterState,
  type LeadItem,
  type LeadKind,
} from "../lib/api/leads";

function item(kind: LeadKind, id: string, timestamp: string, extra: Record<string, unknown> = {}): LeadItem {
  return { _id: id, __kind: kind, timestamp, ...extra };
}

const ids = (items: LeadItem[]) => items.map((entry) => entry._id);

test("merge interleaves two newest-first lists and stops at the frontier", () => {
  const form = [item("form", "f1", "2026-10-05T12:00:00Z"), item("form", "f2", "2026-10-05T10:00:00Z"), item("form", "f3", "2026-10-05T08:00:00Z")];
  const call = [item("call", "c1", "2026-10-05T11:00:00Z"), item("call", "c2", "2026-10-05T09:00:00Z")];
  const out = mergeLeadPages(form, call, { sort: "received_desc", formExhausted: false, callExhausted: false });
  // The call list ran out first (last 09:00): f3 (08:00) could hide an unloaded call lead, so it waits.
  assert.deepEqual(ids(out.items), ["f1", "c1", "f2", "c2"]);
  assert.equal(out.frontier, "call");
});

test("merge emits everything once both lists are exhausted", () => {
  const form = [item("form", "f1", "2026-10-05T12:00:00Z"), item("form", "f3", "2026-10-05T08:00:00Z")];
  const call = [item("call", "c1", "2026-10-05T11:00:00Z")];
  const out = mergeLeadPages(form, call, { sort: "received_desc", formExhausted: true, callExhausted: true });
  assert.deepEqual(ids(out.items), ["f1", "c1", "f3"]);
  assert.equal(out.frontier, null);
});

test("an exhausted list does not hold the other back", () => {
  const form = [item("form", "f1", "2026-10-05T12:00:00Z"), item("form", "f2", "2026-10-05T07:00:00Z")];
  const call = [item("call", "c1", "2026-10-05T11:00:00Z")];
  const out = mergeLeadPages(form, call, { sort: "received_desc", formExhausted: false, callExhausted: true });
  assert.deepEqual(ids(out.items), ["f1", "c1", "f2"]);
  assert.equal(out.frontier, "form");
});

test("one empty list that is not exhausted shows nothing and asks for that list", () => {
  const form = [item("form", "f1", "2026-10-05T12:00:00Z")];
  const out = mergeLeadPages(form, [], { sort: "received_desc", formExhausted: true, callExhausted: false });
  assert.deepEqual(out.items, []);
  assert.equal(out.frontier, "call");
});

test("one empty exhausted list passes the other list through", () => {
  const form = [item("form", "f1", "2026-10-05T12:00:00Z"), item("form", "f2", "2026-10-05T11:00:00Z")];
  const out = mergeLeadPages(form, [], { sort: "received_desc", formExhausted: false, callExhausted: true });
  assert.deepEqual(ids(out.items), ["f1", "f2"]);
  assert.equal(out.frontier, "form");
});

test("equal timestamps tie-break by _id in the sort direction", () => {
  const same = "2026-10-05T12:00:00Z";
  const form = [item("form", "b", same)];
  const call = [item("call", "a", same), item("call", "c", same)];
  const desc = mergeLeadPages(form, call, { sort: "received_desc", formExhausted: true, callExhausted: true });
  assert.deepEqual(ids(desc.items), ["c", "b", "a"]);
  const asc = mergeLeadPages(form, call, { sort: "received_asc", formExhausted: true, callExhausted: true });
  assert.deepEqual(ids(asc.items), ["a", "b", "c"]);
});

test("oldest first merges ascending and the frontier is the earlier-ending list", () => {
  const form = [item("form", "f1", "2026-10-01T00:00:00Z"), item("form", "f2", "2026-10-03T00:00:00Z")];
  const call = [item("call", "c1", "2026-10-02T00:00:00Z"), item("call", "c2", "2026-10-02T12:00:00Z")];
  const out = mergeLeadPages(form, call, { sort: "received_asc", formExhausted: false, callExhausted: false });
  assert.deepEqual(ids(out.items), ["f1", "c1", "c2"]);
  assert.equal(out.frontier, "call");
});

test("move date soonest puts missing dates last", () => {
  const form = [
    item("form", "f1", "2026-10-05T12:00:00Z", { move_date: "2026-11-02T00:00:00Z" }),
    item("form", "f2", "2026-10-04T12:00:00Z", { move_date: "2026-10-20T00:00:00Z" }),
  ];
  const call = [item("call", "c1", "2026-10-05T13:00:00Z")];
  const out = mergeLeadPages(form, call, { sort: "move_soonest", formExhausted: true, callExhausted: true });
  assert.deepEqual(ids(out.items), ["f2", "f1", "c1"]);
});

test("classifyLeadSearch follows the doc 03 table", () => {
  assert.deepEqual(classifyLeadSearch("5563723"), { kind: "job", value: "5563723" });
  assert.deepEqual(classifyLeadSearch("p5563723"), { kind: "job", value: "5563723" });
  assert.deepEqual(classifyLeadSearch("RF 5563723"), { kind: "job", value: "5563723" });
  assert.deepEqual(classifyLeadSearch("DT5563723"), { kind: "job", value: "5563723" });
  assert.deepEqual(classifyLeadSearch("(281) 900-1836"), { kind: "phone", value: "2819001836" });
  assert.deepEqual(classifyLeadSearch("+1 281-900-1836"), { kind: "phone", value: "2819001836" });
  assert.deepEqual(classifyLeadSearch("s.stafford@example.com"), { kind: "email", value: "s.stafford@example.com" });
  assert.deepEqual(classifyLeadSearch("  Scarlette Stafford "), { kind: "name", value: "Scarlette Stafford" });
  assert.deepEqual(classifyLeadSearch("12345"), { kind: "name", value: "12345" });
});

const base: LeadFilterState = {
  q: null,
  kind: null,
  show: "regular",
  status: "all",
  company: null,
  feed: null,
  agent: null,
  from: null,
  to: null,
  dateField: "timestamp",
  sort: "received_desc",
  noSync: "any",
  moveSize: null,
  local: null,
};

test("leadListFilters defaults: newest first, regular only, 50 per page", () => {
  assert.deepEqual(leadListFilters(base, "form"), { limit: 50, sort: "timestamp", direction: "desc", duplicate: false });
});

test("leadListFilters maps show and status", () => {
  assert.equal(leadListFilters({ ...base, show: "duplicates" }, "call").duplicate, true);
  assert.equal("duplicate" in leadListFilters({ ...base, show: "both" }, "call"), false);
  const open = leadListFilters({ ...base, status: "open" }, "form");
  assert.equal(open.booked, false);
  assert.equal(open.cancelled, false);
  assert.equal(leadListFilters({ ...base, status: "booked" }, "form").booked, true);
  assert.equal(leadListFilters({ ...base, status: "cancelled" }, "form").cancelled, true);
  const bad = leadListFilters({ ...base, status: "bad" }, "form");
  assert.equal("booked" in bad, false);
  assert.equal("bad_lead" in bad, false);
});

test("leadListFilters scopes kind-only filters and the source cascade", () => {
  const state = { ...base, moveSize: "Studio", local: "local", company: "top10" };
  assert.equal(leadListFilters(state, "form").move_size, "Studio");
  assert.equal("move_size" in leadListFilters(state, "call"), false);
  assert.equal(leadListFilters(state, "call").local, "local");
  assert.equal(leadListFilters(state, "call").source_company, "top10");
  const feed = leadListFilters({ ...state, feed: "top10_forms_ld" }, "form");
  assert.equal(feed.source_granularity_key, "top10_forms_ld");
  assert.equal("source_company" in feed, false);
});

test("leadListFilters agent: only an ObjectId reaches the server", () => {
  assert.equal(leadListFilters({ ...base, agent: "unassigned" }, "form").receiver_agent, undefined);
  assert.equal(leadListFilters({ ...base, agent: "507f1f77bcf86cd799439011" }, "form").receiver_agent, "507f1f77bcf86cd799439011");
});

test("leadListFilters dates and sorts", () => {
  const range = leadListFilters({ ...base, from: "2026-10-01", to: "2026-10-05", dateField: "move_date" }, "form");
  assert.equal(range.date_field, "move_date");
  assert.equal(range.from, "2026-10-01");
  assert.equal(range.to, "2026-10-05T23:59:59.999Z");
  const asc = leadListFilters({ ...base, sort: "received_asc" }, "call");
  assert.equal(asc.direction, "asc");
  const soon = leadListFilters({ ...base, sort: "move_soonest" }, "form");
  assert.equal(soon.sort, "move_date");
  assert.equal(soon.date_field, "move_date");
  assert.equal(soon.from, "2000-01-01");
  const soonCall = leadListFilters({ ...base, sort: "move_soonest" }, "call");
  assert.equal(soonCall.sort, "timestamp");
  assert.equal(soonCall.direction, "desc");
});

test("leadListFilters search per classifier", () => {
  assert.equal(leadListFilters({ ...base, q: "P5563723" }, "call").job_no, "5563723");
  const formJob = leadListFilters({ ...base, q: "5563723" }, "form");
  assert.equal(formJob.q, "5563723");
  assert.equal("job_no" in formJob, false);
  assert.equal(leadListFilters({ ...base, q: "(281) 900-1836" }, "form").phone_number, "2819001836");
  assert.equal(leadListFilters({ ...base, q: "a@b.co" }, "call").email, "a@b.co");
  assert.equal(leadListFilters({ ...base, q: "Ada Lovelace" }, "call").q, "Ada Lovelace");
});

test("effectiveLeadKinds narrows to the one model a filter exists on", () => {
  assert.deepEqual(effectiveLeadKinds(base), ["form", "call"]);
  assert.deepEqual(effectiveLeadKinds({ ...base, kind: "call" }), ["call"]);
  assert.deepEqual(effectiveLeadKinds({ ...base, status: "bad" }), ["form"]);
  assert.deepEqual(effectiveLeadKinds({ ...base, moveSize: "Studio" }), ["form"]);
  assert.deepEqual(effectiveLeadKinds(base, "call"), ["call"]);
});
