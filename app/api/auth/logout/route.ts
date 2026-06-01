import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  clearAuthCookies,
  getAccessTokenCookie,
  getAdminFromAccessToken,
  getRequestMetadata,
} from "@/server/auth";
import { writeAuditLog } from "@/server/audit";

export async function POST() {
  const cookieStore = await cookies();
  const metadata = await getRequestMetadata();
  const accessToken = getAccessTokenCookie(cookieStore);
  const admin = accessToken ? await getAdminFromAccessToken(accessToken) : null;

  const response = NextResponse.json({ ok: true });
  clearAuthCookies(response.cookies);

  await writeAuditLog({
    ...metadata,
    admin_user_id: admin?.id,
    admin_email: admin?.email,
    action: "logout",
    response_status: 200,
    ok: true,
  });

  return response;
}
