import type { AdminRole } from "@/server/models";
import { getServerEnv } from "@/lib/env/server";
import {
  ADMIN_PROXY_AGENT_HEADER,
  ADMIN_PROXY_HEADER_NAMES,
  computeAdminActorSignature,
  createProxyRequestId,
  isValidAdminAgentId,
  normalizeAdminAgentId,
  normalizeAdminPath,
} from "./proxySigning";

export type TrustedAdminIdentity = {
  id: string;
  email: string;
  role: AdminRole;
  /**
   * S8-REP: the rep's linked Agent id, read from the AdminUser on the server (never from the
   * browser). Used only when `role` is `rep`; an Owner/Admin value is ignored.
   */
  agent_id?: string | null;
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
 *
 * S8-REP: a rep also gets `x-vantage-admin-agent-id`, which is signed as the
 * payload's eighth line. Owner and Admin headers and signatures are unchanged.
 * A rep is never forwarded unsigned: without the secret (or without a valid
 * linked Agent) this throws, and the caller refuses the request.
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
  const rep = admin.role === "rep";
  if (rep && !isValidAdminAgentId(admin.agent_id)) {
    throw new Error("A rep session has no linked Agent.");
  }
  headers.set(ADMIN_PROXY_HEADER_NAMES.userId, admin.id);
  headers.set(ADMIN_PROXY_HEADER_NAMES.email, admin.email);
  headers.set(ADMIN_PROXY_HEADER_NAMES.role, admin.role);
  if (rep) headers.set(ADMIN_PROXY_AGENT_HEADER, normalizeAdminAgentId(admin.agent_id as string));

  if (!options?.method || !options.path) {
    if (rep) throw new Error("A rep request must be signed.");
    return { requestId: undefined };
  }

  const { VANTAGE_ADMIN_PROXY_SIGNING_SECRET } = getServerEnv();
  if (!VANTAGE_ADMIN_PROXY_SIGNING_SECRET) {
    if (rep) throw new Error("A rep request must be signed.");
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
      ...(rep ? { agentId: admin.agent_id } : {}),
    },
    VANTAGE_ADMIN_PROXY_SIGNING_SECRET,
  );

  headers.set(ADMIN_PROXY_HEADER_NAMES.requestId, requestId);
  headers.set(ADMIN_PROXY_HEADER_NAMES.timestamp, timestamp);
  headers.set(ADMIN_PROXY_HEADER_NAMES.signature, signature);

  return { requestId };
}
