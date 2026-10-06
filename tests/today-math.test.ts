import assert from "node:assert/strict";
import test from "node:test";
import type { OverviewReportResponse } from "../lib/api/admin";
import type { DailyOperationsSnapshot } from "../lib/api/dailyOperations";
import { emptySnapshot } from "./today-fixtures";
import type { DailyOperationsEventItem } from "../lib/api/dailyOperationsLive";
import type { MoneySpendRepRow, MoneySpendSourceRow } from "../lib/api/money";
import { fallbackTable, perUnit, rateText, repCostCells, sourceTotals } from "../components/today/money-math";
import {
  exceptionKindsInWords,
  exceptionsTotal,
  highlightEvents,
  isCelebration,
  openIntakePreviewFilters,
  resyncAge,
  tileTrend,
} from "../components/today/pulse-math";
import { OVERVIEW_INTAKE_PREVIEW_LIMIT } from "../components/today/today-copy";

function event(id: string, minute: number, kind = "form_lead.created", lane = "lead"): DailyOperationsEventItem {
  return {
    event_id: id,
    day: "2026-10-05",
    occurred_at: `2026-10-05T14:${String(minute).padStart(2, "0")}:00.000Z`,
    lane,
    kind,
    title: id,
    source_company: null,
    ingestion_origin: null,
    lead_kind: null,
    job_no: null,
    entity_type: null,
    entity_id: null,
    parent_receipt_id: null,
    links: {},
    card: {},
    metric_touches: [],
  } as DailyOperationsEventItem;
}

test("exceptions: the sum and the non-zero kinds in words, in a fixed order", () => {
  assert.equal(exceptionsTotal(emptySnapshot), 0);
  assert.equal(exceptionKindsInWords(emptySnapshot), "");
  const snapshot: DailyOperationsSnapshot = {
    ...emptySnapshot,
    metrics: { ...emptySnapshot.metrics, exceptions: { zip_missing: 1, crm_failed: 1, dead_letter: 0, adoption_conflict: 2 } },
  };
  assert.equal(exceptionsTotal(snapshot), 4);
  assert.equal(exceptionKindsInWords(snapshot), "zip missing, CRM failed, adoption conflict");
});

test("tileTrend: vs yesterday by now; no baseline is no chip", () => {
  assert.equal(tileTrend({ today: 5, yesterday: null, yesterday_by_now: null }), null);
  const up = tileTrend({ today: 42, yesterday: 38, yesterday_by_now: 30 });
  assert.equal(up?.tone, "up");
  assert.equal(up?.label, "+40%");
  assert.match(up?.title ?? "", /\+12/);
  const down = tileTrend({ today: 2, yesterday: 4, yesterday_by_now: 4 });
  assert.equal(down?.tone, "down");
  assert.equal(down?.label, "−50%");
  assert.equal(tileTrend({ today: 3, yesterday: 3, yesterday_by_now: 3 })?.tone, "even");
  assert.equal(tileTrend(undefined), null);
});

test("highlightEvents: tier A only, the newest 8 first, quiet priorities and rows left out", () => {
  const events = Array.from({ length: 12 }, (_, index) => event(`e${index}`, index, "booking.created", "booking"));
  events.push(event("quiet", 59, "granot.priority_updated", "granot"));
  events.push(event("row", 58, "form_lead.created", "lead"));
  events.push(event("counted", 57, "form_lead.duplicate", "lead"));
  const picked = highlightEvents(events);
  assert.equal(picked.length, 8);
  assert.deepEqual(picked.map((item) => item.event_id), ["e11", "e10", "e9", "e8", "e7", "e6", "e5", "e4"]);
  assert.equal(highlightEvents([]).length, 0);
  assert.equal(isCelebration({ kind: "booking.created" }), true);
  assert.equal(isCelebration({ kind: "outreach.rep_goal_met" }), true);
  assert.equal(isCelebration({ kind: "form_lead.created" }), false);
});

test("highlightEvents: a milestone inside its 30 minute pin goes first; later it takes its place in time", () => {
  const goal = event("goal", 0, "outreach.rep_goal_met", "outreach");
  const events = [goal, event("b1", 20, "booking.created", "booking"), event("x1", 25, "exception.crm_failed", "exception"), event("lead", 26)];
  const goalAt = Date.parse(goal.occurred_at);
  assert.deepEqual(highlightEvents(events, 8, goalAt + 26 * 60_000).map((item) => item.event_id), ["goal", "x1", "b1"]);
  assert.deepEqual(highlightEvents(events, 8, goalAt + 31 * 60_000).map((item) => item.event_id), ["x1", "b1", "goal"]);
  assert.deepEqual(highlightEvents(events).map((item) => item.event_id), ["x1", "b1", "goal"], "no clock, no pin");
  assert.deepEqual(highlightEvents(events, 2, goalAt + 26 * 60_000).map((item) => item.event_id), ["goal", "x1"]);
});

