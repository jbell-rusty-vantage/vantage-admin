import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchGranotJobTimeline,
  fetchGranotLeadTimeline,
  fetchGranotLifecycleCandidates,
  fetchGranotLifecycleCase,
  fetchGranotLifecycleCases,
  confirmGranotBooking,
  createGranotReferralBooking,
  updateGranotBooking,
  resolveGranotBookingNoAction,
  confirmGranotCancellation,
  updateGranotReleaseBooking,
  resolveGranotReleaseNoAction,
  GranotLifecycleApiError,
  fetchGranotLifecycleDiscrepancies,
  fetchGranotLifecycleDiscrepancy,
  reEvaluateGranotDiscrepancy,
  correctGranotRecordLink,
  resolveGranotDiscrepancyNoAction,
  asGranotLifecycleHealth,
  fetchGranotLifecycleHealth,
  GRANOT_LIFECYCLE_FLAG_NAMES,
} from "./granotLifecycle";

test("[AC-23][AC-35][AC-36] discrepancy reads and commands use exact encoded proxy paths", async () => {
  let calls = mockFetch({ ok: true, data: { items: [], next_cursor: null } });
  await fetchGranotLifecycleDiscrepancies({ kind: "release", state: "open", reason_code: "release_record_link_conflict" });
  assert.equal(new URL(String(calls[0]?.input), "https://admin.test").pathname, "/api/proxy/api/v1/admin/granot-lifecycle/discrepancies");

  calls = mockFetch({ ok: true, data: { discrepancy_id: "d/1" } });
  await fetchGranotLifecycleDiscrepancy("d/1");
  assert.equal(calls[0]?.input, "/api/proxy/api/v1/admin/granot-lifecycle/discrepancies/d%2F1");

  const success = { ok: true, data: { discrepancy_id: "d/1", discrepancy_kind: "booking", state: "open", revision: 1, evidence_revision: 1, outcome: "still_conflicting", command_execution_id: "command", replayed: false } };
  for (const [action, invoke] of [
    ["re-evaluate", () => reEvaluateGranotDiscrepancy("d/1", { expected_revision: 1 }, "unit29-key")],
    ["correct-record-link", () => correctGranotRecordLink("d/1", { expected_revision: 1, expected_link_revision: 2, selected_lead: { lead_model: "FormLead", lead_id: "a".repeat(24) }, reason_text: "Owner reviewed correction" }, "unit29-key")],
    ["no-action", () => resolveGranotDiscrepancyNoAction("d/1", { expected_revision: 1 }, "unit29-key")],
  ] as const) {
    calls = mockFetch(success);
    await invoke();
    assert.equal(calls[0]?.input, `/api/proxy/api/v1/admin/granot-lifecycle/discrepancies/d%2F1/${action}`);
    assert.equal(new Headers(calls[0]?.init?.headers).get("idempotency-key"), "unit29-key");
  }
});

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

test("[AC-21][AC-22] confirm uses the authenticated proxy and forwards one idempotency key", async () => {
  const calls = mockFetch({ ok: true, data: {
    case_id: "case-1", case_state: "resolved", case_revision: 2,
    outcome: "booking_created", command_execution_id: "command-1", decision_id: "decision-1",
    booking_ref: { id: "booking-1", domain_revision: 1 },
    record_link_ref: { id: "link-1", domain_revision: 1 }, entity_refs: [], replayed: false,
  } }, 201);
  const body = {
    expected_case_revision: 1,
    selected_lead: { lead_model: "FormLead" as const, lead_id: "aaaaaaaaaaaaaaaaaaaaaaaa" },
    official_booking_details: {
      book_date: "2026-08-19",
      agent_allocations: [{ agent_id: "bbbbbbbbbbbbbbbbbbbbbbbb", binder_amount: 10 }],
      total_binder_amount: 10,
      deposit_amount: 5,
      merchant_id: "cccccccccccccccccccccccc",
    },
  };
  const result = await confirmGranotBooking("case/one", body, "unit24-key");
  assert.equal(calls[0]?.input, "/api/proxy/api/v1/admin/granot-lifecycle/booking-cases/case%2Fone/confirm-booking");
  assert.equal(calls[0]?.init?.method, "POST");
  assert.equal(new Headers(calls[0]?.init?.headers).get("idempotency-key"), "unit24-key");
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), body);
  assert.equal(result.booking_ref?.id, "booking-1");
});

