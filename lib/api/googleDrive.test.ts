import assert from "node:assert/strict";
import test from "node:test";
import { bootstrapGooglePicker } from "./googleDrive";

const validBootstrap = {
  picker_api_key: "picker-key",
  picker_app_id: "123456",
  access_token: "short-lived-token",
  access_token_expires_at: "2026-08-04T17:00:00.000Z",
  flow: "folder" as const,
  views: [{ mime_type: "application/vnd.google-apps.folder", mode: "folder" as const }],
  selection_nonce: "nonce",
  connection_health: { connected: true, token_healthy: true },
};

test("Picker bootstrap client rejects unexpected server fields", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        ok: true,
        data: { ...validBootstrap, refresh_token: "must-never-reach-browser-code" },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    )) as typeof fetch;
  try {
    await assert.rejects(
      () => bootstrapGooglePicker("folder"),
      /Unexpected Picker bootstrap field: refresh_token/,
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("Picker bootstrap client accepts the documented allowlist", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ ok: true, data: validBootstrap }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;
  try {
    assert.deepEqual(await bootstrapGooglePicker("folder"), validBootstrap);
  } finally {
    globalThis.fetch = original;
  }
});
