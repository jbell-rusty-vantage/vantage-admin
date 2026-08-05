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
