import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { redactPayload } from "./auditLog";
import {
  assertProxyAuditPayloadSafe,
  buildProxyAuditRequestPayload,
  collectForbiddenAuditFindings,
} from "./proxyAuditPayload";

const TEST_FINGERPRINT_KEY =
  "proxy-audit-fingerprint-test-key-32-characters";

Object.assign(process.env, {
  MONGODB_URI: "mongodb://127.0.0.1/vantage-admin-test",
  ADMIN_AUTH_DB_NAME: "vantage-admin-test",
  ADMIN_ACCESS_TOKEN_SECRET: TEST_FINGERPRINT_KEY,
  ADMIN_REFRESH_TOKEN_SECRET: "refresh-token-test-key-at-least-32-characters",
  VANTAGE_API_BASE_URL: "http://127.0.0.1:3001",
  VANTAGE_API_SECRET: "test-vantage-api-secret",
});

function expectedFingerprint(value: string): string {
  return createHmac("sha256", TEST_FINGERPRINT_KEY)
    .update("vantage-proxy-audit-fingerprint-v1\0", "utf8")
    .update(value, "utf8")
    .digest("hex");
}

const sensitiveReportingDraft = {
  name: "Customer PII export",
  description: "Contains customer names and phones",
  datasetKey: "lead_outcome_detail",
  strategy: "snapshot",
  destinationId: "507f1f77bcf86cd799439011",
  filters: { leadType: "form" },
  selectedColumns: [{ id: "customer_name", label: "Customer Name" }],
};

test("reporting run confirm audit keeps only allowlisted operation evidence", () => {
  const confirmationToken = "confirmation-token-must-not-persist";
  const idempotencyKey = "stable-idempotency-key";
  const payload = buildProxyAuditRequestPayload({
    method: "POST",
    path: "api/v1/admin/reporting/definitions/def-1/run",
    body: {
      revisionId: "507f1f77bcf86cd799439012",
      confirmationToken,
      idempotencyKey,
    },
  });

  assert.deepEqual(payload, {
    method: "POST",
    path: "api/v1/admin/reporting/definitions/def-1/run",
    operation: "reporting_run_confirm",
    definition_id: "def-1",
    revision_id: "507f1f77bcf86cd799439012",
    idempotency_key: {
      present: true,
      hash: expectedFingerprint(idempotencyKey),
    },
    confirmation_token_present: true,
  });

  const persisted = JSON.stringify(redactPayload(payload));
  assert.equal(persisted.includes(confirmationToken), false);
  assert.equal(persisted.includes(idempotencyKey), false);
  assertProxyAuditPayloadSafe(redactPayload(payload), [confirmationToken, idempotencyKey]);
});

test("[AC-32] Granot booking confirm audit excludes money, catalog IDs, and override prose", () => {
  const payload = buildProxyAuditRequestPayload({
    method: "POST",
    path: "api/v1/admin/granot-lifecycle/booking-cases/case-1/confirm-booking",
    body: {
      expected_case_revision: 4,
      selected_lead: { lead_model: "FormLead", lead_id: "lead-1" },
      out_of_scope_override_reason: "Sensitive correction prose must not persist",
      official_booking_details: {
        book_date: "2026-08-19", deposit_amount: 12.34, total_binder_amount: 50,
        merchant_id: "merchant-secret", agent_allocations: [{ agent_id: "agent-secret", binder_amount: 50 }],
      },
    },
  });
  assert.deepEqual(payload, {
    method: "POST",
    path: "api/v1/admin/granot-lifecycle/booking-cases/case-1/confirm-booking",
    operation: "granot_booking_confirm",
    case_id: "case-1",
    expected_case_revision: 4,
    selected_lead_model: "FormLead",
    selected_lead_id: "lead-1",
    allocation_count: 1,
    override_reason_present: true,
    official_details_present: true,
  });
  assertProxyAuditPayloadSafe(payload, ["Sensitive correction prose", "merchant-secret", "agent-secret"]);
});

