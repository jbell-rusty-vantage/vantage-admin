import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { ADMIN_PROXY_HEADER_NAMES, computeAdminActorSignature } from "@/server/auth/proxySigning";
import { sitePreviewOrigin, type SitePreviewEnvironment } from "./environment";

const BASE = "/api/v1/site-preview/cms";
const responseHeaders = { "cache-control": "no-store", "x-content-type-options": "nosniff" };
type Actor = { id: string; email: string; role: string };
type Dependencies = { actor: () => Promise<Actor | null>; env: () => SitePreviewEnvironment; fetch: typeof fetch };
const failure = (status: number, code: string, error: string) => Response.json({ ok: false, code, error }, { status, headers: responseHeaders });

export function staticPreviewAsset(path: string[]) {
  const value = `/${path.join("/")}`;
  if (path.some(part => !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(part) || part.includes(".."))) throw new Error("Invalid asset path");
  if (!["/icon.svg", "/vantage-movers-logo-refined-smaller-text.svg"].includes(value) && !/^\/(?:images|partnerlogos|sitepictures)\/.+\.(?:png|jpe?g|webp|svg)$/i.test(value)) throw new Error("Unknown static asset");
  return value;
}

export function cmsTarget(method: string, path: string[], query: URLSearchParams) {
  const route = path.join("/");
  const media = /^media\/[a-f\d]{24}$/i.test(route);
  const allowed = method === "GET" ? ["admin", "admin/history", "admin/testimonials"].includes(route) || media
    : method === "PUT" ? route === "admin"
      : method === "POST" && ["admin/restore", "admin/media"].includes(route);
  if (!allowed || path.some(part => !part || part.includes("/") || part.includes("\\"))) throw new Error("Unknown preview operation");
  const params = new URLSearchParams();
  for (const [key, value] of query) {
    if (!["admin/history", "admin/testimonials"].includes(route) || !["page", "limit"].includes(key) || !/^[1-9]\d{0,5}$/.test(value) || params.has(key)) throw new Error("Invalid query");
    params.set(key, value);
  }
  return `${BASE}/${route}${params.size ? `?${params}` : ""}`;
}

async function readBounded(stream: ReadableStream<Uint8Array> | null, limit: number) {
  if (!stream) return Buffer.alloc(0);
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.byteLength;
    if (size > limit) { await reader.cancel(); throw new Error("Body too large"); }
    chunks.push(chunk.value);
  }
  return Buffer.concat(chunks);
}

export async function handleCmsRequest(request: NextRequest, context: { params: Promise<{ path: string[] }> }, deps: Dependencies) {
  try {
    const actor = await deps.actor();
    if (!actor) return failure(401, "UNAUTHENTICATED", "Sign in to manage preview content.");
    if (actor.role !== "owner") return failure(403, "FORBIDDEN", "Only the Owner can manage preview content.");
    const path = (await context.params).path;
    if (path[0] === "assets") {
      if (request.method !== "GET" || request.nextUrl.search) return failure(400, "INVALID_INPUT", "Unknown image request.");
      let asset: string;
      try { asset = staticPreviewAsset(path.slice(1)); } catch { return failure(400, "INVALID_INPUT", "Unknown image request."); }
      const bypass = deps.env().SITE_PREVIEW_SITE_PROTECTION_BYPASS;
      if (!bypass) return failure(503, "NOT_CONNECTED", "Preview images are not connected yet.");
      const upstream = await deps.fetch(`https://vantage-main-site-optimization.vercel.app${asset}`, { headers: { "x-vercel-protection-bypass": bypass }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000) });
      if (!upstream.ok) return failure(upstream.status === 404 ? 404 : 503, "UNAVAILABLE", "Preview image is unavailable.");
      const type = upstream.headers.get("content-type")?.split(";")[0] ?? "";
      if (!["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(type)) throw new Error();
      const bytes = await readBounded(upstream.body, 8_000_000);
      return new Response(new Uint8Array(bytes), { headers: { ...responseHeaders, "content-type": type, "content-security-policy": "default-src 'none'; sandbox" } });
    }
    if (request.method !== "GET" && (request.headers.get("origin") !== request.nextUrl.origin || request.headers.get("sec-fetch-site") === "cross-site")) return failure(403, "FORBIDDEN", "Use the dashboard to save changes.");
    let target: string;
    try { target = cmsTarget(request.method, path, request.nextUrl.searchParams); }
    catch { return failure(400, "INVALID_INPUT", "Unknown preview content operation."); }
    let body: string | undefined;
    if (request.method !== "GET") {
      if (!request.headers.get("content-type")?.startsWith("application/json")) return failure(400, "INVALID_INPUT", "Send JSON.");
      try {
        const value: unknown = JSON.parse((await readBounded(request.body, 3_000_000)).toString("utf8"));
        if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
        body = JSON.stringify(value);
      } catch { return failure(400, "INVALID_INPUT", "The submitted content is invalid or too large."); }
    }
    const env = deps.env();
    if (!env.SITE_PREVIEW_API_BASE_URL || !env.SITE_PREVIEW_API_SECRET || !env.SITE_PREVIEW_ADMIN_SIGNING_SECRET || env.SITE_PREVIEW_ADMIN_SIGNING_SECRET.length < 32) return failure(503, "NOT_CONNECTED", "Preview content is not connected yet.");
    const origin = sitePreviewOrigin(env.SITE_PREVIEW_API_BASE_URL);
    const timestamp = String(Date.now());
    const requestId = randomUUID();
    const headers = new Headers({ "x-api-secret": env.SITE_PREVIEW_API_SECRET });
    headers.set(ADMIN_PROXY_HEADER_NAMES.userId, actor.id);
    headers.set(ADMIN_PROXY_HEADER_NAMES.email, actor.email);
    headers.set(ADMIN_PROXY_HEADER_NAMES.role, actor.role);
    headers.set(ADMIN_PROXY_HEADER_NAMES.timestamp, timestamp);
    headers.set(ADMIN_PROXY_HEADER_NAMES.requestId, requestId);
    headers.set(ADMIN_PROXY_HEADER_NAMES.signature, computeAdminActorSignature({ adminId: actor.id, email: actor.email, role: actor.role, timestamp, requestId, method: request.method, path: target }, env.SITE_PREVIEW_ADMIN_SIGNING_SECRET));
    if (body) headers.set("content-type", "application/json");
    if (env.SITE_PREVIEW_API_PROTECTION_BYPASS) headers.set("x-vercel-protection-bypass", env.SITE_PREVIEW_API_PROTECTION_BYPASS);
    const upstream = await deps.fetch(`${origin}${target}`, { method: request.method, body, headers, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(25000) });
    const bytes = await readBounded(upstream.body, 8_000_000);
    if (target.startsWith(`${BASE}/media/`) && upstream.ok) {
      const type = upstream.headers.get("content-type")?.split(";")[0] ?? "";
      if (!["image/png", "image/jpeg", "image/webp"].includes(type)) throw new Error();
      return new Response(new Uint8Array(bytes), { headers: { ...responseHeaders, "content-type": type } });
    }
    const value = JSON.parse(bytes.toString("utf8"));
    if (typeof value.ok !== "boolean") throw new Error();
    return Response.json(value, { status: upstream.status, headers: responseHeaders });
  } catch { return failure(503, "UNAVAILABLE", "Preview content is unavailable. Reload to check whether your last save completed before retrying."); }
}
