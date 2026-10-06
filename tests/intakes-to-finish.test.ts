import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ToFinishCard } from "../components/intakes/to-finish-card";
import { GranotMessage, granotMessageRows, granotReadingGroups, humanizeKey } from "../components/intakes/granot-message";
import { parseToFinishUrl } from "../components/intakes/to-finish-page";
import { TO_FINISH_COPY } from "../components/intakes/to-finish-copy";
import {
  contactSyncChip,
  finishedToday,
  finishModeOf,
  granotAgeLine,
  granotValueForInput,
  isFinishedToday,
  moneyText,
  moveMoneyLine,
  overrideReasonProblem,
  possibleCustomerCount,
  rememberedMerchantId,
  reviewLine,
  sheetLabel,
  suggestedAgentId,
  TO_FINISH_OPEN_FILTERS,
} from "../lib/api/bookingsToFinish";
import type { GranotLifecycleCaseListItem } from "../lib/api/granotLifecycle";

const NOW = new Date("2026-10-05T20:00:00Z");

const base: GranotLifecycleCaseListItem = {
  case_id: "case-1",
  kind: "booking",
  state: "open",
  mode: "create_missing_booking",
  sequence_number: 1,
  normalized_job_no: "5562365",
  job_no: "5562365",
  source: { id: "s1", label: "10best Inbounds" },
  customer_label: "Steve Dority",
  latest_action: "booked",
  evidence_count: 3,
  case_revision: 4,
  evidence_revision: 4,
  deterministic_booking: { present: false },
  opened_at: "2026-10-05T18:30:00Z",
  last_evidence_at: "2026-10-05T19:00:00Z",
};

const render = (item: GranotLifecycleCaseListItem) => renderToStaticMarkup(createElement(ToFinishCard, { item, now: NOW }));

test("the list read is the open booking cases, newest Granot evidence first", () => {
  assert.deepEqual(
    { kind: TO_FINISH_OPEN_FILTERS.kind, state: TO_FINISH_OPEN_FILTERS.state, sort: TO_FINISH_OPEN_FILTERS.sort, order: TO_FINISH_OPEN_FILTERS.order },
    { kind: "booking", state: "open", sort: "last_evidence_at", order: "desc" },
  );
});

test("a card shows the job, customer, source, Granot age, updates and one Finish button", () => {
  const markup = render(base);
  assert.match(markup, /5562365/);
  assert.match(markup, /Steve Dority/);
  assert.match(markup, /10best Inbounds/);
  assert.match(markup, /Granot booked 1h ago/);
  assert.match(markup, /3 updates/);
  assert.equal((markup.match(/>Finish</g) ?? []).length, 1);
  assert.equal(markup.includes("Two possible customers"), false);
  assert.equal(markup.includes("Intake"), false);
});

test("the move and money line renders only when the case file summary arrives, with no placeholder when absent", () => {
  const line = moveMoneyLine({ origin: "Tucson, AZ", destination: "Sterling, VA", pickup: "2026-10-19", total_estimate: 1978, customer_payment: 578 }, NOW);
  assert.equal(line, "Tucson, AZ → Sterling, VA · pickup Oct 19 · Granot estimate $1,978 · paid $578");
  assert.equal(moveMoneyLine({ total_estimate: "$1,978.40" }, NOW), "Granot estimate $1,978.40");
  assert.equal(moveMoneyLine(undefined, NOW), "");
  assert.equal(moveMoneyLine({}, NOW), "");
  const withSummary = render({ ...base, case_file_summary: { origin: "Tucson, AZ", destination: "Sterling, VA", pickup: "2026-10-19", total_estimate: 1978, customer_payment: 578, rep: "AUSTIN" } });
  assert.match(withSummary, /Tucson, AZ → Sterling, VA/);
  assert.match(withSummary, /AUSTIN/);
  assert.equal(render(base).includes("to-finish-move-line"), false);
});

