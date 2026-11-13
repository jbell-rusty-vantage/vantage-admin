import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { computeAdminActorSignature } from "../auth/proxySigning";
import { cmsTarget, handleCmsRequest, staticPreviewAsset } from "./proxy";
import { sitePreviewOrigin } from "./environment";

const owner = { id: "111111111111111111111111", email: "owner@example.test", role: "owner" };
const env = { SITE_PREVIEW_API_BASE_URL: "https://vantage-sites-preview-api.vercel.app", SITE_PREVIEW_API_SECRET: "preview-api-secret", SITE_PREVIEW_ADMIN_SIGNING_SECRET: "dedicated-preview-key-1234567890123456", SITE_PREVIEW_API_PROTECTION_BYPASS: "preview-bypass" };
const context = (path = ["admin"]) => ({ params: Promise.resolve({ path }) });
const request = (method = "GET", path = "admin", body?: unknown, origin = "https://admin.example.test") => new NextRequest(`https://admin.example.test/api/site-preview-cms/${path}`, { method, headers: { origin, "content-type": "application/json", cookie: "never-forward-me", "x-vantage-admin-role": "admin" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const failFetch: typeof fetch = async () => { throw new Error("Unexpected fetch"); };

test("unauthenticated and every non-owner role are denied before upstream access", async () => {
  for (const actor of [null, ...["admin", "rep", "manager"].map(role => ({ ...owner, role }))]) {
    const response = await handleCmsRequest(request(), context(), { actor: async () => actor, env: () => env, fetch: failFetch });
    assert.equal(response.status, actor ? 403 : 401);
  }
});

test("mutations require the current dashboard origin", async () => {
  const response = await handleCmsRequest(request("PUT", "admin", { expectedRevision: 1, values: {} }, "https://attacker.test"), context(), { actor: async () => owner, env: () => env, fetch: failFetch });
  assert.equal(response.status, 403);
});

test("routing excludes operational APIs, unbounded query strings and traversal", () => {
  for (const path of [["admin", "..", "testimonials"], ["admin/testimonials"], ["admin", "bookings"], ["https:", "evil.test"]]) assert.throws(() => cmsTarget("GET", path, new URLSearchParams()));
  assert.throws(() => cmsTarget("GET", ["admin"], new URLSearchParams("origin=https://evil.test")));
  assert.throws(() => cmsTarget("GET", ["admin", "testimonials"], new URLSearchParams("page=1&page=2")));
  assert.equal(cmsTarget("GET", ["admin", "history"], new URLSearchParams("page=2&limit=20")), "/api/v1/site-preview/cms/admin/history?page=2&limit=20");
});

test("CMS credentials can only target the isolated stable origin or development loopback", () => {
  assert.equal(sitePreviewOrigin(env.SITE_PREVIEW_API_BASE_URL, true), env.SITE_PREVIEW_API_BASE_URL);
  assert.equal(sitePreviewOrigin("http://127.0.0.1:4500", false), "http://127.0.0.1:4500");
  for (const value of ["https://vantage-movers-main-server.vercel.app", "https://vantage-sites-preview-api.vercel.app.evil.test", "https://vantage-sites-preview-api.vercel.app/admin", "https://user@vantage-sites-preview-api.vercel.app", "https://vantage-sites-preview-api.vercel.app?x=1", "http://127.0.0.1:4500"]) assert.throws(() => sitePreviewOrigin(value, true));
});

test("signed owner headers use dedicated key and preserve revision conflict without forwarding cookies", async () => {
  let called = false;
  const response = await handleCmsRequest(request("PUT", "admin", { expectedRevision: 4, values: { heading: "Changed" } }), context(), { actor: async () => owner, env: () => env, fetch: async (url, init) => {
    called = true;
    assert.equal(url, `${env.SITE_PREVIEW_API_BASE_URL}/api/v1/site-preview/cms/admin`);
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("cookie"), null);
    assert.equal(headers.get("x-vantage-admin-role"), "owner");
    assert.equal(headers.get("x-api-secret"), env.SITE_PREVIEW_API_SECRET);
    assert.equal(headers.get("x-vercel-protection-bypass"), env.SITE_PREVIEW_API_PROTECTION_BYPASS);
    assert.equal(headers.get("x-vantage-admin-signature"), computeAdminActorSignature({ adminId: owner.id, email: owner.email, role: owner.role, timestamp: headers.get("x-vantage-admin-timestamp")!, requestId: headers.get("x-vantage-admin-request-id")!, method: "PUT", path: "/api/v1/site-preview/cms/admin" }, env.SITE_PREVIEW_ADMIN_SIGNING_SECRET));
    assert.equal(init?.redirect, "error");
    assert.deepEqual(JSON.parse(String(init?.body)), { expectedRevision: 4, values: { heading: "Changed" } });
    return Response.json({ ok: false, code: "REVISION_CONFLICT", error: "Reload" }, { status: 409 });
  } });
  assert.equal(called, true);
  assert.equal(response.status, 409);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("missing configuration fails closed while unsupported media never reaches a browser", async () => {
  assert.equal((await handleCmsRequest(request(), context(), { actor: async () => owner, env: () => ({}), fetch: failFetch })).status, 503);
  const response = await handleCmsRequest(request("GET", "media/aaaaaaaaaaaaaaaaaaaaaaaa"), context(["media", "aaaaaaaaaaaaaaaaaaaaaaaa"]), { actor: async () => owner, env: () => env, fetch: async () => new Response("<svg/>", { headers: { "content-type": "image/svg+xml" } }) });
  assert.equal(response.status, 503);
});

test("valid raster media is streamed with no sniffing and no upstream cookies", async () => {
  const response = await handleCmsRequest(request("GET", "media/aaaaaaaaaaaaaaaaaaaaaaaa"), context(["media", "aaaaaaaaaaaaaaaaaaaaaaaa"]), { actor: async () => owner, env: () => env, fetch: async () => new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/webp", "set-cookie": "not-forwarded" } }) });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/webp");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("set-cookie"), null);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), new Uint8Array([1, 2, 3]));
});

test("static thumbnails stay on the fixed preview site and receive only the site bypass", async () => {
  for (const value of [["..", "api", "quote"], ["api", "quote"], ["images", "..", "x.png"], ["images", "a%2fb.png"], ["images", "a.html"], ["images/x.png"]]) assert.throws(() => staticPreviewAsset(value));
  assert.equal(staticPreviewAsset(["images", "selected-20261112", "home.webp"]), "/images/selected-20261112/home.webp");
  const response = await handleCmsRequest(request("GET", "assets/partnerlogos/top10.svg"), context(["assets", "partnerlogos", "top10.svg"]), { actor: async () => owner, env: () => ({ ...env, SITE_PREVIEW_SITE_PROTECTION_BYPASS: "site-only-bypass" }), fetch: async (url, init) => {
    assert.equal(url, "https://vantage-main-site-optimization.vercel.app/partnerlogos/top10.svg");
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("x-vercel-protection-bypass"), "site-only-bypass");
    assert.equal(headers.get("x-api-secret"), null);
    assert.equal(headers.get("cookie"), null);
    assert.equal(headers.get("x-vantage-admin-signature"), null);
    return new Response("<svg/>", { headers: { "content-type": "image/svg+xml" } });
  } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-security-policy"), "default-src 'none'; sandbox");
});
