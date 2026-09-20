import assert from "node:assert/strict";
import test from "node:test";
import { ownerCoverageSchema } from "./salesIntelligence";

const schema = ownerCoverageSchema.shape.data.shape.coverage.shape.backfill;
test("backfill Coverage preserves unknown counts and stored gap evidence", () => {
  const empty = schema.parse({ available: false, owner_triggered: true, days: 0, planned: null, partial: null,
    complete: null, failed: null, known_complete_through: null, gaps: [], note: "No windows stored" });
  assert.equal(empty.complete, null);
  const saved = schema.parse({ ...empty, available: true, days: 3, planned: 1, partial: 1, complete: 2, failed: 0,
    known_complete_through: "2026-09-18T00:00:00.000Z", gaps: [{ from: "2026-09-16T00:00:00.000Z", to: "2026-09-17T00:00:00.000Z", reason: "provider_permission_denied" }] });
  assert.equal(saved.gaps[0].reason, "provider_permission_denied");
  assert.equal(saved.failed, 0);
  assert.equal(schema.safeParse({ ...saved, planned: -1 }).success, false);
});