test("[AC-24][AC-32] Granot update and No Action audits retain only bounded metadata", () => {
  const update = buildProxyAuditRequestPayload({
    method: "POST",
    path: "api/v1/admin/granot-lifecycle/booking-cases/case-1/update-booking",
    body: {
      expected_case_revision: 4,
      expected_booking_revision: 8,
      official_booking_details: {
        book_date: "2026-08-19", deposit_amount: 12.34, total_binder_amount: 50,
        merchant_id: "merchant-secret", agent_allocations: [{ agent_id: "agent-secret", binder_amount: 50 }],
      },
    },
  });
  assert.deepEqual(update, {
    method: "POST",
    path: "api/v1/admin/granot-lifecycle/booking-cases/case-1/update-booking",
    operation: "granot_booking_update",
    case_id: "case-1",
    expected_case_revision: 4,
    expected_booking_revision: 8,
    allocation_count: 1,
    official_details_present: true,
  });
  assertProxyAuditPayloadSafe(update, ["merchant-secret", "agent-secret", "12.34"]);

  const noAction = buildProxyAuditRequestPayload({
    method: "POST",
    path: "api/v1/admin/granot-lifecycle/booking-cases/case-1/no-action",
    body: { expected_case_revision: 4, reason_code: "other", reason_text: "Sensitive owner prose" },
  });
  assert.deepEqual(noAction, {
    method: "POST",
    path: "api/v1/admin/granot-lifecycle/booking-cases/case-1/no-action",
    operation: "granot_booking_no_action",
    case_id: "case-1",
    expected_case_revision: 4,
    reason_code: "other",
    reason_text_present: true,
  });
  assertProxyAuditPayloadSafe(noAction, ["Sensitive owner prose"]);
});

test("[AC-28] Referral create audit excludes contact, Job, money, and catalog IDs", () => {
  const payload = buildProxyAuditRequestPayload({
    method: "POST",
    path: "api/v1/admin/granot-lifecycle/booking-cases/case-1/create-referral-booking",
    body: {
      expected_case_revision: 4,
      official_booking_details: {
        book_date: "2026-08-19", deposit_amount: 12.34, total_binder_amount: 50,
        merchant_id: "merchant-secret", agent_allocations: [{ agent_id: "agent-secret", binder_amount: 50 }],
      },
    },
  });
  assert.deepEqual(payload, {
    method: "POST",
    path: "api/v1/admin/granot-lifecycle/booking-cases/case-1/create-referral-booking",
    operation: "granot_referral_booking_create",
    case_id: "case-1",
    expected_case_revision: 4,
    official_details_present: true,
  });
  assertProxyAuditPayloadSafe(payload, ["merchant-secret", "agent-secret", "12.34", "2026-08-19"]);
});

test("[AC-25][AC-32] Granot Release audits exclude official values and owner prose", () => {
  const cancellation = buildProxyAuditRequestPayload({
    method: "POST",
    path: "api/v1/admin/granot-lifecycle/release-cases/case-1/confirm-cancellation",
    body: { expected_case_revision: 4, expected_booking_revision: 8, official_cancellation_details: { cancel_date: "2026-08-19", refund_amount: 12.34, reason: "Sensitive reason", notes: "Sensitive notes", cancelled_by: "Sensitive actor" } },
  });
  assert.deepEqual(cancellation, {
    method: "POST", path: "api/v1/admin/granot-lifecycle/release-cases/case-1/confirm-cancellation",
    operation: "granot_release_confirm_cancellation", case_id: "case-1",
    expected_case_revision: 4, expected_booking_revision: 8, official_details_present: true,
  });
  assertProxyAuditPayloadSafe(cancellation, ["12.34", "Sensitive reason", "Sensitive notes", "Sensitive actor"]);

  const update = buildProxyAuditRequestPayload({
    method: "POST", path: "api/v1/admin/granot-lifecycle/release-cases/case-1/update-booking",
    body: { expected_case_revision: 4, expected_booking_revision: 8, official_booking_details: { merchant_id: "merchant-secret", agent_allocations: [{ agent_id: "agent-secret", binder_amount: 50 }] } },
  });
  assert.equal(update.operation, "granot_release_update_booking");
  assert.equal(update.allocation_count, 1);
  assertProxyAuditPayloadSafe(update, ["merchant-secret", "agent-secret"]);

  const noAction = buildProxyAuditRequestPayload({
    method: "POST", path: "api/v1/admin/granot-lifecycle/release-cases/case-1/no-action",
    body: { expected_case_revision: 4, reason_code: "other", reason_text: "Sensitive owner prose" },
  });
  assert.equal(noAction.operation, "granot_release_no_action");
  assert.equal(noAction.reason_text_present, true);
  assertProxyAuditPayloadSafe(noAction, ["Sensitive owner prose"]);
});

