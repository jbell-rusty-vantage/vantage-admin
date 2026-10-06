import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  SALES_OUTREACH_READ_SHAPE_MISMATCH,
  SALES_OUTREACH_TOLERATED_ENUMS,
  SalesOutreachApiError,
  onSalesOutreachUnknownValue,
  salesOutreachCapabilitiesSchema,
  salesOutreachCommand,
  salesOutreachConfigurationPatchResponseSchema,
  salesOutreachConfigurationReadSchema,
  salesOutreachDetailSchema,
  salesOutreachEnvelope,
  salesOutreachPaths,
  salesOutreachQueueSchema,
  salesOutreachRead,
  salesOutreachRepDaysSchema,
  salesOutreachTeamSchema,
  type SalesOutreachUnknownValue,
} from "../../lib/api/salesOutreach";
import {
  configurationPatchBody,
  withDefaultGoal,
  withHolidays,
  withSwitchToggled,
  withWorkingDayToggled,
} from "../../components/outreach-desk/lib/configuration-patch";
import { cadenceMetricText, channelStatus, readFailureText, rowIssue } from "../../components/outreach-desk/lib/format";
import { deskCopy } from "../../components/outreach-desk/outreach-desk-copy";
import { retryDeskRead } from "../../components/outreach-desk/data/use-desk-reads";
import { SYNTHETIC_AGENTS, syntheticConfiguration, syntheticConfigurationValue } from "./fixtures/synthetic";

/**
 * Lifecycle repair ADM-0: the admin mirror must not break, or wipe server state, when the server ships first.
 * (i) the Owner's Settings PATCH sends back every configuration key and value it does not know, at every level;
 * (ii) a new enum value in a read reads as a safe fallback (or is kept as text) instead of failing the read;
 * (iii) a read that still fails says so (`READ_SHAPE_MISMATCH`, not retried) instead of a skeleton.
 */

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const readServerExample = (name: string): { ok: true; data: Record<string, unknown> } =>
  JSON.parse(readFileSync(path.join(process.cwd(), "tests/outreach-desk/fixtures/server", name), "utf8"));

/** Collects the unknown-value reports raised while `run` executes. */
function collectUnknown<T>(run: () => T): { result: T; events: SalesOutreachUnknownValue[] } {
  const events: SalesOutreachUnknownValue[] = [];
  const stop = onSalesOutreachUnknownValue((event) => events.push(event));
  try {
    return { result: run(), events };
  } finally {
    stop();
  }
}

/** Adds an unknown key (with a nested object and array) to every plain object of a JSON value, arrays included. */
function withProbes(value: Json, at = "$"): { value: Json; probes: number } {
  let probes = 0;
  const walk = (node: Json, where: string): Json => {
    if (Array.isArray(node)) return node.map((item, index) => walk(item, `${where}[${index}]`));
    if (node && typeof node === "object") {
      const out: { [key: string]: Json } = {};
      for (const [key, child] of Object.entries(node)) out[key] = walk(child, `${where}.${key}`);
      out.olr_probe_unknown_key = { at: where, nested: [1, { deep: true }] };
      probes += 1;
      return out;
    }
    return node;
  };
  return { value: walk(value, at), probes };
}

/** The revision-5-shaped value plus everything the repair lanes may add before this admin knows it. */
function futureConfigurationValue(): { raw: Record<string, Json>; probes: number } {
  const base = clone(syntheticConfigurationValue("desk")) as unknown as Record<string, Json>;
  const cadence = base.cadence as Record<string, Json>;
  const goals = base.goals as Record<string, Json>;
  // New keys (lanes A/B/C), a new namespace, and enum values the mirror does not list.
  (base.evidence as Record<string, Json>).today_tolerance_minutes = 25;
  (base.transition as Record<string, Json>).expansion_admission_enabled = false;
  (base.migration as Record<string, Json>).decision_reconcile_per_run = 300;
  goals.count_scope_schedule = [{ from_day: "2026-10-07", scope: "eligible_new_quoted" }];
  base.operations = { evaluate_drain_max: 100, evaluate_drain_budget_seconds: 40 };
  cadence.no_contact_number_rule = "review_no_cadence";
  cadence.calendar_mode = "a_future_calendar_mode";
  (cadence.intake_default_rule as Record<string, Json>).granot_created = "no_cadence";
  const codes = (cadence.priority_map as Record<string, Json>).codes as Record<string, Json>[];
  codes.push({ code: "9", workflow: "a_future_workflow", closure_reason: "a_future_closure_reason" });
  ((goals.effective_day_overrides as Record<string, Json>[])[0] as Record<string, Json>).reason = "training";
  const probed = withProbes(base);
  return { raw: probed.value as Record<string, Json>, probes: probed.probes };
}

