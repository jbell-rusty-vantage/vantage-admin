import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  getAccessTokenCookie,
  getAdminFromAccessToken,
  getRefreshTokenCookie,
  refreshAdminSession,
  setAuthCookies,
} from "@/server/auth";
import { setTrustedAdminHeaders } from "@/server/auth/trustedProxyHeaders";
import { getServerEnv } from "@/lib/env/server";
import { buildVantageApiUrl } from "@/server/vantage-api/url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const LIVE_PATH = "api/v1/admin/granot-lifecycle/receipts/live";

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
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  if (admin.role !== "owner") {
    return NextResponse.json({ ok: false, error: "Forbidden." }, { status: 403 });
  }

  const { VANTAGE_API_SECRET, VANTAGE_API_PROTECTION_BYPASS } = getServerEnv();
  const url = buildVantageApiUrl(LIVE_PATH);
  const headers = new Headers();
  headers.set("accept", "text/event-stream");
  headers.set("x-api-secret", VANTAGE_API_SECRET);
  if (VANTAGE_API_PROTECTION_BYPASS) {
    headers.set("x-vercel-protection-bypass", VANTAGE_API_PROTECTION_BYPASS);
  }
  const lastEventId = request.headers.get("last-event-id");
  if (lastEventId) {
    headers.set("last-event-id", lastEventId);
  }
  setTrustedAdminHeaders(headers, admin, {
    method: "GET",
    path: LIVE_PATH,
  });

  const upstream = await fetch(url, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  if (!upstream.ok || !upstream.body) {
    const message = upstream.status === 403 ? "Forbidden." : "Live webhook stream failed.";
    return NextResponse.json({ ok: false, error: message }, { status: upstream.status || 502 });
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
