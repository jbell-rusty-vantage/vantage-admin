import assert from "node:assert/strict";
import test from "node:test";
import {
  SalesOutreachApiError,
  onSalesOutreachUnknownValue,
  salesOutreachCommand,
  salesOutreachConfigurationPatchResponseSchema,
  salesOutreachConfigurationReadSchema,
  salesOutreachEnvelope,
  salesOutreachPaths,
  salesOutreachRead,
  type SalesOutreachConfigurationValue,
  type SalesOutreachUnknownValue,
} from "../../lib/api/salesOutreach";
import {
  CONFIGURATION_RULE_SWITCHES,
  CONFIGURATION_TUNABLE_GROUPS,
  configurationPatchBody,
  countScopeEntryInEffect,
  countScopeSchedule,
  parseTunableDraft,
  ruleSwitchState,
  storedTunable,
  withCountScopeEntry,
  withIntakeDefault,
  withoutCountScopeEntry,
  withRuleSwitch,
  withTunables,
  type ConfigurationTunable,
} from "../../components/outreach-desk/lib/configuration-patch";
import { configurationFieldLabel, configurationIssueLines, configurationWriteError } from "../../components/outreach-desk/lib/configuration-issues";
import { onUnknownDeskCode, type UnknownDeskCode } from "../../components/outreach-desk/lib/unknown-codes";
import { deskCopy } from "../../components/outreach-desk/outreach-desk-copy";
import { syntheticConfiguration, syntheticConfigurationValue } from "./fixtures/synthetic";

/**
 * Lifecycle repair ADM-5: the Owner configuration editor. Every edit is the stored value with one path changed (every
 * key it does not edit goes back, known or not — ADM-0); tunables and rule switches remove their key to return to the
 * server default; a refused PATCH reads issue by issue, by code, never with the server's text.
 */

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const c = deskCopy.configEditor;

/** Adds an unknown key to every plain object (arrays included) so a dropped key anywhere fails the deep-equal. */
function withProbes(node: Json, where = "$"): Json {
  if (Array.isArray(node)) return node.map((item, i) => withProbes(item, `${where}[${i}]`));
  if (node && typeof node === "object") {
    const out: JsonObject = {};
    for (const [key, child] of Object.entries(node)) out[key] = withProbes(child, `${where}.${key}`);
    out.olr_probe = { at: where };
    return out;
  }
  return node;
}

/** A production-shaped value (revision 6: the C2c rule on) with an upcoming count entry and a few tunables set. */
function storedRaw(): JsonObject {
  const base = clone(syntheticConfigurationValue("desk")) as unknown as JsonObject;
  (base.cadence as JsonObject).no_contact_number_rule = "review_no_cadence";
  (base.evidence as JsonObject).today_coverage_tolerance_minutes = 30;
  (base.migration as JsonObject).feed_budget_seconds = 20;
  (base.goals as JsonObject).count_scope_schedule = [
    { from_day: "2026-09-28", scope: "all_outbound" },
    { from_day: "2026-10-05", scope: "eligible_new_quoted" },
    { from_day: "2026-10-12", scope: "all_outbound" },
  ];
  base.a_future_namespace = { flag: true };
  return withProbes(base) as JsonObject;
}

function parse(raw: JsonObject): SalesOutreachConfigurationValue {
  const stop = onSalesOutreachUnknownValue(() => undefined);
  try {
    return salesOutreachEnvelope(salesOutreachConfigurationReadSchema).parse(clone({ ok: true, data: { ...syntheticConfiguration("desk"), value: raw } })).data.value!;
  } finally {
    stop();
  }
}

const sent = (value: SalesOutreachConfigurationValue) => JSON.parse(JSON.stringify(configurationPatchBody({ revision: 6 }, value).value)) as JsonObject;
const tunableOf = (field: string): ConfigurationTunable =>
  Object.values(CONFIGURATION_TUNABLE_GROUPS)
    .flat()
    .find((t) => t.field === field)!;

