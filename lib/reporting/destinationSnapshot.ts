import type {
  ReportingDestinationStrategy,
  ReportingDestinationSummary,
} from "@/lib/api/reportingDestinations";

/** Matches vantage-main-server REPORTING_DESTINATION_HEALTH_MAX_AGE_MS. */
export const REPORTING_DESTINATION_HEALTH_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function destinationSnapshotChecksumFromSummary(
  destination: ReportingDestinationSummary,
): string {
  if (destination.snapshot_checksum) {
    return destination.snapshot_checksum;
  }
  throw new Error(
    "Destination snapshot checksum is unavailable. Verify the destination and refresh.",
  );
}

export function isDestinationHealthFresh(
  destination: Pick<
    ReportingDestinationSummary,
    "health_verified_at" | "denylist_checked_at"
  >,
  now = Date.now(),
): boolean {
  const health = destination.health_verified_at
    ? Date.parse(destination.health_verified_at)
    : Number.NaN;
  const denylist = destination.denylist_checked_at
    ? Date.parse(destination.denylist_checked_at)
    : Number.NaN;
  if (!Number.isFinite(health) || !Number.isFinite(denylist)) {
    return false;
  }
  return (
    now - health <= REPORTING_DESTINATION_HEALTH_MAX_AGE_MS &&
    now - denylist <= REPORTING_DESTINATION_HEALTH_MAX_AGE_MS
  );
}

export function canBindDestinationToDraft(
  destination: ReportingDestinationSummary,
  now = Date.now(),
): boolean {
  return (
    destination.state === "active" &&
    destination.access_status === "verified" &&
    Boolean(destination.snapshot_checksum) &&
    isDestinationHealthFresh(destination, now)
  );
}

export function destinationDeliveryExplanation(
  strategy: ReportingDestinationStrategy,
): string {
  if (strategy === "snapshot") {
    return "This destination is a Drive folder. Vantage creates a new spreadsheet in that folder only after you run a saved revision.";
  }
  return "This destination is a managed tab inside a workbook. A run replaces that tab; it does not create a new file.";
}
