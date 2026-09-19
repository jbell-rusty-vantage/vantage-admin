import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { getAccessTokenCookie, getAdminFromAccessToken, getRefreshTokenCookie, refreshAdminSession, setAuthCookies } from "@/server/auth";
import { getServerEnv } from "@/lib/env/server";
import { buildVantageApiUrl } from "@/server/vantage-api/url";
import { salesIntelligenceLive, CSI_LIVE_PATH } from "@/server/sales-intelligence-live";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
async function requireAdmin() {
  const cookieStore = await cookies();
  const accessToken = getAccessTokenCookie(cookieStore);
  if (accessToken) {
    const admin = await getAdminFromAccessToken(accessToken);
    if (admin) {
      return admin;
    }
  }
  const refreshToken = getRefreshTokenCookie(cookieStore);
  if (!refreshToken) {
    return null;
  }
  const refreshed = await refreshAdminSession(refreshToken);
  if (!refreshed) {
    return null;
  }
  setAuthCookies(cookieStore, refreshed.tokens.accessToken, refreshed.tokens.refreshToken);
  return refreshed.admin;
}

export async function GET(request: NextRequest) {
  return salesIntelligenceLive(request, { admin: await requireAdmin(), url: buildVantageApiUrl(CSI_LIVE_PATH).toString(), apiSecret: getServerEnv().VANTAGE_API_SECRET });
}
