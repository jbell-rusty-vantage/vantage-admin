import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { activityOverviewSchema, outcomesOverviewSchema, teamOverviewSchema } from "../../lib/api/salesIntelligenceOverview";
import { CaptureWarning, PhaseCOverviewView } from "../../components/sales-intelligence/overview/phase-c-overview";
import { workloadHref } from "../../components/sales-intelligence/overview/links";
import { customRangeError, PeriodControl } from "../../components/sales-intelligence/overview/period-control";
import { ACTIVITY_C, ACTIVITY_MISSING_C, OUTCOMES_C, TEAM_C, TEAM_PENDING_C } from "../../app/(dashboard)/sales-intelligence/dev/gallery/sections/overview-fixtures-c";

const visible = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const render = (team = TEAM_C, activity = ACTIVITY_C) => renderToStaticMarkup(createElement(PhaseCOverviewView, { team, activity, outcomes: OUTCOMES_C }));

test("Phase C response shapes retain every drill and nullable capture count", () => {
  assert.equal(teamOverviewSchema.parse({ ok: true, as_of: TEAM_C.as_of, data: TEAM_C }).data.rows.length, 4);
  assert.equal(activityOverviewSchema.parse({ ok: true, as_of: TEAM_C.as_of, data: ACTIVITY_MISSING_C }).data.totals?.human_conversations, null);
  assert.equal(outcomesOverviewSchema.parse({ ok: true, as_of: TEAM_C.as_of, data: OUTCOMES_C }).data.booked_in_granot, 2);
});

test("every workload count uses the server drill parameters and snapshot id", () => {
  const metric = TEAM_C.rows[0]!.records_with_overdue;
  const href = workloadHref(metric);
  const params = new URL(href, "https://local.example").searchParams;
  assert.equal(params.get("snapshot_id"), TEAM_C.snapshot_id);
  assert.deepEqual(params.getAll("assigned_agent_id"), ["alex"]);
  assert.deepEqual(params.getAll("work"), ["overdue_followup"]);
  assert.equal(params.get("view"), "all_outreach");
});

test("team workload shows zero-work and inactive reps, action multiplicity, and Unassigned last", () => {
  const html = render();
  const words = visible(html);
  assert.ok(words.includes("Taylor M."));
  assert.ok(words.includes("No assigned Outreach"));
  assert.ok(words.includes("Riley C."));
  assert.ok(words.includes("inactive, has work"));
  assert.ok(words.includes("4 on 3 records"));
  assert.ok(html.indexOf("Unassigned</th>") > html.indexOf("Taylor M."));
  assert.ok(!words.includes("conversion rate") && !words.includes("booking rate"));
});

test("pending team and missing capture never print zero as a substitute", () => {
  const words = visible(render(TEAM_PENDING_C, ACTIVITY_MISSING_C));
  assert.ok(words.includes("Not captured"));
  assert.ok(words.includes("No team data yet"));
  assert.ok(words.includes("Preparing Outreach"));
  assert.ok(!words.includes("0 records with overdue follow-ups"));
});

test("activity and outcomes preserve independent units and Granot disclosure", () => {
  const words = visible(render());
  assert.ok(words.includes("Conversations 7"));
  assert.ok(words.includes("Outbound attempts 18"));
  assert.ok(words.includes("Leads received 24"));
  assert.ok(words.includes("Booked in Granot"));
  assert.ok(words.includes("0 conversations not matched to a rep · 2 outbound attempts not matched to a rep"));
});

test("inbound-only unmapped conversations remain visible when outbound attempts are zero", () => {
  const words = visible(render(TEAM_C, { ...ACTIVITY_C, unmapped: { human_conversations: 3, outbound_attempts: 0 } }));
  assert.ok(words.includes("3 conversations not matched to a rep · 0 outbound attempts not matched to a rep"));
  assert.ok(words.includes("Review identity"));
});

test("custom periods require real ordered calendar dates spanning at most 92 inclusive days", () => {
  assert.ok(customRangeError("", "2026-04-01"));
  assert.ok(customRangeError("2026-02-30", "2026-03-01"));
  assert.ok(customRangeError("2026-04-02", "2026-04-01"));
  assert.equal(customRangeError("2026-01-01", "2026-04-02"), null);
  assert.ok(customRangeError("2026-01-01", "2026-04-03"));
  const html = renderToStaticMarkup(createElement(PeriodControl, { label: "Period", value: { key: "custom", from: "2026-01-01", through: "2026-04-03" }, onChange: () => assert.fail("invalid range applied") }));
  assert.ok(html.includes("disabled"));
  assert.ok(visible(html).includes("Choose no more than 92 days"));
});

test("an existing capture-health problem warns above Attention, without a rep Coverage link", () => {
  const owner = renderToStaticMarkup(createElement(CaptureWarning, { status: "attention" }));
  assert.ok(owner.includes('role="alert"') && owner.includes("view=coverage"));
  assert.equal(renderToStaticMarkup(createElement(CaptureWarning, { status: "ok" })), "");
  assert.equal(renderToStaticMarkup(createElement(CaptureWarning, { status: "broken", rep: true })), "");
});
