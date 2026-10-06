import assert from "node:assert/strict";
import test from "node:test";
import {
  channelDefaultsOf,
  costLeaf,
  currentPeriod,
  filingOf,
  granotRows,
  isChannelDefault,
  landsNowhere,
  numberLeaf,
  numberRows,
  quietLineParts,
  sourceReadiness,
} from "../components/setup/lead-sources/lead-sources-model";
import {
  closeSheetUrl,
  EMPTY_LEAD_SOURCES_URL,
  leadSourcesHref,
  openSheetOf,
  parseLeadSourcesUrl,
  patchLeadSourcesUrl,
} from "../components/setup/lead-sources/lead-sources-url";
import { needsYou } from "../components/setup/lead-sources/needs-you";
import type { LeadSourceListItem } from "../lib/api/leadSources";
import type { CplSchedulePeriod } from "../lib/api/registryCpl";
import type { GranotCrmSourceItem } from "../lib/api/registryGranotCrmSources";
import type { RingCentralRoute } from "../lib/api/registryRingCentral";
import { ORS3_LEAD_SOURCE_DETAIL } from "../lib/operations-registry/ors3LeadSourceDetailFixture";
import { rewriteRegistryHref } from "../lib/setup/setup-links";

const NOW = Date.parse("2026-10-06T12:00:00Z");

function list(overrides: Partial<LeadSourceListItem> = {}): LeadSourceListItem {
  return { ...ORS3_LEAD_SOURCE_DETAIL, ...overrides };
}

const granotBase: GranotCrmSourceItem = {
  id: "granot-1",
  granot_label: "Top10 Forms Prime",
  enabled: true,
  lifecycle_enabled: false,
  lifecycle_disposition: "source_scoped_lead",
  lead_created_policy: "link_only",
  lifecycle_routes: [],
  lifecycle_policy_version: "v1",
  default_channel: "form",
  automation_sources: [],
};

const routeBase: RingCentralRoute = {
  id: "route-1",
  provider: "ringcentral",
  phone_number: "+19545550142",
  phone_locked: false,
  display_label: "Best Relocation inbound queue",
  active: false,
  ever_activated: false,
  observed_target_names: [],
  validation_status: "unvalidated",
  created_from: "admin",
};

// ── needsYou ────────────────────────────────────────────────────────────────────────────────────────

test("needsYou reads the list: a missing or invalid lead cost opens the cost sheet", () => {
  const items = needsYou([list()]);
  const cost = items.filter((item) => item.kind === "cost_missing");
  assert.equal(cost.length, 3, "all three feeds are not priced");
  assert.ok(cost.every((item) => item.href.includes("edit=cost") && item.href.startsWith("/setup/lead-sources?")));
  assert.match(cost[0]!.text, /Best Relocation · Web forms — local moves has a lead cost that needs fixing/);
  assert.match(cost[1]!.text, /has no lead cost/);
  assert.match(cost[1]!.href, /source=lead-source-best-relocation&feed=feed-long&edit=cost/);
});

test("needsYou ignores a dormant source: off with no feed on", () => {
  const dormant = list({
    active: false,
    feeds: {
      empty: false,
      items: ORS3_LEAD_SOURCE_DETAIL.feeds.items.map((feed) => ({
        ...feed,
        active: false,
        readiness: { ...feed.readiness, lead_source_active: false, feed_active: false },
      })),
    },
  });
  assert.deepEqual(needsYou([dormant]), []);
});

test("needsYou flags a source that is off while a feed is on", () => {
  const items = needsYou([list({ active: false })]);
  const off = items.filter((item) => item.kind === "source_off_live_feeds");
  assert.equal(off.length, 1);
  assert.equal(off[0]!.href, "/setup/lead-sources?source=lead-source-best-relocation&edit=source");
  assert.match(off[0]!.text, /is off but has feeds that are on/);
});

test("needsYou flags an active call feed with no inbound number from the counts alone", () => {
  const withCount = list({
    feeds: {
      empty: false,
      items: ORS3_LEAD_SOURCE_DETAIL.feeds.items.map((feed) =>
        feed.channel === "call" ? { ...feed, inbound_number_count: 0, inbound_numbers: undefined } : feed,
      ),
    },
  });
  const items = needsYou([withCount]);
  const missing = items.find((item) => item.key === "nonumber:feed-call");
  assert.equal(missing?.kind, "number_not_filing");
  assert.match(missing!.href, /view=numbers/);
  assert.match(missing!.href, /edit=number&number=new/);
});

