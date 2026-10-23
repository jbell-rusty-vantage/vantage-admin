import { cookies } from "next/headers";
import { getAccessTokenCookie, getSessionUserFromAccessToken, getRefreshTokenCookie, refreshAdminSession, setAuthCookies } from "./auth";
/** Retains active-user and token-version checks on every board request. */
export async function requireDailyOperationsSession() {
  const store = await cookies();
  const access = getAccessTokenCookie(store);
  if (access) { const admin = await getSessionUserFromAccessToken(access); if (admin) return admin; }
  const refresh = getRefreshTokenCookie(store);
  if (!refresh) return null;
  const refreshed = await refreshAdminSession(refresh);
  if (!refreshed) return null;
  setAuthCookies(store, refreshed.tokens.accessToken, refreshed.tokens.refreshToken);
  return refreshed.admin;
}