test("[AC-21][AC-24][AC-32] update and No Action use only their exact authenticated proxy paths", async () => {
  let calls = mockFetch({ ok: true, data: {
    case_id: "case-1", case_state: "resolved", case_revision: 2,
    outcome: "booking_updated", command_execution_id: "command-1", decision_id: "decision-1",
    booking_ref: { id: "booking-1", domain_revision: 2 }, entity_refs: [], replayed: false,
  } });
  const updateBody = {
    expected_case_revision: 1,
    expected_booking_revision: 1,
    official_booking_details: {
      book_date: "2026-08-19",
      agent_allocations: [{ agent_id: "b".repeat(24), binder_amount: 10 }],
      total_binder_amount: 10,
      deposit_amount: 5,
      merchant_id: "c".repeat(24),
    },
  };
  await updateGranotBooking("case/one", updateBody, "unit25-update-key");
  assert.equal(calls[0]?.input, "/api/proxy/api/v1/admin/granot-lifecycle/booking-cases/case%2Fone/update-booking");
  assert.equal(new Headers(calls[0]?.init?.headers).get("idempotency-key"), "unit25-update-key");
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), updateBody);

  calls = mockFetch({ ok: true, data: {
    case_id: "case-1", case_state: "resolved", case_revision: 2,
    outcome: "no_action", command_execution_id: "command-2", decision_id: "decision-1",
    entity_refs: [], replayed: false,
  } });
  const noActionBody = { expected_case_revision: 1, reason_code: "other" as const };
  await resolveGranotBookingNoAction("case/one", noActionBody, "unit25-no-action-key");
  assert.equal(calls[0]?.input, "/api/proxy/api/v1/admin/granot-lifecycle/booking-cases/case%2Fone/no-action");
  assert.equal(new Headers(calls[0]?.init?.headers).get("idempotency-key"), "unit25-no-action-key");
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), noActionBody);
});

test("[AC-28] Referral create sends only official details through the exact proxy path", async () => {
  const calls = mockFetch({ ok: true, data: {
    case_id: "case-1", case_state: "resolved", case_revision: 2,
    outcome: "referral_booking_created", command_execution_id: "command-1", decision_id: "decision-1",
    booking_ref: { id: "booking-1", domain_revision: 1 },
    record_link_ref: { id: "link-1", domain_revision: 1 }, entity_refs: [], replayed: false,
  } }, 201);
  const body = {
    expected_case_revision: 1,
    official_booking_details: {
      book_date: "2026-08-19",
      agent_allocations: [{ agent_id: "b".repeat(24), binder_amount: 10 }],
      total_binder_amount: 10,
      deposit_amount: 5,
      merchant_id: "c".repeat(24),
    },
  };
  await createGranotReferralBooking("case/one", body, "unit28-referral-key");
  assert.equal(calls[0]?.input, "/api/proxy/api/v1/admin/granot-lifecycle/booking-cases/case%2Fone/create-referral-booking");
  assert.equal(new Headers(calls[0]?.init?.headers).get("idempotency-key"), "unit28-referral-key");
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), body);
});

test("[AC-21][AC-25][AC-32] Release commands use exact proxy paths, bodies, and idempotency keys", async () => {
  const response = { ok: true, data: {
    case_id: "case-1", case_state: "resolved", case_revision: 2,
    outcome: "cancellation_created", command_execution_id: "command-1", decision_id: "decision-1",
    booking_ref: { id: "booking-1", domain_revision: 2 },
    cancellation_ref: { id: "cancellation-1", domain_revision: 1 }, entity_refs: [], replayed: false,
  } };
  let calls = mockFetch(response, 201);
  const cancellationBody = {
    expected_case_revision: 1,
    expected_booking_revision: 1,
    official_cancellation_details: { cancel_date: "2026-08-19", refund_amount: 12.34, reason: "Synthetic reason" },
  };
  await confirmGranotCancellation("case/one", cancellationBody, "unit27-cancel-key");
  assert.equal(calls[0]?.input, "/api/proxy/api/v1/admin/granot-lifecycle/release-cases/case%2Fone/confirm-cancellation");
  assert.equal(new Headers(calls[0]?.init?.headers).get("idempotency-key"), "unit27-cancel-key");
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), cancellationBody);

  calls = mockFetch(response);
  const updateBody = {
    expected_case_revision: 1, expected_booking_revision: 1,
    official_booking_details: { book_date: "2026-08-19", agent_allocations: [{ agent_id: "b".repeat(24), binder_amount: 10 }], total_binder_amount: 10, deposit_amount: 5, merchant_id: "c".repeat(24) },
  };
  await updateGranotReleaseBooking("case/one", updateBody, "unit27-update-key");
  assert.equal(calls[0]?.input, "/api/proxy/api/v1/admin/granot-lifecycle/release-cases/case%2Fone/update-booking");
  assert.equal(new Headers(calls[0]?.init?.headers).get("idempotency-key"), "unit27-update-key");

  calls = mockFetch(response);
  await resolveGranotReleaseNoAction("case/one", { expected_case_revision: 1, reason_code: "other" }, "unit27-no-action-key");
  assert.equal(calls[0]?.input, "/api/proxy/api/v1/admin/granot-lifecycle/release-cases/case%2Fone/no-action");
  assert.equal(new Headers(calls[0]?.init?.headers).get("idempotency-key"), "unit27-no-action-key");
});

