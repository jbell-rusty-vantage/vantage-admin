import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { attentionSchema, overviewSchema, ownerCoverageSchema } from "../../lib/api/salesIntelligence";
import { SALES_INTELLIGENCE_FALLBACK_POLL_MS, SALES_INTELLIGENCE_OFFLINE_MS, salesIntelligenceKeys } from "../../lib/query/salesIntelligence";
import {
  COVERAGE_HREF,
  HeaderLive,
  UpdatedListPill,
  attentionListShape,
  cachedOverviewCaptureStatus,
  captureHealthProp,
  listChanged,
  liveHealthOf,
  liveStatusOf,
  narrowHealth,
  readNewestAsOf,
  reportAsOf,
  resetNewestAsOf,
  type ListShape,
} from "../../components/sales-intelligence/data/live";
import { siKeys } from "../../components/sales-intelligence/data/query-keys";
import { findContractsDir, fixtureTest } from "./contracts-dir";

// UI1-LIVE: the header indicator's inputs, the list rule and the fallback constants (UI-0 §2.5). No DOM (trap 7):
// the SSE reconnect and the 30 s timer need the browser pass.

const CONTRACTS = findContractsDir() ?? "";
const fixture = (rel: string) => JSON.parse(fs.readFileSync(path.join(CONTRACTS, rel), "utf8"));
const decode = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');

const shape = (snapshotId: string | null, keys: string[], totalItems: number | null = keys.length): ListShape => ({ snapshotId, totalItems, keys });

test("listChanged: same snapshot never changes the order; a new snapshot changes it only when order or count differ", () => {
  assert.equal(listChanged(shape("s1", ["a", "b"]), shape("s1", ["a", "b", "c"], 2)), false, "Load more within one snapshot");
  assert.equal(listChanged(shape("s1", ["a", "b"]), shape("s2", ["a", "b"])), false, "new snapshot, same order: in place");
  assert.equal(listChanged(shape("s1", ["a", "b"]), shape("s2", ["b", "a"])), true, "reordered");
  assert.equal(listChanged(shape("s1", ["a", "b"]), shape("s2", ["a", "b"], 3)), true, "count changed");
  assert.equal(listChanged(shape("s1", ["a", "b"]), shape("s2", ["a"], 2)), true, "a row left");
  assert.equal(listChanged(shape(null, ["a"]), shape(null, ["a"])), false, "no snapshot id, same list");
  assert.equal(listChanged(shape(null, ["a"]), shape(null, ["b"])), true, "no snapshot id, different list");
});

fixtureTest("attentionListShape reads snapshot_id, total_items and the subject_key sequence from a fixture page", () => {
  const page = attentionSchema.parse(fixture("S5c/attention__default.json"));
  const s = attentionListShape({ pages: [page] });
  assert.equal(s.snapshotId, page.data.snapshot_id);
  assert.equal(s.totalItems, page.data.total_items);
  assert.equal(s.keys.length, page.data.items.length);
  assert.equal(s.keys[0], page.data.items[0]!.subject_key);
  // The same page republished under a new snapshot with two rows swapped is a pending update.
  const swapped = { ...page, data: { ...page.data, snapshot_id: "outreach:other", items: [page.data.items[1]!, page.data.items[0]!, ...page.data.items.slice(2)] } };
  assert.equal(listChanged(s, attentionListShape({ pages: [swapped] })), true);
  const same = { ...page, data: { ...page.data, snapshot_id: "outreach:other" } };
  assert.equal(listChanged(s, attentionListShape({ pages: [same] })), false);
});

test("liveStatusOf: offline only after the down timer, never while live", () => {
  assert.equal(liveStatusOf("live", true), "live");
  assert.equal(liveStatusOf("reconnecting", false), "reconnecting");
  assert.equal(liveStatusOf("reconnecting", true), "offline");
  assert.equal(liveStatusOf("connecting", true), "offline");
  assert.equal(SALES_INTELLIGENCE_OFFLINE_MS, 30_000);
  assert.equal(SALES_INTELLIGENCE_FALLBACK_POLL_MS, 60_000);
});

fixtureTest("capture health: the Overview's cached status wins, coverage supplies known_complete_through, unknown words are null", () => {
  const coverage = ownerCoverageSchema.parse(fixture("S5c/coverage__seed.json")).data.coverage.capture_health!;
  assert.deepEqual(liveHealthOf(null, coverage), { status: "attention", knownCompleteThrough: coverage.known_complete_through });
  assert.deepEqual(liveHealthOf("broken", coverage), { status: "broken", knownCompleteThrough: coverage.known_complete_through });
  assert.deepEqual(liveHealthOf(null, null), { status: null, knownCompleteThrough: null });
  assert.equal(narrowHealth("degraded"), null);
  assert.equal(captureHealthProp({ status: null, knownCompleteThrough: null }), null);

  const client = new QueryClient();
  assert.equal(cachedOverviewCaptureStatus(client), null);
  const overview = overviewSchema.parse(fixture("S8/owner-overview__default.json"));
  client.setQueryData(siKeys.overview({ period: "today" }), overview);
  assert.equal(cachedOverviewCaptureStatus(client), overview.data.now.capture_health!.status);
  client.setQueryData(siKeys.overview({ period: "last_7_days" }), { data: { ...overview.data, as_of: "2000-01-01T00:00:00.000Z", now: { ...overview.data.now, capture_health: { status: "ok" } } } });
  assert.equal(cachedOverviewCaptureStatus(client), overview.data.now.capture_health!.status, "the newest Overview decides");
});

test("the newest as_of on screen only moves forward", () => {
  resetNewestAsOf();
  reportAsOf("2026-09-23T21:46:37.661Z");
  reportAsOf("2026-09-23T20:00:00.000Z");
  reportAsOf("not a time");
  reportAsOf(null);
  assert.equal(readNewestAsOf(), "2026-09-23T21:46:37.661Z");
  reportAsOf("2026-09-24T18:39:02.909Z");
  assert.equal(readNewestAsOf(), "2026-09-24T18:39:02.909Z");
  resetNewestAsOf();
});

test("UpdatedListPill reads `Updated list available · Show` with a 44 px Show button", () => {
  const html = decode(renderToStaticMarkup(createElement(UpdatedListPill, { onShow: () => {} })));
  assert.match(html, /Updated list available<\/span><span aria-hidden="true">·<\/span><button type="button" class="si-link si-listpill__show" aria-label="Show the updated list">/);
  assert.ok(html.includes(">Show</button>"));
  assert.ok(html.includes('role="status"'));
});

test("HeaderLive renders the indicator before the stream opens (server render: Connecting…, Refresh)", () => {
  const client = new QueryClient();
  const html = decode(renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(HeaderLive, { healthEnabled: false }))));
  assert.ok(html.includes("Connecting…"));
  assert.ok(html.includes('aria-label="Refresh everything on this page"'));
  // The Coverage link lives in the tooltip card, which renders its body only when opened (primitives test covers it).
  assert.equal(COVERAGE_HREF, "/sales-intelligence?view=coverage");
  assert.ok(!html.includes("is-unhealthy"));
  assert.deepEqual(salesIntelligenceKeys.all, ["sales-intelligence"]);
});