test("the mirror keeps every ADM-5 key as stored: tunables, schedule, operations, switches (parse deep-equals the value)", () => {
  const raw = storedRaw();
  (raw as JsonObject).operations = { evaluate_drain_max_jobs: 300, evaluate_drain_budget_seconds: 50, evaluate_drain_concurrency: 2, olr_probe: { at: "ops" } };
  (raw.transition as JsonObject).expansion_admission_enabled = true;
  (raw.evidence as JsonObject).call_association_rule = "a_future_association_rule";
  const events: SalesOutreachUnknownValue[] = [];
  const stop = onSalesOutreachUnknownValue((event) => events.push(event));
  let value: SalesOutreachConfigurationValue;
  try {
    value = salesOutreachEnvelope(salesOutreachConfigurationReadSchema).parse(clone({ ok: true, data: { ...syntheticConfiguration("desk"), value: raw } })).data.value!;
  } finally {
    stop();
  }
  assert.deepEqual(JSON.parse(JSON.stringify(value)), raw);
  assert.equal(value.operations?.evaluate_drain_max_jobs, 300);
  assert.deepEqual(
    events.map((event) => [event.field, event.value, event.mode]),
    [["configuration evidence.call_association_rule", "a_future_association_rule", "text"]],
    "an unknown rule value is kept as text and reported",
  );
});

test("every editor edit sends the stored value back with only the edited path changed", () => {
  const raw = storedRaw();
  const value = parse(raw);
  const edits: Array<[string, SalesOutreachConfigurationValue, (expected: JsonObject) => void]> = [
    [
      "add an upcoming count entry (sorted, existing entries untouched)",
      withCountScopeEntry(value, "2026-10-08", "all_outbound"),
      (e) => {
        const schedule = (e.goals as JsonObject).count_scope_schedule as JsonObject[];
        schedule.splice(2, 0, { from_day: "2026-10-08", scope: "all_outbound" });
      },
    ],
    [
      "change the scope of an upcoming entry (its unknown keys kept)",
      withCountScopeEntry(value, "2026-10-12", "eligible_new_quoted"),
      (e) => void (((e.goals as JsonObject).count_scope_schedule as JsonObject[])[2]!.scope = "eligible_new_quoted"),
    ],
    [
      "remove an upcoming count entry",
      withoutCountScopeEntry(value, "2026-10-12"),
      (e) => void ((e.goals as JsonObject).count_scope_schedule as JsonObject[]).splice(2, 1),
    ],
    [
      "set a capture tunable and return another to its default",
      withTunables(value, [
        [tunableOf("call_settlement_allowance_minutes"), 3],
        [tunableOf("today_coverage_tolerance_minutes"), null],
      ]),
      (e) => {
        (e.evidence as JsonObject).call_settlement_allowance_minutes = 3;
        delete (e.evidence as JsonObject).today_coverage_tolerance_minutes;
      },
    ],
    [
      "set the drain tunables (the operations namespace is created)",
      withTunables(value, [
        [tunableOf("evaluate_drain_concurrency"), 2],
        [tunableOf("evaluate_drain_max_jobs"), 300],
        [tunableOf("evaluate_drain_budget_seconds"), 50],
      ]),
      (e) => void (e.operations = { evaluate_drain_concurrency: 2, evaluate_drain_max_jobs: 300, evaluate_drain_budget_seconds: 50 }),
    ],
    [
      "set and clear the lead-change tunables",
      withTunables(value, [
        [tunableOf("feed_budget_seconds"), null],
        [tunableOf("feed_max_passes_per_run"), 20],
        [tunableOf("decision_reconcile_per_run"), 500],
      ]),
      (e) => {
        const migration = e.migration as JsonObject;
        delete migration.feed_budget_seconds;
        migration.feed_max_passes_per_run = 20;
        migration.decision_reconcile_per_run = 500;
      },
    ],
    [
      "Granot-created leads start as New (D3)",
      withIntakeDefault(value, "granot_created", "new"),
      (e) => void (((e.cadence as JsonObject).intake_default_rule as JsonObject).granot_created = "new"),
    ],
    [
      "expansion admission on (D7)",
      withRuleSwitch(value, "expansion_admission", true),
      (e) => void ((e.transition as JsonObject).expansion_admission_enabled = true),
    ],
    [
      "no-contact-number rule off (key removed)",
      withRuleSwitch(value, "no_contact_number", false),
      (e) => void delete (e.cadence as JsonObject).no_contact_number_rule,
    ],
    [
      "call association rule on (D-C2d)",
      withRuleSwitch(value, "call_association", true),
      (e) => void ((e.evidence as JsonObject).call_association_rule = "single_active_subject_on_link"),
    ],
  ];
  for (const [name, edited, expect] of edits) {
    const expected = clone(raw);
    expect(expected);
    assert.deepEqual(sent(edited), expected, name);
  }
  assert.deepEqual(sent(value), raw, "the parsed value itself round-trips");
});