test("needsYou takes Granot names that land nowhere from the Granot names read", () => {
  const without = needsYou([]);
  assert.deepEqual(without, []);
  const items = needsYou([], {
    granotNames: [
      granotBase,
      { ...granotBase, id: "granot-ref", granot_label: "Referral Partner", lifecycle_disposition: "referral_booking" },
      { ...granotBase, id: "granot-off", granot_label: "Old name", enabled: false },
    ],
  });
  assert.equal(items.length, 1, "referral and disabled names do not need a landing");
  assert.equal(items[0]!.kind, "granot_nowhere");
  assert.equal(items[0]!.href, "/setup/lead-sources?view=granot&edit=granot&granot=granot-1");
  assert.match(items[0]!.text, /"Top10 Forms Prime" was seen in Granot but lands nowhere/);
});

test("needsYou flags a number that is checked but not filing, and one that stopped", () => {
  const items = needsYou([], {
    now: NOW,
    routes: [
      { ...routeBase, id: "ready", validation_status: "valid", validated_at: "2026-10-06T10:00:00.000Z" },
      { ...routeBase, id: "stopped", active: true, validation_status: "invalid" },
      { ...routeBase, id: "draft" },
      {
        ...routeBase,
        id: "filing",
        active: true,
        validation_status: "valid",
        current_assignment: {
          id: "a",
          route_id: "filing",
          source_company_id: "c",
          source_granularity_id: "f",
          lead_source_name: "Best Relocation",
          feed_display_name: "Inbound calls",
          effective_from: "2026-08-01T00:00:00.000Z",
          active: true,
        },
      },
    ],
  });
  assert.deepEqual(items.map((item) => item.key), ["number:ready", "number:stopped"]);
  assert.match(items[0]!.text, /\(954\) 555-0142 is checked but not filing calls/);
  assert.match(items[1]!.text, /stopped filing calls/);
  assert.equal(items[0]!.href, "/setup/lead-sources?view=numbers&edit=number&number=ready");
});

test("needsYou orders by the doc's kinds: cost, Granot names, numbers, source off", () => {
  const items = needsYou([list({ active: false })], {
    granotNames: [granotBase],
    routes: [{ ...routeBase, validation_status: "valid", validated_at: "2026-10-06T10:00:00.000Z" }],
    now: NOW,
  });
  const kinds = items.map((item) => item.kind);
  const firstOf = (kind: string) => kinds.indexOf(kind as (typeof kinds)[number]);
  assert.ok(firstOf("cost_missing") < firstOf("granot_nowhere"));
  assert.ok(firstOf("granot_nowhere") < firstOf("number_not_filing"));
  assert.ok(firstOf("number_not_filing") < firstOf("source_off_live_feeds"));
});

test("every needsYou href is a Setup URL, never an old Registry link", () => {
  const items = needsYou([list({ active: false })], { granotNames: [granotBase], routes: [routeBase] });
  for (const item of items) {
    assert.ok(item.href.startsWith("/setup/lead-sources"), item.href);
    assert.equal(rewriteRegistryHref(item.href), item.href);
  }
});

// ── URL contract ────────────────────────────────────────────────────────────────────────────────────

test("the URL contract parses view, source, feed, edit and ids, and drops an edit without its id", () => {
  const url = parseLeadSourcesUrl(new URLSearchParams("view=numbers&source=s1&feed=f1&edit=number&number=n1"));
  assert.deepEqual(url, { view: "numbers", source: "s1", feed: "f1", edit: "number", granot: null, number: "n1", isNew: false });
  assert.equal(parseLeadSourcesUrl(new URLSearchParams("edit=feed")).edit, null);
  assert.equal(parseLeadSourcesUrl(new URLSearchParams("edit=cost&source=s1")).edit, null);
  assert.equal(parseLeadSourcesUrl(new URLSearchParams("view=bogus")).view, "sources");
  assert.equal(parseLeadSourcesUrl(new URLSearchParams("new=1")).isNew, true);
  assert.equal(openSheetOf(parseLeadSourcesUrl(new URLSearchParams("new=1"))), "add");
  assert.equal(openSheetOf(parseLeadSourcesUrl(new URLSearchParams("edit=source&source=s1"))), "source");
  assert.equal(openSheetOf(EMPTY_LEAD_SOURCES_URL), null);
});

