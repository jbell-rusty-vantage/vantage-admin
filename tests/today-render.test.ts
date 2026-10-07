import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MoneyFallback, MoneyLive } from "../components/today/money-tab";
import { PulseView, type PulseViewProps } from "../components/today/pulse-view";
import { TeamSummaryView } from "../components/today/team-tab";
import { TodayChrome, todaySubtitle } from "../components/today/today-page";
import type { OverviewReportResponse } from "../lib/api/admin";
import type { DailyOperationsSnapshot } from "../lib/api/dailyOperations";
import type { DailyOperationsEventItem } from "../lib/api/dailyOperationsLive";
import type { GranotLifecycleCaseListItem } from "../lib/api/granotLifecycle";
import type { GranotCheck } from "../lib/automations/granot-updates-model";
import type { MoneySpendResponse } from "../lib/api/money";
import type { SalesOutreachTeamDto } from "../lib/api/salesOutreach";
import { emptySnapshot } from "./today-fixtures";

const NOW = Date.parse("2026-10-05T18:41:00.000Z");

const snapshot: DailyOperationsSnapshot = {
  ...emptySnapshot,
  metrics: {
    ...emptySnapshot.metrics,
    leads: { today: 41, yesterday: 50, yesterday_by_now: 36, form: 29, call: 12, duplicate_form: 0, duplicate_call: 0 },
    bookings: { today: 4, yesterday: 3, yesterday_by_now: 2 },
    cancellations: { today: 0, yesterday: 1, yesterday_by_now: 0 },
    texts: { ...emptySnapshot.metrics.texts, today: 38, held_now: 2 },
    intakes: { opened_today: 3, still_open: 3 },
    exceptions: { zip_missing: 1, crm_failed: 1, dead_letter: 0, adoption_conflict: 0 },
  },
  companies: [{ source_company: "top10", form: 14, call: 0, total: 14, yesterday_total: 11 }],
};

const intake: GranotLifecycleCaseListItem = {
  case_id: "case-1",
  kind: "booking",
  state: "open",
  mode: "create_missing_booking",
  sequence_number: 1,
  normalized_job_no: "5562365",
  job_no: "5562365",
  source: { id: "s", label: "Synthetic" },
  customer_label: "Steve D.",
  latest_action: "booked",
  evidence_count: 1,
  case_revision: 1,
  evidence_revision: 1,
  deterministic_booking: { present: false },
  opened_at: "2026-10-05T16:00:00.000Z",
  last_evidence_at: "2026-10-05T17:41:00.000Z",
};

const bookingEvent = {
  event_id: "ev-1",
  day: "2026-10-05",
  occurred_at: "2026-10-05T18:40:00.000Z",
  lane: "booking",
  kind: "booking.created",
  title: "Booking written",
  source_company: null,
  ingestion_origin: null,
  lead_kind: null,
  job_no: null,
  entity_type: null,
  entity_id: null,
  parent_receipt_id: null,
  links: { booking_id: "b1" },
  card: { customer_name: "Pat Q." },
  metric_touches: [],
} as DailyOperationsEventItem;

const metric = (value: number | null) => ({ value, unknown_reason: null });
const team = {
  as_of: "2026-10-05T18:41:00.000Z",
  business_day: "2026-10-05",
  is_today: true,
  goal_metrics_enabled: true,
  goals: {
    count_scope: "all_outbound",
    count_scope_label: "Outbound calls",
    outbound_calls: { actual: 172, goal: 200, progress: 0.86, incomplete: false, pending_agent_ids: [], unknown_reason: null },
    reps_at_goal: { count: 1, of: 2, pending: 0 },
    other_outbound_total: 0,
    roster_size: 2,
  },
  goals_unknown_reason: null,
  daily_call_goals: [
    { agent_id: "a1", agent_name: "Alex Rivera", goal_state: "goal", goal: 100, goal_label: "100", actual_confirmed: 64, progress: 0.64, goal_reached: false, remaining: 36, overdue_leads: metric(8) },
    { agent_id: "a2", agent_name: "Jamie Cole", goal_state: "goal", goal: 100, goal_label: "100", actual_confirmed: 108, progress: 1, goal_reached: true, remaining: 0, overdue_leads: metric(0) },
    { agent_id: "a3", agent_name: "Sam Off", goal_state: "no_goal", goal: 0, goal_label: "No goal today", actual_confirmed: null, progress: null, goal_reached: null, remaining: null, overdue_leads: metric(null) },
  ],
  distinct_overdue_leads: metric(8),
  quoted_overdue_leads: metric(2),
  unassigned: { count: 5, overdue: metric(1) },
  leads_needing_attention: { rows: [], limit: 10, unknown_reason: null },
  cadence_exposure: null,
  readiness: null,
} as unknown as SalesOutreachTeamDto;

