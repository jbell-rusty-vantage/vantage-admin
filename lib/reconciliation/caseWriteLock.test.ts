import assert from "node:assert/strict";
import test from "node:test";
import { runWithCaseWriteLock } from "./caseWriteLock";

test("case write lock rejects concurrent writes for the same case", async () => {
  const pending = new Set<string>();
  let releaseFirstWrite!: () => void;
  const firstWrite = runWithCaseWriteLock(
    pending,
    "case-a",
    () =>
      new Promise<void>((resolve) => {
        releaseFirstWrite = resolve;
      }),
    () => undefined,
  );

  await assert.rejects(
    runWithCaseWriteLock(pending, "case-a", async () => undefined, () => undefined),
    /still in progress/,
  );
  releaseFirstWrite();
  await firstWrite;
  assert.equal(pending.has("case-a"), false);
});

test("case write lock allows unrelated cases concurrently", async () => {
  const pending = new Set<string>();
  let releaseCaseA!: () => void;
  const snapshots: string[][] = [];
  const recordSnapshot = (caseIds: Set<string>) => {
    snapshots.push([...caseIds].sort());
  };
  const caseAWrite = runWithCaseWriteLock(
    pending,
    "case-a",
    () =>
      new Promise<void>((resolve) => {
        releaseCaseA = resolve;
      }),
    recordSnapshot,
  );

  await runWithCaseWriteLock(pending, "case-b", async () => undefined, recordSnapshot);
  assert.equal(pending.has("case-a"), true);
  assert.equal(pending.has("case-b"), false);
  releaseCaseA();
  await caseAWrite;
  assert.deepEqual(snapshots, [
    ["case-a"],
    ["case-a", "case-b"],
    ["case-a"],
    [],
  ]);
});
