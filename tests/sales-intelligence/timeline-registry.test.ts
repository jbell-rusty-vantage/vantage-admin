import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as lucide from "lucide-react";
import { timelineV2Schema, timelineEventSchema, type TimelineEvent } from "../../lib/api/salesIntelligence";
import {
  EVENT_KINDS, GENERIC_KIND, EventRow, eventGroup, eventIcon, hasKindEntry, kindEntry, kindsForGroups, TIMELINE_GROUPS,
} from "../../components/sales-intelligence/timeline";
import { findContractsDir, fixtureTest } from "./contracts-dir";

// UI1-TL (UI1-A35): every timeline kind in the contract fixtures has a registry entry; an unknown kind renders
// through the generic fallback without throwing. No DOM (ADMIN-REBUILD trap 7).

const CONTRACTS = findContractsDir() ?? "";

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}

/** The v2 timeline route captures: `outreach-timeline__*`, `number-timeline__*` and S8's `*-outreach-timeline*` (owner and rep). */
const TIMELINE_FILE = /[\\/][^\\/]*(outreach|number)-timeline[^\\/]*\.json$/;
type Loaded = { file: string; asOf: string; items: TimelineEvent[] };
const loaded: Loaded[] = [];
const skipped: string[] = [];
for (const file of (CONTRACTS ? walk(CONTRACTS) : []).filter((f) => TIMELINE_FILE.test(f))) {
  const rel = path.relative(CONTRACTS, file);
  // flag-off/ holds TIMELINE_V2-off (v1) pages: story kinds (`interaction`, `followup`, …), never rendered by this timeline.
  if (/(^|[\\/])flag-off[\\/]/.test(rel)) { skipped.push(`${rel} (flag-off v1)`); continue; }
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  const body = raw && typeof raw === "object" && "body" in raw && "status" in raw ? raw.body : raw;
  if (!body?.data?.items) { skipped.push(`${rel} (no items: ${raw.status ?? "?"})`); continue; }
  const parsed = timelineV2Schema.parse(body);
  loaded.push({ file: rel, asOf: parsed.as_of, items: parsed.data.items });
}

fixtureTest("every kind in the timeline fixtures has a registry entry (A35)", () => {
  assert.ok(loaded.length >= 90, `only ${loaded.length} timeline captures found`);
  const kinds = new Map<string, number>();
  const missing = new Set<string>();
  for (const { items, file } of loaded) {
    for (const item of items) {
      kinds.set(item.kind, (kinds.get(item.kind) ?? 0) + 1);
      if (!hasKindEntry(item.kind)) missing.add(`${item.kind} (${file})`);
    }
  }
  assert.deepEqual([...missing], [], "kinds with no registry entry");
  console.log(`timeline fixtures: ${loaded.length} pages, ${kinds.size} kinds; skipped ${skipped.length}: ${skipped.filter((s) => !s.endsWith("(flag-off v1)")).join(", ")}`);
  // TL-AUDIT §5a: the 23 kinds the fixtures show, plus CF12's `followup_redated` (S12-REPACT) and `nudge_sent` (S12-REPNUDGE: the
  // first capture of a sent nudge; its entry stays a "server" kind from the TL audit).
  assert.equal(kinds.size, 25, [...kinds.keys()].sort().join(","));
  for (const kind of kinds.keys()) if (kind !== "nudge_sent") assert.equal(EVENT_KINDS[kind]!.source, "fixture", `${kind} is a fixture kind`);
});

fixtureTest("the registry's group matches the server's group on every fixture item, and no fixture kind is pending", () => {
  for (const { items, file } of loaded) {
    for (const item of items) {
      assert.equal(kindEntry(item.kind).group, item.group, `${item.kind} in ${file}`);
      assert.ok(!kindEntry(item.kind).pending, item.kind);
    }
  }
});

fixtureTest("every fixture item renders through its entry, with the server's title and description", () => {
  let rendered = 0;
  for (const { items, asOf } of loaded) {
    for (const item of items) {
      const html = renderToStaticMarkup(createElement(EventRow, { item, asOf }));
      assert.ok(html.includes(`data-kind="${item.kind}"`) && html.includes('data-known="1"'), item.id);
      rendered += 1;
    }
  }
  assert.ok(rendered > 500);
});

