import assert from "node:assert/strict";
import test from "node:test";
import { RegistryApiError } from "./registryRequest";
import {
  buildSimpleCplDraftRows,
  computeSimpleCplChanges,
  CPL_PREVIEW_STALE_CODE,
  isCplPreviewStaleError,
  isRegistryStaleRevisionError,
  isSnapshotRateMissing,
  parseCplAmountInput,
  REGISTRY_STALE_REVISION_CODE,
  resolveAdvancedExpectedRevision,
  snapshotCurrentAmount,
  type CplSnapshot,
} from "./registryCpl";

const baseGranularity = {
  id: "gran-1",
  _id: "gran-1",
  source_company: "co-1",
  granularity_key: "forms",
  channel: "form" as const,
  owner_label: "Forms",
  crm_label: "Forms",
  aliases: [],
  source_sites: [],
  priority: 0,
  active: true,
  schedule_revision: 3,
  created_from: "seed",
};

function snapshot(
  items: CplSnapshot["items"],
): CplSnapshot {
  return { generated_at: "2026-01-01T00:00:00.000Z", items };
}

test("snapshotCurrentAmount distinguishes missing from zero", () => {
  assert.equal(snapshotCurrentAmount({ status: "missing_rate", fallback_amount: 0 }), null);
  assert.equal(snapshotCurrentAmount({ status: "resolved", amount: 0, amount_cents: 0 }), 0);
  assert.equal(isSnapshotRateMissing({ status: "missing_rate", fallback_amount: 0 }), true);
});

test("computeSimpleCplChanges returns only dirty rows", () => {
  const data = snapshot([
    {
      source_granularity: { ...baseGranularity, id: "a" },
      schedule_revision: 1,
      current_rate: { status: "resolved", amount: 10, amount_cents: 1000 },
    },
    {
      source_granularity: { ...baseGranularity, id: "b" },
      schedule_revision: 2,
      current_rate: { status: "missing_rate", fallback_amount: 0 },
    },
    {
      source_granularity: { ...baseGranularity, id: "c" },
      schedule_revision: 4,
      current_rate: { status: "resolved", amount: 5, amount_cents: 500 },
    },
  ]);

  const changes = computeSimpleCplChanges(data, {
    a: "10",
    b: "7.5",
    c: "5",
  });

  assert.equal(changes.length, 1);
  assert.deepEqual(changes[0], {
    source_granularity_id: "b",
    amount: 7.5,
    schedule_revision: 2,
  });
});

test("computeSimpleCplChanges allows explicit zero edits", () => {
  const data = snapshot([
    {
      source_granularity: baseGranularity,
      schedule_revision: 5,
      current_rate: { status: "resolved", amount: 12, amount_cents: 1200 },
    },
  ]);

  const changes = computeSimpleCplChanges(data, { "gran-1": "0" });
  assert.equal(changes.length, 1);
  assert.equal(changes[0]?.amount, 0);
});

test("buildSimpleCplDraftRows seeds missing rows as empty drafts", () => {
  const data = snapshot([
    {
      source_granularity: baseGranularity,
      schedule_revision: 1,
      current_rate: { status: "missing_rate", fallback_amount: 0 },
    },
  ]);

  const rows = buildSimpleCplDraftRows(data, {});
  assert.equal(rows[0]?.draft_amount, "");
  assert.equal(rows[0]?.baseline_amount, null);
});

test("parseCplAmountInput rejects empty input instead of coercing to zero", () => {
  assert.equal(parseCplAmountInput(""), null);
  assert.equal(parseCplAmountInput("   "), null);
  assert.equal(parseCplAmountInput("abc"), null);
  assert.equal(parseCplAmountInput("-1"), null);
  assert.equal(parseCplAmountInput("0"), 0);
  assert.equal(parseCplAmountInput("12.5"), 12.5);
});

test("resolveAdvancedExpectedRevision never fabricates revision 0 while unloaded", () => {
  assert.equal(resolveAdvancedExpectedRevision(false, undefined), null);
  assert.equal(resolveAdvancedExpectedRevision(false, 0), null);
  assert.equal(resolveAdvancedExpectedRevision(true, undefined), null);
  assert.equal(resolveAdvancedExpectedRevision(true, 0), 0);
  assert.equal(resolveAdvancedExpectedRevision(true, 4), 4);
});

test("stale registry/preview error helpers key off stable codes", () => {
  const staleRevision = new RegistryApiError({
    message: "stale",
    status: 409,
    registryCode: REGISTRY_STALE_REVISION_CODE,
  });
  const stalePreview = new RegistryApiError({
    message: "stale preview",
    status: 409,
    registryCode: CPL_PREVIEW_STALE_CODE,
  });
  const other = new RegistryApiError({
    message: "other",
    status: 400,
    registryCode: "REGISTRY_VALIDATION",
  });

  assert.equal(isRegistryStaleRevisionError(staleRevision), true);
  assert.equal(isRegistryStaleRevisionError(stalePreview), false);
  assert.equal(isCplPreviewStaleError(stalePreview), true);
  assert.equal(isCplPreviewStaleError(other), false);
});
