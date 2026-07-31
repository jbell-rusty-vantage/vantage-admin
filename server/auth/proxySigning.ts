import { createHmac, randomUUID } from "node:crypto";

/**
 * Canonical dashboard actor signing contract shared with vantage-main-server S1.
 *
 * Payload fields are newline-delimited UTF-8 in this order:
 *   admin_id, normalized_email, normalized_role, timestamp, request_id, method, path
 *
 * HMAC-SHA256 with `VANTAGE_ADMIN_PROXY_SIGNING_SECRET`, lowercase hex digest.
 */

export const ADMIN_PROXY_HEADER_NAMES = {
  userId: "x-vantage-admin-user-id",
  email: "x-vantage-admin-email",
  role: "x-vantage-admin-role",
  requestId: "x-vantage-admin-request-id",
  timestamp: "x-vantage-admin-timestamp",
  signature: "x-vantage-admin-signature",
} as const;

export type CanonicalAdminActorFields = {
  adminId: string;
  email: string;
  role: string;
  timestamp: string;
  requestId: string;
  method: string;
  path: string;
};

export function normalizeAdminEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeAdminRole(role: string): string {
  return role.trim().toLowerCase();
}

export function normalizeAdminMethod(method: string): string {
  return method.trim().toUpperCase();
}

export function normalizeAdminPath(path: string): string {
  const withoutQuery = path.split("?")[0] ?? "";
  const withLeadingSlash = withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
  return withLeadingSlash.length > 1
    ? withLeadingSlash.replace(/\/+$/, "")
    : withLeadingSlash;
}

export function buildCanonicalAdminActorPayload(fields: CanonicalAdminActorFields): string {
  return [
    fields.adminId.trim(),
    normalizeAdminEmail(fields.email),
    normalizeAdminRole(fields.role),
    fields.timestamp.trim(),
    fields.requestId.trim(),
    normalizeAdminMethod(fields.method),
    normalizeAdminPath(fields.path),
  ].join("\n");
}

export function signAdminActorPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

export function computeAdminActorSignature(
  fields: CanonicalAdminActorFields,
  secret: string,
): string {
  return signAdminActorPayload(buildCanonicalAdminActorPayload(fields), secret);
}

export function createProxyRequestId(): string {
  return randomUUID();
}
