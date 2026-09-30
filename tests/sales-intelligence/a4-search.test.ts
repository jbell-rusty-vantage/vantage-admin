import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { attentionCapabilitiesReadSchema, nextActionSchema, salesRosterSchema } from "../../lib/api/salesIntelligence";
import { FilterRail, railRegionsFor } from "../../components/sales-intelligence/rail";
import { OutreachListView } from "../../components/sales-intelligence/desk/outreach-list";
import { attentionQuery, closedHistoryQuery, supportedAttentionParams } from "../../components/sales-intelligence/data/requests";
import { attentionParamsFromDesk, clearDeskFilters, closedHistoryParamsFromDesk, deskUrlUpdate, parseDeskUrl, serializeDeskUrl } from "../../components/sales-intelligence/data/url-state";

const AGENT = "a".repeat(24);
const capabilities = attentionCapabilitiesReadSchema.parse({ ok: true, as_of: "2026-09-29T12:00:00Z", data: { capabilities: {
  roster: true, move_date: true, assignment: true, relationship: true, work: true, location: true, move_date_sort: true, snapshot_pin: true,
  closed_history: { move_date: true, assignment: true, location: true, work: false, relationship: false, move_date_sort: false, snapshot_pin: false },
} } }).data.capabilities;

test("A4 URL carries every new filter family and keeps legacy involvement separate", () => {
  const query = deskUrlUpdate("view=all_outreach&agent_id=" + AGENT + "&cursor=old", {
    assigned_agent_id: [AGENT], followup_agent_id: [AGENT], relationship: "involved", agent: AGENT,
    work: ["overdue_followup", "due_today"], move_date_mode: "within", move_days: 14,
    loc_side: "pickup", loc_city: "Miami", loc_state: "FL", loc_zip: "33101", snapshot_id: "outreach:one",
  });
  assert.equal(query.get("cursor"), null);
  const state = parseDeskUrl(query);
  assert.deepEqual(state.agent_id, [AGENT]);
  assert.deepEqual(state.assigned_agent_id, [AGENT]);
  assert.deepEqual(state.followup_agent_id, [AGENT]);
  assert.equal(state.relationship, "involved");
  assert.deepEqual(parseDeskUrl(serializeDeskUrl(state)).work, ["overdue_followup", "due_today"]);
  const sent = attentionQuery(attentionParamsFromDesk(state, "all_outreach"));
  for (const key of ["agent_id", "assigned_agent_id", "followup_agent_id", "relationship", "agent", "move_date_mode", "move_days", "loc_side", "loc_city", "loc_state", "loc_zip", "snapshot_id"]) assert.ok(sent.has(key), key);
  assert.deepEqual(sent.getAll("work"), ["overdue_followup", "due_today"]);
  const closed = closedHistoryQuery(closedHistoryParamsFromDesk({ ...state, view: "closed" }));
  assert.ok(closed.has("assigned_agent_id") && closed.has("loc_state"));
  assert.ok(!closed.has("work") && !closed.has("relationship") && !closed.has("snapshot_id"));
});

test("A4 capability gate preserves requested URL filters while withholding unsupported requests", () => {
  const requested = attentionParamsFromDesk(parseDeskUrl(new URLSearchParams(`view=all_outreach&move_date_mode=unknown&assigned_agent_id=${AGENT}&work=blocked&loc_state=FL&sort=move_date`)), "all_outreach");
  const old = supportedAttentionParams(requested, null);
  assert.deepEqual(old.unavailable, ["Move date", "Assigned rep", "Follow-up", "Location", "Move date sort"]);
  const sent = attentionQuery(old.params);
  for (const key of ["move_date_mode", "assigned_agent_id", "work", "loc_state"]) assert.equal(sent.has(key), false, key);
  assert.equal(requested.move_date_mode, "unknown", "the requested state remains intact");
  assert.equal(supportedAttentionParams(requested, capabilities).unavailable.length, 0);
  const invalid = supportedAttentionParams({ ...requested, move_date_mode: "range", move_from: "2026-02-30", move_through: "2026-03-01" }, capabilities);
  assert.ok(invalid.unavailable.includes("Invalid move date"));
  assert.equal(attentionQuery(invalid.params).has("move_date_mode"), false);
});

test("A4 Clear all removes hidden and visible filters, preserving view and sort", () => {
  const before = `view=closed&sort=closed&direction=asc&priority=0&attachment=lead&band=1&move_date_within=30&move_date_mode=unknown&loc_state=FL&work=blocked&q=Riley&snapshot_id=outreach%3Aone&cursor=old`;
  const after = deskUrlUpdate(before, clearDeskFilters());
  assert.equal(after.get("view"), "closed");
  assert.equal(after.get("sort"), "closed");
  assert.equal(after.get("direction"), "asc");
  for (const key of ["priority", "attachment", "band", "move_date_within", "move_date_mode", "loc_state", "work", "q", "snapshot_id", "cursor"]) assert.equal(after.has(key), false, key);
});

test("A4 roster and null date resolution follow the verified read shapes", () => {
  const roster = salesRosterSchema.parse({ ok: true, as_of: "2026-09-29T12:00:00Z", data: { agents: [{ id: AGENT, name: "Riley", active: false, has_open_work: true }], status: "ready", snapshot_id: "outreach:one" } });
  assert.equal(roster.data.agents[0]?.has_open_work, true);
  const followup = nextActionSchema.parse({ id: AGENT, revision: 1, allowed_actions: [], kind: "call", description: "Call", status: "open", due_at: null,
    snoozed_until: null, overdue: false, origin: "owner", assignment: { agent: null, origin: null }, promised_by: null, paused_channels: [], date_resolution: null });
  assert.equal(followup.date_resolution, null);
});

test("A4 controls keep 0/1 visible and disable unavailable families without losing the selection", () => {
  const state = parseDeskUrl(new URLSearchParams(`assigned_agent_id=${AGENT}&move_date_mode=unknown&loc_state=FL&work=blocked`));
  const sidebar = (caps: typeof capabilities | null) => renderToStaticMarkup(createElement(FilterRail, { regions: railRegionsFor("all_outreach"), value: state, onChange: () => {}, reps: [{ id: AGENT, name: "Riley", active: false }], asOf: null, capabilities: caps }));
  const html = sidebar(null);
  assert.ok(html.includes("Not available yet"));
  assert.ok(html.includes("Unknown"));
  const available = sidebar(capabilities);
  assert.ok(available.includes("Riley (inactive)"));
  assert.ok(available.includes("Blocked from calling"));
});

test("A4 initial pending projection has no false zero count or no-match sentence", () => {
  const html = renderToStaticMarkup(createElement(OutreachListView, { view: "all_outreach", rows: [], asOf: "2026-09-29T12:00:00Z", sort: "lead_received", q: "Riley", totalItems: null,
    stale: false, hasMore: false, emptyOverride: "Results are not available until the next publish." }));
  assert.ok(html.includes("Results are not available until the next publish."));
  assert.ok(!html.includes("Nothing matches"));
  assert.ok(!html.includes("data-results"));
});
