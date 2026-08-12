import assert from "node:assert/strict";
import test from "node:test";
import {
  approveGranotRun,
  createGranotAutomationSource,
  createGranotRun,
  createGranotRunGroup,
  fetchGranotAutomationSources,
  fetchGranotRun,
  fetchGranotRuns,
  GranotAutomationApiError,
  normalizeGranotRun,
  toGranotApiDate,
} from "./granotAutomation";

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

test("create formats the Granot run request through the authenticated proxy", async () => {
  const calls = mockFetch({ ok: true, data: { run_id: "run-1", status: "queued" } }, 202);

  const result = await createGranotRun({
    from: "2026-08-01",
    to: "2026-08-05",
    operation: "form_leads",
    workflow: "apply",
    source_labels: ["Google", "MoveBuddha"],
  });

  assert.equal(result.run_id, "run-1");
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.input, "/api/proxy/api/v1/admin/granot-automation/runs");
  assert.equal(calls[0]?.init?.method, "POST");
  assert.equal(calls[0]?.init?.credentials, "include");
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
    operation: "form_leads",
    workflow: "apply",
    from: "08/01/2026",
    to: "08/05/2026",
    source_labels: ["Google", "MoveBuddha"],
  });
});

test("Granot source catalog lists and creates exact labels through the proxy", async () => {
  let calls = mockFetch({
    ok: true,
    data: [
      {
        id: "source-1",
        label: "TBM Forms",
        active: true,
        supported_operations: ["form_leads"],
        created_from: "seed",
      },
    ],
  });
  const sources = await fetchGranotAutomationSources();
  assert.equal(calls[0]?.input, "/api/proxy/api/v1/admin/granot-automation/runs/sources");
  assert.equal(sources[0]?.label, "TBM Forms");

  calls = mockFetch({
    ok: true,
    data: {
      id: "source-2",
      label: "New Exact Label",
      active: true,
      supported_operations: ["form_leads", "call_leads"],
      created_from: "admin",
    },
  }, 201);
  const created = await createGranotAutomationSource({
    label: "New Exact Label",
    supported_operations: ["form_leads", "call_leads"],
  });
  assert.equal(calls[0]?.input, "/api/proxy/api/v1/admin/granot-automation/runs/sources");
  assert.equal(calls[0]?.init?.method, "POST");
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
    label: "New Exact Label",
    supported_operations: ["form_leads", "call_leads"],
  });
  assert.equal(created.label, "New Exact Label");
  assert.deepEqual(created.supported_operations, ["form_leads", "call_leads"]);
});

test("run group creation submits both workflows in one request", async () => {
  const calls = mockFetch({
    ok: true,
    data: {
      run_group_id: "group-1",
      runs: [
        {
          run_id: "run-form",
          operation: "form_leads",
          source_labels: ["TBM Forms"],
        },
        {
          run_id: "run-call",
          operation: "call_leads",
          source_labels: ["10best Inbounds"],
        },
      ],
    },
  }, 202);
  const result = await createGranotRunGroup({
    from: "2026-08-01",
    to: "2026-08-05",
    operations: ["form_leads", "call_leads"],
    workflow: "apply",
    source_ids: ["source-form", "source-call"],
  });
  assert.equal(
    calls[0]?.input,
    "/api/proxy/api/v1/admin/granot-automation/run-groups",
  );
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
    operations: ["form_leads", "call_leads"],
    workflow: "apply",
    from: "08/01/2026",
    to: "08/05/2026",
    source_ids: ["source-form", "source-call"],
  });
  assert.equal(result.run_group_id, "group-1");
  assert.equal(result.runs.length, 2);
});

test("detail requests owner fields and normalizes the server safeRun payload", async () => {
  let calls = mockFetch({
    ok: true,
    data: [{ id: "run-2", operation: "form_leads", workflow: "apply", status: "queued" }],
  });
  const runs = await fetchGranotRuns();
  assert.equal(runs[0]?.run_id, "run-2");
  assert.equal(runs[0]?.operation, "form_leads");
  assert.equal(runs[0]?.workflow, "apply");

  calls = mockFetch({
    ok: true,
    data: {
      id: "507f1f77bcf86cd799439011",
      operation: "form_leads",
      workflow: "apply",
      status: "awaiting_approval",
      plan_checksum: "a".repeat(64),
      expires_at: "2026-08-06T00:00:00.000Z",
      counters: { update: 1, conflict: 1 },
      collection: {
        requestedDateWindow: { from: "08/01/2026", to: "08/05/2026" },
        discoveredSourceLabels: ["Google"],
        notObservedSourceLabels: ["MoveBuddha"],
        sources: [
          {
            sourceLabel: "Google",
            contentHash: "source-hash",
            bookedJobs: 2,
            followUpEstimates: 3,
          },
        ],
      },
      checkpoint: {
        phase: "planned",
        completed_units: 2,
        updated_at: "2026-08-05T12:00:00.000Z",
      },
      receipt_count: 1,
      plan: {
        kind: "form_leads",
        schema_version: 1,
        counters: { update: 1, conflict: 1 },
        actions: [
          {
            action_id: "Google:row-1",
            row_id: "row-1",
            source_label: "Google",
            classification: "update",
            match_method: "ref_no_exact",
            lead_id: "lead-1",
            warnings: ["Exact ref matched a different source_company."],
          },
          {
            action_id: "Google:row-2",
            row_id: "row-2",
            source_label: "Google",
            classification: "conflict",
            reason: "ambiguous_fallback",
          },
        ],
      },
      receipts: [
        {
          action_id: "Google:row-1",
          outcome: "applied",
          applied_at: "2026-08-05T12:05:00.000Z",
        },
      ],
    },
  });
  const detail = await fetchGranotRun("507f1f77bcf86cd799439011");
  assert.equal(
    calls[0]?.input,
    "/api/proxy/api/v1/admin/granot-automation/runs/507f1f77bcf86cd799439011?details=owner",
  );
  assert.equal(detail.from, "08/01/2026");
  assert.equal(detail.to, "08/05/2026");
  assert.deepEqual(detail.operation_status_counts, { update: 1, conflict: 1 });
  assert.deepEqual(detail.collection_summaries?.[0], {
    source_label: "Google",
    content_hash: "source-hash",
    booked_jobs: 2,
    follow_up_estimates: 3,
    row_count: 5,
  });
  assert.equal(detail.actions?.[0]?.syncable, true);
  assert.equal(detail.actions?.[0]?.match_method, "ref_no_exact");
  assert.deepEqual(detail.actions?.[0]?.warnings, [
    "Exact ref matched a different source_company.",
  ]);
  assert.equal(detail.actions?.[1]?.syncable, false);
  assert.equal(detail.conflicts?.[0]?.conflict_id, "Google:row-2");
  assert.equal(detail.receipts?.[0]?.status, "applied");
  assert.equal(detail.checkpoint?.completed_units, 2);
});

