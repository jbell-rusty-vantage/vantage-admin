import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";
import { setTestEnv } from "@/tests/setup-env";
import { ACCESS_TOKEN_COOKIE } from "./cookies";
import { applyAuthRouteGuard, applyRoleRouteGuard, PUBLIC_ASSET_PATHS, shouldProtectPath } from "./routeGuard";

test("route guard protects dashboard paths", () => {
  assert.equal(shouldProtectPath("/"), true);
  assert.equal(shouldProtectPath("/bookings"), true);
  assert.equal(shouldProtectPath("/intakes"), true);
  assert.equal(shouldProtectPath("/manual"), true);
  assert.equal(shouldProtectPath("/extension"), true);
  assert.equal(shouldProtectPath("/job-timeline"), true);
  assert.equal(shouldProtectPath("/duplicate-call-leads"), true);
  assert.equal(shouldProtectPath("/audit-log"), true);
  assert.equal(shouldProtectPath("/operations-registry"), true);
  assert.equal(shouldProtectPath("/operations-registry/foo"), true);
  assert.equal(shouldProtectPath("/reporting"), true);
  assert.equal(shouldProtectPath("/reporting/definition-1"), true);
  assert.equal(shouldProtectPath("/ingestion"), true);
  assert.equal(shouldProtectPath("/ingestion/granot"), true);
  assert.equal(shouldProtectPath("/sales-intelligence"), true);
  assert.equal(shouldProtectPath("/conversations"), true);
});

test("route guard skips auth, api, and static paths", () => {
  assert.equal(shouldProtectPath("/login"), false);
  assert.equal(shouldProtectPath("/api/auth/me"), false);
  assert.equal(shouldProtectPath("/_next/static/app.js"), false);
  assert.equal(shouldProtectPath("/favicon.ico"), false);
});

test("route guard skips public legal pages", () => {
  assert.equal(shouldProtectPath("/privacy-policy"), false);
  assert.equal(shouldProtectPath("/terms-and-conditions"), false);
});

test("route guard leaves employee booking public", () => {
  assert.equal(shouldProtectPath("/employee-booking"), false);
});

test("route guard allows login page even when stale auth cookies exist", () => {
  const request = new NextRequest("http://localhost:3000/login", {
    headers: {
      cookie: `${ACCESS_TOKEN_COOKIE}=stale-token`,
    },
  });

  assert.equal(applyAuthRouteGuard(request), null);
});

// V-T3 M11: the role guard at the request boundary.

function tokenCookie(role: "owner" | "admin" | "rep", options: { expired?: boolean; secret?: string } = {}) {
  setTestEnv();
  const payload = { sub: "65f0000000000000000000a1", email: `${role}@example.invalid`, role, token_version: 0 };
  const secret = options.secret ?? process.env.ADMIN_ACCESS_TOKEN_SECRET!;
  const token = options.expired
    ? jwt.sign({ ...payload, exp: Math.floor(Date.now() / 1000) - 60 }, secret)
    : jwt.sign(payload, secret, { expiresIn: 900 });
  return `${ACCESS_TOKEN_COOKIE}=${token}`;
}

function guard(pathname: string, cookie?: string) {
  return applyRoleRouteGuard(
    new NextRequest(`http://localhost:3000${pathname}`, { headers: cookie ? { cookie } : {} }),
  );
}

function listPublicFiles(dir: string, prefix = ""): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? listPublicFiles(path.join(dir, entry.name), `${prefix}/${entry.name}`)
      : [`${prefix}/${entry.name}`],
  );
}

test("PUBLIC_ASSET_PATHS is exactly the public/ folder plus /favicon.ico", () => {
  const onDisk = listPublicFiles(path.join(process.cwd(), "public"));
  assert.deepEqual([...PUBLIC_ASSET_PATHS].sort(), [...onDisk, "/favicon.ico"].sort());
});

test("a verified rep is refused on page paths ending in an asset extension", () => {
  const rep = tokenCookie("rep");
  for (const pathname of [
    "/customers/x.png",
    "/form-leads/a.svg",
    "/sales-intelligence/numbers/65f0000000000000000000aa.png",
    "/sales-intelligence/outreach/65f0000000000000000000aa.jpg",
    "/settings/logo.webp",
    "/favicon.ico/x",
    "/vantage/other.png",
    "/login.png",
  ]) {
    assert.equal(guard(pathname, rep)?.status, 403, pathname);
  }
});

test("a verified rep still loads /_next/ files and the real public assets", () => {
  const rep = tokenCookie("rep");
  for (const pathname of ["/_next/static/chunks/app.js", "/_next/image", ...PUBLIC_ASSET_PATHS]) {
    assert.equal(guard(pathname, rep), null, pathname);
  }
  assert.equal(guard("/sales-intelligence", rep), null);
  assert.equal(guard("/sales-intelligence/outreach/65f0000000000000000000aa", rep), null);
});

test("an expired or unverifiable access token is no session: protected pages redirect to /login", () => {
  const cookies = [
    tokenCookie("rep", { expired: true }),
    tokenCookie("owner", { expired: true }),
    tokenCookie("rep", { secret: "some-other-secret-some-other-secret-00" }),
    `${ACCESS_TOKEN_COOKIE}=not-a-jwt`,
  ];
  for (const cookie of cookies) {
    for (const pathname of ["/form-leads", "/customers/x.png", "/sales-intelligence", "/daily"]) {
      const response = guard(pathname, cookie);
      assert.equal(response?.status, 307, `${pathname} ${cookie.slice(0, 40)}`);
      const location = new URL(response!.headers.get("location")!);
      assert.equal(location.pathname, "/login");
      assert.equal(location.searchParams.get("next"), pathname);
    }
    // Session-free pages and assets still pass (no redirect loop on /login).
    for (const pathname of ["/login", "/api/auth/refresh", "/privacy-policy", "/accept-invite", "/next.svg", "/_next/static/a.js"]) {
      assert.equal(guard(pathname, cookie), null, pathname);
    }
  }
});

test("owner and admin are unchanged by the role guard; no cookie is left to the auth guard", () => {
  for (const role of ["owner", "admin"] as const) {
    const cookie = tokenCookie(role);
    for (const pathname of ["/form-leads", "/customers/x.png", "/sales-intelligence", "/settings", "/daily", "/next.svg"]) {
      assert.equal(guard(pathname, cookie), null, `${role} ${pathname}`);
    }
  }
  assert.equal(guard("/form-leads"), null);
  assert.equal(guard("/customers/x.png"), null);
});
