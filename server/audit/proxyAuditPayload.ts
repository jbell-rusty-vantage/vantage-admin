import { createHmac } from "node:crypto";
import { getServerEnv } from "@/lib/env/server";
import type { VantageApiMethod } from "@/server/vantage-api/client";
import { redactPayload } from "@/server/audit/auditLog";

const REPORTING_PREFIX = "/api/v1/admin/reporting";
const GOOGLE_DRIVE_PREFIX = "/api/v1/admin/google-drive";

const FORBIDDEN_AUDIT_KEYS = new Set([
  "confirmationToken",
  "confirmation_token",
  "selection_nonce",
  "selectionNonce",
  "selection_reference",
  "selectionReference",
  "access_token",
  "accessToken",
  "authorization_url",
  "authorizationUrl",
  "refresh_token",
  "refreshToken",
  "client_secret",
  "clientSecret",
  "code",
  "state",
  "draft",
  "sampleRows",
  "sample_rows",
  "filters",
  "selectedColumns",
  "selected_columns",
  "preview_token",
  "previewToken",
  "display_name",
  "displayName",
  "display_url",
  "displayUrl",
  "name",
  "description",
  "title",
  "managed_tab_name",
  "managedTabName",
  "create_folder_name",
  "createFolderName",
  "create_workbook_name",
  "createWorkbookName",
  "folder_selection_reference",
  "folderSelectionReference",
  "workbook_selection_reference",
  "workbookSelectionReference",
]);

export function normalizeProxyAuditPath(path: string): string {
  const withoutQuery = path.split("?")[0] ?? "";
  return withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
}

export function proxyAuditPathname(path: string): string {
  const withoutQuery = path.split("?")[0] ?? "";
  return withoutQuery.startsWith("/") ? withoutQuery.slice(1) : withoutQuery;
}

function parseProxyAuditQuery(path: string): URLSearchParams {
  const queryIndex = path.indexOf("?");
  if (queryIndex === -1) {
    return new URLSearchParams();
  }
  return new URLSearchParams(path.slice(queryIndex + 1));
}

function normalizeQueryKey(key: string): string {
  return key.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "");
}

const LITERAL_QUERY_PARAMS = new Set([
  "database_scope",
  "page",
  "limit",
  "skip",
  "sort",
  "direction",
  "from",
  "to",
  "date_field",
  "level",
  "status",
  "severity",
  "category",
  "tab",
  "view",
  "action",
  "entity_type",
  "strategy",
  "include_inactive",
  "cascade",
  "empty",
  "flow",
]);

const FINGERPRINT_QUERY_PARAM_PATTERN =
  /(?:^|_)(?:id|ids|q|query|search|phone|email|name|token|secret|nonce|code|state|reference)$/i;

function isSafeLiteralQueryValue(key: string, value: string): boolean {
  switch (key) {
    case "database_scope":
      return value === "production" || value === "historical" || value === "combined";
    case "include_inactive":
    case "cascade":
      return value === "true" || value === "false";
    case "page":
    case "limit":
    case "skip":
      return /^\d+$/.test(value);
    case "from":
    case "to":
      return /^\d{4}-\d{2}-\d{2}$/.test(value);
    case "direction":
      return value === "asc" || value === "desc";
    default:
      return /^[\w.-]{1,64}$/.test(value);
  }
}

function sanitizeQueryParam(key: string, value: string): Record<string, unknown> {
  const normalizedKey = normalizeQueryKey(key);

  if (FINGERPRINT_QUERY_PARAM_PATTERN.test(normalizedKey)) {
    return { [normalizedKey]: secretFingerprint(value) };
  }

  if (LITERAL_QUERY_PARAMS.has(normalizedKey) && isSafeLiteralQueryValue(normalizedKey, value)) {
    return { [normalizedKey]: value };
  }

  return { [`${normalizedKey}_present`]: true };
}