test("approve sends selected_action_ids and returns the server acknowledgment", async () => {
  const calls = mockFetch({
    ok: true,
    data: {
      approved: true,
      local_worker: { claimed: true, run_id: "run-3", status: "completed" },
    },
  }, 202);
  const result = await approveGranotRun({
    runId: "run-3",
    plan_checksum: "checksum-3",
    selected_action_ids: ["a-1", "a-2"],
  });
  assert.equal(
    calls[0]?.input,
    "/api/proxy/api/v1/admin/granot-automation/runs/run-3/approve",
  );
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
    plan_checksum: "checksum-3",
    selected_action_ids: ["a-1", "a-2"],
  });
  assert.equal(result.run_id, "run-3");
  assert.equal(result.approved, true);
  assert.equal(result.local_worker?.status, "completed");
});

test("409 response preserves status for stale-plan UX", async () => {
  mockFetch({ ok: false, error: "Plan checksum changed.", request_id: "req-1" }, 409);
  await assert.rejects(
    () =>
      approveGranotRun({
        runId: "run-4",
        plan_checksum: "stale",
        selected_action_ids: ["a-1"],
      }),
    (error: unknown) => {
      assert.ok(error instanceof GranotAutomationApiError);
      assert.equal(error.status, 409);
      assert.equal(error.requestId, "req-1");
      return true;
    },
  );
});

test("source duplicate response preserves its stable error code", async () => {
  mockFetch({
    ok: false,
    code: "GRANOT_SOURCE_ALREADY_EXISTS",
    error: "Granot automation source already exists: TBM Forms",
  }, 409);
  await assert.rejects(
    () =>
      createGranotAutomationSource({
        label: "TBM Forms",
        supported_operations: ["form_leads"],
      }),
    (error: unknown) => {
      assert.ok(error instanceof GranotAutomationApiError);
      assert.equal(error.code, "GRANOT_SOURCE_ALREADY_EXISTS");
      return true;
    },
  );
});

test("normalizer tolerates a minimal create response", () => {
  assert.deepEqual(normalizeGranotRun({ run_id: "run-5", status: "queued" }), {
    run_id: "run-5",
    run_group_id: undefined,
    status: "queued",
    operation: undefined,
    workflow: undefined,
    from: undefined,
    to: undefined,
    plan_checksum: null,
    expires_at: undefined,
    collection: undefined,
    collection_summaries: undefined,
    operation_status_counts: undefined,
    actions: undefined,
    conflicts: undefined,
    receipts: undefined,
    receipt_count: 0,
    checkpoint: undefined,
    created_at: undefined,
    updated_at: undefined,
  });
});

test("date adapter converts browser dates to the Granot route format", () => {
  assert.equal(toGranotApiDate("2026-12-09"), "12/09/2026");
  assert.throws(() => toGranotApiDate("12/09/2026"), /YYYY-MM-DD/);
});

test("call-plan preview statuses drive syncability and conflict rows", () => {
  const run = normalizeGranotRun({
    id: "run-call",
    operation: "call_leads",
    workflow: "apply",
    status: "awaiting_approval",
    receipt_count: 0,
    plan: {
      kind: "call_leads",
      actions: [
        {
          action_id: "enrichment:row-1",
          operation: "enrichment",
          row: { row_id: "row-1", source_label: "Google" },
          preview: { status: "updateable", message: "Ready" },
        },
        {
          action_id: "enrichment:row-2",
          operation: "enrichment",
          row: { row_id: "row-2", source_label: "Google" },
          preview: { status: "conflict", message: "Ambiguous match" },
        },
      ],
    },
  });

  assert.equal(run.actions?.[0]?.syncable, true);
  assert.equal(run.actions?.[1]?.syncable, false);
  assert.equal(run.conflicts?.[0]?.conflict_id, "enrichment:row-2");
  assert.equal(run.conflicts?.[0]?.summary, "Ambiguous match");
});

test("server-provided action eligibility overrides inferred preview status", () => {
  const run = normalizeGranotRun({
    id: "run-authoritative-syncability",
    status: "awaiting_approval",
    receipt_count: 0,
    plan: {
      actions: [
        {
          action_id: "blocked-update",
          syncable: false,
          preview: { status: "updateable" },
        },
        {
          action_id: "allowed-conflict",
          syncable: true,
          preview: { status: "conflict" },
        },
      ],
    },
  });

  assert.equal(run.actions?.[0]?.syncable, false);
  assert.equal(run.actions?.[1]?.syncable, true);
});
