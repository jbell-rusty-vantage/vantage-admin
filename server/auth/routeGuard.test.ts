import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { ACCESS_TOKEN_COOKIE } from "./cookies";
import { applyAuthRouteGuard, shouldProtectPath } from "./routeGuard";

test("route guard protects dashboard paths", () => {
  assert.equal(shouldProtectPath("/"), true);
  assert.equal(shouldProtectPath("/bookings"), true);
  assert.equal(shouldProtectPath("/duplicate-call-leads"), true);
  assert.equal(shouldProtectPath("/audit-log"), true);
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

test("route guard allows login page even when stale auth cookies exist", () => {
  const request = new NextRequest("http://localhost:3000/login", {
    headers: {
      cookie: `${ACCESS_TOKEN_COOKIE}=stale-token`,
    },
  });

  assert.equal(applyAuthRouteGuard(request), null);
});
