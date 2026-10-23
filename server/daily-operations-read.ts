import { setTrustedAdminHeaders, type TrustedAdminIdentity } from "./auth/trustedProxyHeaders";
export const DAILY_OPERATIONS_BOARD_PATH = "api/v1/admin/daily-operations/board";
export const DAILY_OPERATIONS_LEGACY_PATH = "api/v1/admin/daily-operations/live";
/** Identity is loaded from the active session for every request, never from browser headers. */
export async function dailyOperationsRead(request: Request, deps: {
  admin: TrustedAdminIdentity | null; url: string | URL;
  path?: typeof DAILY_OPERATIONS_BOARD_PATH | typeof DAILY_OPERATIONS_LEGACY_PATH;
  apiSecret: string; protectionBypass?: string; fetch?: typeof fetch;
}) {
  if (!deps.admin) return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  if (deps.admin.role !== "owner" && deps.admin.role !== "manager") return Response.json({ ok: false, error: "Forbidden." }, { status: 403 });
  const path = deps.path ?? DAILY_OPERATIONS_BOARD_PATH;
  const headers = new Headers({ accept: "application/json", "x-api-secret": deps.apiSecret });
  if (deps.protectionBypass) headers.set("x-vercel-protection-bypass", deps.protectionBypass);
  setTrustedAdminHeaders(headers, deps.admin, { method: "GET", path });
  try {
    const upstream = await (deps.fetch ?? fetch)(deps.url, { method: "GET", headers, cache: "no-store", signal: request.signal });
    // HTTP 204 stops native EventSource retries; its empty body is not an error.
    if (upstream.status === 204) return new Response(null, { status: 204, headers: { "Cache-Control": "private, no-store" } });
    if (!upstream.ok) return Response.json({ ok: false, error: "Daily Operations is unavailable." }, { status: upstream.status, headers: { "Cache-Control": "private, no-store", "Retry-After": upstream.headers.get("retry-after") ?? "60" } });
    if (!upstream.headers.get("content-type")?.includes("application/json")) return Response.json({ ok: false, error: "Daily Operations is unavailable." }, { status: 502 });
    return new Response(upstream.body, { status: upstream.status, headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ ok: false, error: "Daily Operations is unavailable." }, { status: 502, headers: { "Cache-Control": "private, no-store" } });
  }
}
