import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WaitingNotice } from "../components/automations/granot-updates/start-page";
import { HistoryCard } from "../components/automations/granot-updates/start-history";
import { groupGranotNames, NewCheckCard } from "../components/automations/granot-updates/start-new-check";
import { RangePicker } from "../components/automations/granot-updates/start-range-picker";
import { normalizeGranotRun, type GranotAutomationSource, type GranotRun } from "../lib/api/granotAutomation";
import type { GranotCrmSourceItem } from "../lib/api/registryGranotCrmSources";
import { findOwnerMarkupLeaks } from "../lib/operations-registry/ownerLanguageDeck";

const TODAY = "2026-10-05";
const NOW = Date.parse("2026-10-05T14:14:00.000Z");
const CHECKSUM = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2";

/** Plan schema v2 payloads the way the owner detail sends them, trimmed to what the start page reads. */
const formPayload = {
  id: "aaaaaaaaaaaaaaaaaaaaaaa1",
  run_group_id: "group-1",
  operation: "form_leads",
  workflow: "apply",
  status: "awaiting_approval",
  plan_checksum: CHECKSUM,
  expires_at: "2026-10-06T13:14:00.000Z",
  counters: { update: 2, conflict: 1, no_match: 1, unchanged: 1 },
  collection: {
    requestedDateWindow: { from: "10/03/2026", to: "10/05/2026" },
    discoveredSourceLabels: ["TBM Forms", "Top10 Forms"],
    notObservedSourceLabels: [],
    sources: [],
  },
  receipt_count: 0,
  created_at: "2026-10-05T13:12:00.000Z",
};

const callPayload = {
  id: "aaaaaaaaaaaaaaaaaaaaaaa2",
  run_group_id: "group-1",
  operation: "call_leads",
  workflow: "apply",
  status: "awaiting_approval",
  plan_checksum: "b".repeat(64),
  expires_at: "2026-10-06T13:20:00.000Z",
  counters: { updateable: 1, conflict: 0, no_match: 1, unchanged: 0 },
  collection: {
    requestedDateWindow: { from: "10/03/2026", to: "10/05/2026" },
    discoveredSourceLabels: ["TBM Inbounds"],
    notObservedSourceLabels: [],
    sources: [],
  },
  receipt_count: 0,
  created_at: "2026-10-05T13:12:05.000Z",
};

const waitingRuns: GranotRun[] = [normalizeGranotRun(formPayload), normalizeGranotRun(callPayload)];

const appliedRun = normalizeGranotRun({
  id: "bbbbbbbbbbbbbbbbbbbbbbb1",
  run_group_id: "group-0",
  operation: "form_leads",
  workflow: "apply",
  status: "completed",
  collection: { requestedDateWindow: { from: "10/01/2026", to: "10/03/2026" }, discoveredSourceLabels: ["Top10 Forms"], notObservedSourceLabels: [], sources: [] },
  receipt_count: 21,
  created_at: "2026-10-03T12:40:00.000Z",
});

function source(id: string, label: string, status: "ready" | "missing_reference", crmId?: string): GranotAutomationSource {
  return {
    id,
    label,
    active: true,
    created_from: "seed",
    supported_operations: ["form_leads", "call_leads"],
    compatibility: { available_for_apply: status === "ready", status, issues: [], granot_crm_source_id: crmId },
  };
}

const sources = [
  source("s-top10", "Top10 Forms", "ready", "crm-top10"),
  source("s-tbm", "TBM Forms", "ready", "crm-tbm"),
  source("s-best", "Best Relocation Forms", "ready", "crm-best"),
  source("s-new", "New Feed X", "missing_reference", "crm-top10"),
];

function nameRow(id: string, label: string, company: string, automation: GranotAutomationSource[]): GranotCrmSourceItem {
  return {
    id,
    granot_label: label,
    enabled: true,
    lifecycle_enabled: true,
    lifecycle_disposition: "observation_only",
    lead_created_policy: "link_only",
    lead_source_company_label: company,
    lifecycle_routes: [],
    lifecycle_policy_version: "v1",
    default_channel: "form",
    automation_sources: automation.map((item) => ({ id: item.id, label: item.label, active: true, compatibility: item.compatibility! })),
  } as unknown as GranotCrmSourceItem;
}

