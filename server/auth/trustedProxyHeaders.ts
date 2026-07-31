import type { AdminRole } from "@/server/models";
import { getServerEnv } from "@/lib/env/server";
import {
  ADMIN_PROXY_HEADER_NAMES,
  computeAdminActorSignature,
  createProxyRequestId,
  normalizeAdminPath,
} from "./proxySigning";

export type TrustedAdminIdentity = {
  id: string;
  email: string;
  role: AdminRole;
};

export type SignedProxyHeaderInput = {
  admin: TrustedAdminIdentity;
  method: string;
  path: string;
  requestId?: string;
  timestampMs?: number;
};

/**
 * Sets trusted identity headers. When the signing secret is configured, also
 * attaches request id, timestamp, and HMAC signature bound to method+path.
 */
export function setTrustedAdminHeaders(
  headers: Headers,
  admin: TrustedAdminIdentity,
  options?: {
    method?: string;
    path?: string;
    requestId?: string;
    timestampMs?: number;
  },
): { requestId: string | undefined } {
  headers.set(ADMIN_PROXY_HEADER_NAMES.userId, admin.id);
  headers.set(ADMIN_PROXY_HEADER_NAMES.email, admin.email);
  headers.set(ADMIN_PROXY_HEADER_NAMES.role, admin.role);

  if (!options?.method || !options.path) {
    return { requestId: undefined };
  }

  const { VANTAGE_ADMIN_PROXY_SIGNING_SECRET } = getServerEnv();
  if (!VANTAGE_ADMIN_PROXY_SIGNING_SECRET) {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "[vantage-admin] VANTAGE_ADMIN_PROXY_SIGNING_SECRET is unset; registry actor signatures are omitted and Owner registry writes will fail closed on the main server.",
      );
    }
    const requestId = options.requestId ?? createProxyRequestId();
    headers.set(ADMIN_PROXY_HEADER_NAMES.requestId, requestId);
    return { requestId };
  }

  const requestId = options.requestId ?? createProxyRequestId();
  const timestamp = String(options.timestampMs ?? Date.now());
  const signature = computeAdminActorSignature(
    {
      adminId: admin.id,
      email: admin.email,
      role: admin.role,
      timestamp,
      requestId,
      method: options.method,
      path: normalizeAdminPath(options.path),
    },
    VANTAGE_ADMIN_PROXY_SIGNING_SECRET,
  );

  headers.set(ADMIN_PROXY_HEADER_NAMES.requestId, requestId);
  headers.set(ADMIN_PROXY_HEADER_NAMES.timestamp, timestamp);
  headers.set(ADMIN_PROXY_HEADER_NAMES.signature, signature);

  return { requestId };
}
