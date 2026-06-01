import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAccessTokenCookie, getAdminFromAccessToken } from "@/server/auth";

export async function GET() {
  const cookieStore = await cookies();
  const accessToken = getAccessTokenCookie(cookieStore);

  if (!accessToken) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const admin = await getAdminFromAccessToken(accessToken);
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  return NextResponse.json({ ok: true, data: { admin } });
}