function parseConfiguration(raw: Record<string, Json>) {
  const body = clone({ ok: true, data: { ...syntheticConfiguration("desk"), value: raw } });
  return collectUnknown(() => salesOutreachEnvelope(salesOutreachConfigurationReadSchema).parse(body).data);
}

test("(i) the configuration value parses loose at every level: unknown keys and enum values survive unchanged", () => {
  const { raw, probes } = futureConfigurationValue();
  assert.ok(probes >= 30, `probes reached every nested object (${probes})`);
  const { result: config, events } = parseConfiguration(raw);
  assert.deepEqual(JSON.parse(JSON.stringify(config.value)), raw, "parse(value) deep-equals the stored value");
  // Unknown configuration enum values are kept as text and reported (development log), never replaced.
  const reported = new Map(events.map((event) => [String(event.value), event]));
  for (const value of ["a_future_calendar_mode", "no_cadence", "a_future_workflow", "a_future_closure_reason", "training"]) {
    assert.equal(reported.get(value)?.mode, "text", `${value} is kept as text`);
  }
});

test("(i) every Settings edit round-trips: the PATCH body is the stored value with only the edited path changed", () => {
  const { raw } = futureConfigurationValue();
  const { result: config } = parseConfiguration(raw);
  const value = config.value!;
  const agentId = SYNTHETIC_AGENTS.alex.id;
  const edits: Array<[string, () => unknown, (expected: Record<string, Json>) => void]> = [
    ["desk switch", () => withSwitchToggled(value, "desk_enabled"), (e) => void ((e.controls as Record<string, Json>).desk_enabled = !value.controls.desk_enabled)],
    [
      "intake gate",
      () => withSwitchToggled(value, "intake_admission_enabled"),
      (e) => void ((e.transition as Record<string, Json>).intake_admission_enabled = !value.transition.intake_admission_enabled),
    ],
    ["default goal", () => withDefaultGoal(value, 120), (e) => void ((e.goals as Record<string, Json>).default_scheduled_goal = 120)],
    [
      "working day",
      () => withWorkingDayToggled(value, agentId, 3),
      (e) => {
        const row = ((e.goals as Record<string, Json>).rep_work_schedules as Record<string, Json>[]).find((r) => r.agent_id === agentId)!;
        row.working_days = (row.working_days as number[]).filter((day) => day !== 3);
      },
    ],
    ["closures", () => withHolidays(value, ["2026-12-25", "2026-11-26", "2026-12-25"]), (e) => void ((e.cadence as Record<string, Json>).holidays = ["2026-11-26", "2026-12-25"])],
  ];
  for (const [name, edit, expect] of edits) {
    const body = JSON.parse(JSON.stringify(configurationPatchBody(config, edit() as typeof value)));
    const expected = clone(raw);
    expect(expected);
    assert.equal(body.expected_revision, config.revision, `${name}: sends the revision read`);
    assert.deepEqual(body.value, expected, `${name}: every unknown key and value is sent back`);
  }
  // The working-day edit adds a day back in ISO order.
  const added = withWorkingDayToggled(withWorkingDayToggled(value, agentId, 3), agentId, 3);
  assert.deepEqual(added.goals.rep_work_schedules!.find((row) => row.agent_id === agentId)!.working_days, [1, 2, 3, 4, 5, 6, 7]);
});

test("(i) end to end through the BFF calls: GET /configuration then a toggle PATCH carries every unknown key", async () => {
  const { raw } = futureConfigurationValue();
  const original = globalThis.fetch;
  const sent: unknown[] = [];
  try {
    globalThis.fetch = async (_url, init) => {
      if (init?.method === "PATCH") {
        sent.push(JSON.parse(String(init.body)));
        return Response.json({ ok: true, data: { contract_version: "sod-v1", revision: 6, version: "v", content_hash: "c".repeat(64), changed: true, replayed: false } });
      }
      return Response.json({ ok: true, data: { ...syntheticConfiguration("desk"), value: raw } });
    };
    const stop = onSalesOutreachUnknownValue(() => undefined);
    try {
      const config = await salesOutreachRead(salesOutreachPaths.configuration(), salesOutreachConfigurationReadSchema);
      await salesOutreachCommand("PATCH", salesOutreachPaths.configuration(), configurationPatchBody(config, withSwitchToggled(config.value!, "goal_metrics_enabled")), "k", salesOutreachConfigurationPatchResponseSchema);
    } finally {
      stop();
    }
    const expected = clone(raw);
    (expected.controls as Record<string, Json>).goal_metrics_enabled = !(raw.controls as Record<string, Json>).goal_metrics_enabled;
    assert.deepEqual((sent[0] as { value: unknown }).value, expected);
  } finally {
    globalThis.fetch = original;
  }
});