function withQuery(node: ReturnType<typeof createElement>): string {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderToStaticMarkup(createElement(QueryClientProvider, { client: queryClient }, node));
}

function pulse(props: Partial<PulseViewProps> = {}): string {
  return withQuery(
    createElement(PulseView, {
      role: "owner",
      snapshot,
      events: [bookingEvent],
      team,
      intakes: { items: [intake], hasMore: false },
      nowMs: NOW,
      ...props,
    }),
  );
}

test("Pulse: three Waiting columns with counts, lists and actions", () => {
  const markup = pulse();
  assert.match(markup, /Waiting for you/);
  assert.match(markup, /3 bookings to finish/);
  assert.match(markup, /5562365/);
  assert.match(markup, /Steve D\./);
  assert.match(markup, /1h/);
  assert.match(markup, /href="\/intakes"[^>]*>Finish →/);
  assert.match(markup, /5 unassigned leads/);
  assert.match(markup, /5 unassigned · 1 overdue/);
  assert.match(markup, /href="\/outreach-desk\?view=team&amp;unassigned=true"[^>]*>Assign →/);
  assert.match(markup, /2 exceptions/);
  assert.match(markup, /zip missing, CRM failed/);
  assert.match(markup, /href="\/\?tab=operations&amp;lane=exception"[^>]*>Open →/);
  // Doc 17: the fourth slot exists only while a Granot check waits for approval.
  assert.doesNotMatch(markup, /waiting-granot/);
});