test("the registry covers the UI-0 §7.3 map, the 11 unfixtured server kinds and the S11-TL kinds (pending)", () => {
  const server = ["conversation_recorded", "followup_cancelled", "reopened", "waiting_set", "review_resolved", "restriction_set", "restriction_resolved", "nudge_sent", "call_started", "call_ended", "analysis_submitted"];
  for (const kind of server) assert.equal(EVENT_KINDS[kind]?.source, "server", kind);
  const s11 = ["duplicate_lead_received", "lead_details_changed", "booking_changed", "cancellation_changed", "granot_booking_action", "auto_assigned", "followup_rescheduled", "analysis_published", "reanalysis_requested", "analysis_reviewed"];
  for (const kind of s11) {
    assert.equal(EVENT_KINDS[kind]?.source, "s11-tl", kind);
    assert.equal(EVENT_KINDS[kind]?.pending, "S11-TL", kind);
  }
  for (const kind of ["rep_replied", "thread_resolved"]) assert.ok(EVENT_KINDS[kind]?.pending, kind);
  // S12-REPACT shipped `followup_redated`: a live kind now (fixture `S12/owner-outreach-timeline-kind__followup-redated.json`).
  assert.equal(EVENT_KINDS.followup_redated?.pending, undefined);
  assert.equal(EVENT_KINDS.followup_redated?.group, "work");
  assert.equal(Object.keys(EVENT_KINDS).length, 23 + 11 + 10 + 3);
  // Pending kinds are never sent (the server answers 400 to an unknown kind).
  const all = kindsForGroups([...TIMELINE_GROUPS]);
  for (const kind of [...s11, "rep_replied", "thread_resolved"]) assert.ok(!all.includes(kind), kind);
  assert.deepEqual(kindsForGroups(["calls"]), ["call", "conversation_recorded"]);
  assert.deepEqual(kindsForGroups([]), []);
});

test("UI-0 §7.3 icons: call by direction and result, the named kinds, the generic dot", () => {
  const exports = lucide as unknown as Record<string, unknown>;
  const base = timelineEventSchema.parse({ id: "x", kind: "call", happened_at: "2026-09-20T12:00:00Z", observed_at: "2026-09-20T12:00:00Z", description: "d" });
  const call = (direction: string, result: string | null) => ({ ...base, call: { interaction_id: "i", direction, result, contact_type: null, duration_seconds: null, recording_state: "none", conversation_id: null, rep: null } });
  assert.equal(eventIcon(call("Inbound", "Call connected")), exports.PhoneIncoming);
  assert.equal(eventIcon(call("Outbound", "Busy")), exports.PhoneOutgoing);
  assert.equal(eventIcon(call("Outbound", "No Answer")), exports.PhoneMissed);
  assert.equal(eventIcon(call("Inbound", "Missed")), exports.PhoneMissed);
  assert.equal(eventIcon(call("Unknown", "Call connected")), exports.Phone);
  assert.equal(eventIcon({ ...base, call: null }), exports.Phone);
  const icon = (kind: string) => eventIcon({ ...base, kind });
  assert.equal(icon("lead_received"), exports.Inbox);
  assert.equal(icon("band_changed"), exports.ArrowUpDown);
  assert.equal(icon("followup_superseded"), exports.Replace);
  assert.equal(icon("receiver_agent_changed"), exports.UserRoundCog);
  assert.equal(icon("made_up_kind"), exports.Dot);
  assert.equal(GENERIC_KIND.icon, exports.Dot);
});

test("a made-up kind renders through the generic fallback without throwing (A35)", () => {
  const item = timelineEventSchema.parse({
    id: "made_up:1", kind: "made_up_kind", happened_at: "2026-09-20T12:00:00Z", observed_at: "2026-09-20T12:00:00Z",
    title: "Something new happened", description: "The server described it.", group: "messages", detail: { weird: [1, { deep: null }] },
    actor: { kind: "robot", name: null }, action: { kind: "open_somewhere_new", href: "/x" },
  });
  assert.equal(hasKindEntry(item.kind), false);
  assert.equal(eventGroup(item), "messages");
  const html = renderToStaticMarkup(createElement(EventRow, { item, asOf: "2026-09-20T13:00:00Z" }));
  assert.ok(html.includes('data-known="0"'));
  assert.ok(html.includes("Something new happened") && html.includes("The server described it."));
  assert.ok(html.includes("lucide-dot"));
  assert.ok(!html.includes('href="/x"'), "an unknown action kind has no label, so no link");
  // A v1 item (no title, no group) and a malformed band detail never throw either.
  const v1 = timelineEventSchema.parse({ id: "v1", kind: "interaction", happened_at: "2026-09-20T12:00:00Z", observed_at: "2026-09-20T12:00:00Z", description: "Only a description." });
  assert.ok(renderToStaticMarkup(createElement(EventRow, { item: v1, asOf: "2026-09-20T13:00:00Z" })).includes("Only a description."));
  const band = timelineEventSchema.parse({ id: "b", kind: "band_changed", happened_at: "2026-09-20T12:00:00Z", observed_at: "2026-09-20T12:00:00Z", title: "Moved", description: "d", detail: { from_band: "x", cause: "nope" } });
  assert.ok(renderToStaticMarkup(createElement(EventRow, { item: band, asOf: "2026-09-20T13:00:00Z" })).includes("Left Attention"));
});