test("(ii) every tolerated enum reads a new server value safely and reports it; known values read as themselves", () => {
  assert.ok(SALES_OUTREACH_TOLERATED_ENUMS.length >= 30, "the tolerated list is registered");
  for (const entry of SALES_OUTREACH_TOLERATED_ENUMS) {
    for (const known of entry.values) {
      const input = entry.mode === "dropped" ? [known] : known;
      assert.deepEqual(collectUnknown(() => entry.schema.parse(input)).result, input, `${entry.field}: ${known}`);
    }
    const unknown = "a_value_the_server_adds_later";
    const input = entry.mode === "dropped" ? [entry.values[0], unknown] : unknown;
    const { result, events } = collectUnknown(() => entry.schema.parse(input));
    const expected = entry.mode === "fallback" ? entry.fallback : entry.mode === "text" ? unknown : [entry.values[0]];
    assert.deepEqual(result, expected, `${entry.field}: unknown reads as ${JSON.stringify(expected)}`);
    assert.deepEqual(events, [{ field: entry.field, value: unknown, mode: entry.mode, fallback: entry.fallback }], `${entry.field}: reported`);
    if (entry.mode === "fallback") assert.ok(entry.values.includes(entry.fallback!), `${entry.field}: the fallback is a known value`);
  }
  // Tolerance is for new string values only: a missing or mistyped value still fails the read.
  const channelStatus = SALES_OUTREACH_TOLERATED_ENUMS.find((entry) => entry.field.startsWith("channel.status"))!;
  assert.equal(channelStatus.schema.safeParse(undefined).success, false);
  assert.equal(channelStatus.schema.safeParse(3).success, false);
});

test("(ii) a queue page with new channel, coverage, freshness, workflow and status values renders safely", () => {
  const body = readServerExample("queue.owner.page-1.json");
  const data = body.data as { rows: Record<string, Record<string, unknown>>[]; freshness: Record<string, Record<string, unknown>> };
  const row = data.rows[0]!;
  row.call!.status = "awaiting_capture";
  (row.call!.coverage as Record<string, unknown>).state = "catching_up";
  row.sms!.status = "awaiting_capture";
  (row as Record<string, unknown>).workflow = "late_new";
  (row as Record<string, unknown>).subject_status = "on_hold";
  data.freshness.calls!.state = "confirmation_stale";
  data.freshness.granot!.state = "lagging";
  // The server keeps `overdue` false while it cannot verify the deadline (A1/A2); only the statuses are new.
  (row.status_flags as Record<string, unknown>).overdue = false;
  const { result, events } = collectUnknown(() => salesOutreachEnvelope(salesOutreachQueueSchema).parse(body).data);
  const parsed = result.rows[0]!;
  assert.equal(parsed.call.status, "pending");
  assert.equal(parsed.call.coverage.state, "unknown");
  assert.equal(parsed.workflow, "none");
  assert.equal(parsed.subject_status, "review");
  assert.equal(result.freshness.calls.state, "unknown");
  assert.equal(result.freshness.granot.state, "unknown");
  assert.equal(events.length, 7);
  // Never red, never "done": an unknown status reads as pending evidence.
  assert.deepEqual(channelStatus(parsed.call, result.as_of, "call"), { text: deskCopy.text.pending, tone: "muted" });
  assert.notEqual(rowIssue(parsed, result.as_of).tone, "red");
});