test("reporting preview and save audits exclude draft free text and PII-bearing fields", () => {
  const payloads = [
    buildProxyAuditRequestPayload({
      method: "POST",
      path: "api/v1/admin/reporting/draft/preview",
      body: sensitiveReportingDraft,
    }),
    buildProxyAuditRequestPayload({
      method: "POST",
      path: "api/v1/admin/reporting/definitions/def-1/revisions",
      body: {
        draft: sensitiveReportingDraft,
        previewId: "507f1f77bcf86cd799439013",
        previewChecksum: "a".repeat(64),
      },
    }),
  ];

  for (const payload of payloads) {
    assert.equal("body" in payload, false);
    assert.equal("draft" in payload, false);
    assert.equal("name" in payload, false);
    assert.equal("description" in payload, false);
    assert.equal("filters" in payload, false);
    assert.equal("selectedColumns" in payload, false);
    assertProxyAuditPayloadSafe(redactPayload(payload), [
      "Customer PII export",
      "customer_name",
      "Contains customer names",
    ]);
  }
});

test("google picker verify audit never persists nonce, token, display metadata, or raw file_id", () => {
  const selectionNonce = "picker-nonce-must-not-persist";
  const fileId = "1DistinctiveGoogleFileIdMustNotLeak999";
  const payload = buildProxyAuditRequestPayload({
    method: "POST",
    path: "api/v1/admin/google-drive/picker/selections/verify",
    body: {
      selection_nonce: selectionNonce,
      file_id: fileId,
      display_name: "Sensitive workbook title",
      display_url: "https://docs.google.com/spreadsheets/d/secret",
      parent_folder_id: "folder-parent",
    },
  });

  assert.deepEqual(payload, {
    method: "POST",
    path: "api/v1/admin/google-drive/picker/selections/verify",
    operation: "google_picker_selection_verify",
    file_id: {
      present: true,
      hash: expectedFingerprint(fileId),
      suffix: "***k999",
    },
    selection_nonce_present: true,
    parent_folder_id_present: true,
  });

  const persisted = JSON.stringify(redactPayload(payload));
  assert.equal(persisted.includes(fileId), false);
  assert.equal(persisted.includes(selectionNonce), false);
  assert.equal(persisted.includes("folder-parent"), false);
  assertProxyAuditPayloadSafe(redactPayload(payload), [
    selectionNonce,
    fileId,
    "Sensitive workbook title",
    "https://docs.google.com/spreadsheets/d/secret",
    "folder-parent",
  ]);
});

test("google picker bootstrap audit excludes access token fields", () => {
  const payload = buildProxyAuditRequestPayload({
    method: "POST",
    path: "api/v1/admin/google-drive/picker/bootstrap",
    body: { flow: "folder" },
  });

  assert.deepEqual(payload, {
    method: "POST",
    path: "api/v1/admin/google-drive/picker/bootstrap",
    operation: "google_picker_bootstrap",
    flow: "folder",
  });

  assertProxyAuditPayloadSafe(redactPayload(payload), ["ya29.access-token-example"]);
});

