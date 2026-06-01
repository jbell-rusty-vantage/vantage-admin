import assert from "node:assert/strict";
import test from "node:test";
import { parseVantageApiResponse } from "./response";
import { VantageApiError } from "./errors";

test("parseVantageApiResponse unwraps successful backend envelopes", async () => {
  const parsed = await parseVantageApiResponse<{ id: string }>(
    new Response(JSON.stringify({ ok: true, data: { id: "lead_1" } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );

  assert.equal(parsed.kind, "json");
  if (parsed.kind === "json") {
    assert.deepEqual(parsed.data, { id: "lead_1" });
  }
});

test("parseVantageApiResponse throws typed errors for failed envelopes", async () => {
  await assert.rejects(
    parseVantageApiResponse(
      new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json", "x-request-id": "req_1" },
      }),
      "/api/v1/form-leads",
    ),
    (error) => {
      assert.ok(error instanceof VantageApiError);
      assert.equal(error.status, 401);
      assert.equal(error.message, "Unauthorized");
      assert.equal(error.requestId, "req_1");
      assert.equal(error.path, "/api/v1/form-leads");
      return true;
    },
  );
});

test("parseVantageApiResponse supports text health responses", async () => {
  const parsed = await parseVantageApiResponse(
    new Response("ok", {
      status: 200,
      headers: { "content-type": "text/plain" },
    }),
  );

  assert.equal(parsed.kind, "text");
  if (parsed.kind === "text") {
    assert.equal(parsed.text, "ok");
  }
});

test("parseVantageApiResponse supports CSV responses", async () => {
  const parsed = await parseVantageApiResponse(
    new Response("id,name\n1,Austin", {
      status: 200,
      headers: { "content-type": "text/csv" },
    }),
  );

  assert.equal(parsed.kind, "csv");
  if (parsed.kind === "csv") {
    assert.equal(new TextDecoder().decode(parsed.body), "id,name\n1,Austin");
  }
});
