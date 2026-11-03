import assert from "node:assert/strict";
import { test } from "node:test";
import { canProxyVantagePath } from "../server/auth/authorization";
import { SETUP_SECTIONS } from "../components/setup/setup-sections";

test("Best Relocation has no Setup activation entry or proxy mutation, including Owner", () => {
  assert.equal(SETUP_SECTIONS.some((section) => section.href === "/setup/sheet-ingestion"), false);
  for (const method of ["POST", "PATCH", "DELETE"] as const) {
    for (const path of ["connections/best-relocation", "connections/best-relocation/preview", "connections/best-relocation/run", "runs/old/retry", "conflicts/old/resolve"]) {
      assert.equal(canProxyVantagePath({ role: "owner", method, path: `/api/v1/admin/ingestion/${path}` }), false);
    }
  }
  assert.equal(canProxyVantagePath({ role: "owner", method: "GET", path: "/api/v1/admin/ingestion/runs" }), true);
  assert.equal(canProxyVantagePath({ role: "owner", method: "POST", path: "/api/v1/admin/granot-lifecycle/cases/old/retry" }), true);
});