test("[AC-23][AC-35] discrepancy audit masks refs and omits Owner reason text", () => {
  const discrepancyId = "507f1f77bcf86cd799439011";
  const leadId = "507f1f77bcf86cd799439012";
  const reason = "Distinctive owner correction reason must not persist";
  const payload = buildProxyAuditRequestPayload({
    method: "POST",
    path: `api/v1/admin/granot-lifecycle/discrepancies/${discrepancyId}/correct-record-link`,
    body: { expected_revision: 2, expected_link_revision: 3, selected_lead: { lead_model: "FormLead", lead_id: leadId }, reason_text: reason },
  });
  const serialized = JSON.stringify(payload);
  assert.equal(serialized.includes(discrepancyId), false);
  assert.equal(serialized.includes(leadId), false);
  assert.equal(serialized.includes(reason), false);
  assert.equal(payload.path, "api/v1/admin/granot-lifecycle/discrepancies/:discrepancy/correct-record-link");
  assert.equal(payload.reason_present, true);
});

test("destination create audit uses presence flags instead of free-form names", () => {
  const payload = buildProxyAuditRequestPayload({
    method: "POST",
    path: "api/v1/admin/reporting/destinations",
    body: {
      strategy: "replace_tab",
      folder_selection_reference: "folder-ref-must-not-persist",
      create_workbook_name: "Executive Summary",
      managed_tab_name: "Report",
    },
  });

  assert.deepEqual(payload, {
    method: "POST",
    path: "api/v1/admin/reporting/destinations",
    operation: "reporting_destination_create",
    strategy: "replace_tab",
    folder_selection_reference_present: true,
    create_folder_name_present: false,
    workbook_selection_reference_present: false,
    create_workbook_name_present: true,
    managed_tab_name_present: true,
  });

  assertProxyAuditPayloadSafe(redactPayload(payload), [
    "folder-ref-must-not-persist",
    "Executive Summary",
    "Report",
  ]);
});

test("forbidden audit key scanner catches nested secret fields", () => {
  const findings = collectForbiddenAuditFindings(
    {
      method: "POST",
      body: {
        confirmationToken: "secret",
      },
    },
    ["secret"],
  );

  assert.ok(findings.some((finding) => finding.includes("confirmationToken")));
});

test("proxy audit stores pathname only and sanitizes sensitive query params", () => {
  const sensitiveSearch = "DistinctiveCustomerSearchTermMustNotPersist";
  const sensitivePhone = "555-DISTINCTIVE-PHONE";
  const sensitiveCustomerId = "507f1f77bcf86cd799439099";
  const payload = buildProxyAuditRequestPayload({
    method: "GET",
    path: `api/v1/admin/exports/observability/events.csv?database_scope=production&q=${encodeURIComponent(sensitiveSearch)}&lead_phone=${encodeURIComponent(sensitivePhone)}&customer_id=${sensitiveCustomerId}&level=error&unknown_filter=sensitive-value`,
    body: undefined,
  });

  assert.equal(payload.path, "api/v1/admin/exports/observability/events.csv");
  assert.equal(String(payload.path).includes("?"), false);
  assert.equal(payload.operation, "proxy_export");
  assert.deepEqual(payload.query, {
    database_scope: "production",
    q: {
      present: true,
      hash: expectedFingerprint(sensitiveSearch),
    },
    lead_phone: {
      present: true,
      hash: expectedFingerprint(sensitivePhone),
    },
    customer_id: {
      present: true,
      hash: expectedFingerprint(sensitiveCustomerId),
    },
    level: "error",
    unknown_filter_present: true,
  });

  const persisted = JSON.stringify(redactPayload(payload));
  assert.equal(persisted.includes(sensitiveSearch), false);
  assert.equal(persisted.includes(sensitivePhone), false);
  assert.equal(persisted.includes(sensitiveCustomerId), false);
  assert.equal(persisted.includes("sensitive-value"), false);
  assertProxyAuditPayloadSafe(redactPayload(payload), [
    sensitiveSearch,
    sensitivePhone,
    sensitiveCustomerId,
    "sensitive-value",
  ]);
});

