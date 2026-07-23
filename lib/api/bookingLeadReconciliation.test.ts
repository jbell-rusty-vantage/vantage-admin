// Tests for: booking lead reconciliation API — revision payload forwarding
import assert from "node:assert/strict";
import test from "node:test";
import {
  BookingLeadReconciliationApiError,
  evaluateBookingLeadCandidateActionability,
  fetchBookingLeadReconciliationCases,
  refreshBookingLeadCandidates,
  searchBookingLeadCandidates,
  isStaleBookingLeadReconciliationError,
} from "./bookingLeadReconciliation";

test("refreshBookingLeadCandidates sends the current revision to the backend", async () => {
  const { calls, restore } = stubFetch(
    new Response(JSON.stringify({ ok: true, data: { id: "case-1", revision: 7 } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );

  try {
    await refreshBookingLeadCandidates("case-1", 12);
  } finally {
    restore();
  }

  assert.equal(calls.length, 1);
  assert.equal(
    calls[0]?.url,
    "/api/proxy/api/v1/admin/booking-lead-reconciliations/case-1/candidates/refresh",
  );
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), { revision: 12 });
  assert.equal(calls[0]?.init?.method, "POST");
});

test("queue request forwards cursor and ObjectId source-company filters", async () => {
  const { calls, restore } = stubFetch(
    new Response(
      JSON.stringify({
        ok: true,
        data: { items: [], page: 1, limit: 25, next_cursor: "next-page" },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    ),
  );

  try {
    const result = await fetchBookingLeadReconciliationCases({
      lead_source_company: "507f1f77bcf86cd799439011",
      cursor: "current-page",
      limit: 25,
    });
    assert.equal(result.next_cursor, "next-page");
  } finally {
    restore();
  }

  const url = new URL(calls[0]?.url ?? "", "https://admin.test");
  assert.equal(url.searchParams.get("lead_source_company"), "507f1f77bcf86cd799439011");
  assert.equal(url.searchParams.get("cursor"), "current-page");
  assert.equal(url.searchParams.has("source_company"), false);
});

test("candidate search URL is isolated to the supplied case id", async () => {
  const { calls, restore } = stubFetch(
    new Response(JSON.stringify({ ok: true, data: { items: [], page: 1, limit: 25 } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );

  try {
    await searchBookingLeadCandidates("case/A", { q: "Smith", limit: 25 });
  } finally {
    restore();
  }

  assert.equal(
    calls[0]?.url,
    "/api/proxy/api/v1/admin/booking-lead-reconciliations/case%2FA/candidates/search",
  );
});

test("reconciliation API errors preserve HTTP status for stale-revision recovery", async () => {
  const { restore } = stubFetch(
    new Response(JSON.stringify({ ok: false, error: "Revision is stale." }), {
      status: 409,
      headers: { "content-type": "application/json" },
    }),
  );

  try {
    await assert.rejects(
      refreshBookingLeadCandidates("case-1", 3),
      (error: unknown) =>
        error instanceof BookingLeadReconciliationApiError &&
        error.status === 409 &&
        error.message === "Revision is stale.",
    );
  } finally {
    restore();
  }
});

test("candidate actionability hard-blocks booked, cancelled, and unknown warnings", () => {
  assert.deepEqual(
    evaluateBookingLeadCandidateActionability({
      eligibility: "booked",
      warnings: ["duplicate_lead", "lead_already_booked"],
    }),
    {
      canAct: false,
      overrideableWarnings: ["duplicate_lead"],
      hardBlockReasons: ["lead_already_booked"],
    },
  );
  assert.equal(
    evaluateBookingLeadCandidateActionability({
      cancelled: true,
      warnings: ["unexpected_server_warning"],
    }).canAct,
    false,
  );
});

test("candidate actionability exposes only exact overrideable warning codes", () => {
  assert.deepEqual(
    evaluateBookingLeadCandidateActionability({
      eligibility: "duplicate",
      warnings: ["source_conflict", "lead_cancelled"],
    }),
    {
      canAct: false,
      overrideableWarnings: ["source_conflict", "duplicate_lead"],
      hardBlockReasons: ["lead_cancelled"],
    },
  );
  assert.deepEqual(
    evaluateBookingLeadCandidateActionability({
      duplicate: true,
      warnings: ["source_unassigned"],
    }),
    {
      canAct: true,
      overrideableWarnings: ["source_unassigned", "duplicate_lead"],
      hardBlockReasons: [],
    },
  );
});

test("stale recovery identifies only stale revision conflicts", () => {
  assert.equal(
    isStaleBookingLeadReconciliationError(
      new BookingLeadReconciliationApiError(
        "Booking lead reconciliation case is stale",
        409,
      ),
    ),
    true,
  );
  assert.equal(
    isStaleBookingLeadReconciliationError(
      new BookingLeadReconciliationApiError(
        "source_resolution is required for source conflicts",
        409,
      ),
    ),
    false,
  );
});

function stubFetch(response: Response) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return response;
  }) as typeof fetch;
  return {
    calls,
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
}
