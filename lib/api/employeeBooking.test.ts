import assert from "node:assert/strict";
import test from "node:test";
import {
  EmployeeBookingRequestError,
  employeeBookingSubmitBodySchema,
  employeeBookingSuccessSecondaryText,
  submitEmployeeBooking,
} from "./employeeBooking";

test("employee booking success copy matches public outcomes", () => {
  assert.equal(
    employeeBookingSuccessSecondaryText({
      outcome: "booked_and_linked",
      lead_connection: "connected",
    }),
    "Lead connected.",
  );
  assert.equal(
    employeeBookingSuccessSecondaryText({
      outcome: "booked_pending_lead",
      lead_connection: "pending",
    }),
    "Lead connection is pending owner review.",
  );
  assert.equal(
    employeeBookingSuccessSecondaryText({
      outcome: "duplicate_submission",
      lead_connection: "pending",
    }),
    "This submission was already received.",
  );
});

test("employee booking submit schema rejects unknown keys", () => {
  assert.throws(
    () =>
      employeeBookingSubmitBodySchema.parse({
        submission_id: "05db9651-8a3b-4743-bf35-e5a3ebae0f91",
        submission_nonce: "nonce",
        lead_source_company_id: "company-id",
        source_granularity_key: "granularity",
        agent: "Agent One",
        lead_name: "Casey Booker",
        binder_amount: 1000,
        deposit_amount: 250,
        merchant: "Merchant",
        phone_number: "2125550100",
        job_no: "JOB-100",
        unexpected: true,
      }),
    /Unrecognized key/,
  );
});

test("employee booking submit schema rejects blank required amounts", () => {
  const base = {
    submission_id: "05db9651-8a3b-4743-bf35-e5a3ebae0f91",
    submission_nonce: "nonce",
    lead_source_company_id: "company-id",
    source_granularity_key: "granularity",
    agent: "Agent One",
    lead_name: "Casey Booker",
    binder_amount: 1000,
    deposit_amount: 250,
    merchant: "Merchant",
    phone_number: "2125550100",
    job_no: "JOB-100",
  };

  assert.equal(
    employeeBookingSubmitBodySchema.safeParse({
      ...base,
      binder_amount: "",
    }).success,
    false,
  );
  assert.equal(
    employeeBookingSubmitBodySchema.safeParse({
      ...base,
      deposit_amount: "   ",
    }).success,
    false,
  );
});

test("employee booking submit schema reports blank money fields on the correct paths", () => {
  const base = {
    submission_id: "05db9651-8a3b-4743-bf35-e5a3ebae0f91",
    submission_nonce: "nonce",
    lead_source_company_id: "company-id",
    source_granularity_key: "granularity",
    agent: "Agent One",
    lead_name: "Casey Booker",
    binder_amount: 1000,
    deposit_amount: 250,
    merchant: "Merchant",
    phone_number: "2125550100",
    job_no: "JOB-100",
  };

  const result = employeeBookingSubmitBodySchema.safeParse({
    ...base,
    binder_amount: "",
    deposit_amount: "   ",
  });

  assert.equal(result.success, false);
  if (!result.success) {
    const fields = result.error.issues.map((issue) => issue.path.join("."));
    assert.ok(fields.includes("binder_amount"));
    assert.ok(fields.includes("deposit_amount"));
  }
});

test("employee booking submit preserves structured backend issues", async () => {
  const validBody = {
    submission_id: "05db9651-8a3b-4743-bf35-e5a3ebae0f91",
    submission_nonce: "nonce",
    lead_source_company_id: "company-id",
    source_granularity_key: "granularity",
    agent: "Agent One",
    lead_name: "Casey Booker",
    binder_amount: 1000,
    deposit_amount: 250,
    merchant: "Merchant",
    phone_number: "2125550100",
    job_no: "JOB-100",
  };
  const { restore } = stubFetch(
    new Response(
      JSON.stringify({
        ok: false,
        error: "Check the booking details and try again.",
        issues: [
          { field: "binder_amount", message: "Binder amount is required." },
          { field: 123, message: "ignore me" },
        ],
      }),
      {
        status: 400,
        headers: { "content-type": "application/json" },
      },
    ),
  );

  try {
    await assert.rejects(
      () => submitEmployeeBooking(validBody),
      (error: unknown) => {
        assert.ok(error instanceof EmployeeBookingRequestError);
        assert.equal(error.message, "Check the booking details and try again.");
        assert.deepEqual(error.issues, [
          { field: "binder_amount", message: "Binder amount is required." },
        ]);
        return true;
      },
    );
  } finally {
    restore();
  }
});

function stubFetch(response: Response) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => response) as typeof fetch;
  return {
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
}