test("operation resource extraction ignores query strings on audited mutation paths", () => {
  const payload = buildProxyAuditRequestPayload({
    method: "POST",
    path: "api/v1/admin/reporting/definitions/def-with-query/run?database_scope=production",
    body: {
      revisionId: "507f1f77bcf86cd799439012",
      idempotencyKey: "prepare-key-12345678",
    },
  });

  assert.equal(payload.path, "api/v1/admin/reporting/definitions/def-with-query/run");
  assert.equal(payload.definition_id, "def-with-query");
  assert.deepEqual(payload.query, { database_scope: "production" });
});

test("Granot create audit labels operation without persisting exact source labels or filters", () => {
  const payload = buildProxyAuditRequestPayload({
    method: "POST",
    path: "api/v1/admin/granot-automation/runs",
    body: {
      operation: "form_leads",
      workflow: "apply",
      from: "08/01/2026",
      to: "08/05/2026",
      source_labels: ["Distinctive Source Label", "Partner Two"],
      filters: { department: "555-sensitive" },
    },
  });

  assert.deepEqual(payload, {
    method: "POST",
    path: "api/v1/admin/granot-automation/runs",
    operation: "granot_run_create",
    granot_operation: "form_leads",
    workflow: "apply",
    from: "08/01/2026",
    to: "08/05/2026",
    source_label_count: 2,
    source_id_count: 0,
    filters_present: true,
  });
  assertProxyAuditPayloadSafe(payload, ["Distinctive Source Label", "555-sensitive"]);
});

test("Granot single-run source-ID audit stores only the source count", () => {
  const payload = buildProxyAuditRequestPayload({
    method: "POST",
    path: "api/v1/admin/granot-automation/runs",
    body: {
      operation: "form_leads",
      workflow: "preview",
      from: "08/01/2026",
      to: "08/05/2026",
      source_ids: ["sensitive-source-id"],
    },
  });

  assert.equal(payload.source_label_count, 0);
  assert.equal(payload.source_id_count, 1);
  assertProxyAuditPayloadSafe(payload, ["sensitive-source-id"]);
});

test("Granot run-group audit records workflow counts without source identities", () => {
  const payload = buildProxyAuditRequestPayload({
    method: "POST",
    path: "api/v1/admin/granot-automation/run-groups",
    body: {
      operations: ["form_leads", "call_leads"],
      workflow: "apply",
      from: "08/01/2026",
      to: "08/05/2026",
      source_ids: ["sensitive-source-id-1", "sensitive-source-id-2"],
      filters: { department: "sensitive-department" },
    },
  });

  assert.deepEqual(payload, {
    method: "POST",
    path: "api/v1/admin/granot-automation/run-groups",
    operation: "granot_run_group_create",
    granot_operations: ["form_leads", "call_leads"],
    workflow: "apply",
    from: "08/01/2026",
    to: "08/05/2026",
    source_id_count: 2,
    filters_present: true,
  });
  assertProxyAuditPayloadSafe(payload, [
    "sensitive-source-id-1",
    "sensitive-department",
  ]);
});

test("Granot approval audit fingerprints checksum and stores only selected action count", () => {
  const checksum = "granot-plan-checksum-must-not-persist";
  const payload = buildProxyAuditRequestPayload({
    method: "POST",
    path: "api/v1/admin/granot-automation/runs/run-1/approve",
    body: {
      plan_checksum: checksum,
      selected_action_ids: ["action-sensitive-1", "action-sensitive-2"],
    },
  });

  assert.deepEqual(payload, {
    method: "POST",
    path: "api/v1/admin/granot-automation/runs/run-1/approve",
    operation: "granot_run_approve",
    run_id: "run-1",
    plan_checksum: {
      present: true,
      hash: expectedFingerprint(checksum),
    },
    action_count: 2,
  });
  assertProxyAuditPayloadSafe(payload, [
    checksum,
    "action-sensitive-1",
    "action-sensitive-2",
  ]);
});
