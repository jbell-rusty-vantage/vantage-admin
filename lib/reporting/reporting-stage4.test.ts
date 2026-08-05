import assert from "node:assert/strict";
import test from "node:test";
import { assertPickerBootstrapAllowlist } from "../google/picker";
import { reportingRunPollIntervalMs } from "./polling";
import { computeChecksumSync } from "./checksum";

test("picker bootstrap allowlist rejects unexpected fields", () => {
  assert.doesNotThrow(() =>
    assertPickerBootstrapAllowlist({
      picker_api_key: "key",
      picker_app_id: "app",
      access_token: "token",
      access_token_expires_at: "2026-08-04T10:05:00.000Z",
      flow: "folder",
      views: [],
      selection_nonce: "nonce",
      connection_health: { connected: true, token_healthy: true },
    }),
  );
  assert.throws(() =>
    assertPickerBootstrapAllowlist({
      refresh_token: "secret",
    }),
  );
});

test("reporting run polling uses bounded backoff steps", () => {
  assert.equal(reportingRunPollIntervalMs("writing", 0), 2_000);
  assert.equal(reportingRunPollIntervalMs("writing", 1), 4_000);
  assert.equal(reportingRunPollIntervalMs("writing", 2), 8_000);
  assert.equal(reportingRunPollIntervalMs("writing", 5), 15_000);
  assert.equal(reportingRunPollIntervalMs("completed", 0), false);
});

test("checksum matches server envelope shape", () => {
  const checksum = computeChecksumSync({
    checksum_version: 1,
    artifact_kind: "reporting_destination_snapshot",
    schema_version: 1,
    payload: {
      contractVersion: 1,
      destinationId: "507f1f77bcf86cd799439011",
      provider: "google_sheets",
      driveConnectionId: "conn",
      ownerIdentitySnapshot: { stableOwnerId: "owner", maskedEmail: "o***@example.com" },
      folder: { id: "f", name: "Folder", url: "https://example.com/f" },
      strategy: "snapshot",
      destinationType: "owner_drive",
      ownershipPolicy: "vantage_managed_tab",
      accessStatus: "verified",
      healthVerifiedAt: "2026-08-04T10:00:00.000Z",
      archived: false,
      safety: {
        denylistCheckedAt: "2026-08-04T10:00:00.000Z",
        operationalWorkbookMatch: false,
        humanCreatedTabTakeover: false,
      },
      capacity: { providerMaxCells: 10_000_000, destinationAvailableCells: 9_000_000 },
    },
  });
  assert.match(checksum, /^[a-f0-9]{64}$/);
});