test("Pulse: the fourth Waiting slot says how many Granot updates are ready and opens the check (doc 17)", () => {
  const check: GranotCheck = {
    id: "group-1",
    runs: [],
    operations: ["form_leads", "call_leads"],
    from: "2026-10-03",
    to: "2026-10-05",
    status: "awaiting",
    created_at: "2026-10-05T13:12:00.000Z",
    expires_at: "2026-10-06T17:41:00.000Z",
    source_labels: ["TBM Forms"],
    buckets: { ready: 23, look: 3, missing: 12, same: 81, readyForm: 14, readyCall: 9 },
    receipt_count: 0,
  };
  const markup = pulse({ granotWaiting: [check, { ...check, id: "group-0" }] });
  assert.match(markup, /data-testid="waiting-granot"/);
  assert.match(markup, /23 Granot updates ready/);
  assert.match(markup, /Oct 3 – Oct 5 · expires in 23 h/);
  assert.match(markup, /\+1 more check waiting/);
  assert.match(markup, /href="\/automations\/granot-updates\/group-1"[^>]*>Review →/);
  assert.doesNotMatch(markup, /group-1<\//);
});

test("Pulse: five tiles with trend, captions and the Spend placeholder", () => {
  const markup = pulse();
  for (const id of ["tile-leads", "tile-bookings", "tile-cancellations", "tile-texts", "tile-spend"]) {
    assert.match(markup, new RegExp(`data-testid="${id}"`));
  }
  assert.match(markup, /form 29 · call 12/);
  assert.match(markup, /\+14%/); // 41 vs 36
  assert.match(markup, /2 held/);
  assert.match(markup, /Spend today/);
  assert.match(markup, /Open the Money tab/);
  assert.match(markup, /href="\/\?tab=money"/);
  assert.match(markup, /href="\/\?tab=operations&amp;lane=lead"/);
  assert.match(markup, /href="\/\?tab=operations&amp;lane=booking"/);
  assert.match(markup, /href="\/\?tab=operations&amp;lane=cancellation"/);
  assert.match(markup, /href="\/\?tab=operations&amp;lane=text"/);
});

test("Pulse: highlights, reps today and by source company", () => {
  const markup = pulse();
  assert.match(markup, /Highlights/);
  assert.match(markup, /data-kind="booking\.created"/);
  assert.match(markup, /crm-pill--gold/);
  assert.match(markup, /See everything → Operations/);
  assert.match(markup, /Reps today/);
  assert.match(markup, /Alex Rivera/);
  assert.match(markup, /64 \/ 100/);
  assert.match(markup, /108 \/ 100/);
  assert.match(markup, /No goal today/);
  assert.match(markup, /Open the desk →/);
  assert.match(markup, /href="\/outreach-desk\?view=team"/);
  assert.match(markup, /By source company \(today\)/);
  assert.match(markup, /live lead cost/);
});

test("Pulse: a pending unassigned count says Pending, a failed team read says so in words", () => {
  const pending = pulse({ team: { ...team, unassigned: { count: null, overdue: metric(null) } } as SalesOutreachTeamDto });
  assert.match(pending, /Pending/);
  const failed = pulse({ team: undefined, teamError: new Error("Request failed (503).") });
  assert.match(failed, /Rep goals could not load/);
  assert.match(failed, /Request failed \(503\)/);
  assert.match(failed, /The Outreach Desk count could not load/);
});

test("Pulse: nothing renders for a non-owner role", () => {
  assert.equal(pulse({ role: "manager" }), "");
  assert.equal(pulse({ role: "admin" }), "");
});

test("Pulse: loading shows skeletons, a failed snapshot is said in words", () => {
  const loading = pulse({ snapshot: null, events: null, team: undefined, intakes: { items: [], hasMore: false, loading: true } });
  assert.match(loading, /crm-skeleton/);
  const failed = pulse({ snapshot: null, snapshotError: new Error("Request failed (500).") });
  assert.match(failed, /Today&#x27;s numbers could not load/);
});

test("Today chrome: owner gets four tabs, manager none (Operations only), subtitle is New York time", () => {
  const owner = renderToStaticMarkup(createElement(TodayChrome, { role: "owner", tab: "pulse", nowMs: NOW }));
  for (const label of ["Pulse", "Operations", "Team", "Money"]) assert.match(owner, new RegExp(`>${label}<`));
  assert.match(owner, /Today/);
  assert.match(owner, /Monday, Oct 5 · 2:41 PM New York/);
  assert.match(owner, /href="\/\?tab=money"/);
  const manager = renderToStaticMarkup(createElement(TodayChrome, { role: "manager", tab: "operations", nowMs: NOW }));
  assert.doesNotMatch(manager, /role="tablist"/);
  assert.doesNotMatch(manager, />Money</);
  const admin = renderToStaticMarkup(createElement(TodayChrome, { role: "admin", tab: "pulse", nowMs: NOW }));
  assert.doesNotMatch(admin, /role="tablist"/);
  assert.equal(todaySubtitle(undefined), "New York");
});

test("Team tab: four cards, goals table with View queue links, nothing that acts", () => {
  const markup = withQuery(createElement(TeamSummaryView, { team }));
  assert.match(markup, /Outbound calls/);
  assert.match(markup, /172 \/ 200/);
  assert.match(markup, /Reps at goal/);
  assert.match(markup, /1 \/ 2/);
  assert.match(markup, /Overdue leads/);
  assert.match(markup, /Quoted leads with gaps/);
  assert.match(markup, /Daily call goals/);
  assert.match(markup, /href="\/outreach-desk\?view=my&amp;agent=a1"/);
  assert.match(markup, /8 overdue/);
  assert.match(markup, /Leads needing attention/);
  assert.match(markup, /No Leads need attention/);
  assert.match(markup, /See all in the desk/);
  assert.doesNotMatch(markup, /<button/);
});

test("Team tab: goals switched off and a failed read are said in words", () => {
  const off = withQuery(createElement(TeamSummaryView, { team: { ...team, goal_metrics_enabled: false, goals: null } as SalesOutreachTeamDto }));
  assert.match(off, /Goal tracking is switched off in Settings/);
  const failed = withQuery(createElement(TeamSummaryView, { team: undefined, error: new Error("Request failed (503).") }));
  assert.match(failed, /Team goals and Lead counts could not load/);
  assert.match(failed, /Unavailable/);
});

const overview = {
  generated_at: "2026-10-05T12:00:00.000Z",
  all_time: { totals: {}, lead_cost: { total: 50_000, by_source_company: [] }, top_agents: [] },
  last_7_days: {
    period: { from: "a", to: "b" },
    totals: {},
    by_source_company: [],
    lead_cost: {
      total: 1_845,
      by_source_company: [
        { source_company: "top10", source_company_label: "Top10 Forms", lead_count: 9, total_lead_cost: 1_845, unresolved_cpl_count: 0 },
        { source_company: "tbm", source_company_label: "TBM Forms", lead_count: 3, total_lead_cost: 0, unresolved_cpl_count: 3 },
      ],
    },
    top_agents: [],
  },
} as unknown as OverviewReportResponse;

test("Money fallback: waiting notice, Overview lead cost table, unpriced warning, by-rep note", () => {
  const markup = withQuery(createElement(MoneyFallback, { overview, loading: false, range: "last_7_days", onRange: () => undefined }));
  assert.match(markup, /Money is waiting on the server/);
  assert.match(markup, /Lead spend per day and rep cost per lead need the Money endpoint/);
  assert.match(markup, /Last 7 days/);
  assert.match(markup, /All time/);
  assert.match(markup, /Top10 Forms/);
  assert.match(markup, /\$1,845/);
  // Setup (doc 19): the unpriced link opens Setup → Lead costs; the Registry route is now a permanent redirect.
  assert.match(markup, /href="\/setup\/lead-costs"/);
  assert.match(markup, /Needs rep compensation \(server work\)/);
});

test("Money live: header cards, source table with missing rate, rep table with missing compensation", () => {
  const data: MoneySpendResponse = {
    range: "today",
    generated_at: "2026-10-05T18:41:00.000Z",
    totals: { lead_spend: 5_120, cost_per_lead: 125, cost_per_booked_lead: 1_280, rep_cost_per_lead: 38, unpriced: 3 },
    by_source_company: [
      { source_company: "top10", source_company_label: "Top10 Forms", leads: 14, duplicates: 2, rate_label: "$205.00", spend: 2_870, booked: 1, cost_per_booked: 2_870, unpriced: 0 },
      { source_company: "paid", source_company_label: "Paid Overflow", leads: 3, duplicates: 0, rate_label: null, spend: 0, booked: 0, cost_per_booked: null, unpriced: 3 },
    ],
    by_rep: [
      { agent_id: "a1", agent_name: "Alex", leads_received: 12, calls: 64, booked: 1, rep_cost: 240, cost_per_lead: 20, cost_per_booked: 240, compensation_missing: false },
      { agent_id: "a2", agent_name: "Jamie", leads_received: 9, calls: 108, booked: 2, rep_cost: null, cost_per_lead: null, cost_per_booked: null, compensation_missing: true },
    ],
  };
  const markup = withQuery(createElement(MoneyLive, { data }));
  assert.match(markup, /Lead spend/);
  assert.match(markup, /\$5,120/);
  assert.match(markup, /Cost \/ booked lead/);
  assert.match(markup, /Rep cost \/ lead/);
  assert.match(markup, /\$205\.00/);
  assert.match(markup, />missing</);
  assert.match(markup, /no rate/);
  assert.match(markup, /Missing is not zero/);
});

const goalEvent = {
  event_id: "goal-1",
  day: "2026-10-05",
  occurred_at: "2026-10-05T18:30:00.000Z",
  lane: "outreach",
  kind: "outreach.rep_goal_met",
  title: "Rep goal reached",
  source_company: null,
  ingestion_origin: null,
  lead_kind: null,
  job_no: null,
  entity_type: null,
  entity_id: null,
  parent_receipt_id: null,
  links: {},
  card: { agent_id: "a2", agent_name: "Jamie Cole", actual: 108, goal: 100, reached_at: "2026-10-05T18:29:00.000Z", rank: 1 },
  metric_touches: [],
} as unknown as DailyOperationsEventItem;

const rowEvent = { ...bookingEvent, event_id: "lead-1", kind: "form_lead.created", lane: "lead", title: "Form Lead created", occurred_at: "2026-10-05T18:40:30.000Z" } as DailyOperationsEventItem;

test("Pulse highlights: tier A and goals only, a goal first with its numbers and the queue link", () => {
  const markup = pulse({ events: [bookingEvent, rowEvent, goalEvent] });
  assert.match(markup, /data-kind="outreach\.rep_goal_met"/);
  assert.match(markup, /Jamie Cole hit today&#x27;s call goal/);
  assert.match(markup, /108 \/ 100 calls/);
  assert.match(markup, /1st rep at goal today/);
  assert.match(markup, /href="\/outreach-desk\?view=my&amp;agent=a2"[^>]*>View queue</);
  assert.doesNotMatch(markup, /data-kind="form_lead\.created"/, "a plain Lead is a row on Operations, not a highlight");
  assert.ok(markup.indexOf('data-kind="outreach.rep_goal_met"') < markup.indexOf('data-kind="booking.created"'), "the goal is pinned first");
  assert.match(markup, /See everything → Operations/);
});

test("Pulse: the rep who reached the goal is marked on Reps today", () => {
  const markup = pulse({ events: [goalEvent] });
  assert.match(markup, /Goal reached 2:29 PM/);
  assert.equal((markup.match(/Goal reached 2:29 PM/g) ?? []).length, 1);
  assert.doesNotMatch(pulse({ events: [bookingEvent] }), /Goal reached/);
});

test("Team tab: the goal mark sits on the rep's row", () => {
  const marks = new Map([["a2", "2026-10-05T18:29:00.000Z"]]);
  const markup = withQuery(createElement(TeamSummaryView, { team, goalReachedAt: marks }));
  assert.match(markup, /Goal reached 2:29 PM/);
  assert.match(markup, /crm-pill--gold/);
  assert.doesNotMatch(withQuery(createElement(TeamSummaryView, { team })), /Goal reached d/);
});
