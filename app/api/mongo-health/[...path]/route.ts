import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { getServerEnv } from '@/lib/env/server';
import { getAccessTokenCookie, getAdminFromAccessToken, getRefreshTokenCookie, refreshAdminSession, setAuthCookies } from '@/server/auth';
import { handleHealthRequest } from '@/server/mongo-health/proxy';

export const runtime = 'nodejs';
export const maxDuration = 45;
export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return handleHealthRequest(request, (await context.params).path, {
    actor: async () => {
      const jar = await cookies();
      const token = getAccessTokenCookie(jar);
      const current = token ? await getAdminFromAccessToken(token) : null;
      if (current) return current;
      const refresh = getRefreshTokenCookie(jar);
      const renewed = refresh ? await refreshAdminSession(refresh) : null;
      if (!renewed) return null;
      setAuthCookies(jar, renewed.tokens.accessToken, renewed.tokens.refreshToken);
      return getAdminFromAccessToken(renewed.tokens.accessToken);
    }, env: getServerEnv, fetch,
  });
}
