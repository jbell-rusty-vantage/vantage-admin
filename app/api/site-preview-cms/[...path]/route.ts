import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { getAccessTokenCookie, getAdminFromAccessToken, getRefreshTokenCookie, refreshAdminSession, setAuthCookies } from "@/server/auth";
import { getSitePreviewEnvironment } from "@/server/site-preview/environment";
import { handleCmsRequest } from "@/server/site-preview/proxy";

export const runtime = "nodejs";
async function handle(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return handleCmsRequest(request, context, { actor: async () => {
    const store = await cookies();
    const access = getAccessTokenCookie(store);
    const current = access ? await getAdminFromAccessToken(access) : null;
    if (current) return current;
    const refresh = getRefreshTokenCookie(store);
    const renewed = refresh ? await refreshAdminSession(refresh) : null;
    if (!renewed) return null;
    setAuthCookies(store, renewed.tokens.accessToken, renewed.tokens.refreshToken);
    return getAdminFromAccessToken(renewed.tokens.accessToken);
  }, env: getSitePreviewEnvironment, fetch });
}
export const GET = handle;
export const PUT = handle;
export const POST = handle;
