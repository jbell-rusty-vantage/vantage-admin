import assert from "node:assert/strict";
import test from "node:test";
import {
  archiveReportingDestination,
  normalizeReportingDestination,
} from "./reportingDestinations";

test("destination adapter maps snapshot_checksum and artifact links", () => {
  const result = normalizeReportingDestination({
    _id: "507f1f77bcf86cd799439011",
    provider: "google_sheets",
    owner_identity_snapshot: {
      stable_owner_id: "owner-1",
      masked_email: "o***@example.com",
    },
    folder: { id: "folder-1", name: "Exports", url: "https://drive.google.com/folder/1" },
    strategy: "replace_tab",
    workbook: { id: "wb-1", name: "Workbook", url: "https://docs.google.com/spreadsheets/d/wb-1" },
    managed_tab: { immutable_sheet_id: 123, name: "Report" },
    destination_type: "owner_drive",
    ownership_policy: "vantage_managed_tab",
    access_status: "verified",
    health_verified_at: "2026-08-04T10:00:00.000Z",
    denylist_checked_at: "2026-08-04T10:00:00.000Z",
    capacity: { provider_max_cells: 10_000_000, destination_available_cells: 9_000_000 },
    state: "active",
    version: 2,
    snapshot_checksum: "a".repeat(64),
  });

  assert.equal(result.id, "507f1f77bcf86cd799439011");
  assert.equal(result.snapshot_checksum, "a".repeat(64));
  assert.equal(result.workbook?.id, "wb-1");
});

test("archive sends expected_version on DELETE so the proxy can forward it", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return new Response(
      JSON.stringify({
        ok: true,
        data: {
          _id: "507f1f77bcf86cd799439011",
          provider: "google_sheets",
          owner_identity_snapshot: {
            stable_owner_id: "owner-1",
            masked_email: "o***@example.com",
          },
          folder: { id: "folder-1", name: "Exports", url: "https://drive.google.com/folder/1" },
          strategy: "snapshot",
          destination_type: "owner_drive",
          ownership_policy: "vantage_managed_tab",
          access_status: "verified",
          capacity: { provider_max_cells: 10_000_000, destination_available_cells: 10_000_000 },
          state: "archived",
          version: 3,
        },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;
  try {
    await archiveReportingDestination("507f1f77bcf86cd799439011", 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.match(calls[0]?.url ?? "", /\/507f1f77bcf86cd799439011$/);
  assert.equal(calls[0]?.init?.method, "DELETE");
  assert.equal(calls[0]?.init?.body, JSON.stringify({ expected_version: 2 }));
});