test("tunables: absent reads as the documented server default; blank clears the key; bounds mirror the server schema", () => {
  const value = parse(storedRaw());
  // The server code defaults (DESK_TIMING_DEFAULTS, OUTREACH_FEED_LOOP_DEFAULTS, DECISION_RECONCILE_DEFAULT_PER_RUN) and schema bounds.
  const documented = Object.values(CONFIGURATION_TUNABLE_GROUPS)
    .flat()
    .map((t) => [`${t.namespace}.${t.field}`, t.default, t.min, t.max]);
  assert.deepEqual(documented, [
    ["evidence.call_settlement_allowance_minutes", 2, 0, 30],
    ["evidence.today_coverage_tolerance_minutes", 25, 5, 180],
    ["evidence.capture_freshness_tolerance_minutes", 10, 1, 60],
    ["evidence.webhook_silence_minutes", 30, 5, 240],
    ["operations.evaluate_drain_max_jobs", 100, 1, 1000],
    ["operations.evaluate_drain_budget_seconds", 40, 5, 55],
    ["operations.evaluate_drain_concurrency", 1, 1, 4],
    ["migration.feed_budget_seconds", 15, 1, 40],
    ["migration.feed_max_passes_per_run", 10, 1, 50],
    ["migration.decision_reconcile_per_run", 300, 1, 5000],
  ]);
  assert.equal(storedTunable(value, tunableOf("today_coverage_tolerance_minutes")), 30);
  assert.equal(storedTunable(value, tunableOf("webhook_silence_minutes")), null, "absent = the server default");
  assert.equal(storedTunable(value, tunableOf("evaluate_drain_max_jobs")), null, "no operations namespace = defaults");
  // Clearing a tunable that is absent (operations absent) adds nothing.
  assert.equal("operations" in sent(withTunables(value, [[tunableOf("evaluate_drain_max_jobs"), null]])), false);
  // Clearing the last drain tunable keeps the namespace object (it may carry keys this admin does not know).
  const withOps = withTunables(value, [[tunableOf("evaluate_drain_max_jobs"), 200]]);
  assert.deepEqual(sent(withTunables(withOps, [[tunableOf("evaluate_drain_max_jobs"), null]])).operations, {});

  const t = tunableOf("evaluate_drain_concurrency");
  assert.deepEqual(parseTunableDraft(t, ""), { ok: true, value: null });
  assert.deepEqual(parseTunableDraft(t, " 4 "), { ok: true, value: 4 });
  for (const bad of ["0", "5", "2.5", "-1", "two"]) assert.deepEqual(parseTunableDraft(t, bad), { ok: false }, bad);
  assert.deepEqual(parseTunableDraft(tunableOf("call_settlement_allowance_minutes"), "0"), { ok: true, value: 0 }, "0 is a valid allowance");
});