test("two possible customers shows the warning and only on create cases", () => {
  assert.equal(possibleCustomerCount({ customer_label: "Betty Raban / John Donahue" }), 2);
  assert.equal(possibleCustomerCount({ customer_label: "Steve Dority" }), 0);
  assert.equal(possibleCustomerCount({ customer_label: "Steve Dority", possible_customer_count: 2 }), 2);
  assert.equal(possibleCustomerCount({ customer_label: "A / B", possible_customer_count: 1 }), 0);
  assert.match(render({ ...base, customer_label: "Betty Raban / John Donahue" }), /Two possible customers · pick one/);
  assert.equal(render({ ...base, customer_label: "Betty Raban / John Donahue", mode: "review_existing_booking" }).includes("Two possible customers"), false);
});

test("a review case says Vantage already has a booking and offers Review, not Finish", () => {
  const markup = render({ ...base, mode: "review_existing_booking", deterministic_booking: { present: true, id: "b1" } });
  assert.match(markup, /Vantage already has a booking for this job/);
  assert.match(markup, />Review</);
  assert.equal(markup.includes(">Finish<"), false);
  assert.equal(finishModeOf("create_referral_booking"), "referral");
  assert.equal(finishModeOf("create_missing_booking"), "create");
  assert.equal(finishModeOf("review_existing_booking"), "review");
});

test("Granot age words follow the latest action", () => {
  assert.equal(granotAgeLine({ latest_action: "booked", last_evidence_at: "2026-10-05T19:00:00Z" }, NOW.getTime()), "Granot booked 1h ago");
  assert.equal(granotAgeLine({ latest_action: "release", last_evidence_at: "2026-10-05T19:25:00Z" }, NOW.getTime()), "Granot released 35m ago");
});

test("Finished today keeps only cases resolved on today's New York day", () => {
  const items = [
    { id: "a", resolved_at: "2026-10-05T14:00:00Z" },
    { id: "b", resolved_at: "2026-10-05T03:30:00Z" }, // 11:30 PM Oct 4 in New York
    { id: "c", resolved_at: "2026-10-06T03:30:00Z" }, // 11:30 PM Oct 5 in New York
    { id: "d", resolved_at: undefined },
  ];
  assert.deepEqual(finishedToday(items, NOW).map((item) => item.id), ["a", "c"]);
  assert.equal(isFinishedToday({ resolved_at: "garbage" }, NOW), false);
});

test("a Use button writes Granot's value only as an explicit copy: money drops $ and commas, a date becomes its New York day", () => {
  assert.equal(granotValueForInput("binder", "$1,978.40"), "1978.40");
  assert.equal(granotValueForInput("deposit", "$578"), "578");
  assert.equal(granotValueForInput("deposit", " 578.5 "), "578.50");
  assert.equal(granotValueForInput("binder", "call me"), undefined);
  assert.equal(granotValueForInput("binder", undefined), undefined);
  assert.equal(granotValueForInput("book_date", "2026-10-05T14:39:00Z"), "2026-10-05");
  assert.equal(granotValueForInput("book_date", "2026-10-06T02:00:00Z"), "2026-10-05");
  assert.equal(granotValueForInput("book_date", "2026-10-05"), "2026-10-05");
  assert.equal(granotValueForInput("book_date", ""), undefined);
});

test("the override reason must be 10 to 500 characters once trimmed", () => {
  assert.ok(overrideReasonProblem(""));
  assert.ok(overrideReasonProblem("too short"));
  assert.ok(overrideReasonProblem("   123456789   "));
  assert.equal(overrideReasonProblem("1234567890"), undefined);
  assert.equal(overrideReasonProblem("x".repeat(500)), undefined);
  assert.ok(overrideReasonProblem("x".repeat(501)));
});

test("the review line reads like the booking it files", () => {
  assert.equal(
    reviewLine({ customer: "Steve Dority", binder: 1978.4, deposit: 578, agents: ["Austin"], merchant: "Stripe" }),
    "Booking for Steve Dority · $1,978.40 binder · $578 deposit · Austin · Stripe",
  );
  assert.equal(
    reviewLine({ customer: null, jobNo: "5562365", leadless: true, binder: 2000, agents: ["Austin", "Sam"] }),
    "Booking for job 5562365 · no lead · $2,000 binder · Austin + Sam",
  );
  assert.equal(moneyText("$1,978.40"), "$1,978.40");
  assert.equal(moneyText(undefined), "");
  assert.equal(sheetLabel("create", true), "Sheet: Master Booked (with lead)");
  assert.equal(sheetLabel("create", false), "Sheet: Master Booked (leadless)");
});

