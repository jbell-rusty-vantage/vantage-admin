import assert from "node:assert/strict";
import test from "node:test";
import { applyUrlStateUpdate } from "../lib/api/url-state-update";
import { activeLeadFilters, CLEAR_ALL_FILTERS, leadsUrlUpdate, parseLeadsUrl } from "../components/leads/leads-url";

test("an empty URL is the defaults", () => {
  const state = parseLeadsUrl(new URLSearchParams(""));
  assert.equal(state.show, "regular");
  assert.equal(state.status, "all");
  assert.equal(state.sort, "received_desc");
  assert.equal(state.dateField, "timestamp");
  assert.equal(state.kind, null);
  assert.equal(state.lead, null);
  assert.equal(state.isNew, false);
  assert.equal(state.noSync, "any");
});

test("every documented key parses", () => {
  const state = parseLeadsUrl(
    new URLSearchParams(
      "q=Ada&kind=call&show=duplicates&status=booked&company=top10&feed=top10_forms&agent=unassigned&from=2026-10-01&to=2026-10-05&date_field=move_date&sort=move_soonest&lead=abc&lk=form&panel=contact&new=1&no_sync=true&move_size=Studio&local=local",
    ),
  );
  assert.deepEqual(
    { q: state.q, kind: state.kind, show: state.show, status: state.status, company: state.company, feed: state.feed, agent: state.agent },
    { q: "Ada", kind: "call", show: "duplicates", status: "booked", company: "top10", feed: "top10_forms", agent: "unassigned" },
  );
  assert.equal(state.dateField, "move_date");
  assert.equal(state.sort, "move_soonest");
  assert.equal(state.lead, "abc");
  assert.equal(state.lk, "form");
  assert.equal(state.panel, "contact");
  assert.equal(state.isNew, true);
  assert.equal(state.noSync, "yes");
  assert.equal(state.moveSize, "Studio");
  assert.equal(state.local, "local");
});

test("unknown values fall back to the defaults", () => {
  const state = parseLeadsUrl(new URLSearchParams("kind=zzz&show=zzz&status=zzz&sort=zzz&lk=zzz&no_sync=maybe"));
  assert.equal(state.kind, null);
  assert.equal(state.show, "regular");
  assert.equal(state.status, "all");
  assert.equal(state.sort, "received_desc");
  assert.equal(state.lk, null);
  assert.equal(state.noSync, "any");
});

test("defaults serialise to a removed key and the rest round-trips", () => {
  const next = applyUrlStateUpdate(
    "status=booked&show=duplicates&sort=received_asc&q=x",
    leadsUrlUpdate({ status: "all", show: "regular", sort: "received_desc", kind: "form", isNew: true, noSync: "no" }),
  ).toString();
  assert.equal(next, "q=x&kind=form&no_sync=false&new=1");
});

test("clear all removes the filters but keeps sort and the open lead", () => {
  const next = applyUrlStateUpdate(
    "q=x&kind=form&status=open&company=a&feed=b&agent=c&from=2026-10-01&sort=received_asc&lead=1&lk=form",
    leadsUrlUpdate(CLEAR_ALL_FILTERS),
  ).toString();
  assert.equal(next, "sort=received_asc&lead=1&lk=form");
});

test("active filters become removable chips with Owner labels", () => {
  const state = parseLeadsUrl(new URLSearchParams("kind=form&status=booked&company=top10&feed=f1&agent=a1&show=duplicates&from=2026-10-01&to=2026-10-05"));
  const chips = activeLeadFilters(state, {
    company: () => "Top10 Forms",
    feed: () => "Top10 Forms (LD)",
    agent: () => "Josh",
  });
  assert.deepEqual(
    chips.map((chip) => chip.label),
    ["Form leads", "Booked", "Top10 Forms", "Top10 Forms (LD)", "Josh", "Duplicates", "Received 2026-10-01 to 2026-10-05"],
  );
  assert.deepEqual(chips[2]?.clear, { company: null, feed: null });
});
