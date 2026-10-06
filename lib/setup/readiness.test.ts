import assert from "node:assert/strict";
import test from "node:test";
import type { LeadSourceDetail, LeadSourceFeedProjection } from "../api/leadSources";
import {
  planReadiness,
  runReadinessPlan,
  type ReadinessDeps,
  type ReadinessNumber,
} from "./readiness";

function feed(
  id: string,
  channel: "form" | "call",
  overrides: Partial<LeadSourceFeedProjection> = {},
): LeadSourceFeedProjection {
  return {
    id,
    granularity_key: id,
    channel,
    display_name: id,
    crm_label: id,
    active: false,
    readiness: { lead_source_active: false, feed_active: false, lead_cost: "ready", live: false },
    ...overrides,
  };
}

function detail(feeds: LeadSourceFeedProjection[], overrides: Partial<LeadSourceDetail> = {}): LeadSourceDetail {
  return {
    id: "source-1",
    company_slug: "source_1",
    name: "Source One",
    owner_label: "Source One",
    active: false,
    aliases: [],
    sheet_config: { has_bad_tabs: false, projection_mode: "derived_import" },
    feeds: { empty: feeds.length === 0, items: feeds },
    blocking_finding_count: 0,
    findings: [],
    readiness_plan: [],
    advanced: { raw_findings: [] },
    ...overrides,
  };
}

const kinds = (steps: ReturnType<typeof planReadiness>["steps"]) => steps.map((step) => step.kind);

function recordingDeps(overrides: Partial<ReadinessDeps> = {}) {
  const calls: string[] = [];
  const deps: ReadinessDeps = {
    activateLeadSource: async (id) => void calls.push(`source:${id}`),
    activateFeed: async (id) => void calls.push(`feed:${id}`),
    makeDefault: async (_source, channel, feedId) => void calls.push(`default:${channel}:${feedId}`),
    switchGranotLive: async (id) => void calls.push(`granot:${id}`),
    activateNumber: async (routeId, feedId) => void calls.push(`number:${routeId}:${feedId}`),
    describeError: (error) => (error instanceof Error ? error.message : String(error)),
    ...overrides,
  };
  return { deps, calls };
}

test("steps come in the doc order: cost, source on, feeds on, Granot names live, customer text, number filing", () => {
  const numbers: ReadinessNumber[] = [
    { route_id: "route-1", feed_id: "calls", phone_number: "+19545550142", validated: true, active: false },
  ];
  const plan = planReadiness(
    detail([
      feed("forms", "form", {
        granot_names: {
          empty: false,
          items: [
            {
              id: "granot-1",
              name_received_from_granot: "Source One",
              when_lead_arrives: "create_if_missing",
              when_lead_arrives_copy: "",
              text_state: "off",
              live: false,
              route: { shape: "one_feed", lands_in_this_feed: true },
            },
          ],
        },
      }),
      feed("calls", "call"),
    ]),
    { numbers },
  );
  assert.deepEqual(kinds(plan.steps), [
    "lead_cost",
    "lead_cost",
    "lead_source_on",
    "feed_on",
    "feed_on",
    "granot_live",
    "customer_text",
    "number_filing",
  ]);
});

test("customer text is planned only for names that create the lead if missing", () => {
  const item = (id: string, arrival: "watch_only" | "existing_only" | "create_if_missing") => ({
    id,
    name_received_from_granot: id,
    when_lead_arrives: arrival,
    when_lead_arrives_copy: "",
    text_state: "off" as const,
    live: false,
    route: { shape: "one_feed" as const, lands_in_this_feed: true as const },
  });
  const plan = planReadiness(
    detail([
      feed("forms", "form", {
        granot_names: {
          empty: false,
          items: [item("a", "watch_only"), item("b", "existing_only"), item("c", "create_if_missing")],
        },
      }),
    ]),
  );
  const text = plan.steps.filter((step) => step.kind === "customer_text");
  assert.equal(text.length, 1);
  assert.equal(text[0]?.kind === "customer_text" && text[0].granot_id, "c");
  assert.equal(plan.steps.filter((step) => step.kind === "granot_live").length, 3);
});