test("case list unwraps a nested proxy envelope and missing items without throwing", async () => {
  mockFetch({
    ok: true,
    data: { ok: true, data: { next_cursor: null } },
  });
  const nested = await fetchGranotLifecycleCases();
  assert.deepEqual(nested, { items: [], next_cursor: null });

  mockFetch({
    ok: true,
    data: { cases: [{ case_id: "case-1" }], next_cursor: "cursor-1" },
  });
  const aliased = await fetchGranotLifecycleCases();
  assert.deepEqual(aliased.items, [{ case_id: "case-1" }]);
  assert.equal(aliased.next_cursor, "cursor-1");
});

test("case detail unwraps a nested envelope and defaults official_current", async () => {
  mockFetch({
    ok: true,
    data: { ok: true, data: { case_id: "case-1" } },
  });
  const result = await fetchGranotLifecycleCase("case-1");
  assert.equal(result.case_id, "case-1");
  assert.deepEqual(result.official_current, {});
  assert.deepEqual(result.evidence, []);
});

test("case detail fails closed when the proxy body has no case_id", async () => {
  mockFetch({ ok: true, data: { ok: true } });
  await assert.rejects(
    () => fetchGranotLifecycleCase("6a85348abb59311027d5660b"),
    (error: unknown) => {
      assert.ok(error instanceof GranotLifecycleApiError);
      assert.equal(error.status, 502);
      assert.equal(error.code, "GRANOT_CASE_PROJECTION_MISSING");
      return true;
    },
  );
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

test("[AC-31][AC-35] health client uses the exact GET path and ignores raw payload keys", async () => {
  const calls = mockFetch({
    ok: true,
    data: {
      generated_at: "2026-08-19T16:00:00.000Z",
      flags: Object.fromEntries(GRANOT_LIFECYCLE_FLAG_NAMES.map((name) => [name, name === "GRANOT_LIFECYCLE_SHADOW_MODE"])),
      activation: { present: true, id: "aaaaaa...bbbb", activated_at: "2026-08-19T12:00:00.000Z", processor_version: "unit-30" },
      receipts: { due_count: 2, dead_letter_count: 1, oldest_due_age_ms: 1000, claimed_count: 0, expired_claim_count: 0, by_work_state: { pending: 2 } },
      decisions_last_24h: [{ execution_mode: "historical_shadow", outcome: "already_current", reason_code: "desired_state_already_current", count: 3 }],
      open_cases: [{ kind: "booking", mode: "create_missing_booking", count: 1 }],
      open_discrepancies: [],
      command_conflicts_last_24h: [],
      record_links: { active: 0, disputed: 0 },
      last_queue_run: null,
      last_cron_run: null,
      ringcentral: { state_present: false, last_run_at: null, last_run_status: null, cursor_to: null, lease: { held: false, acquired_at: null, expires_at: null, age_ms: null, expired: false }, last_runtime_ms: null, last_adopted_count: null, last_adoption_conflict_count: null, last_throttled_count: null },
      alerts: [{ code: "dead_letter_present", state: "firing", observed_value: 1, threshold: 0, unit: "count" }],
      payload: { email: "owner@example.invalid" },
    },
  });
  const health = await fetchGranotLifecycleHealth();
  assert.equal(calls[0]?.input, "/api/proxy/api/v1/admin/granot-lifecycle/operations/health");
  assert.equal(calls[0]?.init?.method ?? "GET", "GET");
  assert.equal(health.flags.GRANOT_LIFECYCLE_SHADOW_MODE, true);
  assert.equal(health.flags.GRANOT_LIFECYCLE_BOOKING_COMMANDS_ENABLED, false);
  assert.equal(health.decisions_last_24h[0]?.execution_mode, "historical_shadow");
  assert.equal(health.alerts[0]?.state, "firing");
  assert.equal("payload" in health, false);
  assert.throws(
    () => asGranotLifecycleHealth({ ok: true, data: { generated_at: "2026-08-19T16:00:00.000Z" } }),
    /malformed/,
  );
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
