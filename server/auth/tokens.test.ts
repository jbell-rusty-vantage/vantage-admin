import assert from "node:assert/strict";
import test from "node:test";
import { setTestEnv } from "@/tests/setup-env";
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "./tokens";

test("access tokens round-trip expected admin claims", () => {
  setTestEnv();

  const token = signAccessToken({
    sub: "507f1f77bcf86cd799439011",
    email: "owner@example.com",
    role: "owner",
  });
  const payload = verifyAccessToken(token);

  assert.equal(payload.sub, "507f1f77bcf86cd799439011");
  assert.equal(payload.email, "owner@example.com");
  assert.equal(payload.role, "owner");
});

test("refresh tokens round-trip token version", () => {
  setTestEnv();

  const token = signRefreshToken({
    sub: "507f1f77bcf86cd799439011",
    token_version: 3,
  });
  const payload = verifyRefreshToken(token);

  assert.equal(payload.sub, "507f1f77bcf86cd799439011");
  assert.equal(payload.token_version, 3);
});
