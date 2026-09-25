import assert from "node:assert/strict";
import test from "node:test";
import {
  attentionParamsFromDesk, closedHistoryParamsFromDesk, deepLinkTarget, deskUrlUpdate, effectiveSort, overviewParamsFromDesk, parseDeskUrl, serializeDeskUrl,
} from "../../components/sales-intelligence/data/url-state";
import { attentionQuery, closedHistoryQuery, overviewQuery, timelineQuery, withCursor } from "../../components/sales-intelligence/data/requests";
import { presetOf, presetPriority, presetStorageKey, readStoredPreset, writeStoredPreset } from "../../components/sales-intelligence/data/preset-storage";
import { legacyNumberHref, legacyNumbersHref } from "../../components/sales-intelligence/lib/legacy-links";

const url = (query: string) => new URLSearchParams(query);

test("parse → serialize round trip keeps every owned key, multi-values repeated", () => {
  const query = "view=all_outreach&sort=last_call&direction=asc&band=1&band=2&priority=0&priority=not_set&state=open&agent_id=a1&needs_review=true&unassigned=true"
    + "&attachment=lead&has_recording=true&has_assessment=true&newer_call=true&ti_min=50&ml_min=25&received_from=2026-09-18T04%3A00%3A00.000Z"
    + "&received_to=2026-09-25T04%3A00%3A00.000Z&move_date_within=30&move_date_passed=true&freshness=fresh&q=Priya&period=last_7_days";
  const state = parseDeskUrl(url(query));
  assert.deepEqual(state.band, ["1", "2"]);
  assert.deepEqual(state.priority, ["0", "not_set"]);
  assert.equal(state.ti_min, 50);
  assert.equal(state.attachment, "lead");
  const again = parseDeskUrl(serializeDeskUrl(state));
  assert.deepEqual(again, state);
  const written = serializeDeskUrl(state).toString();
  assert.match(written, /priority=0&priority=not_set/);
  assert.doesNotMatch(written, /%5B%5D|\[\]/, "the bracket form is never written");
});

test("comma-separated multi-values are read, and rewritten repeated", () => {
  const state = parseDeskUrl(url("view=closed&outcome=crm_dead,crm_bad_unusable&priority=7,8"));
  assert.deepEqual(state.outcome, ["crm_dead", "crm_bad_unusable"]);
  const next = deskUrlUpdate("view=closed&outcome=crm_dead,crm_bad_unusable", { outcome: state.outcome });
  assert.deepEqual(next.getAll("outcome"), ["crm_dead", "crm_bad_unusable"]);
});

test("an absent or unknown view is the Overview; the Overview is not written to the URL", () => {
  assert.equal(parseDeskUrl(url("")).view, "overview");
  assert.equal(parseDeskUrl(url("view=nonsense")).view, "overview");
  assert.equal(deskUrlUpdate("view=attention", { view: "overview" }).has("view"), false);
});

test("any filter, sort, view or search change drops the cursor; an unrelated key does not", () => {
  const base = "view=attention&cursor=abc&attention_cursor=def&tab=x";
  for (const patch of [{ band: ["2"] }, { sort: "last_call" }, { direction: "asc" as const }, { view: "all_outreach" as const }, { q: "Nair" },
    { priority: ["1"] }, { attachment: "none" as const }, { needs_review: true }, { ti_min: 40 }, { freshness: "fresh" as const }]) {
    const next = deskUrlUpdate(base, patch);
    assert.equal(next.has("cursor"), false, JSON.stringify(patch));
    assert.equal(next.has("attention_cursor"), false, JSON.stringify(patch));
    assert.equal(next.get("tab"), "x", "keys the module doesn't own are kept");
  }
  // Re-sending the same value is not a change.
  assert.equal(deskUrlUpdate("view=attention&band=2&cursor=abc", { band: ["2"] }).get("cursor"), "abc");
});

test("a new sort resets the direction to that sort's default; a new view resets the sort", () => {
  const sorted = deskUrlUpdate("view=all_outreach&sort=last_call&direction=asc", { sort: "interactions" });
  assert.equal(sorted.get("sort"), "interactions");
  assert.equal(sorted.has("direction"), false);
  assert.equal(effectiveSort("all_outreach", "interactions").direction, "desc");
  const moved = deskUrlUpdate("view=all_outreach&sort=interactions&direction=asc", { view: "closed" });
  assert.equal(moved.has("sort"), false);
  assert.equal(moved.has("direction"), false);
  const both = deskUrlUpdate("view=all_outreach", { view: "closed", sort: "time_to_close", direction: "desc" });
  assert.equal(both.get("sort"), "time_to_close");
  assert.equal(both.get("direction"), "desc");
});

test("old deep links are preserved and resolved (ADMIN-REBUILD traps 4–5)", () => {
  const legacy = "view=attention&lead=6ab4be0539a7bcb4aa41beb5&lead_model=FormLead&si_return=%2Fform-leads&panel=assessment";
  const next = deskUrlUpdate(legacy, { band: ["1"] });
  for (const key of ["lead", "lead_model", "si_return", "panel"]) assert.equal(next.get(key), url(legacy).get(key), key);
  assert.deepEqual(deepLinkTarget(parseDeskUrl(next)), { kind: "lead", model: "FormLead", id: "6ab4be0539a7bcb4aa41beb5" });
  assert.deepEqual(deepLinkTarget(parseDeskUrl(url("view=attention&outreach=o1&lead=l1&lead_model=CallLead"))), { kind: "outreach", id: "o1" });
  assert.equal(deepLinkTarget(parseDeskUrl(url("view=attention&lead=l1"))), null);
});

