import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { getAccessTokenCookie, getSessionUserFromAccessToken, getRefreshTokenCookie, refreshAdminSession, setAuthCookies } from "@/server/auth";
import { canProxyVantagePath } from "@/server/auth/authorization";
import { getServerEnv } from "@/lib/env/server";
import { buildVantageApiUrl } from "@/server/vantage-api/url";
import { outreachDeskLive, OUTREACH_DESK_LIVE_PATH } from "@/server/outreach-desk-live";
import { mockOutreachDeskLiveStream, outreachDeskMockVariant } from "@/server/outreach-desk-mock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Any signed-in user; `outreachDeskLive` admits the Owner, a Manager and a linked Rep. */
async function requireSessionUser() {
  const cookieStore = await cookies();
  const accessToken = getAccessTokenCookie(cookieStore);
  if (accessToken) {
    const user = await getSessionUserFromAccessToken(accessToken);
    if (user) return user;
  }
  const refreshToken = getRefreshTokenCookie(cookieStore);
  if (!refreshToken) return null;
  const refreshed = await refreshAdminSession(refreshToken);
  if (!refreshed) return null;
  setAuthCookies(cookieStore, refreshed.tokens.accessToken, refreshed.tokens.refreshToken);
  return refreshed.admin;
}

export async function GET(request: NextRequest) {
  const admin = await requireSessionUser();
  // Local mock mode (never on Vercel production): the same role check, then a synthetic connect/clock stream.
  if (admin && outreachDeskMockVariant() && canProxyVantagePath({ role: admin.role, method: "GET", path: OUTREACH_DESK_LIVE_PATH, via: "live" })) {
    return mockOutreachDeskLiveStream(request.signal);
  }
  return outreachDeskLive(request, {
    admin,
    url: buildVantageApiUrl(OUTREACH_DESK_LIVE_PATH).toString(),
    apiSecret: getServerEnv().VANTAGE_API_SECRET,
  });
}
