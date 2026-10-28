import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { pricingHeaders, pricingTarget } from "@/server/operations-pricing/protocol";
import type { ServerEnv } from "@/lib/env/server";
import { validatePricingBody } from "@/server/operations-pricing/validation";

type Context = { params: Promise<{ path: string[] }> };
const headers = { "cache-control": "no-store" };
function failure(status: number, code: string, message: string) { return Response.json({ ok: false, error: { code, message } }, { status, headers }); }
export async function handlePricingRequest(request: NextRequest, context: Context, deps: { actor: () => Promise<{ id: string; role: string } | null>; env: () => Pick<ServerEnv, "OPERATIONS_API_BASE_URL" | "OPERATIONS_ADMIN_SIGNING_SECRET">; fetch: typeof fetch }) {
  try {
    const actor = await deps.actor();
    if (!actor) return failure(401, "UNAUTHENTICATED", "Sign in again.");
    if (actor.role !== "owner") return failure(403, "FORBIDDEN", "Only the Owner manages transportation pricing.");
    if (request.method !== "GET" && (request.headers.get("origin") !== request.nextUrl.origin || request.headers.get("sec-fetch-site") === "cross-site")) return failure(403, "FORBIDDEN", "Use the dashboard to make this change.");
    let target: string;
    let body = "";
    try {
      target = pricingTarget(request.method, (await context.params).path, request.nextUrl.searchParams);
      if (request.method !== "GET") {
        if (!request.headers.get("content-type")?.startsWith("application/json")) return failure(400, "INVALID_INPUT", "Send JSON.");
        const reader = request.body?.getReader();
        if (!reader) return failure(400, "INVALID_INPUT", "Send JSON.");
        const chunks: Uint8Array[] = []; let length = 0;
        while (true) { const chunk = await reader.read(); if (chunk.done) break; length += chunk.value.byteLength; if (length > 262144) { await reader.cancel(); return failure(413, "PAYLOAD_TOO_LARGE", "Configuration is too large."); } chunks.push(chunk.value); }
        const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
        body = JSON.stringify(validatePricingBody(target, request.method, value));
      }
    } catch { return failure(400, "INVALID_INPUT", "Invalid pricing request."); }
    const env = deps.env();
    if (!env.OPERATIONS_API_BASE_URL || !env.OPERATIONS_ADMIN_SIGNING_SECRET) return failure(503, "DEPENDENCY_UNAVAILABLE", "Transportation pricing is not connected.");
    const upstream = await deps.fetch(new URL(target, env.OPERATIONS_API_BASE_URL), { method: request.method, headers: pricingHeaders({ actorId: actor.id, method: request.method, target, body, secret: env.OPERATIONS_ADMIN_SIGNING_SECRET, requestId: randomUUID(), timestamp: String(Date.now()) }), body: body || undefined, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000) });
    const reader = upstream.body?.getReader();
    if (!reader) throw new Error();
    const chunks: Uint8Array[] = []; let length = 0;
    while (true) { const chunk = await reader.read(); if (chunk.done) break; length += chunk.value.byteLength; if (length > 2_000_000) { await reader.cancel(); throw new Error(); } chunks.push(chunk.value); }
    const text = Buffer.concat(chunks).toString("utf8");
    const value = JSON.parse(text);
    if (typeof value.ok !== "boolean") throw new Error();
    return Response.json(value, { status: upstream.status, headers: { ...headers, ...(upstream.headers.get("retry-after") ? { "retry-after": upstream.headers.get("retry-after")! } : {}) } });
  } catch { return failure(503, "DEPENDENCY_UNAVAILABLE", "Transportation pricing is unavailable. Reload before retrying a draft save; retry the same command for an unknown publication outcome."); }
}


