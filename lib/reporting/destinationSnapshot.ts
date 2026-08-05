import type { ReportingDestinationSummary } from "@/lib/api/reportingDestinations";

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

export function canBindDestinationToDraft(destination: ReportingDestinationSummary): boolean {
  return (
    destination.state === "active" &&
    destination.access_status === "verified" &&
    Boolean(destination.snapshot_checksum)
  );
}