test("a name that lands in two feeds is one Granot step", () => {
  const shared = {
    id: "granot-split",
    name_received_from_granot: "Best Relocation",
    when_lead_arrives: "existing_only" as const,
    when_lead_arrives_copy: "",
    text_state: "not_available" as const,
    live: false,
    route: {
      shape: "form_by_move_type" as const,
      lands_in_this_feed: true as const,
      selection_rule: "",
      local_feed_id: "local",
      long_distance_feed_id: "long",
    },
  };
  const plan = planReadiness(
    detail([
      feed("local", "form", { move_type: "local", granot_names: { empty: false, items: [shared] } }),
      feed("long", "form", { move_type: "long_distance", granot_names: { empty: false, items: [shared] } }),
    ]),
    { defaultFeedIdByChannel: { form: "long" } },
  );
  const granot = plan.steps.filter((step) => step.kind === "granot_live");
  assert.equal(granot.length, 1);
  assert.deepEqual(granot[0]?.kind === "granot_live" && granot[0].feed_ids, ["local", "long"]);
});

test("the chosen default feed is turned on last in its channel", () => {
  const feeds = [feed("local", "form"), feed("long", "form"), feed("calls", "call")];
  const longDefault = planReadiness(detail(feeds), { defaultFeedIdByChannel: { form: "long" } });
  const order = (plan: ReturnType<typeof planReadiness>) =>
    plan.steps.filter((step) => step.kind === "feed_on").map((step) => step.kind === "feed_on" && step.feed_id);
  assert.deepEqual(order(longDefault), ["local", "long", "calls"]);
  assert.deepEqual(longDefault.channelsNeedingDefault, []);
  assert.equal(longDefault.defaults.form, "long");

  const localDefault = planReadiness(detail(feeds), { defaultFeedIdByChannel: { form: "local" } });
  assert.deepEqual(order(localDefault), ["long", "local", "calls"]);
  const last = localDefault.steps.find((step) => step.kind === "feed_on" && step.feed_id === "local");
  assert.equal(last?.kind === "feed_on" && last.make_default, true);
});

test("a channel with two feeds and no choice asks the Owner", () => {
  const plan = planReadiness(detail([feed("local", "form"), feed("long", "form"), feed("calls", "call")]));
  assert.deepEqual(plan.channelsNeedingDefault, ["form"]);
});

test("the default already on is re-asserted after another feed in its channel is turned on", () => {
  const plan = planReadiness(
    detail([feed("local", "form", { active: true }), feed("long", "form")]),
    { defaultFeedIdByChannel: { form: "local" } },
  );
  const tail = plan.steps.filter((step) => step.kind === "feed_on" || step.kind === "make_default");
  assert.deepEqual(
    tail.map((step) => `${step.kind}:${"feed_id" in step ? step.feed_id : ""}`),
    ["feed_on:long", "feed_on:local", "make_default:local"],
  );
  const alreadyOn = plan.steps.find((step) => step.kind === "feed_on" && step.feed_id === "local");
  assert.equal(alreadyOn?.satisfied, true);
});

test("the runner turns feeds on in the planned order, default last, and reports done per step", async () => {
  const plan = planReadiness(detail([feed("local", "form"), feed("long", "form")]), {
    defaultFeedIdByChannel: { form: "long" },
  });
  const { deps, calls } = recordingDeps();
  const results = await runReadinessPlan(plan, deps);
  assert.deepEqual(calls, ["source:source-1", "feed:local", "feed:long"]);
  assert.deepEqual(
    results.map((result) => [result.step.kind, result.status]),
    [
      ["lead_cost", "done"],
      ["lead_cost", "done"],
      ["lead_source_on", "done"],
      ["feed_on", "done"],
      ["feed_on", "done"],
    ],
  );
});

