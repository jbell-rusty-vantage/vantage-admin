import assert from "node:assert/strict";
import test from "node:test";
import { leadHref, recordHref } from "../components/operational/record-href";

test("recordHref opens the owning workspace with the record's panel open", () => {
  assert.equal(recordHref("form_lead", "abc123"), "/leads?lead=abc123&lk=form");
  assert.equal(recordHref("call_lead", "abc"), "/leads?lead=abc&lk=call");
  assert.equal(recordHref("booked_lead", "abc"), "/bookings?record=abc");
  assert.equal(recordHref("cancelled_lead", "abc"), "/bookings/cancellations?record=abc");
});

test("recordHref returns null for incomplete input and URL-encodes the id", () => {
  assert.equal(recordHref("form_lead", null), null);
  assert.equal(recordHref(undefined, "abc"), null);
  assert.equal(recordHref("form_lead", "a/b c"), "/leads?lead=a%2Fb+c&lk=form");
  assert.equal(recordHref("booked_lead", "a/b c"), "/bookings?record=a%2Fb%20c");
});

test("leadHref carries the Duplicates chip and a panel tab", () => {
  assert.equal(leadHref("form", "x", { duplicate: true }), "/leads?lead=x&lk=form&show=duplicates");
  assert.equal(leadHref("call", "x", { panel: "message" }), "/leads?lead=x&lk=call&panel=message");
});
