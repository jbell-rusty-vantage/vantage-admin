import assert from "node:assert/strict";
import test from "node:test";
import { applyUrlStateUpdate } from "../lib/api/url-state-update";
import { cancellationsUrlUpdate, CLEAR_ALL as CLEAR_ALL_CANCELLATIONS, activeCancellationFilters, parseCancellationsUrl } from "../components/cancellations/cancellations-url";

test("an empty cancellations URL is the defaults and every key parses", () => {
  const empty = parseCancellationsUrl(new URLSearchParams(""));
  assert.deepEqual({ sort: empty.sort, refund: empty.refund, record: empty.record }, { sort: "cancel_desc", refund: "any", record: null });
  const state = parseCancellationsUrl(
    new URLSearchParams("q=Lopez&reason=price_too_high&source=Top10&agent=Austin&merchant=Stripe&from=2026-09-01&to=2026-10-01&refund=no&by=Rusty&sort=refund_desc&record=c1&panel=summary"),
  );
  assert.deepEqual(
    { q: state.q, reason: state.reason, source: state.source, agent: state.agent, merchant: state.merchant, refund: state.refund, by: state.by, sort: state.sort, record: state.record },
    { q: "Lopez", reason: "price_too_high", source: "Top10", agent: "Austin", merchant: "Stripe", refund: "no", by: "Rusty", sort: "refund_desc", record: "c1" },
  );
  assert.equal(parseCancellationsUrl(new URLSearchParams("refund=zzz&sort=zzz")).refund, "any");
});

test("cancellations defaults serialise to a removed key, clear all keeps sort and record", () => {
  assert.equal(applyUrlStateUpdate("refund=yes&sort=cancel_asc", cancellationsUrlUpdate({ refund: "any", sort: "cancel_desc", by: "Rusty" })).toString(), "by=Rusty");
  assert.equal(
    applyUrlStateUpdate("q=x&reason=other&source=a&agent=b&merchant=c&from=1&to=2&refund=no&by=d&sort=refund_desc&record=9", cancellationsUrlUpdate(CLEAR_ALL_CANCELLATIONS)).toString(),
    "sort=refund_desc&record=9",
  );
});

test("cancellation chips use the Owner reason label", () => {
  const state = parseCancellationsUrl(new URLSearchParams("reason=booked_with_competitor&refund=yes&by=Rusty&from=2026-09-01"));
  const chips = activeCancellationFilters(state, { reason: () => "Booked with competitor" });
  assert.deepEqual(chips.map((chip) => chip.label), ["Booked with competitor", "Cancelled from 2026-09-01", "Refunded", "By Rusty"]);
});
