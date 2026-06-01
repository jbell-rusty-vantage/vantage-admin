import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  clearAuthCookies,
  getRefreshTokenCookie,
  getRequestMetadata,
  refreshAdminSession,
  resolveAdminIdFromRefreshToken,
  setAuthCookies,
} from "@/server/auth";
import { writeAuditLog } from "@/server/audit";

export async function POST() {
  const cookieStore = await cookies();
  const metadata = await getRequestMetadata();
  const refreshToken = getRefreshTokenCookie(cookieStore);

  if (!refreshToken) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const result = await refreshAdminSession(refreshToken);
  if (!result) {
    const admin = await resolveAdminIdFromRefreshToken(refreshToken);
    const response = NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
    clearAuthCookies(response.cookies);

    await writeAuditLog({
      ...metadata,
      admin_user_id: admin?.id,
      admin_email: admin?.email,
      action: "token_refresh_failure",
      response_status: 401,
      ok: false,
      error_message: "Refresh token rejected.",
    });

    return response;
  }

  const response = NextResponse.json({ ok: true, data: { admin: result.admin } });
  setAuthCookies(response.cookies, result.tokens.accessToken, result.tokens.refreshToken);

  return response;
}
