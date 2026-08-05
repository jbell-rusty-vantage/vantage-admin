import assert from "node:assert/strict";
import test from "node:test";
import {
  getRelatedNavLinks,
  leadModelToEntityType,
  linkedContextHref,
  relatedRecordId,
} from "../components/operational/related-record-nav";

test("relatedRecordId accepts string ids and populated docs", () => {
  assert.equal(relatedRecordId("abc123"), "abc123");
  assert.equal(relatedRecordId({ _id: "abc123" }), "abc123");
  assert.equal(relatedRecordId({ id: "abc123" }), "abc123");
  assert.equal(relatedRecordId(null), null);
  assert.equal(relatedRecordId({}), null);
});

test("leadModelToEntityType maps FormLead and CallLead", () => {
  assert.equal(leadModelToEntityType("FormLead"), "form_lead");
  assert.equal(leadModelToEntityType("CallLead"), "call_lead");
  assert.equal(leadModelToEntityType("Customer"), null);
});

test("getRelatedNavLinks returns Lead → Booking", () => {
  assert.deepEqual(
    getRelatedNavLinks("form-leads", { booked: { _id: "booking1" } }),
    [{ href: "/bookings?record=booking1", label: "View booking" }],
  );
  assert.deepEqual(
    getRelatedNavLinks("call-leads", { booked: "booking2" }),
    [{ href: "/bookings?record=booking2", label: "View booking" }],
  );
  assert.deepEqual(getRelatedNavLinks("form-leads", {}), []);
});

test("getRelatedNavLinks returns Booking → Lead", () => {
  assert.deepEqual(
    getRelatedNavLinks("bookings", {
      lead_ref: { _id: "lead1" },
      lead_model: "FormLead",
    }),
    [{ href: "/form-leads?record=lead1", label: "View lead" }],
  );
  assert.deepEqual(
    getRelatedNavLinks("bookings", {
      lead_ref: "lead2",
      lead_model: "CallLead",
    }),
    [{ href: "/call-leads?record=lead2", label: "View lead" }],
  );
  assert.deepEqual(
    getRelatedNavLinks("bookings", {
      is_referral_booking: true,
    }),
    [],
  );
});

test("getRelatedNavLinks returns Cancellation → Booking", () => {
  assert.deepEqual(
    getRelatedNavLinks("cancellations", { booked_lead: { _id: "booking9" } }),
    [{ href: "/bookings?record=booking9", label: "View booking" }],
  );
});

test("linkedContextHref resolves relation keys for the side panel", () => {
  assert.equal(
    linkedContextHref("form-leads", "booked", { booked: "b1" }),
    "/bookings?record=b1",
  );
  assert.equal(
    linkedContextHref("bookings", "lead_ref", {
      lead_ref: "l1",
      lead_model: "FormLead",
    }),
    "/form-leads?record=l1",
  );
  assert.equal(
    linkedContextHref("cancellations", "booked_lead", { booked_lead: "b2" }),
    "/bookings?record=b2",
  );
  assert.equal(
    linkedContextHref("bookings", "cancelled", { cancelled: "c1" }),
    "/cancellations?record=c1",
  );
  assert.equal(linkedContextHref("bookings", "related_bookings", {}), null);
});
