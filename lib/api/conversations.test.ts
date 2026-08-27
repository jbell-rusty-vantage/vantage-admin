import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchConversation,
  fetchConversationAudioUrl,
  fetchConversations,
} from "./conversations";

type FetchCall = { input: string | URL | Request; init?: RequestInit };

function mockFetch(data: unknown, status = 200) {
  const calls: FetchCall[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ input, init });
    return new Response(JSON.stringify(data), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return calls;
}

test("list conversations uses the Owner proxy and returns the list DTO", async () => {
  const calls = mockFetch({
    ok: true,
    data: [
      {
        id: "6a905b5cf7dda52cfacb721e",
        has_transcript: true,
        has_summary: true,
      },
    ],
  });
  const result = await fetchConversations();
  assert.equal(String(calls[0]?.input), "/api/proxy/api/v1/admin/conversations");
  assert.equal(calls[0]?.init?.credentials, "include");
  assert.equal(result[0]?.id, "6a905b5cf7dda52cfacb721e");
  assert.equal("transcript" in (result[0] ?? {}), false);
  assert.equal("summary" in (result[0] ?? {}), false);
});

test("conversation detail uses the Owner proxy id route", async () => {
  const calls = mockFetch({
    ok: true,
    data: { id: "6a905b5cf7dda52cfacb721e", transcript: { text: "Redacted" } },
  });
  const result = await fetchConversation("6a905b5cf7dda52cfacb721e");
  assert.equal(
    String(calls[0]?.input),
    "/api/proxy/api/v1/admin/conversations/6a905b5cf7dda52cfacb721e",
  );
  assert.equal(result.transcript?.text, "Redacted");
});

test("audio URL uses the audited play route", async () => {
  const calls = mockFetch({
    ok: true,
    data: { url: "https://signed.example/audio", expires_at: "2026-08-27T16:05:00.000Z", ttl_ms: 300000 },
  });
  const result = await fetchConversationAudioUrl("6a905b5cf7dda52cfacb721e");
  assert.equal(
    String(calls[0]?.input),
    "/api/proxy/api/v1/admin/conversations/6a905b5cf7dda52cfacb721e/audio-url",
  );
  assert.equal(result.url, "https://signed.example/audio");
});