test("desk requests: default sorts per view, closed-only params only on Closed, freshness only with a score sort", () => {
  const state = parseDeskUrl(url("band=2&outcome=booked&closed_from=2026-09-01T04%3A00%3A00.000Z&freshness=fresh&priority=0&priority=not_set"));
  const attention = attentionQuery(attentionParamsFromDesk(state, "attention"));
  // Every view defaults to Lead received, newest first (Owner, 2026-09-25).
  assert.equal(attention.get("sort"), "lead_received");
  assert.equal(attention.get("direction"), "desc");
  assert.equal(attention.has("outcome"), false);
  assert.equal(attention.has("closed_from"), false);
  assert.equal(attention.has("freshness"), false, "Lead received is not a score sort");
  assert.deepEqual(attention.getAll("priority"), ["0", "not_set"]);
  assert.equal(attention.get("band"), "2");
  const all = attentionQuery(attentionParamsFromDesk(state, "all_outreach"));
  assert.equal(all.get("sort"), "lead_received");
  assert.equal(all.get("direction"), "desc");
  const scored = attentionQuery(attentionParamsFromDesk({ ...state, sort: "transaction_intent" }, "all_outreach"));
  assert.equal(scored.get("freshness"), "fresh");
  const closed = attentionQuery(attentionParamsFromDesk(state, "closed"));
  assert.equal(closed.get("sort"), "lead_received");
  assert.equal(closed.get("direction"), "desc");
  assert.equal(closed.get("outcome"), "booked");
  assert.equal(closed.has("band"), false);
  // A desk sort that Closed doesn't have falls back to Closed's default, and vice versa.
  assert.equal(attentionQuery(attentionParamsFromDesk({ ...state, sort: "last_call" }, "closed")).get("sort"), "lead_received");
  assert.equal(attentionQuery(attentionParamsFromDesk({ ...state, sort: "time_to_close" }, "attention")).get("sort"), "lead_received");
  // UI-1 §3.4: Last conversation defaults to newest first on the new desk.
  assert.equal(attentionQuery(attentionParamsFromDesk({ ...state, sort: "last_human_contact" }, "attention")).get("direction"), "desc");
});

test("Overview, Closed history and timeline queries: repeated params, no empty values", () => {
  const state = parseDeskUrl(url("period=custom&from=2026-09-01&to=2026-09-07&priority=0&priority=not_set&outcome=booked&outcome=granot_booked&agent_id=a1"));
  assert.equal(overviewQuery(overviewParamsFromDesk(state)).toString(), "period=custom&from=2026-09-01&to=2026-09-07&priority=0&priority=not_set");
  assert.equal(overviewQuery({ period: "today", from: "2026-09-01" }).toString(), "period=today", "from/to only with a custom period");
  assert.equal(overviewQuery({}).toString(), "");
  assert.equal(closedHistoryQuery(closedHistoryParamsFromDesk(state)).toString(), "outcome=booked&outcome=granot_booked&priority=0&priority=not_set&agent_id=a1&limit=50");
  assert.equal(timelineQuery(["call", "band_changed"]).toString(), "kinds=band_changed&kinds=call&limit=50");
  assert.equal(withCursor("attention", url("view=attention"), "c1"), "attention?view=attention&cursor=c1");
  assert.equal(withCursor("overview", url(""), null), "overview");
});

test("presets and their per-user memory (SSR-safe, never throws)", () => {
  assert.equal(presetOf([]), "all");
  assert.equal(presetOf(["not_set", "0"]), "new");
  assert.equal(presetOf(["1"]), "quoted");
  assert.equal(presetOf(["9", "8", "7", "4", "3"]), "other");
  assert.equal(presetOf(["1", "3"]), "custom");
  assert.deepEqual(presetPriority("new"), ["0", "not_set"]);
  // No window (server render): nothing stored, and writing is a no-op.
  assert.equal(readStoredPreset("u1"), null);
  writeStoredPreset("u1", { priority: ["1"], attachment: null });
  const store = new Map<string, string>();
  const g = globalThis as { window?: unknown };
  g.window = { localStorage: { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => void store.set(key, value) } };
  try {
    writeStoredPreset("u1", { priority: ["0", "not_set"], attachment: "none" });
    assert.deepEqual(readStoredPreset("u1"), { priority: ["0", "not_set"], attachment: "none" });
    assert.equal(readStoredPreset("u2"), null, "per user");
    store.set(presetStorageKey("u3"), "{not json");
    assert.equal(readStoredPreset("u3"), null);
    g.window = { get localStorage(): Storage { throw new Error("blocked"); } };
    assert.equal(readStoredPreset("u1"), null);
    writeStoredPreset("u1", { priority: [], attachment: null });
  } finally { delete g.window; }
});

test("legacy links are built in one place", () => {
  assert.equal(legacyNumberHref("6ab4 be/05"), "/sales-intelligence/legacy?view=numbers&number=6ab4%20be%2F05");
  assert.equal(legacyNumbersHref(), "/sales-intelligence/legacy?view=numbers");
});