test("goal counts: entries in effect, ended and upcoming by day; emptying the schedule removes the key", () => {
  const value = parse(storedRaw());
  const schedule = countScopeSchedule(value);
  assert.equal(countScopeEntryInEffect(schedule, "2026-09-27"), null, "before the first entry: the default (every outbound call)");
  assert.equal(countScopeEntryInEffect(schedule, "2026-10-06")?.scope, "eligible_new_quoted");
  assert.equal(countScopeEntryInEffect(schedule, "2026-10-12")?.from_day, "2026-10-12");
  const none = clone(storedRaw());
  delete (none.goals as JsonObject).count_scope_schedule;
  assert.deepEqual(countScopeSchedule(parse(none)), [], "absent = no schedule");

  let only = withoutCountScopeEntry(withoutCountScopeEntry(value, "2026-10-12"), "2026-10-05");
  only = withoutCountScopeEntry(only, "2026-09-28");
  assert.equal("count_scope_schedule" in (sent(only).goals as JsonObject), false, "an empty schedule is removed (absent = every outbound call)");
  const fresh = withCountScopeEntry(only, "2026-10-09", "eligible_new_quoted");
  assert.deepEqual((sent(fresh).goals as JsonObject).count_scope_schedule, [{ from_day: "2026-10-09", scope: "eligible_new_quoted" }]);
});

test("rule switches: off = key absent, on = the approved value, a value this admin does not know reads 'other'", () => {
  const value = parse(storedRaw());
  assert.equal(ruleSwitchState(value, "no_contact_number"), "on", "revision 6: review_no_cadence");
  assert.equal(ruleSwitchState(value, "expansion_admission"), "off");
  assert.equal(ruleSwitchState(value, "call_association"), "off");
  const explicit = { ...value, evidence: { ...value.evidence, call_association_rule: "number_lead" } } as SalesOutreachConfigurationValue;
  assert.equal(ruleSwitchState(explicit, "call_association"), "off", "number_lead is the built behaviour");
  const unknown = { ...value, evidence: { ...value.evidence, call_association_rule: "a_future_rule" } } as SalesOutreachConfigurationValue;
  assert.equal(ruleSwitchState(unknown, "call_association"), "other");
  assert.equal(ruleSwitchState({ ...value, transition: { ...value.transition, expansion_admission_enabled: false } }, "expansion_admission"), "off");
  for (const key of Object.keys(CONFIGURATION_RULE_SWITCHES) as Array<keyof typeof CONFIGURATION_RULE_SWITCHES>) {
    const on = withRuleSwitch(value, key, true);
    assert.equal(ruleSwitchState(on, key), "on", `${key} on`);
    const off = withRuleSwitch(on, key, false);
    const sw = CONFIGURATION_RULE_SWITCHES[key];
    assert.equal(sw.field in (sent(off)[sw.namespace] as JsonObject), false, `${key} off removes the key`);
  }
  // Intake defaults need the installed rule: without it the value is unchanged.
  const noRule = { ...value, cadence: { ...value.cadence, intake_default_rule: null } } as SalesOutreachConfigurationValue;
  assert.equal(withIntakeDefault(noRule, "granot_created", "new"), noRule);
});

test("a refused PATCH reads issue by issue, by code; server text and raw paths never show", () => {
  const reported: UnknownDeskCode[] = [];
  const stop = onUnknownDeskCode((event) => reported.push(event));
  try {
    const lines = configurationIssueLines([
      { path: "goals.count_scope_schedule", code: "count_scope_not_prospective" },
      { path: "cadence", code: "engine_policy_unavailable" },
      { path: "cadence", code: "engine_policy_unavailable" },
      { path: "evidence.today_coverage_tolerance_minutes", code: "custom" },
      { path: "transition.backfill_lookback_days", code: "custom" },
      { path: "value.operations.evaluate_drain_concurrency", code: "too_big" },
      { path: "cadence.no_contact_number_rule", code: "invalid_value" },
      { path: "goals.a_server_path", code: "a_new_guard" },
    ]);
    assert.deepEqual(
      lines.map((line) => line.code),
      ["count_scope_not_prospective", "engine_policy_unavailable", "custom", "custom", "too_big", "invalid_value", "a_new_guard"],
      "repeated reasons read once",
    );
    assert.equal(lines[0]!.text, c.issues.count_scope_not_prospective);
    assert.equal(lines[1]!.text, c.issues.engine_policy_unavailable);
    assert.equal(lines[2]!.text, c.issues.coverageBelowSettlement);
    assert.equal(lines[3]!.text, c.issues.backfillRequired);
    assert.equal(lines[4]!.text, "Re-checks at once is outside the range the server accepts.");
    assert.equal(lines[5]!.text, "No phone number → Needs review has a value the server doesn't accept.");
    assert.equal(lines[6]!.text, "The server refused this setting (code a_new_guard).");
    for (const line of lines) assert.doesNotMatch(line.text, /\b(goals|cadence|evidence|operations|transition)\.[a-z_]+/, `no raw path: ${line.text}`);
    assert.deepEqual(reported, [{ kind: "configuration_issue", code: null, value: "a_new_guard" }], "only the unknown code is reported");
  } finally {
    stop();
  }
  assert.equal(configurationFieldLabel("cadence.intake_default_rule.granot_created"), "Created in Granot default");
  assert.equal(configurationFieldLabel("transition.expansion_admission_enabled"), "Admit leads that become eligible later");
  assert.equal(configurationFieldLabel("goals.count_scope_schedule.2.scope"), "Goal counts");

  assert.deepEqual(configurationWriteError(new SalesOutreachApiError(409, "REVISION_CONFLICT", "stale", null, [{ path: "expected_revision", code: "stale" }])), {
    summary: c.conflict,
    lines: [],
  });
  assert.deepEqual(configurationWriteError(new SalesOutreachApiError(400, "INVALID_INPUT", "a server sentence")), { summary: deskCopy.errors.failed(null), lines: [] });
  assert.equal(configurationWriteError(null), null);
});