test("(ii) team, rep-days, detail and capabilities reads survive new values; unknown reasons keep their text", () => {
  const team = readServerExample("team.owner.cadence-enforcement.json");
  const t = team.data as Record<string, Record<string, unknown>>;
  t.distinct_overdue_leads = { value: null, unknown_reason: "coverage_wait" };
  (t.goals as Record<string, unknown>).count_scope = "a_future_scope";
  const goalRow = (t.daily_call_goals as unknown as Record<string, unknown>[])[0]!;
  goalRow.goal_state = "on_leave";
  goalRow.actual_basis = "estimated";
  goalRow.count_scope = "a_future_scope";
  (goalRow.coverage as Record<string, unknown>).state = "catching_up";
  (goalRow.other_outbound as Record<string, unknown>).label = "Other outbound calls";
  (goalRow.goal_provenance as Record<string, unknown>).basis = "a_future_basis";
  goalRow.calls_due_today = { value: null, unknown_reason: "coverage_wait" };
  const teamParsed = collectUnknown(() => salesOutreachEnvelope(salesOutreachTeamSchema).parse(team).data).result;
  assert.equal(teamParsed.distinct_overdue_leads.unknown_reason, "coverage_wait");
  assert.deepEqual(cadenceMetricText(teamParsed.distinct_overdue_leads), { text: deskCopy.text.unavailable, available: false, reason: deskCopy.text.unavailable });
  assert.equal(teamParsed.goals!.count_scope, "mixed");
  const parsedRow = teamParsed.daily_call_goals![0]!;
  assert.equal(parsedRow.goal_state, "no_goal_today");
  assert.equal(parsedRow.actual_basis, "pending");
  assert.equal(parsedRow.count_scope, "all_outbound");
  assert.equal(parsedRow.coverage.state, "unknown");
  assert.equal(parsedRow.other_outbound.label, "Other outbound");
  assert.equal(parsedRow.calls_due_today.unknown_reason, "coverage_wait");

  const repDays = readServerExample("rep-days.owner.json");
  (repDays.data as Record<string, unknown>).count_scope = "a_future_scope";
  (repDays.data as Record<string, unknown>).unknown_reason = "a_future_reason";
  const repParsed = collectUnknown(() => salesOutreachEnvelope(salesOutreachRepDaysSchema).parse(repDays).data).result;
  assert.equal(repParsed.count_scope, "mixed");
  assert.equal(repParsed.unknown_reason, "a_future_reason");

  const detail = readServerExample("outreach.owner.overdue.json");
  const d = detail.data as Record<string, Record<string, unknown>>;
  d.subject!.status = "parked";
  d.subject!.received_quality = "estimated";
  (d.subject!.enrollment as Record<string, unknown>).kind = "late";
  d.priority!.basis = "a_future_basis";
  d.policy!.projection_state = "coverage_wait";
  (d.requirements!.call as Record<string, unknown>).status = "awaiting_capture";
  const detailParsed = collectUnknown(() => salesOutreachEnvelope(salesOutreachDetailSchema).parse(detail).data).result;
  assert.equal(detailParsed.subject.status, "review");
  assert.equal(detailParsed.subject.received_quality, "unreliable");
  assert.equal(detailParsed.subject.enrollment.kind, "expansion");
  assert.equal(detailParsed.priority.basis, "none");
  assert.equal(detailParsed.policy.projection_state, "pending");
  assert.equal(detailParsed.requirements.call.status, "pending");

  const capabilities = readServerExample("capabilities.owner.json");
  const c = capabilities.data as Record<string, unknown>;
  c.deployed_reads = [...(c.deployed_reads as string[]), "enrollment_admissions"];
  c.permitted_views = [...(c.permitted_views as string[]), "a_future_view"];
  (c.permitted_filters as Record<string, unknown>).queue = [...((c.permitted_filters as Record<string, string[]>).queue ?? []), "verification"];
  const capabilitiesParsed = collectUnknown(() => salesOutreachEnvelope(salesOutreachCapabilitiesSchema).parse(capabilities).data).result;
  assert.ok(!(capabilitiesParsed.deployed_reads as string[]).includes("enrollment_admissions"));
  assert.ok(!(capabilitiesParsed.permitted_views as string[]).includes("a_future_view"));
  assert.ok(capabilitiesParsed.permitted_views.includes("team"), "known values keep their place");
  assert.ok(!(capabilitiesParsed.permitted_filters.queue as string[]).includes("verification"));
});

test("(iii) a body the mirror can't read is a typed READ_SHAPE_MISMATCH, not retried, and said in words", async () => {
  const original = globalThis.fetch;
  try {
    const body = readServerExample("team.owner.json");
    (body.data as Record<string, unknown>).daily_call_goals = "not a list";
    globalThis.fetch = async () => Response.json(body);
    let caught: unknown = null;
    await salesOutreachRead(salesOutreachPaths.team(), salesOutreachTeamSchema).catch((error: unknown) => {
      caught = error;
    });
    assert.ok(caught instanceof SalesOutreachApiError);
    assert.equal(caught.code, SALES_OUTREACH_READ_SHAPE_MISMATCH);
    assert.equal(caught.status, 200);
    assert.ok(caught.issues?.some((issue) => issue.path === "data.daily_call_goals"));
    assert.equal(retryDeskRead(0, caught), false, "the same body would fail again");
    assert.equal(readFailureText(caught), deskCopy.readErrors.shape);
  } finally {
    globalThis.fetch = original;
  }
  assert.equal(readFailureText(new SalesOutreachApiError(503, "PROJECTION_PENDING", "x")), deskCopy.readErrors.unavailable);
  assert.equal(readFailureText(new SalesOutreachApiError(403, "FORBIDDEN", "x")), deskCopy.readErrors.forbidden);
  assert.equal(readFailureText(new TypeError("Failed to fetch")), deskCopy.readErrors.failed);
  assert.equal(retryDeskRead(0, new TypeError("Failed to fetch")), true, "a network failure is still retried");
});

test("read-failure copy is plain words (no server codes on screen)", () => {
  const r = deskCopy.readErrors;
  for (const text of [r.team, r.goal, r.queue, r.reps, r.unavailable, r.shape, r.forbidden, r.failed, r.stale("Thu, Oct 1, 2026, 9:10 AM EDT"), r.retry]) {
    assert.doesNotMatch(text, /[a-z]+_[a-z]+/, text);
  }
});
