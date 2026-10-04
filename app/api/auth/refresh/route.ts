import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  clearAuthCookies,
  getRefreshTokenCookie,
  refreshAdminSession,
  setAuthCookies,
} from "@/server/auth";

export async function POST() {
  const cookieStore = await cookies();
  const refreshToken = getRefreshTokenCookie(cookieStore);

  if (!refreshToken) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const result = await refreshAdminSession(refreshToken);
  if (!result) {
    const response = NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
    clearAuthCookies(response.cookies);
    return response;
  }

  const response = NextResponse.json({ ok: true, data: { admin: result.admin } });
  setAuthCookies(response.cookies, result.tokens.accessToken, result.tokens.refreshToken);

  return response;
}
