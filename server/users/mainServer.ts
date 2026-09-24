import { setTrustedAdminHeaders } from "@/server/auth/trustedProxyHeaders";
import type { VantageApiRequestOptions, VantageApiResponse } from "@/server/vantage-api/client";
import { UsersError, type AgentDirectory, type InviteDeliveryStatus, type InviteMailer, type UsersActor } from "./types";

/**
 * Main-server reads/sends used by user management. Both calls carry the
 * Owner's identity in the same signed actor headers the proxy uses
 * (`VANTAGE_ADMIN_PROXY_SIGNING_SECRET`), plus `x-api-secret` from the client.
 */
export type VantageRequest = <T = unknown>(path: string, options?: VantageApiRequestOptions) => Promise<VantageApiResponse<T>>;

export const CATALOG_AGENTS_PATH = "api/v1/admin/catalog/agents";
export const ADMIN_INVITE_EMAIL_PATH = "api/v1/internal/admin-invite-email";

function signedHeaders(actor: UsersActor, method: string, path: string): Headers {
  const headers = new Headers({ accept: "application/json" });
  setTrustedAdminHeaders(headers, actor, { method, path });
  return headers;
}

/**
 * Active-Agent check through the existing Operations Registry catalog read
 * (`GET /api/v1/admin/catalog/agents`, active Agents only by default). Fails
 * closed: an unreachable main server is `agent_check_unavailable`, never "active".
 */
export function createMainServerAgentDirectory(request: VantageRequest): AgentDirectory {
  return {
    async isActiveAgent(agentId, actor) {
      let response: VantageApiResponse<{ items?: Array<{ id?: unknown; _id?: unknown; active?: unknown }> }>;
      try {
        response = await request(CATALOG_AGENTS_PATH, {
          method: "GET",
          headers: signedHeaders(actor, "GET", CATALOG_AGENTS_PATH),
        });
      } catch {
        throw new UsersError("agent_check_unavailable", "Couldn't check the Agent right now. Try again.");
      }
      if (response.kind !== "json" || !Array.isArray(response.data?.items)) {
        throw new UsersError("agent_check_unavailable", "Couldn't check the Agent right now. Try again.");
      }
      const wanted = agentId.toLowerCase();
      return response.data.items.some(
        (item) => String(item.id ?? item._id ?? "").toLowerCase() === wanted && item.active !== false,
      );
    },
  };
}

/**
 * Sends the invite through `POST /api/v1/internal/admin-invite-email` on the
 * main server (which holds the SendGrid key). Any transport or auth failure is
 * `unreachable`, so the Owner gets the copy-link fallback. Never logs the link.
 */
export function createMainServerInviteMailer(request: VantageRequest): InviteMailer {
  return {
    async sendInvite({ actor, to, link, expiresAt }) {
      try {
        const response = await request<{ status?: unknown }>(ADMIN_INVITE_EMAIL_PATH, {
          method: "POST",
          headers: signedHeaders(actor, "POST", ADMIN_INVITE_EMAIL_PATH),
          body: { to, link, expires_at: expiresAt.toISOString() },
        });
        const status = response.kind === "json" ? response.data?.status : undefined;
        return status === "sent" || status === "not_configured" || status === "failed"
          ? (status as InviteDeliveryStatus)
          : "unreachable";
      } catch {
        return "unreachable";
      }
    },
  };
}