const names = [
  nameRow("crm-top10", "Top10 Forms", "Top10", [sources[0]!]),
  nameRow("crm-tbm", "TBM Forms", "Top10", [sources[1]!]),
  nameRow("crm-best", "Best Relocation Forms", "Best Relocation", [sources[2]!]),
];

const ready = <T,>(data: T) => ({ data, isLoading: false, error: null });

function renderCard(overrides: Record<string, unknown> = {}) {
  return renderToStaticMarkup(
    createElement(NewCheckCard, {
      sources: ready(sources),
      names: ready(names),
      runs: [appliedRun],
      todayKey: TODAY,
      nowMs: NOW,
      submitting: false,
      error: null,
      onStart: () => undefined,
      ...overrides,
    }),
  );
}

test("NewCheckCard shows both lead types on, grouped Granot names and the sentence", () => {
  const markup = renderCard();
  assert.equal((markup.match(/type="checkbox"[^>]*checked=""|checked=""[^>]*type="checkbox"/g) ?? []).length, 2);
  assert.match(markup, /Form leads/);
  assert.match(markup, /Call leads/);
  assert.match(markup, />Top10</);
  assert.match(markup, />Best Relocation</);
  // The Best Relocation label starts unticked; the others are ticked.
  assert.match(markup, /aria-pressed="false"[^>]*>Best Relocation Forms</);
  assert.match(markup, /aria-pressed="true"[^>]*>Top10 Forms</);
  assert.match(markup, /Check 2 Granot names for jobs opened Oct 3 – Oct 5 and prepare updates for form \+ call leads/);
  assert.match(markup, />Check Granot</);
  assert.match(markup, /Since last check · Oct 3 – Oct 5/);
  assert.deepEqual(findOwnerMarkupLeaks(markup), []);
});

test("NewCheckCard greys a not-ready name and links to Setup", () => {
  const markup = renderCard();
  assert.match(markup, /<button[^>]*disabled=""[^>]*>New Feed X</);
  assert.match(markup, /has no Granot name in Setup yet/);
  assert.match(markup, /href="\/setup\/lead-sources\?view=granot&amp;granot=crm-top10"/);
  assert.match(markup, /Fix in Setup ›/);
  assert.match(markup, /1 not ready/);
});

test("NewCheckCard falls back to Last 7 days and disables Since last check without an applied check", () => {
  const markup = renderCard({ runs: [] });
  assert.match(markup, /disabled=""[^>]*title="No applied check yet"[^>]*>Since last check</);
  assert.match(markup, /Check 2 Granot names for jobs opened Sep 29 – Oct 5/);
});

test("NewCheckCard disables the button and says why when nothing can be checked", () => {
  const loading = renderCard({ sources: { data: undefined, isLoading: true, error: null } });
  assert.match(loading, /Reading the Granot names…/);
  const failed = renderCard({ sources: { data: undefined, isLoading: false, error: new Error("boom") } });
  assert.match(failed, /The Granot names could not load\./);
  const none = renderCard({ sources: ready([]) });
  assert.match(none, /No Granot names are set up yet/);
  assert.match(none, /granot=new/);
  const failedStart = renderCard({ error: new Error("nope") });
  assert.match(failedStart, /The check could not start\./);
  const submitting = renderCard({ submitting: true });
  assert.match(submitting, /disabled=""[^>]*>Checking…</);
  assert.deepEqual(findOwnerMarkupLeaks(failed), []);
});

test("groupGranotNames joins by automation source id or Registry id and puts the rest under Other", () => {
  const stray = source("s-stray", "Stray", "ready", "crm-best");
  const orphan = source("s-orphan", "Orphan", "ready");
  const groups = groupGranotNames([...sources, stray, orphan], names);
  assert.deepEqual(
    groups.map((group) => [group.label, group.sources.map((entry) => entry.label)]),
    [
      ["Best Relocation", ["Best Relocation Forms", "Stray"]],
      ["Top10", ["New Feed X", "TBM Forms", "Top10 Forms"]],
      ["Other", ["Orphan"]],
    ],
  );
});

