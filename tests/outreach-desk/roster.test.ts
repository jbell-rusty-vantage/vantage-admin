import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { withRosterRule, withWorkingDayToggled } from "../../components/outreach-desk/lib/configuration-patch";
import { deskCopy } from "../../components/outreach-desk/outreach-desk-copy";
import { rosterPanelRows } from "../../components/outreach-desk/views/settings-view";
import { salesOutreachEnvelope, salesOutreachTeamSchema, salesOutreachRepDaysSchema, type SalesOutreachConfigurationValue } from "../../lib/api/salesOutreach";
import { syntheticConfigurationValue } from "./fixtures/synthetic";

/**
 * P08a-1 (F1/F2) consumers: the derived-roster server examples parse, the Settings roster panel lists the effective
 * members under the automatic rule (and the configured list otherwise), a day toggle creates a settings row for a
 * rep who has none, and the rule switch adds or removes `goals.roster_rule`.
 */
const readServerExample = (name: string): unknown => JSON.parse(readFileSync(path.join(process.cwd(), "tests/outreach-desk/fixtures/server", name), "utf8"));
const team = (name: string) => salesOutreachEnvelope(salesOutreachTeamSchema).parse(readServerExample(name)).data;

test("server examples: the derived roster is served with its members and the Owner's other-callers footnote; older examples read explicit", () => {
  const derived = team("team.owner.desk-reps.json");
  assert.equal(derived.roster?.rule, "desk_reps");
  assert.equal(derived.roster?.members.length, 4);
  assert.deepEqual(derived.daily_call_goals!.map((row) => row.agent_id), derived.roster!.members.map((m) => m.agent_id), "rows are exactly the members, in the same order");
  assert.deepEqual(derived.roster!.members.map((m) => m.schedule_source), ["configured", "default", "configured", "configured"]);
  assert.deepEqual(derived.goals!.other_callers, { agents: 2, agent_ids: derived.goals!.other_callers!.agent_ids, confirmed: 14, awaiting_confirmation: 0 });
  assert.equal(derived.goals!.roster_size, 4);
  const explicit = team("team.owner.json");
  assert.equal(explicit.roster?.rule, "explicit");
  assert.equal(explicit.goals!.other_callers, null);
  assert.equal(explicit.daily_call_goals!.some((row) => row.goal_state === "not_on_roster"), true, "the explicit rule still lists callers off the roster as rows");
  const days = salesOutreachEnvelope(salesOutreachRepDaysSchema).parse(readServerExample("rep-days.owner.desk-reps.json")).data;
  assert.deepEqual(days.reps!.map((row) => row.goal_state), ["goal", "goal", "goal", "goal"]);
});

test("other-callers footnote copy counts calls and people", () => {
  assert.equal(deskCopy.team.goals.otherCallers(14, 2), "Also today: 14 outbound calls by 2 people not on the roster (not active, or not connected in Accounts).");
  assert.equal(deskCopy.team.goals.otherCallers(1, 1), "Also today: 1 outbound call by 1 person not on the roster (not active, or not connected in Accounts).");
});

test("rosterPanelRows: the automatic rule lists the served members (defaults marked), the explicit rule lists the configured rows, and waits for the team read", () => {
  const base = syntheticConfigurationValue() as SalesOutreachConfigurationValue;
  const names = new Map([[base.goals.rep_work_schedules![0]!.agent_id, "Alice"]]);
  const explicit = rosterPanelRows(base, null, names);
  assert.equal(explicit.automatic, false);
  assert.equal(explicit.loading, false);
  assert.equal(explicit.rows.length, base.goals.rep_work_schedules!.length);
  assert.equal(explicit.rows[0]!.name, "Alice");
  const automatic = withRosterRule(base, "desk_reps");
  assert.deepEqual(rosterPanelRows(automatic, null, names), { automatic: true, loading: true, rows: [] });
  const served = team("team.owner.desk-reps.json").roster!;
  const rows = rosterPanelRows(automatic, served, new Map());
  assert.equal(rows.loading, false);
  assert.deepEqual(
    rows.rows.map((row) => [row.name, row.default_schedule, row.goal]),
    [
      ["Alice Rep", false, null],
      ["Bob Rep", true, null],
      ["Cara Rep", false, null],
      ["Dan Rep", false, null],
    ],
  );
});

test("withWorkingDayToggled creates a settings row for a rep without one, from the days the desk shows; withRosterRule adds or removes the key", () => {
  const base = syntheticConfigurationValue() as SalesOutreachConfigurationValue;
  const newcomer = "9".repeat(24);
  const toggled = withWorkingDayToggled(base, newcomer, 6, [1, 2, 3, 4, 5, 6, 7]);
  const row = toggled.goals.rep_work_schedules!.find((r) => r.agent_id === newcomer)!;
  assert.deepEqual([row.working_days, row.scheduled_goal], [[1, 2, 3, 4, 5, 7], null]);
  assert.equal(toggled.goals.rep_work_schedules!.length, base.goals.rep_work_schedules!.length + 1, "existing rows untouched");
  const again = withWorkingDayToggled(toggled, newcomer, 6);
  assert.deepEqual(again.goals.rep_work_schedules!.find((r) => r.agent_id === newcomer)!.working_days, [1, 2, 3, 4, 5, 6, 7]);
  const on = withRosterRule(base, "desk_reps");
  assert.equal(on.goals.roster_rule, "desk_reps");
  const off = withRosterRule(on, null);
  assert.equal("roster_rule" in off.goals, false, "Off removes the key (the server default), never writes explicit");
  assert.deepEqual(off.goals.rep_work_schedules, base.goals.rep_work_schedules);
});
