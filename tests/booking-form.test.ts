import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { getBookingQuery } from "../components/operational/operational-actions";
import {
  BOOKING_FORM_COPY,
  preciseBookingReconciliationHref,
} from "../components/forms/booking-form-copy";
import {
  getPreciseBookingFormMissingFields,
  readOwnerCreateReconciliationCaseId,
} from "../components/forms/booking-form-fields";

const forbiddenOwnerWords = ["owner_booking", "is_leadless_booking", "created_on_unmatched"];

const ownerVisibleCopy = [
  BOOKING_FORM_COPY.pageTitle,
  BOOKING_FORM_COPY.pageHint,
  BOOKING_FORM_COPY.leadSourceHint,
  BOOKING_FORM_COPY.callPhoneHint,
  BOOKING_FORM_COPY.successLinked,
  BOOKING_FORM_COPY.successReferral,
  BOOKING_FORM_COPY.successPending,
  BOOKING_FORM_COPY.openReconciliation,
].join(" ");

test("Precise Booking Form copy never prints internal field names", () => {
  for (const word of forbiddenOwnerWords) {
    assert.equal(ownerVisibleCopy.includes(word), false, word);
  }
  assert.match(BOOKING_FORM_COPY.successPending, /Booking Reconciliation/);
  assert.match(BOOKING_FORM_COPY.successPending, /keep the booking without a lead/);
  assert.match(BOOKING_FORM_COPY.callPhoneHint, /Booking Reconciliation/);
});

test("Call Lead submit without phone is allowed when job is present", () => {
  const missing = getPreciseBookingFormMissingFields({
    bookDate: "2026-09-08",
    agent: "Ada",
    merchant: "Stripe",
    binderAmount: "100",
    depositAmount: "50",
    jobNo: "JOB-1",
    customerName: "",
    sourceCompany: "",
    formLeadId: "",
    mode: "source",
    leadType: "CallLead",
  });
  assert.deepEqual(missing, []);
});

test("Call Lead still requires job number", () => {
  const missing = getPreciseBookingFormMissingFields({
    bookDate: "2026-09-08",
    agent: "Ada",
    merchant: "Stripe",
    binderAmount: "100",
    depositAmount: "50",
    jobNo: "",
    customerName: "",
    sourceCompany: "",
    formLeadId: "",
    mode: "source",
    leadType: "CallLead",
  });
  assert.deepEqual(missing, ["job number"]);
});

test("pending success href uses the unwrapped reconciliation_case_id", () => {
  assert.equal(
    readOwnerCreateReconciliationCaseId({
      booking: { job_no: "JOB-1" },
      reconciliation_case_id: "case-abc",
    }),
    "case-abc",
  );
  assert.equal(
    readOwnerCreateReconciliationCaseId({
      ok: true,
      data: { reconciliation_case_id: "nested" },
    }),
    undefined,
  );
  assert.equal(
    preciseBookingReconciliationHref("case-abc"),
    "/bookings/reconciliation?case=case-abc",
  );
});

test("Call desk Book this lead passes phone and job when present", () => {
  const withJob = getBookingQuery("call-leads", {
    phone_number: "5551234567",
    job_no: "JOB-99",
  });
  const params = new URLSearchParams(withJob);
  assert.equal(params.get("lead_type"), "CallLead");
  assert.equal(params.get("call_phone_number"), "5551234567");
  assert.equal(params.get("call_job_no"), "JOB-99");

  const phoneOnly = new URLSearchParams(
    getBookingQuery("call-leads", { phone_number: "5551234567" }),
  );
  assert.equal(phoneOnly.get("call_phone_number"), "5551234567");
  assert.equal(phoneOnly.get("call_job_no"), null);
});

test("Precise Booking Form keeps Call phone optional in the markup", () => {
  const form = readFileSync(path.join(process.cwd(), "components/forms/booking-form.tsx"), "utf8");
  assert.match(form, /name="call_phone_number"/);
  assert.doesNotMatch(
    form,
    /name="call_phone_number"[^>]*required/,
  );
  assert.match(form, /BOOKING_FORM_COPY\.callPhoneHint/);
  assert.match(form, /readOwnerCreateReconciliationCaseId/);
  assert.match(form, /preciseBookingReconciliationHref/);
  assert.doesNotMatch(form, /call lead phone number/);
});