test("the agent is suggested only when a Granot username matches an active agent; the merchant only while still active", () => {
  const agents = [
    { id: "a1", granot_crm_username: "AUSTIN", active: true },
    { id: "a2", granot_crm_username: "sam", active: false },
  ];
  assert.equal(suggestedAgentId(agents, "austin"), "a1");
  assert.equal(suggestedAgentId(agents, "sam"), undefined);
  assert.equal(suggestedAgentId(agents, undefined), undefined);
  assert.equal(suggestedAgentId(agents, "nobody"), undefined);
  assert.equal(rememberedMerchantId([{ id: "m1", active: true }], "m1"), "m1");
  assert.equal(rememberedMerchantId([{ id: "m1", active: false }], "m1"), undefined);
  assert.equal(rememberedMerchantId([{ id: "m1" }], ""), undefined);
});

test("the Form submitted ⇄ Granot chip says same or differs, and is absent without a Granot contact", () => {
  const lead = { model: "FormLead" as const, id: "l1" };
  assert.equal(contactSyncChip({ lead_ref: lead }), undefined);
  assert.deepEqual(contactSyncChip({ lead_ref: lead, known_contacts: { form_submitted: {}, granot: { differs_from_ingested: false } } }), { state: "ok", text: "Form submitted ⇄ Granot: same" });
  assert.deepEqual(contactSyncChip({ lead_ref: lead, known_contacts: { form_submitted: {}, granot: { differs_from_ingested: true } } }), { state: "warn", text: "Form submitted ⇄ Granot: differs" });
});

test("the URL contract is the case key only", () => {
  assert.deepEqual(parseToFinishUrl(new URLSearchParams("case=abc")), { caseId: "abc" });
  assert.deepEqual(parseToFinishUrl(new URLSearchParams("tab=cancellations&state=resolved")), { caseId: null });
  assert.deepEqual(parseToFinishUrl(new URLSearchParams("case=%20")), { caseId: null });
  assert.equal(TO_FINISH_COPY.title, "Bookings to finish");
});

test("the exact Granot message reads as labelled rows, never as JSON", () => {
  const rows = granotMessageRows({
    event_type: "Booked",
    job_no: "5562365",
    origin: { city: "Tucson", state: "AZ", zip: "" },
    tags: ["long distance", "priority"],
    password: "must-not-surface",
    estimatedCubicFeet: 540,
    empty: null,
  });
  assert.deepEqual(rows, [
    { label: "Event type", value: "Booked" },
    { label: "Job no", value: "5562365" },
    { label: "Origin · City", value: "Tucson" },
    { label: "Origin · State", value: "AZ" },
    { label: "Tags", value: "long distance, priority" },
    { label: "Estimated cubic feet", value: "540" },
  ]);
  assert.equal(humanizeKey("move_date_raw"), "Move date raw");
  const groups = granotReadingGroups({
    customer: { name: "Steve Dority", phone: "5205550142" },
    move: { from: "Tucson, AZ", to: "Sterling, VA" },
    money: { estimate: "1978.40" },
    whatGranotCalledIt: "Booked",
    granotPriority: "5",
  });
  assert.deepEqual(groups.map((group) => group.heading), ["Customer", "Move", "Money", "Granot details"]);
  assert.equal(groups[2]?.rows[0]?.value, "$1,978.40");
  const markup = renderToStaticMarkup(
    createElement(GranotMessage, { statement: { customer: {}, move: {}, money: {} }, raw: { event_type: "Booked", password: "x" } }),
  );
  assert.match(markup, /Every field Granot sent/);
  assert.match(markup, /Event type/);
  assert.doesNotMatch(markup, /<pre|[{}]|must-not-surface|<dt>Password/);
});