test("hrefs omit defaults and closing a sheet keeps the view and the open source", () => {
  assert.equal(leadSourcesHref({}), "/setup/lead-sources");
  assert.equal(leadSourcesHref({ view: "sources", source: "s1" }), "/setup/lead-sources?source=s1");
  assert.equal(leadSourcesHref({ isNew: true }), "/setup/lead-sources?new=1");
  const open = parseLeadSourcesUrl(new URLSearchParams("view=granot&source=s1&edit=granot&granot=g1&feed=f1"));
  assert.equal(closeSheetUrl(open), "/setup/lead-sources?view=granot&source=s1");
  assert.equal(patchLeadSourcesUrl(open, { edit: "feed", feed: "f2" }), "/setup/lead-sources?view=granot&source=s1&feed=f2&edit=feed&granot=g1");
});

test("the shell's old-link rewrite lands inside the URL contract", () => {
  assert.equal(
    rewriteRegistryHref("/operations-registry?tab=lead-sources&entity=s1&feed=f1"),
    "/setup/lead-sources?source=s1&feed=f1",
  );
  const parsed = parseLeadSourcesUrl(new URL(rewriteRegistryHref("/operations-registry?tab=granot-names&entity=g1"), "http://x").searchParams);
  assert.equal(parsed.view, "granot");
  assert.equal(parsed.granot, "g1");
});

// ── Model: defaults, readiness word, leaves ─────────────────────────────────────────────────────────

test("channel defaults come from the source companies read", () => {
  const defaults = channelDefaultsOf([
    {
      id: "c1",
      _id: "c1",
      company_slug: "c",
      name: "C",
      owner_label: "C",
      aliases: [],
      active: true,
      default_form_granularity: "f-form",
      default_call_granularity: "f-call",
      sheet_config: { has_bad_tabs: false, projection_mode: "derived_import" },
      created_from: "admin",
    },
  ]);
  assert.equal(isChannelDefault(defaults, "c1", { id: "f-form", channel: "form" }), true);
  assert.equal(isChannelDefault(defaults, "c1", { id: "f-call", channel: "call" }), true);
  assert.equal(isChannelDefault(defaults, "c1", { id: "f-form", channel: "call" }), false);
  assert.equal(isChannelDefault(defaults, "other", { id: "f-form", channel: "form" }), false);
});

test("the readiness word is all live, N not live, or lead cost missing", () => {
  const feeds = ORS3_LEAD_SOURCE_DETAIL.feeds.items;
  assert.equal(sourceReadiness([]).word, "no feeds yet");
  assert.deepEqual(sourceReadiness(feeds), { word: "3 not live · lead cost missing", tone: "amber" });
  const live = feeds.map((feed) => ({ ...feed, readiness: { ...feed.readiness, lead_cost: "ready" as const, live: true } }));
  assert.deepEqual(sourceReadiness(live), { word: "all live", tone: "green" });
  const oneOff = live.map((feed, index) => (index === 0 ? { ...feed, readiness: { ...feed.readiness, live: false } } : feed));
  assert.deepEqual(sourceReadiness(oneOff), { word: "1 not live", tone: "amber" });
});

test("the lead cost leaf is the amount in force with its start day, or the readiness word", () => {
  const periods: CplSchedulePeriod[] = [
    { source_granularity_id: "f", amount_cents: 18000, effective_from: "", effective_from_date: "2026-01-01", effective_until_date_exclusive: "2026-07-30", business_timezone: "America/New_York" },
    { source_granularity_id: "f", amount_cents: 20500, effective_from: "", effective_from_date: "2026-07-30", business_timezone: "America/New_York" },
    { source_granularity_id: "f", amount_cents: 22000, effective_from: "", effective_from_date: "2026-11-01", business_timezone: "America/New_York" },
  ];
  assert.equal(currentPeriod(periods, "2026-10-06")?.amount_cents, 20500);
  assert.equal(currentPeriod(periods, "2026-12-01")?.amount_cents, 22000);
  assert.equal(currentPeriod(periods, "2025-01-01"), undefined);
  assert.deepEqual(costLeaf("ready", periods, "2026-10-06"), { state: "ready", amount_cents: 20500, since: "2026-07-30" });
  assert.deepEqual(costLeaf("ready", undefined, "2026-10-06"), { state: "ready" });
  assert.deepEqual(costLeaf("missing", periods, "2026-10-06"), { state: "missing" });
  assert.deepEqual(costLeaf("invalid", periods, "2026-10-06"), { state: "invalid" });
});