function sanitizeProxyAuditQuery(path: string): Record<string, unknown> | undefined {
  const params = parseProxyAuditQuery(path);
  const keys = [...new Set([...params.keys()].map(normalizeQueryKey))];
  if (keys.length === 0) {
    return undefined;
  }

  const sanitized: Record<string, unknown> = {};
  for (const key of keys) {
    const rawKey = [...params.keys()].find((candidate) => normalizeQueryKey(candidate) === key);
    if (!rawKey) {
      continue;
    }
    const values = params.getAll(rawKey);
    const primary = values[0];
    if (!primary) {
      continue;
    }
    Object.assign(sanitized, sanitizeQueryParam(key, primary));
    if (values.length > 1) {
      sanitized[`${key}_count`] = values.length;
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

function hashStable(value: string): string {
  return createHmac("sha256", getServerEnv().ADMIN_ACCESS_TOKEN_SECRET)
    .update("vantage-proxy-audit-fingerprint-v1\0", "utf8")
    .update(value, "utf8")
    .digest("hex");
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "";
}

function secretFingerprint(value: unknown): { present: true; hash: string } | undefined {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }
  return { present: true, hash: hashStable(value) };
}

function externalResourceFingerprint(
  value: unknown,
): { present: true; hash: string; suffix: string } | undefined {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }
  const trimmed = value.trim();
  return {
    present: true,
    hash: hashStable(trimmed),
    suffix: trimmed.length <= 4 ? "***" : `***${trimmed.slice(-4)}`,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function pathSegment(path: string, segment: string): string | undefined {
  const parts = normalizeProxyAuditPath(path).split("/").filter(Boolean);
  const index = parts.indexOf(segment);
  if (index === -1 || index + 1 >= parts.length) {
    return undefined;
  }
  return parts[index + 1];
}

function draftAuditMeta(body: Record<string, unknown>) {
  const draft = asRecord(body.draft ?? body);
  return {
    dataset_key: readString(draft.datasetKey ?? draft.dataset_key),
    strategy: readString(draft.strategy),
    destination_id: readString(draft.destinationId ?? draft.destination_id),
  };
}

function sanitizeReportingAuditBody(
  method: VantageApiMethod,
  path: string,
  body: unknown,
): Record<string, unknown> {
  const normalized = normalizeProxyAuditPath(path);
  const record = asRecord(body);

  if (normalized.endsWith("/draft/preview") || /\/definitions\/[^/]+\/preview$/.test(normalized)) {
    return {
      operation: "reporting_preview",
      definition_id: pathSegment(path, "definitions"),
      ...draftAuditMeta(record.draft ? { draft: record.draft } : record),
    };
  }

  if (normalized.endsWith("/definitions") && method === "POST") {
    return {
      operation: "reporting_definition_create",
      ...draftAuditMeta(record),
      preview_id_present: hasValue(record.previewId ?? record.preview_id),
      preview_checksum_present: hasValue(record.previewChecksum ?? record.preview_checksum),
    };
  }

  if (/\/definitions\/[^/]+\/revisions$/.test(normalized) && method === "POST") {
    return {
      operation: "reporting_revision_create",
      definition_id: pathSegment(path, "definitions"),
      ...draftAuditMeta(record),
      preview_id_present: hasValue(record.previewId ?? record.preview_id),
      preview_checksum_present: hasValue(record.previewChecksum ?? record.preview_checksum),
    };
  }

  if (/\/definitions\/[^/]+\/run$/.test(normalized) && method === "POST") {
    const confirmation = record.confirmationToken ?? record.confirmation_token;
    return {
      operation: confirmation ? "reporting_run_confirm" : "reporting_run_prepare",
      definition_id: pathSegment(path, "definitions"),
      revision_id: readString(record.revisionId ?? record.revision_id),
      idempotency_key: secretFingerprint(record.idempotencyKey ?? record.idempotency_key),
      confirmation_token_present: hasValue(confirmation),
    };
  }

  if (/\/definitions\/[^/]+\/clone$/.test(normalized) && method === "POST") {
    return {
      operation: "reporting_definition_clone",
      definition_id: pathSegment(path, "definitions"),
    };
  }

  if (/\/definitions\/[^/]+$/.test(normalized) && method === "DELETE") {
    return {
      operation: "reporting_definition_archive",
      definition_id: pathSegment(path, "definitions"),
    };
  }

  if (normalized.endsWith("/destinations") && method === "POST") {
    return {
      operation: "reporting_destination_create",
      strategy: record.strategy,
      folder_selection_reference_present: hasValue(
        record.folder_selection_reference ?? record.folderSelectionReference,
      ),
      create_folder_name_present: hasValue(record.create_folder_name ?? record.createFolderName),
      workbook_selection_reference_present: hasValue(
        record.workbook_selection_reference ?? record.workbookSelectionReference,
      ),
      create_workbook_name_present: hasValue(
        record.create_workbook_name ?? record.createWorkbookName,
      ),
      managed_tab_name_present: hasValue(record.managed_tab_name ?? record.managedTabName),
    };
  }

  if (/\/destinations\/[^/]+\/verify$/.test(normalized) && method === "POST") {
    return {
      operation: "reporting_destination_verify",
      destination_id: pathSegment(path, "destinations"),
    };
  }

  if (/\/destinations\/[^/]+$/.test(normalized) && method === "PATCH") {
    return {
      operation: "reporting_destination_update",
      destination_id: pathSegment(path, "destinations"),
      expected_version: record.expected_version ?? record.expectedVersion,
      managed_tab_name_present: hasValue(record.managed_tab_name ?? record.managedTabName),
    };
  }

  if (/\/destinations\/[^/]+$/.test(normalized) && method === "DELETE") {
    return {
      operation: "reporting_destination_archive",
      destination_id: pathSegment(path, "destinations"),
      expected_version: record.expected_version ?? record.expectedVersion,
    };
  }

  if (/\/runs\/[^/]+\/cancel$/.test(normalized) && method === "POST") {
    return {
      operation: "reporting_run_cancel",
      run_id: pathSegment(path, "runs"),
      idempotency_key: secretFingerprint(record.idempotencyKey ?? record.idempotency_key),
    };
  }

  return {
    operation: "reporting_mutation",
    path: proxyAuditPathname(path),
  };
}

function sanitizeGoogleDriveAuditBody(
  method: VantageApiMethod,
  path: string,
  body: unknown,
): Record<string, unknown> {
  const normalized = normalizeProxyAuditPath(path);
  const record = asRecord(body);

  if (normalized.endsWith("/oauth/authorize") && method === "POST") {
    return { operation: "google_oauth_authorize" };
  }

  if (normalized.endsWith("/connection") && method === "DELETE") {
    return { operation: "google_oauth_disconnect" };
  }

  if (normalized.endsWith("/picker/bootstrap") && method === "POST") {
    return {
      operation: "google_picker_bootstrap",
      flow: record.flow,
    };
  }

  if (normalized.endsWith("/picker/selections/verify") && method === "POST") {
    return {
      operation: "google_picker_selection_verify",
      file_id: externalResourceFingerprint(record.file_id ?? record.fileId),
      selection_nonce_present: hasValue(record.selection_nonce ?? record.selectionNonce),
      parent_folder_id_present: hasValue(record.parent_folder_id ?? record.parentFolderId),
    };
  }

  if (normalized.endsWith("/folders") && method === "POST") {
    return {
      operation: "google_drive_folder_create",
      name_present: hasValue(record.name),
      parent_folder_id_present: hasValue(record.parent_folder_id ?? record.parentFolderId),
    };
  }

  if (normalized.endsWith("/test-spreadsheet") && method === "POST") {
    return {
      operation: "google_drive_test_spreadsheet_create",
      title_present: hasValue(record.title),
      folder_id_present: hasValue(record.folder_id ?? record.folderId),
    };
  }

  return {
    operation: "google_drive_mutation",
    path: proxyAuditPathname(path),
  };
}

function sanitizeGenericProxyAuditBody(
  method: VantageApiMethod,
  path: string,
  body: unknown,
): Record<string, unknown> {
  const normalized = normalizeProxyAuditPath(path);

  if (
    method === "GET" &&
    (normalized.includes("/exports/") || normalized.endsWith(".csv"))
  ) {
    return { operation: "proxy_export" };
  }

  return {
    operation: "proxy_mutation",
    ...(body !== undefined ? { body: redactPayload(body) } : {}),
  };
}

export function buildProxyAuditRequestPayload(input: {
  method: VantageApiMethod;
  path: string;
  body: unknown;
}): Record<string, unknown> {
  const normalized = normalizeProxyAuditPath(input.path);
  const pathname = proxyAuditPathname(input.path);
  const query = sanitizeProxyAuditQuery(input.path);
  const base = {
    method: input.method,
    path: pathname,
    ...(query ? { query } : {}),
  };

  if (normalized === REPORTING_PREFIX || normalized.startsWith(`${REPORTING_PREFIX}/`)) {
    return {
      ...base,
      ...sanitizeReportingAuditBody(input.method, input.path, input.body),
    };
  }

  if (normalized === GOOGLE_DRIVE_PREFIX || normalized.startsWith(`${GOOGLE_DRIVE_PREFIX}/`)) {
    return {
      ...base,
      ...sanitizeGoogleDriveAuditBody(input.method, input.path, input.body),
    };
  }

  return {
    ...base,
    ...sanitizeGenericProxyAuditBody(input.method, input.path, input.body),
  };
}

export function collectForbiddenAuditFindings(
  value: unknown,
  forbiddenValues: string[] = [],
  path = "$",
): string[] {
  const findings: string[] = [];

  if (typeof value === "string") {
    for (const forbidden of forbiddenValues) {
      if (value.includes(forbidden)) {
        findings.push(`${path} contains forbidden value`);
      }
    }
    return findings;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      findings.push(...collectForbiddenAuditFindings(entry, forbiddenValues, `${path}[${index}]`));
    });
    return findings;
  }

  if (!value || typeof value !== "object") {
    return findings;
  }

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_AUDIT_KEYS.has(key)) {
      findings.push(`${path}.${key} is forbidden`);
    }
    findings.push(...collectForbiddenAuditFindings(nested, forbiddenValues, `${path}.${key}`));
  }

  return findings;
}

export function assertProxyAuditPayloadSafe(
  payload: unknown,
  forbiddenValues: string[] = [],
): void {
  const findings = collectForbiddenAuditFindings(payload, forbiddenValues);
  if (findings.length > 0) {
    throw new Error(`Unsafe proxy audit payload: ${findings.join("; ")}`);
  }
}
