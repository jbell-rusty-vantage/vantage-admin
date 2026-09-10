import assert from "node:assert/strict";
import test from "node:test";
import { publicProxyErrorMessage } from "./publicError";

test("owner-safe 503 reporting messages pass through the proxy", () => {
  assert.equal(
    publicProxyErrorMessage(
      503,
      "Sheet creation is unavailable until reporting confirmation is configured.",
    ),
    "Sheet creation is unavailable until reporting confirmation is configured.",
  );
  assert.equal(
    publicProxyErrorMessage(
      503,
      "Google reporting delivery is disabled by deployment configuration.",
    ),
    "Google reporting delivery is disabled by deployment configuration.",
  );
});

test("client validation messages stay visible", () => {
  assert.equal(
    publicProxyErrorMessage(409, "Destination health verification is stale."),
    "Destination health verification is stale.",
  );
});

test("infrastructure 500s stay generic", () => {
  assert.equal(
    publicProxyErrorMessage(500, "connect ECONNREFUSED 127.0.0.1:4000"),
    "Vantage API request failed.",
  );
  assert.equal(publicProxyErrorMessage(500, ""), "Vantage API request failed.");
});

test("sanitized reporting 500s keep the server wording", () => {
  assert.equal(publicProxyErrorMessage(500, "Reporting request failed"), "Reporting request failed");
});