test("end to end through the BFF calls: a tunable PATCH carries every unknown key; a 400 reads by code", async () => {
  const raw = storedRaw();
  const original = globalThis.fetch;
  const bodies: JsonObject[] = [];
  let refuse = false;
  try {
    globalThis.fetch = async (_url, init) => {
      if (init?.method === "PATCH") {
        bodies.push(JSON.parse(String(init.body)) as JsonObject);
        if (refuse) {
          return Response.json(
            {
              ok: false,
              code: "INVALID_INPUT",
              error: "a server sentence that must not show",
              issues: [
                { path: "goals.count_scope_schedule", code: "count_scope_not_prospective", message: "entries on or before 2026-10-06 cannot change" },
                { path: "cadence", code: "engine_policy_unavailable", message: "website_form review" },
              ],
            },
            { status: 400 },
          );
        }
        return Response.json({ ok: true, data: { contract_version: "sod-v1", revision: 7, version: "v", content_hash: "c".repeat(64), changed: true, replayed: false } });
      }
      return Response.json({ ok: true, data: { ...syntheticConfiguration("desk"), revision: 6, value: raw } });
    };
    const stop = onSalesOutreachUnknownValue(() => undefined);
    try {
      const config = await salesOutreachRead(salesOutreachPaths.configuration(), salesOutreachConfigurationReadSchema);
      const edited = withTunables(config.value!, [[tunableOf("evaluate_drain_budget_seconds"), 50]]);
      await salesOutreachCommand("PATCH", salesOutreachPaths.configuration(), configurationPatchBody(config, edited), "k1", salesOutreachConfigurationPatchResponseSchema);
      refuse = true;
      const error = await salesOutreachCommand(
        "PATCH",
        salesOutreachPaths.configuration(),
        configurationPatchBody(config, withCountScopeEntry(config.value!, "2026-10-05", "all_outbound")),
        "k2",
        salesOutreachConfigurationPatchResponseSchema,
      ).catch((caught: unknown) => caught);
      const shown = configurationWriteError(error);
      assert.equal(shown?.summary, c.refusedSummary);
      assert.deepEqual(shown?.lines, [
        { code: "count_scope_not_prospective", text: c.issues.count_scope_not_prospective },
        { code: "engine_policy_unavailable", text: c.issues.engine_policy_unavailable },
      ]);
      assert.ok(!JSON.stringify(shown).includes("server sentence") && !JSON.stringify(shown).includes("2026-10-06"), "the server's text is not shown");
    } finally {
      stop();
    }
    const expected = clone(raw);
    expected.operations = { evaluate_drain_budget_seconds: 50 };
    assert.equal(bodies[0]!.expected_revision, 6);
    assert.deepEqual(bodies[0]!.value, expected);
  } finally {
    globalThis.fetch = original;
  }
});
