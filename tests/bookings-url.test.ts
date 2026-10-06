import assert from "node:assert/strict";
import test from "node:test";
import { applyUrlStateUpdate } from "../lib/api/url-state-update";
import { activeBookingFilters, bookingsUrlUpdate, CLEAR_ALL, parseBookingsUrl } from "../components/bookings/bookings-url";

test("an empty bookings URL is the defaults", () => {
  const state = parseBookingsUrl(new URLSearchParams(""));
  assert.equal(state.status, "active");
  assert.equal(state.sort, "book_desc");
  assert.equal(state.type, "any");
  assert.equal(state.binder, "any");
  assert.equal(state.record, null);
  assert.equal(state.connect, false);
});

test("every documented bookings key parses", () => {
  const state = parseBookingsUrl(
    new URLSearchParams("q=Dority&status=cancelled&source=Top10%20Inbounds&agent=Austin&merchant=Stripe&from=2026-10-01&to=2026-10-05&type=referral&local=local&binder=4k&sort=binder_desc&record=abc&panel=cancellation&connect=1"),
  );
  assert.deepEqual(
    { q: state.q, status: state.status, source: state.source, agent: state.agent, merchant: state.merchant, from: state.from, to: state.to },
    { q: "Dority", status: "cancelled", source: "Top10 Inbounds", agent: "Austin", merchant: "Stripe", from: "2026-10-01", to: "2026-10-05" },
  );
  assert.deepEqual({ type: state.type, local: state.local, binder: state.binder, sort: state.sort }, { type: "referral", local: "local", binder: "4k", sort: "binder_desc" });
  assert.deepEqual({ record: state.record, panel: state.panel, connect: state.connect }, { record: "abc", panel: "cancellation", connect: true });
});

test("unknown bookings values fall back to the defaults", () => {
  const state = parseBookingsUrl(new URLSearchParams("status=zzz&type=zzz&binder=9k&sort=zzz"));
  assert.equal(state.status, "active");
  assert.equal(state.type, "any");
  assert.equal(state.binder, "any");
  assert.equal(state.sort, "book_desc");
});

test("bookings defaults serialise to a removed key and the rest round-trips", () => {
  const next = applyUrlStateUpdate(
    "status=cancelled&type=leadless&binder=2k&sort=book_asc&q=x",
    bookingsUrlUpdate({ status: "active", type: "any", binder: "any", sort: "book_desc", source: "Top10", connect: false }),
  ).toString();
  assert.equal(next, "q=x&source=Top10");
  const back = parseBookingsUrl(new URLSearchParams(applyUrlStateUpdate("", bookingsUrlUpdate({ status: "all", type: "lead", binder: "4k", sort: "binder_desc", record: "r", panel: "production" })).toString()));
  assert.deepEqual({ status: back.status, type: back.type, binder: back.binder, sort: back.sort, record: back.record, panel: back.panel }, { status: "all", type: "lead", binder: "4k", sort: "binder_desc", record: "r", panel: "production" });
});

test("bookings clear all removes the filters but keeps sort and the open record", () => {
  const next = applyUrlStateUpdate(
    "q=x&status=all&source=a&agent=b&merchant=c&from=2026-10-01&type=lead&local=local&binder=2k&sort=book_asc&record=1&panel=summary",
    bookingsUrlUpdate(CLEAR_ALL),
  ).toString();
  assert.equal(next, "sort=book_asc&record=1&panel=summary");
});

test("bookings chips: Active is the default and shows none; the rest read in Owner words", () => {
  assert.deepEqual(activeBookingFilters(parseBookingsUrl(new URLSearchParams(""))), []);
  const state = parseBookingsUrl(new URLSearchParams("status=all&source=Top10%20Inbounds&agent=Austin&merchant=Stripe&from=2026-10-01&to=2026-10-05&type=leadless&local=long_distance&binder=2k"));
  const chips = activeBookingFilters(state, { source: () => "Top10 Inbounds (calls)", local: () => "Long Distance" });
  assert.deepEqual(
    chips.map((chip) => chip.label),
    ["Active and cancelled", "Top10 Inbounds (calls)", "Austin", "Stripe", "Booked 2026-10-01 to 2026-10-05", "Leadless", "Long Distance", "Binder over $2k"],
  );
  assert.deepEqual(chips[0]?.clear, { status: "active" });
});
