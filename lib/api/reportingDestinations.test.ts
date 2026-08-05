import assert from "node:assert/strict";
import test from "node:test";
import { normalizeReportingDestination } from "./reportingDestinations";

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
