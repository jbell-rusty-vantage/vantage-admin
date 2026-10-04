import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import {
  getAccessTokenCookie,
  getRefreshTokenCookie,
  getSessionUserFromAccessToken,
  hashPassword,
  refreshAdminSession,
  setAuthCookies,
} from "@/server/auth";
import { requestVantageApi } from "@/server/vantage-api/client";
import { createMainServerAgentDirectory, createMainServerInviteMailer } from "./mainServer";
import { createMongoAdminUserInvitesStore, createMongoAdminUsersStore } from "./mongoStore";
import type { UsersActor, UsersDeps } from "./types";

/** Production dependencies for the users service (route handlers only). */
export function defaultUsersDeps(): UsersDeps {
  return {
    users: createMongoAdminUsersStore(),
    invites: createMongoAdminUserInvitesStore(),
    agents: createMainServerAgentDirectory(requestVantageApi),
    mailer: createMainServerInviteMailer(requestVantageApi),
    hashPassword,
    now: () => new Date(),
    randomToken: () => randomBytes(32).toString("base64url"),
  };
}

/**
 * The signed-in dashboard user, refreshing an expired access token from the
 * refresh cookie the same way the proxy BFF does.
 */
export async function resolveSessionActor(): Promise<UsersActor | null> {
  const cookieStore = await cookies();
  const accessToken = getAccessTokenCookie(cookieStore);
  if (accessToken) {
    const admin = await getSessionUserFromAccessToken(accessToken);
    if (admin) return admin;
  }
  const refreshToken = getRefreshTokenCookie(cookieStore);
  if (!refreshToken) return null;
  const refreshed = await refreshAdminSession(refreshToken);
  if (!refreshed) return null;
  setAuthCookies(cookieStore, refreshed.tokens.accessToken, refreshed.tokens.refreshToken);
  return refreshed.admin;
}