test("a number leaf says verified / not checked / invalid and filing / stopped / not filing", () => {
  const item = { id: "route-1", phone_number: "+19545550142", nickname: "Queue" };
  const assignment = {
    id: "a",
    route_id: "route-1",
    source_company_id: "c",
    source_granularity_id: "f",
    lead_source_name: "Best Relocation",
    feed_display_name: "Inbound calls",
    effective_from: "2026-08-01T00:00:00.000Z",
    active: true,
  };
  assert.equal(numberLeaf(item, undefined, NOW).verification, null);
  assert.equal(numberLeaf(item, routeBase, NOW).verificationWord, "RingCentral not checked");
  const filing = { ...routeBase, active: true, validation_status: "valid" as const, current_assignment: assignment, last_seen_in_call_log_at: "2026-10-06T11:30:00.000Z" };
  const leaf = numberLeaf(item, filing, NOW);
  assert.equal(leaf.phone, "(954) 555-0142");
  assert.equal(leaf.verificationWord, "RingCentral verified");
  assert.equal(leaf.filingWord, "Filing calls");
  assert.equal(leaf.lastSeen, "30 minutes ago");
  assert.equal(filingOf({ ...filing, validation_status: "invalid" }, NOW), "stopped");
  assert.equal(numberLeaf(item, { ...filing, validation_status: "invalid" }, NOW).verificationWord, "RingCentral says invalid");
});

test("the quiet line carries the sheet tab, accepted spellings and what Vantage sends to Granot", () => {
  const feed = ORS3_LEAD_SOURCE_DETAIL.feeds.items[0]!;
  assert.deepEqual(quietLineParts(feed, { sheet_tab_name: "Best Relocation" }), [
    "Sheet tab: Best Relocation",
    "Sheet names accepted: Best Relocation Locals",
    "What Vantage sends to Granot: Best Relocation Locals",
  ]);
  assert.deepEqual(quietLineParts(ORS3_LEAD_SOURCE_DETAIL.feeds.items[2]!), ["What Vantage sends to Granot: Best Relocation Inbounds"]);
});

test("a Granot name lands nowhere only when our lead source has no feed to land in", () => {
  assert.equal(landsNowhere(granotBase), true);
  assert.equal(landsNowhere({ ...granotBase, lifecycle_disposition: "referral_booking" }), false);
  assert.equal(landsNowhere({ ...granotBase, lifecycle_disposition: "deferred" }), false);
  const landed = { route_key: "form_any", lead_model: "FormLead" as const, move_type: "any" as const, source_granularity_id: "f" };
  assert.equal(landsNowhere({ ...granotBase, lifecycle_routes: [landed] }), false);
  assert.equal(landsNowhere({ ...granotBase, lifecycle_routes: [{ ...landed, source_granularity_status: "missing" }] }), true);
});

test("the flat lists put lands-nowhere and not-filing first", () => {
  const landed = { route_key: "form_any", lead_model: "FormLead" as const, move_type: "any" as const, source_granularity_id: "f" };
  const rows = granotRows([{ ...granotBase, id: "a", granot_label: "Alpha", lifecycle_routes: [landed] }, { ...granotBase, id: "z", granot_label: "Zulu" }], [], []);
  assert.deepEqual(rows.map((row) => row.name), ["Zulu", "Alpha"]);

  const filing: RingCentralRoute = {
    ...routeBase,
    id: "filing",
    phone_number: "+19545550100",
    active: true,
    validation_status: "valid",
    current_assignment: {
      id: "a",
      route_id: "filing",
      source_company_id: "c",
      source_granularity_id: "f",
      lead_source_name: "Best Relocation",
      feed_display_name: "Inbound calls",
      effective_from: "2026-08-01T00:00:00.000Z",
      active: true,
    },
  };
  const stopped: RingCentralRoute = { ...filing, id: "stopped", phone_number: "+19545550200", validation_status: "invalid" };
  const ready: RingCentralRoute = { ...routeBase, id: "ready", phone_number: "+19545550300", validation_status: "valid", current_assignment: undefined };
  const draft: RingCentralRoute = { ...routeBase, id: "draft", phone_number: "+19545550400" };
  const ordered = numberRows([filing, draft, ready, stopped], [], [], NOW).map((row) => row.routeId);
  assert.deepEqual(ordered, ["stopped", "ready", "draft", "filing"]);
});
