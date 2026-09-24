import assert from "node:assert/strict";
import test from "node:test";
import { setTestEnv } from "@/tests/setup-env";
import { computeAdminActorSignature } from "@/server/auth/proxySigning";
import type { VantageApiRequestOptions } from "@/server/vantage-api/client";
import {
  ADMIN_INVITE_EMAIL_PATH,
  CATALOG_AGENTS_PATH,
  createMainServerAgentDirectory,
  createMainServerInviteMailer,
  type VantageRequest,
} from "./mainServer";
import { UsersError, type UsersActor } from "./types";

const OWNER: UsersActor = { id: "0000000000000000000000a1", email: "owner@example.invalid", role: "owner" };

function fakeRequest(respond: (path: string, options: VantageApiRequestOptions) => unknown) {
  const calls: Array<{ path: string; options: VantageApiRequestOptions }> = [];
  const request = (async (path: string, options: VantageApiRequestOptions = {}) => {
    calls.push({ path, options });
    const data = respond(path, options);
    if (data instanceof Error) throw data;
    return { kind: "json", status: 200, headers: new Headers(), data };
  }) as VantageRequest;
  return { request, calls };
}

function assertSigned(headers: HeadersInit | undefined, method: string, path: string) {
  const h = new Headers(headers);
  const expected = computeAdminActorSignature(
    {
      adminId: OWNER.id,
      email: OWNER.email,
      role: "owner",
      timestamp: h.get("x-vantage-admin-timestamp") ?? "",
      requestId: h.get("x-vantage-admin-request-id") ?? "",
      method,
      path: `/${path}`,
    },
    process.env.VANTAGE_ADMIN_PROXY_SIGNING_SECRET ?? "",
  );
  assert.equal(h.get("x-vantage-admin-signature"), expected);
  assert.equal(h.get("x-vantage-admin-role"), "owner");
}

test("active-Agent check reads the Owner-signed catalog and fails closed", async () => {
  setTestEnv();
  const { request, calls } = fakeRequest(() => ({
    items: [
      { id: "65f0000000000000000000aa", active: true },
      { id: "65f0000000000000000000bb", active: false },
    ],
  }));
  const directory = createMainServerAgentDirectory(request);
  assert.equal(await directory.isActiveAgent("65F0000000000000000000AA", OWNER), true);
  assert.equal(await directory.isActiveAgent("65f0000000000000000000bb", OWNER), false);
  assert.equal(await directory.isActiveAgent("65f0000000000000000000cc", OWNER), false);
  assert.equal(calls[0]?.path, CATALOG_AGENTS_PATH);
  assertSigned(calls[0]?.options.headers, "GET", CATALOG_AGENTS_PATH);

  const down = createMainServerAgentDirectory(fakeRequest(() => new Error("ECONNREFUSED")).request);
  await assert.rejects(down.isActiveAgent("65f0000000000000000000aa", OWNER), (error: unknown) =>
    error instanceof UsersError && error.code === "agent_check_unavailable");
  const odd = createMainServerAgentDirectory(fakeRequest(() => ({ unexpected: true })).request);
  await assert.rejects(odd.isActiveAgent("65f0000000000000000000aa", OWNER), UsersError);
});

test("invite mailer posts the signed request and maps every failure to a copy-link status", async () => {
  setTestEnv();
  const link = "https://admin.example.invalid/accept-invite#token=abc";
  const expiresAt = new Date("2026-09-27T15:00:00.000Z");
  const sent = fakeRequest(() => ({ status: "sent" }));
  const mailer = createMainServerInviteMailer(sent.request);
  assert.equal(await mailer.sendInvite({ actor: OWNER, to: "rep@example.invalid", link, expiresAt }), "sent");
  assert.equal(sent.calls[0]?.path, ADMIN_INVITE_EMAIL_PATH);
  assert.equal(sent.calls[0]?.options.method, "POST");
  assert.deepEqual(sent.calls[0]?.options.body, { to: "rep@example.invalid", link, expires_at: expiresAt.toISOString() });
  assertSigned(sent.calls[0]?.options.headers, "POST", ADMIN_INVITE_EMAIL_PATH);

  for (const [data, expected] of [
    [{ status: "not_configured" }, "not_configured"],
    [{ status: "failed", provider_status: 400 }, "failed"],
    [{ status: "weird" }, "unreachable"],
    [new Error("401 Unauthorized"), "unreachable"],
  ] as const) {
    const client = createMainServerInviteMailer(fakeRequest(() => data).request);
    assert.equal(await client.sendInvite({ actor: OWNER, to: "rep@example.invalid", link, expiresAt }), expected);
  }
});