test("a missing lead cost blocks the feed with the reason and nothing is activated for it", async () => {
  const plan = planReadiness(
    detail([feed("forms", "form", { readiness: { lead_source_active: false, feed_active: false, lead_cost: "missing", live: false } })]),
  );
  const { deps, calls } = recordingDeps();
  const results = await runReadinessPlan(plan, deps);
  assert.deepEqual(calls, ["source:source-1"]);
  const cost = results.find((result) => result.step.kind === "lead_cost");
  const feedStep = results.find((result) => result.step.kind === "feed_on");
  assert.equal(cost?.status, "blocked");
  assert.equal(feedStep?.status, "blocked");
  assert.match(feedStep?.reason ?? "", /Waiting on the lead cost for forms/);
});

test("a failed command is reported with the server's reason and its dependants wait", async () => {
  const plan = planReadiness(detail([feed("forms", "form")]));
  const { deps, calls } = recordingDeps({
    activateLeadSource: async () => {
      throw new Error("Lead source cannot be turned on yet.");
    },
  });
  const results = await runReadinessPlan(plan, deps);
  assert.deepEqual(calls, []);
  const source = results.find((result) => result.step.kind === "lead_source_on");
  assert.equal(source?.status, "failed");
  assert.equal(source?.reason, "Lead source cannot be turned on yet.");
  const feedStep = results.find((result) => result.step.kind === "feed_on");
  assert.equal(feedStep?.status, "blocked");
  assert.match(feedStep?.reason ?? "", /Waiting on the lead source being on/);
});

test("customer text is never turned on by the runner: it stays blocked with the instruction", async () => {
  const plan = planReadiness(
    detail([
      feed("forms", "form", {
        granot_names: {
          empty: false,
          items: [
            {
              id: "granot-1",
              name_received_from_granot: "Source One",
              when_lead_arrives: "create_if_missing",
              when_lead_arrives_copy: "",
              text_state: "off",
              live: false,
              route: { shape: "one_feed", lands_in_this_feed: true },
            },
          ],
        },
      }),
    ]),
  );
  const { deps, calls } = recordingDeps();
  const results = await runReadinessPlan(plan, deps);
  assert.ok(calls.includes("granot:granot-1"));
  const text = results.find((result) => result.step.kind === "customer_text");
  assert.equal(text?.status, "blocked");
  assert.match(text?.reason ?? "", /Turn the customer text on yourself/);
});

test("an unvalidated number is blocked; a validated one files into its call feed after the feed is on", async () => {
  const feeds = [feed("calls", "call")];
  const unvalidated = planReadiness(detail(feeds), {
    numbers: [{ route_id: "r1", feed_id: "calls", phone_number: "+19545550142", validated: false, active: false }],
  });
  const first = recordingDeps();
  const blocked = await runReadinessPlan(unvalidated, first.deps);
  assert.equal(blocked.find((result) => result.step.kind === "number_filing")?.status, "blocked");
  assert.ok(!first.calls.some((call) => call.startsWith("number:")));

  const validated = planReadiness(detail(feeds), {
    numbers: [{ route_id: "r1", feed_id: "calls", phone_number: "+19545550142", validated: true, active: false }],
  });
  const second = recordingDeps();
  await runReadinessPlan(validated, second.deps);
  assert.deepEqual(second.calls, ["source:source-1", "feed:calls", "number:r1:calls"]);
});

test("the re-asserted default runs after the other feed is on", async () => {
  const plan = planReadiness(
    detail([feed("local", "form", { active: true }), feed("long", "form")], { active: true }),
    { defaultFeedIdByChannel: { form: "local" } },
  );
  const { deps, calls } = recordingDeps();
  await runReadinessPlan(plan, deps);
  assert.deepEqual(calls, ["feed:long", "default:form:local"]);
});

test("onResult is called once per settled step, in order", async () => {
  const plan = planReadiness(detail([feed("forms", "form")]));
  const { deps } = recordingDeps();
  const seen: string[] = [];
  await runReadinessPlan(plan, deps, (result) => seen.push(`${result.step.kind}:${result.status}`));
  assert.deepEqual(seen, ["lead_cost:done", "lead_source_on:done", "feed_on:done"]);
});
