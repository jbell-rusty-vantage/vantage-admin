import assert from "node:assert/strict";
import test from "node:test";
import { diffRegistrySnapshots, formatSnapshotValue } from "./registrySnapshotDiff";

test("diffRegistrySnapshots detects added, removed, and nested changes", () => {
  const entries = diffRegistrySnapshots(
    { name: "A", nested: { rate: 1, keep: true }, gone: "x" },
    { name: "B", nested: { rate: 2, keep: true }, added: "y" },
  );
  const byPath = Object.fromEntries(entries.map((entry) => [entry.path, entry]));
  assert.equal(byPath.name?.kind, "changed");
  assert.equal(byPath["nested.rate"]?.kind, "changed");
  assert.equal(byPath.gone?.kind, "removed");
  assert.equal(byPath.added?.kind, "added");
  assert.equal(byPath["nested.keep"], undefined);
});

test("diffRegistrySnapshots never expands redacted values", () => {
  const entries = diffRegistrySnapshots(
    { secret: "[redacted]", token: "plain" },
    { secret: "[redacted]", token: "[redacted]" },
  );
  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.path, "token");
  assert.equal(entries[0]?.after, "[redacted]");
  assert.equal(formatSnapshotValue("[redacted]"), "[redacted]");
});

test("diffRegistrySnapshots handles create (null before) and large nested collapse", () => {
  const created = diffRegistrySnapshots(null, { name: "New" });
  assert.equal(created[0]?.kind, "added");
  assert.equal(created[0]?.path, "name");

  const deep = {
    a: { b: { c: { d: { e: 1 } } } },
  };
  const deepAfter = {
    a: { b: { c: { d: { e: 2 } } } },
  };
  const entries = diffRegistrySnapshots(deep, deepAfter);
  assert.ok(entries.some((entry) => entry.path.startsWith("a.b.c")));
});
