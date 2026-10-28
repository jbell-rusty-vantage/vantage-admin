import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { getAccessTokenCookie, getAdminFromAccessToken, getRefreshTokenCookie, refreshAdminSession, setAuthCookies } from "@/server/auth";
import { getServerEnv } from "@/lib/env/server";
import { handlePricingRequest } from "@/server/operations-pricing/proxy";
export const runtime = "nodejs";
async function handle(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return handlePricingRequest(request, context, { actor: async () => {
    const cookieStore = await cookies();
    const token = getAccessTokenCookie(cookieStore);
    const current = token ? await getAdminFromAccessToken(token) : null;
    if (current) return current;
    const refresh = getRefreshTokenCookie(cookieStore);
    const renewed = refresh ? await refreshAdminSession(refresh) : null;
    if (!renewed) return null;
    setAuthCookies(cookieStore, renewed.tokens.accessToken, renewed.tokens.refreshToken);
    return getAdminFromAccessToken(renewed.tokens.accessToken);
  }, env: getServerEnv, fetch });
}
export const GET = handle;
export const POST = handle;
export const PUT = handle;
