import assert from "node:assert/strict";
import test from "node:test";
import { recordHref } from "../components/operational/record-href";

test("recordHref opens the owning official list with the record preselected", () => {
  assert.equal(recordHref("form_lead", "abc123"), "/form-leads?record=abc123");
  assert.equal(recordHref("call_lead", "abc"), "/call-leads?record=abc");
  assert.equal(recordHref("booked_lead", "abc"), "/bookings?record=abc");
  assert.equal(recordHref("cancelled_lead", "abc"), "/cancellations?record=abc");
});

test("recordHref returns null for incomplete input and URL-encodes the id", () => {
  assert.equal(recordHref("form_lead", null), null);
  assert.equal(recordHref(undefined, "abc"), null);
  assert.equal(recordHref("form_lead", "a/b c"), "/form-leads?record=a%2Fb%20c");
});
