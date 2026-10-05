import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  getAccessTokenCookie,
  getSessionUserFromAccessToken,
  getRefreshTokenCookie,
  refreshAdminSession,
  setAuthCookies,
} from "@/server/auth";
import { proxyForwardHeaders, currentCsiScope, isOutreachDeskPath } from "@/server/auth/proxyForwardHeaders";
import { mockedProxyResponse, outreachDeskMockVariant } from "@/server/outreach-desk-mock";
import { canProxyVantagePath } from "@/server/auth/authorization";
import { requestVantageApi, type VantageApiMethod } from "@/server/vantage-api/client";
import { VantageApiError } from "@/server/vantage-api/errors";
import { publicProxyErrorMessage } from "@/server/vantage-api/publicError";

type ProxyContext = {
  params: Promise<{
    path?: string[];
  }>;
};

async function requireAdmin() {
  const cookieStore = await cookies();
  const accessToken = getAccessTokenCookie(cookieStore);

  if (accessToken) {
    // S8-REP: a rep is a proxy caller too; `canProxyVantagePath` limits it to its Sales Intelligence calls.
    const admin = await getSessionUserFromAccessToken(accessToken);
    if (admin) {
      return admin;
    }
  }

  // The short-lived access token is missing or expired. Transparently
  // refresh it from the long-lived refresh token so authenticated browser
  // sessions don't start failing with 401s mid-session. This route is a
  // Route Handler, so mutating the cookie store writes Set-Cookie on the
  // response. token_version is not rotated on refresh, so concurrent proxy
  // requests can each refresh safely without invalidating one another.
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

function buildBackendPath(pathParts: string[] | undefined, request: NextRequest): string {
  const pathname = pathParts?.join("/") ?? "";
  if (
    !pathname ||
    pathname.includes("\\") ||
    pathname.includes("://") ||
    pathname.startsWith("//") ||
    pathname.split("/").includes("..")
  ) {
    throw new Error("Invalid proxy path.");
  }

  return `${pathname}${request.nextUrl.search}`;
}

async function readRequestBody(request: NextRequest, method: VantageApiMethod): Promise<unknown> {
  if (method === "GET") {
    return undefined;
  }

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("application/json")) {
    return request.json();
  }

  const text = await request.text();
  return text.length > 0 ? text : undefined;
}

function responseFromCsv(body: ArrayBuffer, status: number, headers: Headers): NextResponse {
  const responseHeaders = new Headers();
  const contentType = headers.get("content-type");
  const contentDisposition = headers.get("content-disposition");

  if (contentType) {
    responseHeaders.set("content-type", contentType);
  }

  if (contentDisposition) {
    responseHeaders.set("content-disposition", contentDisposition);
  }

  return new NextResponse(body, {
    status,
    headers: responseHeaders,
  });
}

async function handleProxyRequest(request: NextRequest, context: ProxyContext, method: VantageApiMethod) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  let backendPath: string;
  try {
    const { path: pathParts } = await context.params;
    backendPath = buildBackendPath(pathParts, request);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid proxy path." }, { status: 400 });
  }

  if (!canProxyVantagePath({ role: admin.role, method, path: backendPath })) {
    return NextResponse.json({ ok: false, error: "Forbidden." }, { status: 403 });
  }

  const body = await readRequestBody(request, method);
  if (!currentCsiScope(backendPath, body)) return NextResponse.json({ ok: false, code: "UNSUPPORTED_SCOPE", error: "Current records only." }, { status: 403 });
  // Local mock mode (never on Vercel production): desk calls answer from the synthetic fixtures after the same checks.
  const mockVariant = outreachDeskMockVariant();
  const mocked = mockVariant ? mockedProxyResponse({ variant: mockVariant, admin, method, path: backendPath, body }) : null;
  if (mocked) return NextResponse.json(mocked.body, { status: mocked.status });
  let forwarded: ReturnType<typeof proxyForwardHeaders>;
  try {
    forwarded = proxyForwardHeaders(request.headers, admin, method, backendPath);
  } catch {
    // S8-REP: a rep without a linked Agent, or without a signing secret, is never forwarded.
    return NextResponse.json({ ok: false, error: "Forbidden." }, { status: 403 });
  }
  const { headers: forwardHeaders, requestId } = forwarded;

  try {
    const vantageResponse = await requestVantageApi(backendPath, {
      method,
      body,
      headers: forwardHeaders,
    });

    if (vantageResponse.kind === "csv") {
      return responseFromCsv(vantageResponse.body, vantageResponse.status, vantageResponse.headers);
    }

    if (vantageResponse.kind === "text") {
      return NextResponse.json(
        { ok: true, data: { text: vantageResponse.text } },
        { status: vantageResponse.status },
      );
    }

    if (vantageResponse.kind === "empty") {
      return new NextResponse(null, { status: vantageResponse.status });
    }

    return NextResponse.json(
      { ok: true, data: vantageResponse.data, ...vantageResponse.metadata },
      { status: vantageResponse.status },
    );
  } catch (error) {
    const status = error instanceof VantageApiError ? error.status : 500;
    const message =
      error instanceof Error ? error.message : "Unexpected Vantage API proxy failure.";

    return NextResponse.json(
      {
        ok: false,
        error: publicProxyErrorMessage(status, message),
        issues: error instanceof VantageApiError ? error.issues : undefined,
        request_id:
          (error instanceof VantageApiError ? error.requestId : undefined) ?? requestId,
        registry_code: error instanceof VantageApiError ? error.registryCode : undefined,
        // The desk branches on the server's refusal code (CURSOR_EXPIRED, REVISION_CONFLICT, REP_NOT_LINKED, …).
        code: error instanceof VantageApiError && isOutreachDeskPath(backendPath) ? error.registryCode : undefined,
        remediation: error instanceof VantageApiError ? error.remediation : undefined,
      },
      { status },
    );
  }
}

export function GET(request: NextRequest, context: ProxyContext) {
  return handleProxyRequest(request, context, "GET");
}

export function POST(request: NextRequest, context: ProxyContext) {
  return handleProxyRequest(request, context, "POST");
}

export function PATCH(request: NextRequest, context: ProxyContext) {
  return handleProxyRequest(request, context, "PATCH");
}

export function PUT(request: NextRequest, context: ProxyContext) {
  return handleProxyRequest(request, context, "PUT");
}

export function DELETE(request: NextRequest, context: ProxyContext) {
  return handleProxyRequest(request, context, "DELETE");
}