test("WaitingNotice names the newest waiting check with its Review link", () => {
  const markup = renderToStaticMarkup(createElement(WaitingNotice, { runs: waitingRuns, todayKey: TODAY, nowMs: NOW }));
  assert.match(markup, /Waiting for you/);
  assert.match(markup, /Oct 3 – Oct 5/);
  assert.match(markup, /3 updates ready/);
  assert.match(markup, /expires in 23 h/);
  assert.match(markup, /href="\/automations\/granot-updates\/group-1"/);
  assert.match(markup, /crm-button crm-button--primary crm-button--sm/);
  assert.deepEqual(findOwnerMarkupLeaks(markup), []);
  const none = renderToStaticMarkup(createElement(WaitingNotice, { runs: [appliedRun], todayKey: TODAY, nowMs: NOW }));
  assert.equal(none, "");
  const more = renderToStaticMarkup(
    createElement(WaitingNotice, { runs: [...waitingRuns, normalizeGranotRun({ ...formPayload, id: "cccccccccccccccccccccccc", run_group_id: "group-2", created_at: "2026-10-05T10:00:00.000Z" })], todayKey: TODAY, nowMs: NOW }),
  );
  assert.match(more, /1 more check is waiting/);
});

function historyMarkup(runs: GranotRun[], overrides: Record<string, unknown> = {}) {
  return renderToStaticMarkup(
    createElement(HistoryCard, { runs, filter: "all", onFilter: () => undefined, page: 1, onLoadMore: () => undefined, todayKey: TODAY, loading: false, error: null, ...overrides }),
  );
}

test("HistoryCard renders one row per check with words, a View link and no ids", () => {
  const markup = historyMarkup([...waitingRuns, appliedRun]);
  assert.equal((markup.match(/View ›/g) ?? []).length, 2);
  assert.match(markup, /Waiting for approval · 3 updates ready/);
  assert.match(markup, /Applied 21 updates/);
  assert.match(markup, /href="\/automations\/granot-updates\/group-1"/);
  assert.match(markup, /form \+ call/);
  assert.match(markup, /crm-pill--amber/);
  assert.match(markup, /crm-pill--green/);
  assert.equal(markup.includes("a1b2c3d4"), false);
  assert.equal(/[a-f0-9]{24}/i.test(markup.replace(/<[^>]+>/g, " ")), false);
  assert.deepEqual(findOwnerMarkupLeaks(markup), []);
  assert.match(markup, />All</);
  assert.match(markup, />Waiting</);
});

test("HistoryCard filters, says when empty, and pages beyond 25 rows", () => {
  assert.match(historyMarkup([appliedRun], { filter: "waiting" }), /No checks match this filter\./);
  assert.match(historyMarkup([]), /No checks yet\. Start one above\./);
  assert.match(historyMarkup([], { error: new Error("x"), runs: undefined }), /The history could not load\./);
  const many = Array.from({ length: 30 }, (_, index) =>
    normalizeGranotRun({ ...formPayload, id: `${String(index).padStart(24, "d")}`, run_group_id: `group-${index}`, created_at: `2026-09-${String((index % 28) + 1).padStart(2, "0")}T12:00:00.000Z` }),
  );
  const first = historyMarkup(many);
  assert.equal((first.match(/View ›/g) ?? []).length, 25);
  assert.match(first, /Load more/);
  const second = historyMarkup(many, { page: 2 });
  assert.equal((second.match(/View ›/g) ?? []).length, 30);
  assert.equal(second.includes("Load more"), false);
  assert.equal(historyMarkup([appliedRun]).includes("Load more"), false);
});

test("RangePicker renders two months and marks the first and last day", () => {
  const markup = renderToStaticMarkup(createElement(RangePicker, { from: "2026-10-03", to: "2026-10-05", todayKey: TODAY, onChange: () => undefined }));
  assert.match(markup, /October 2026/);
  assert.match(markup, /November 2026/);
  assert.match(markup, /aria-label="Previous month"/);
  assert.match(markup, /aria-label="Next month"/);
  assert.match(markup, /aria-label="Oct 3, 2026, first day"[^>]*>|data-edge="from"[^>]*aria-label="Oct 3, 2026, first day"/);
  assert.match(markup, /data-edge="from"/);
  assert.match(markup, /data-edge="to"/);
  assert.match(markup, /data-edge="in"/);
  assert.match(markup, /aria-label="Oct 5, 2026, today, last day"/);
  assert.equal((markup.match(/data-edge="in"/g) ?? []).length, 1);
});
