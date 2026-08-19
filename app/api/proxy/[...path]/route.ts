import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  getAccessTokenCookie,
  getAdminFromAccessToken,
  getRefreshTokenCookie,
  getRequestMetadata,
  refreshAdminSession,
  setAuthCookies,
} from "@/server/auth";
import { setTrustedAdminHeaders } from "@/server/auth/trustedProxyHeaders";
import { canProxyVantagePath } from "@/server/auth/authorization";
import { writeAuditLog, buildProxyAuditRequestPayload, proxyAuditPathname } from "@/server/audit";
import { requestVantageApi, type VantageApiMethod } from "@/server/vantage-api/client";
import { VantageApiError } from "@/server/vantage-api/errors";

type ProxyContext = {
  params: Promise<{
    path?: string[];
  }>;
};

const MUTATING_METHODS = new Set<VantageApiMethod>(["POST", "PATCH", "PUT", "DELETE"]);

async function requireAdmin() {
  const cookieStore = await cookies();
  const accessToken = getAccessTokenCookie(cookieStore);

  if (accessToken) {
    const admin = await getAdminFromAccessToken(accessToken);
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

function isExportRequest(method: VantageApiMethod, path: string): boolean {
  const normalized = path.toLowerCase();
  return method === "GET" && (normalized.includes("/exports/") || normalized.includes(".csv"));
}

function getDatabaseScope(path: string, body: unknown): string | undefined {
  const queryScope = new URL(`https://proxy.local/${path}`).searchParams.get("database_scope");
  if (queryScope) {
    return queryScope;
  }

  if (body && typeof body === "object" && "database_scope" in body) {
    const value = (body as { database_scope?: unknown }).database_scope;
    return typeof value === "string" ? value : undefined;
  }

  return undefined;
}

function getForwardHeaders(
  request: NextRequest,
  admin: NonNullable<Awaited<ReturnType<typeof requireAdmin>>>,
  method: VantageApiMethod,
  backendPath: string,
): { headers: Headers; requestId: string | undefined } {
  const headers = new Headers();
  const accept = request.headers.get("accept");
  const contentType = request.headers.get("content-type");

  if (accept) {
    headers.set("accept", accept);
  }

  if (contentType) {
    headers.set("content-type", contentType);
  }

  if (/^api\/v1\/admin\/granot-lifecycle\/(?:booking-cases\/[^/?]+\/(?:confirm-booking|create-referral-booking|update-booking|no-action)|release-cases\/[^/?]+\/(?:confirm-cancellation|update-booking|no-action))(?:\?|$)/.test(backendPath)) {
    const idempotencyKey = request.headers.get("idempotency-key");
    if (idempotencyKey) headers.set("idempotency-key", idempotencyKey);
  }

  const { requestId } = setTrustedAdminHeaders(headers, admin, {
    method,
    path: backendPath,
  });
  return { headers, requestId };
}

async function readRequestBody(request: NextRequest, method: VantageApiMethod): Promise<unknown> {
  if (method === "GET" || method === "DELETE") {
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

async function auditProxyRequest(input: {
  admin: Awaited<ReturnType<typeof requireAdmin>>;
  method: VantageApiMethod;
  path: string;
  body: unknown;
  status: number;
  ok: boolean;
  errorMessage?: string;
  requestId?: string;
}) {
  if (!input.admin) {
    return;
  }

  try {
    const metadata = await getRequestMetadata();
    await writeAuditLog({
      ...metadata,
      admin_user_id: input.admin.id,
      admin_email: input.admin.email,
      action: isExportRequest(input.method, input.path) ? "proxy_export_request" : "proxy_mutation",
      entity_type: proxyAuditPathname(input.path),
      database_scope: getDatabaseScope(input.path, input.body),
      request_payload: buildProxyAuditRequestPayload({
        method: input.method,
        path: input.path,
        body: input.body,
      }),
      response_status: input.status,
      ok: input.ok,
      error_message: input.errorMessage,
      request_id: input.requestId,
    });
  } catch (error) {
    console.error("Failed to write proxy audit log", error);
  }
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

  const shouldAudit = MUTATING_METHODS.has(method) || isExportRequest(method, backendPath);
  const body = await readRequestBody(request, method);
  const { headers: forwardHeaders, requestId } = getForwardHeaders(
    request,
    admin,
    method,
    backendPath,
  );

  try {
    const vantageResponse = await requestVantageApi(backendPath, {
      method,
      body,
      headers: forwardHeaders,
    });

    if (shouldAudit) {
      await auditProxyRequest({
        admin,
        method,
        path: backendPath,
        body,
        status: vantageResponse.status,
        ok: true,
        requestId,
      });
    }

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
      { ok: true, data: vantageResponse.data },
      { status: vantageResponse.status },
    );
  } catch (error) {
    const status = error instanceof VantageApiError ? error.status : 500;
    const message =
      error instanceof Error ? error.message : "Unexpected Vantage API proxy failure.";

    if (shouldAudit) {
      await auditProxyRequest({
        admin,
        method,
        path: backendPath,
        body,
        status,
        ok: false,
        errorMessage: message,
        requestId:
          requestId ?? (error instanceof VantageApiError ? error.requestId : undefined),
      });
    }

    return NextResponse.json(
      {
        ok: false,
        error: status >= 500 ? "Vantage API request failed." : message,
        issues: error instanceof VantageApiError ? error.issues : undefined,
        request_id:
          (error instanceof VantageApiError ? error.requestId : undefined) ?? requestId,
        registry_code: error instanceof VantageApiError ? error.registryCode : undefined,
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
