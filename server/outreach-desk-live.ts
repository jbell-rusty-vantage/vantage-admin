import { canProxyVantagePath } from "./auth/authorization";
import { proxyForwardHeaders } from "./auth/proxyForwardHeaders";
import type { TrustedAdminIdentity } from "./auth/trustedProxyHeaders";

/** The desk's scoped SSE on the main server (IMPLEMENTATION-PLAN §5, CONTRACTS "SSE"). Frame version 1. */
export const OUTREACH_DESK_LIVE_PATH = "api/v1/admin/sales-outreach/live?scope=production&version=1";

/**
 * `GET /api/outreach-desk-live` (ADM-7): one EventSource per mounted desk. The browser never names a scope or a rep:
 * the server scopes the hints to the signed actor (a Rep receives only its own Agent's subject and rep-day ids). The
 * Owner, a Manager and a linked Rep pass the same exact allowlist as the proxy; a generic Admin is refused (P09c).
 *
 * The upstream status is kept on refusal (403 forbidden, 503 desk unavailable) so the client can tell "desk muted"
 * from "network down"; the stream itself closes after about 240 s and the client reconnects with a full refetch.
 */
export async function outreachDeskLive(request: Request, deps: {
  admin: TrustedAdminIdentity | null;
  url: string;
  apiSecret: string;
  fetch?: typeof fetch;
}) {
  if (!deps.admin) return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  if (!canProxyVantagePath({ role: deps.admin.role, method: "GET", path: OUTREACH_DESK_LIVE_PATH, via: "live" })) {
    return Response.json({ ok: false, code: "FORBIDDEN", error: "Forbidden." }, { status: 403 });
  }
  let headers: Headers;
  try {
    ({ headers } = proxyForwardHeaders(new Headers(), deps.admin, "GET", OUTREACH_DESK_LIVE_PATH));
  } catch {
    // A rep without a linked Agent, or without a signing secret, is never forwarded.
    return Response.json({ ok: false, code: "FORBIDDEN", error: "Forbidden." }, { status: 403 });
  }
  headers.set("accept", "text/event-stream");
  headers.set("x-api-secret", deps.apiSecret);
  const abort = new AbortController();
  const stop = () => abort.abort();
  request.signal.addEventListener("abort", stop, { once: true });
  if (request.signal.aborted) stop();
  try {
    const upstream = await (deps.fetch ?? fetch)(deps.url, { headers, cache: "no-store", signal: abort.signal });
    if (!upstream.ok || !upstream.body || !upstream.headers.get("content-type")?.includes("text/event-stream")) {
      const status = upstream.ok ? 502 : upstream.status;
      const code = await refusalCode(upstream);
      request.signal.removeEventListener("abort", stop);
      stop();
      return Response.json({ ok: false, ...(code ? { code } : {}), error: "Live updates unavailable." }, { status });
    }
    const reader = upstream.body.getReader();
    const cleanup = () => {
      request.signal.removeEventListener("abort", stop);
      stop();
    };
    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const { done, value } = await reader.read();
          if (done) {
            cleanup();
            controller.close();
          } else controller.enqueue(value);
        } catch {
          cleanup();
          controller.error(new Error("Live stream disconnected"));
        }
      },
      async cancel() {
        cleanup();
        await reader.cancel().catch(() => undefined);
      },
    });
    return new Response(body, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch {
    request.signal.removeEventListener("abort", stop);
    stop();
    return Response.json({ ok: false, error: "Live updates unavailable." }, { status: 502 });
  }
}

/** The server's refusal code (`FORBIDDEN`, `REP_NOT_LINKED`, `CONFIGURATION_UNAVAILABLE`, …), never its message. */
async function refusalCode(upstream: Response): Promise<string | null> {
  try {
    const text = await upstream.text();
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === "object" && "code" in parsed && typeof parsed.code === "string" && /^[A-Z_]{1,64}$/.test(parsed.code)) {
      return parsed.code;
    }
  } catch {
    // Not JSON: no code.
  }
  return null;
}
