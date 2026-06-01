import assert from "node:assert/strict";
import test from "node:test";
import { setTestEnv } from "@/tests/setup-env";
import { buildVantageApiUrl } from "./url";

test("buildVantageApiUrl keeps relative proxy paths on the configured host", () => {
  setTestEnv();

  const url = buildVantageApiUrl("api/v1/form-leads?limit=1");

  assert.equal(url.href, "https://vantage-movers-main-server.test/api/v1/form-leads?limit=1");
});

test("buildVantageApiUrl rejects absolute proxy paths", () => {
  setTestEnv();

  assert.throws(
    () => buildVantageApiUrl("https://attacker.example/api/v1/form-leads"),
    /configured Vantage API host/,
  );
});
