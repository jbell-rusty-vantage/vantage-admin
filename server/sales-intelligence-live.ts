import { proxyForwardHeaders, currentCsiScope } from "./auth/proxyForwardHeaders";
import type { TrustedAdminIdentity } from "./auth/trustedProxyHeaders";
import { isValidAdminAgentId } from "./auth/proxySigning";

export const CSI_LIVE_PATH = "api/v1/admin/sales-intelligence/live?scope=production";

export async function salesIntelligenceLive(request: Request, deps: {
  admin: TrustedAdminIdentity | null;
  url: string;
  apiSecret: string;
  fetch?: typeof fetch;
}) {
  if (!deps.admin) return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  // S8-REP: the Owner, or a rep with a linked Agent (the main server scopes the rep's stream and refuses
  // a rep while SALES_INTELLIGENCE_REP_ACCESS is off). Admin stays refused.
  if (deps.admin.role !== "owner" && !(deps.admin.role === "rep" && isValidAdminAgentId(deps.admin.agent_id))) {
    return Response.json({ ok: false, error: "Forbidden." }, { status: 403 });
  }
  if (!currentCsiScope(`api/v1/admin/sales-intelligence/live${new URL(request.url).search}`)) {
    return Response.json({ ok: false, code: "UNSUPPORTED_SCOPE" }, { status: 403 });
  }
  let headers: Headers;
  try {
    ({ headers } = proxyForwardHeaders(new Headers(), deps.admin, "GET", CSI_LIVE_PATH));
  } catch {
    // A rep is never forwarded unsigned.
    return Response.json({ ok: false, error: "Forbidden." }, { status: 403 });
  }
  headers.set("accept", "text/event-stream");
  headers.set("x-api-secret", deps.apiSecret);
  const cursor = request.headers.get("last-event-id");
  if (cursor && cursor.length <= 256) headers.set("last-event-id", cursor);
  const abort = new AbortController();
  const stop = () => abort.abort();
  request.signal.addEventListener("abort", stop, { once: true });
  if (request.signal.aborted) stop();
  try {
    const upstream = await (deps.fetch ?? fetch)(deps.url, { headers, cache: "no-store", signal: abort.signal });
    if (!upstream.ok || !upstream.body || !upstream.headers.get("content-type")?.includes("text/event-stream")) {
      await upstream.body?.cancel();
      request.signal.removeEventListener("abort", stop);
      stop();
      return Response.json({ ok: false, error: "Live updates unavailable." }, { status: upstream.ok ? 502 : upstream.status });
    }
    const reader = upstream.body.getReader();
    const cleanup = () => { request.signal.removeEventListener("abort", stop); stop(); };
    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const { done, value } = await reader.read();
          if (done) { cleanup(); controller.close(); } else controller.enqueue(value);
        } catch { cleanup(); controller.error(new Error("Live stream disconnected")); }
      },
      async cancel() { cleanup(); await reader.cancel().catch(() => undefined); },
    });
    return new Response(body, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" } });
  } catch {
    request.signal.removeEventListener("abort", stop);
    stop();
    return Response.json({ ok: false, error: "Live updates unavailable." }, { status: 502 });
  }
}
