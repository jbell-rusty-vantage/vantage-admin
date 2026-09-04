import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBookingReconciliationHref,
  nextSelectedBookingReconciliationCaseId,
  readBookingReconciliationCaseId,
} from "./queueSelection";

test("readBookingReconciliationCaseId prefers case over record", () => {
  const params = new URLSearchParams("case=employee-case-1&record=other-case");
  assert.equal(readBookingReconciliationCaseId(params), "employee-case-1");
});

test("readBookingReconciliationCaseId accepts the bookings-style record param", () => {
  const params = new URLSearchParams("record=employee-case-1");
  assert.equal(readBookingReconciliationCaseId(params), "employee-case-1");
});

test("nextSelectedBookingReconciliationCaseId keeps a deep-linked case outside the queue", () => {
  assert.equal(
    nextSelectedBookingReconciliationCaseId({
      requestedCaseId: "linked-case",
      selectedCaseId: "",
      firstQueueId: "first-pending",
    }),
    "linked-case",
  );
});

test("nextSelectedBookingReconciliationCaseId auto-selects the first queue item only when nothing is selected", () => {
  assert.equal(
    nextSelectedBookingReconciliationCaseId({
      requestedCaseId: "",
      selectedCaseId: "",
      firstQueueId: "first-pending",
    }),
    "first-pending",
  );
  assert.equal(
    nextSelectedBookingReconciliationCaseId({
      requestedCaseId: "",
      selectedCaseId: "already-open",
      firstQueueId: "first-pending",
    }),
    "already-open",
  );
});

test("buildBookingReconciliationHref writes the case query used by Granot intakes", () => {
  assert.equal(buildBookingReconciliationHref(), "/bookings/reconciliation");
  assert.equal(
    buildBookingReconciliationHref("employee-case-1"),
    "/bookings/reconciliation?case=employee-case-1",
  );
});
