import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchGranotJobTimeline,
  fetchGranotLeadTimeline,
  fetchGranotLifecycleCandidates,
  fetchGranotLifecycleCase,
  fetchGranotLifecycleCases,
  GranotLifecycleApiError,
} from "./granotLifecycle";

type FetchCall = { input: string | URL | Request; init?: RequestInit };

function mockFetch(data: unknown, status = 200) {
  const calls: FetchCall[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ input, init });
    return new Response(JSON.stringify(data), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return calls;
}

test("[AC-18][AC-20] case list sends every URL-backed filter and opaque cursor", async () => {
  const calls = mockFetch({ ok: true, data: { items: [], next_cursor: "next-opaque" } });
  const result = await fetchGranotLifecycleCases({
    kind: "release",
    state: "resolved",
    mode: "review_existing_booking",
    source_id: "aaaaaaaaaaaaaaaaaaaaaaaa",
    normalized_job_no: "SYNTHETIC JOB 1",
    opened_from: "2026-08-01T00:00:00.000Z",
    opened_to: "2026-08-18T23:59:59.999Z",
    sort: "opened_at",
    order: "asc",
    cursor: "opaque+/=cursor",
    limit: 50,
  });
  const url = new URL(String(calls[0]?.input), "https://admin.test");
  assert.equal(url.pathname, "/api/proxy/api/v1/admin/granot-lifecycle/cases");
  assert.equal(url.searchParams.get("kind"), "release");
  assert.equal(url.searchParams.get("state"), "resolved");
  assert.equal(url.searchParams.get("mode"), "review_existing_booking");
  assert.equal(url.searchParams.get("source_id"), "aaaaaaaaaaaaaaaaaaaaaaaa");
  assert.equal(url.searchParams.get("normalized_job_no"), "SYNTHETIC JOB 1");
  assert.equal(url.searchParams.get("opened_from"), "2026-08-01T00:00:00.000Z");
  assert.equal(url.searchParams.get("opened_to"), "2026-08-18T23:59:59.999Z");
  assert.equal(url.searchParams.get("sort"), "opened_at");
  assert.equal(url.searchParams.get("order"), "asc");
  assert.equal(url.searchParams.get("cursor"), "opaque+/=cursor");
  assert.equal(url.searchParams.get("limit"), "50");
  assert.equal(calls[0]?.init?.credentials, "include");
  assert.equal(result.next_cursor, "next-opaque");
});

test("[AC-35] case detail uses an encoded case identity through the authenticated proxy", async () => {
  const calls = mockFetch({ ok: true, data: { case_id: "case/one" } });
  await fetchGranotLifecycleCase("case/one");
  assert.equal(
    calls[0]?.input,
    "/api/proxy/api/v1/admin/granot-lifecycle/cases/case%2Fone",
  );
});

test("[AC-20] candidate search omits a whitespace query and preserves server paging", async () => {
  const calls = mockFetch({ ok: true, data: { items: [], next_cursor: null } });
  await fetchGranotLifecycleCandidates("case-1", {
    scope: "all",
    lead_model: "CallLead",
    q: "   ",
    cursor: "candidate-cursor",
    limit: 25,
  });
  const url = new URL(String(calls[0]?.input), "https://admin.test");
  assert.equal(url.pathname, "/api/proxy/api/v1/admin/granot-lifecycle/cases/case-1/candidates");
  assert.equal(url.searchParams.get("scope"), "all");
  assert.equal(url.searchParams.get("lead_model"), "CallLead");
  assert.equal(url.searchParams.has("q"), false);
  assert.equal(url.searchParams.get("cursor"), "candidate-cursor");
});

test("[AC-35] Job and Lead timelines encode identities and keep cursor pagination", async () => {
  let calls = mockFetch({ ok: true, data: { items: [], next_cursor: null, current: {}, capabilities: { booking_cases: true, release_cases: false, discrepancies: false, official_facts: true } } });
  await fetchGranotJobTimeline("SYNTHETIC / JOB", { cursor: "job-cursor", limit: 200 });
  assert.equal(calls[0]?.input, "/api/proxy/api/v1/admin/granot-lifecycle/jobs/SYNTHETIC%20%2F%20JOB?cursor=job-cursor&limit=200");

  calls = mockFetch({ ok: true, data: { items: [], next_cursor: null, current: {}, capabilities: { booking_cases: true, release_cases: false, discrepancies: false, official_facts: true } } });
  await fetchGranotLeadTimeline("FormLead", "lead/id", { limit: 100 });
  assert.equal(calls[0]?.input, "/api/proxy/api/v1/admin/leads/FormLead/lead%2Fid/lifecycle?limit=100");
});

test("safe proxy failures preserve status, stable code, request id, and issues", async () => {
  mockFetch({
    ok: false,
    error: "Invalid request",
    registry_code: "GRANOT_VALIDATION_FAILED",
    request_id: "req-synthetic",
    issues: [{ path: "limit", message: "too large" }],
  }, 400);
  await assert.rejects(
    () => fetchGranotLifecycleCases({ limit: 101 }),
    (error: unknown) => {
      assert.ok(error instanceof GranotLifecycleApiError);
      assert.equal(error.status, 400);
      assert.equal(error.code, "GRANOT_VALIDATION_FAILED");
      assert.equal(error.requestId, "req-synthetic");
      assert.deepEqual(error.issues, [{ path: "limit", message: "too large" }]);
      return true;
    },
  );
});

