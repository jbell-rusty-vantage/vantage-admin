import assert from "node:assert/strict";
import test from "node:test";
import {
  entityHref,
  exclusiveEndDate,
  humanizeKey,
  pickApiFilters,
} from "../components/observational/entity-link";

test("entityHref maps business entities to their list pages with preselection", () => {
  assert.equal(entityHref("form_lead", "abc123"), "/form-leads?record=abc123");
  assert.equal(entityHref("call_lead", "abc"), "/call-leads?record=abc");
  assert.equal(entityHref("booked_lead", "abc"), "/bookings?record=abc");
  assert.equal(entityHref("cancelled_lead", "abc"), "/cancellations?record=abc");
  assert.equal(entityHref("customer", "abc"), "/customers?record=abc");
  assert.equal(entityHref("sheet_sync_job", "abc"), "/observational?tab=sheet-sync&job_id=abc");
});

test("entityHref returns null for unknown or incomplete entities", () => {
  assert.equal(entityHref("unknown_type", "abc"), null);
  assert.equal(entityHref("form_lead", null), null);
  assert.equal(entityHref(undefined, "abc"), null);
});

test("entityHref URL-encodes the record id", () => {
  assert.equal(entityHref("form_lead", "a/b c"), "/form-leads?record=a%2Fb%20c");
});

test("humanizeKey turns identifiers into readable labels", () => {
  assert.equal(humanizeKey("sheet_sync.drain.failed"), "Sheet Sync Drain Failed");
  assert.equal(humanizeKey("booking"), "Booking");
  assert.equal(humanizeKey(null), "-");
});

test("exclusiveEndDate advances date-only inputs by one day", () => {
  assert.equal(exclusiveEndDate("2026-06-12"), "2026-06-13");
  assert.equal(exclusiveEndDate("2026-12-31"), "2027-01-01");
  assert.equal(exclusiveEndDate("2026-06-12T15:30:00.000Z"), "2026-06-12T15:30:00.000Z");
  assert.equal(exclusiveEndDate(undefined), undefined);
});

test("pickApiFilters keeps only listed keys and adjusts the to-date", () => {
  const picked = pickApiFilters(
    {
      level: "error",
      to: "2026-06-12",
      tab: "events",
      record: "abc",
      q: "",
      lead_name: "smith",
    },
    ["level", "to", "q", "lead_name"],
  );

  assert.deepEqual(picked, {
    level: "error",
    to: "2026-06-13",
    lead_name: "smith",
  });
});
