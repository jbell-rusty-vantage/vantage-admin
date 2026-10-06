import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AUTOMATIONS_COPY } from "../components/automations/automations-copy";
import { AutomationsHubView } from "../components/automations/automations-hub";
import { GRANOT_UPDATES_COPY } from "../components/automations/granot-updates/granot-updates-copy";
import { normalizeGranotRun } from "../lib/api/granotAutomation";
import { findOwnerMarkupLeaks } from "../lib/operations-registry/ownerLanguageDeck";

const NOW = Date.parse("2026-10-05T14:14:00.000Z");

const waitingRun = normalizeGranotRun({
  id: "aaaaaaaaaaaaaaaaaaaaaaa1",
  run_group_id: "group-1",
  operation: "form_leads",
  workflow: "apply",
  status: "awaiting_approval",
  plan_checksum: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
  expires_at: "2026-10-06T13:14:00.000Z",
  counters: { update: 23, conflict: 3, no_match: 12, unchanged: 81 },
  collection: { requestedDateWindow: { from: "10/03/2026", to: "10/05/2026" }, discoveredSourceLabels: ["TBM Forms"], notObservedSourceLabels: [], sources: [] },
  receipt_count: 0,
  created_at: "2026-10-05T13:12:00.000Z",
});

const appliedRun = normalizeGranotRun({
  id: "aaaaaaaaaaaaaaaaaaaaaaa2",
  run_group_id: "group-0",
  operation: "form_leads",
  workflow: "apply",
  status: "completed",
  receipt_count: 21,
  created_at: "2026-10-04T13:12:00.000Z",
});

test("the Automations hub lists Granot updates with its health line and the Waiting notice (doc 17)", () => {
  const markup = renderToStaticMarkup(createElement(AutomationsHubView, { runs: [waitingRun, appliedRun], failed: false, nowMs: NOW }));
  assert.match(markup, /Automations/);
  assert.match(markup, /data-testid="automation-granot-updates"/);
  assert.match(markup, /href="\/automations\/granot-updates"/);
  assert.match(markup, /Granot updates/);
  assert.match(markup, /waiting for your approval/);
  assert.match(markup, /data-testid="automations-waiting"/);
  assert.match(markup, /Oct 3 – Oct 5 · 23 updates ready · expires in 23 h/);
  assert.match(markup, /href="\/automations\/granot-updates\/group-1"[^>]*>Review/);
  assert.doesNotMatch(markup, /aaaaaaaaaaaaaaaaaaaaaaa1|a1b2c3d4e5f6/);
  assert.deepEqual(findOwnerMarkupLeaks(markup), []);

  const quiet = renderToStaticMarkup(createElement(AutomationsHubView, { runs: [appliedRun], failed: false, nowMs: NOW }));
  assert.doesNotMatch(quiet, /automations-waiting/);
  assert.match(quiet, /Last check .* · applied 21/);
  const empty = renderToStaticMarkup(createElement(AutomationsHubView, { runs: [], failed: false, nowMs: NOW }));
  assert.match(empty, /No check yet/);
  const failed = renderToStaticMarkup(createElement(AutomationsHubView, { runs: null, failed: true, nowMs: NOW }));
  assert.match(failed, /The checks could not load\./);
});

test("Automations and Granot updates copy stay in Owner words with no em-dashes", () => {
  const c = GRANOT_UPDATES_COPY;
  const strings = [
    AUTOMATIONS_COPY.purpose,
    AUTOMATIONS_COPY.help.body,
    AUTOMATIONS_COPY.granotUpdates.purpose,
    c.purpose,
    c.howItWorks.whatItDoes.body,
    c.howItWorks.whatItNeverDoes.body,
    c.howItWorks.whenToRun.body,
    c.howItWorks.whatToSkip.body,
    c.leadTypes.form.fills,
    c.leadTypes.call.fills,
    c.sources.label,
    c.sources.none,
    c.sources.needOne,
    c.jobs.large,
    c.sentence(9, "opened", "Oct 3 – Oct 5", "form + call"),
    c.progress.leave,
    c.review.expired,
    c.review.fallbackWarning,
    c.review.missingReason,
    c.review.dialog.plan("a1b2c3d4", "9:14 AM"),
    c.review.applyDisabled,
    c.results.notSelectedHint,
    c.notFound,
  ].join(" ");
  assert.deepEqual(findOwnerMarkupLeaks(strings), []);
  assert.doesNotMatch(strings, /—/);
  assert.doesNotMatch(strings, /Granot sync|ingestion|durable plan|run group|checksum/i);
});