test("resyncAge: just now, minutes, hours; unknown clock is null", () => {
  const now = 1_000_000_000_000;
  assert.equal(resyncAge(now - 20_000, now), "just now");
  assert.equal(resyncAge(now - 120_000, now), "2 min ago");
  assert.equal(resyncAge(now - 2 * 3_600_000, now), "2 h ago");
  assert.equal(resyncAge(undefined, now), null);
  assert.equal(resyncAge(now, undefined), null);
});

test("open intake preview uses the Intakes list contract with a short page", () => {
  assert.deepEqual(openIntakePreviewFilters("booking"), {
    kind: "booking",
    state: "open",
    sort: "last_evidence_at",
    order: "desc",
    limit: OVERVIEW_INTAKE_PREVIEW_LIMIT,
  });
  assert.equal(OVERVIEW_INTAKE_PREVIEW_LIMIT, 3);
});

const overview = {
  generated_at: "2026-10-05T12:00:00.000Z",
  all_time: {
    totals: {},
    lead_cost: {
      total: 50_000,
      by_source_company: [{ source_company: "top10", source_company_label: "Top10 Forms", lead_count: 100, total_lead_cost: 20_000, unresolved_cpl_count: 2 }],
    },
    top_agents: [],
  },
  last_7_days: {
    period: { from: "a", to: "b" },
    totals: {},
    by_source_company: [],
    lead_cost: {
      total: 1_840,
      by_source_company: [
        { source_company: "top10", source_company_label: "Top10 Forms", lead_count: 9, total_lead_cost: 1_845, unresolved_cpl_count: 0 },
        { source_company: "tbm", source_company_label: "TBM Forms", lead_count: 3, total_lead_cost: 0, unresolved_cpl_count: 3 },
      ],
    },
    top_agents: [],
  },
} as unknown as OverviewReportResponse;

test("fallbackTable: rows from lead_cost, totals use lead_cost.total, unpriced is summed", () => {
  const week = fallbackTable(overview, "last_7_days");
  assert.equal(week?.rows.length, 2);
  assert.deepEqual(week?.rows[1], { key: "tbm", label: "TBM Forms", leads: 3, spend: 0, unpriced: 3 });
  assert.deepEqual(week?.total, { leads: 12, spend: 1_840, unpriced: 3 });
  const all = fallbackTable(overview, "all_time");
  assert.deepEqual(all?.total, { leads: 100, spend: 50_000, unpriced: 2 });
  assert.equal(fallbackTable(undefined, "all_time"), null);
  assert.equal(fallbackTable({ ...overview, last_7_days: null }, "last_7_days"), null);
});

test("money math: per-unit never divides by zero; totals sum the source rows", () => {
  assert.equal(perUnit(100, 0), null);
  assert.equal(perUnit(null, 4), null);
  assert.equal(perUnit(100, 4), 25);
  const rows: MoneySpendSourceRow[] = [
    { source_company: "a", source_company_label: "A", leads: 14, duplicates: 2, rate_label: "$205.00", spend: 2_870, booked: 1, cost_per_booked: 2_870, unpriced: 0 },
    { source_company: "b", source_company_label: "B", leads: 3, duplicates: 0, rate_label: null, spend: 0, booked: 0, cost_per_booked: null, unpriced: 3 },
  ];
  assert.deepEqual(sourceTotals(rows), { leads: 17, duplicates: 2, spend: 2_870, booked: 1, unpriced: 3, costPerBooked: 2_870 });
  assert.equal(rateText(rows[0], "missing"), "$205.00");
  assert.equal(rateText(rows[1], "missing"), "missing");
  assert.equal(rateText({ rate_label: null, unpriced: 0 }, "missing"), "—");
});

test("rep cost cells: missing compensation is missing, never $0", () => {
  const base: MoneySpendRepRow = { agent_id: "1", agent_name: "Alex", leads_received: 12, calls: 64, booked: 1, rep_cost: 240, cost_per_lead: null, cost_per_booked: null, compensation_missing: false };
  assert.deepEqual(repCostCells(base), { cost: 240, perLead: 20, perBooked: 240, missing: false });
  assert.deepEqual(repCostCells({ ...base, compensation_missing: true, rep_cost: null }), { cost: null, perLead: null, perBooked: null, missing: true });
  assert.equal(repCostCells({ ...base, booked: 0 }).perBooked, null);
});
