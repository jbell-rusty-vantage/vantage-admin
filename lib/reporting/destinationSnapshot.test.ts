import assert from "node:assert/strict";
import test from "node:test";
import type { ReportingDestinationSummary } from "@/lib/api/reportingDestinations";
import {
  REPORTING_DESTINATION_HEALTH_MAX_AGE_MS,
  canBindDestinationToDraft,
  destinationDeliveryExplanation,
  isDestinationHealthFresh,
} from "./destinationSnapshot";

const now = Date.parse("2026-09-10T17:00:00.000Z");

function destination(
  overrides: Partial<ReportingDestinationSummary> = {},
): ReportingDestinationSummary {
  return {
    id: "dest-1",
    provider: "google_sheets",
    owner_identity_snapshot: { stable_owner_id: "owner", masked_email: "o***@example.com" },
    folder: { id: "folder-1", name: "Exports", url: "https://drive.google.com/drive/folders/folder-1" },
    strategy: "snapshot",
    destination_type: "owner_drive",
    ownership_policy: "vantage_managed_tab",
    access_status: "verified",
    health_verified_at: "2026-09-10T16:00:00.000Z",
    denylist_checked_at: "2026-09-10T16:00:00.000Z",
    capacity: { provider_max_cells: 10_000_000, destination_available_cells: 10_000_000 },
    state: "active",
    version: 1,
    snapshot_checksum: "a".repeat(64),
    ...overrides,
  };
}

test("fresh health is within the 24-hour verification window", () => {
  assert.equal(isDestinationHealthFresh(destination(), now), true);
  assert.equal(
    isDestinationHealthFresh(
      destination({
        health_verified_at: new Date(now - REPORTING_DESTINATION_HEALTH_MAX_AGE_MS).toISOString(),
        denylist_checked_at: new Date(now - REPORTING_DESTINATION_HEALTH_MAX_AGE_MS).toISOString(),
      }),
      now,
    ),
    true,
  );
});

test("August verification is stale on September 10", () => {
  assert.equal(
    isDestinationHealthFresh(
      destination({
        health_verified_at: "2026-08-07T17:53:58.000Z",
        denylist_checked_at: "2026-08-07T17:53:58.000Z",
      }),
      now,
    ),
    false,
  );
});

test("missing or one-sided timestamps are not fresh", () => {
  assert.equal(
    isDestinationHealthFresh(destination({ health_verified_at: null }), now),
    false,
  );
  assert.equal(
    isDestinationHealthFresh(destination({ denylist_checked_at: null }), now),
    false,
  );
});

test("stale or unverified destinations cannot be bound for preview", () => {
  assert.equal(canBindDestinationToDraft(destination(), now), true);
  assert.equal(
    canBindDestinationToDraft(
      destination({
        health_verified_at: "2026-08-07T17:53:58.000Z",
        denylist_checked_at: "2026-08-07T17:53:58.000Z",
      }),
      now,
    ),
    false,
  );
  assert.equal(
    canBindDestinationToDraft(destination({ access_status: "unverified" }), now),
    false,
  );
});

test("snapshot destinations explain that the folder is empty until a run", () => {
  assert.match(destinationDeliveryExplanation("snapshot"), /folder/i);
  assert.match(destinationDeliveryExplanation("snapshot"), /create the sheet/i);
  assert.doesNotMatch(destinationDeliveryExplanation("snapshot"), /managed tab/i);
  assert.match(destinationDeliveryExplanation("replace_tab"), /managed tab/i);
});
