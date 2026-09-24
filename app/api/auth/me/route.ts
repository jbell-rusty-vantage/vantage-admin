import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAccessTokenCookie, getSessionUserFromAccessToken } from "@/server/auth";

export async function GET() {
  const cookieStore = await cookies();
  const accessToken = getAccessTokenCookie(cookieStore);

  if (!accessToken) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  // S8-USERS: a rep is a signed-in user too (its pages and APIs stay denied).
  const admin = await getSessionUserFromAccessToken(accessToken);
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  return NextResponse.json({ ok: true, data: { admin } });
}
