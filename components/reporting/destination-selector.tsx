"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback";
import { TableErrorState, TableLoadingState } from "@/components/data-table/table-states";
import type { ReportingDefinitionDraft } from "@/lib/api/reporting";
import {
  fetchReportingDestinations,
  verifyReportingDestination,
  type ReportingDestinationSummary,
} from "@/lib/api/reportingDestinations";
import {
  canBindDestinationToDraft,
  destinationDeliveryExplanation,
  destinationSnapshotChecksumFromSummary,
  isDestinationHealthFresh,
} from "@/lib/reporting/destinationSnapshot";
import { queryKeys } from "@/lib/query/keys";
import {
  DestinationHealthBadge,
  DestinationStatusBadge,
} from "@/components/reporting/reporting-status";
import { ExternalHref, InternalReportingLink } from "@/components/reporting/reporting-links";

const fieldClass =
  "h-10 w-full rounded-md border border-input bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export function DestinationSelector({
  draft,
  onChange,
  owner,
}: {
  draft: ReportingDefinitionDraft;
  onChange: (draft: ReportingDefinitionDraft) => void;
  owner: boolean;
}) {
  const queryClient = useQueryClient();
  const [bindingError, setBindingError] = useState<string | null>(null);
  const destinationsQuery = useQuery({
    queryKey: queryKeys.reporting.destinations("active"),
    queryFn: () => fetchReportingDestinations("active"),
  });

  const destinations = destinationsQuery.data ?? [];
  const selected = destinations.find((destination) => destination.id === draft.destination_id);
  const bindableCount = destinations.filter((destination) =>
    canBindDestinationToDraft(destination),
  ).length;
  const selectedBindable = selected ? canBindDestinationToDraft(selected) : false;
  const selectedStale = selected ? !isDestinationHealthFresh(selected) : false;
  const selectedMissing = Boolean(draft.destination_id) && !selected && destinationsQuery.isSuccess;

  function bindDestination(
    destinationId: string,
    list: ReportingDestinationSummary[] | undefined = destinationsQuery.data,
  ) {
    setBindingError(null);
    if (!destinationId) {
      onChange({
        ...draft,
        destination_id: "",
        destination_snapshot_checksum: "",
      });
      return;
    }
    const destination = list?.find((item) => item.id === destinationId);
    if (!destination) return;
    if (!canBindDestinationToDraft(destination)) {
      setBindingError("This destination is not verified or its safety snapshot is unavailable.");
      return;
    }
    try {
      onChange({
        ...draft,
        destination_id: destination.id,
        strategy: destination.strategy,
        destination_snapshot_checksum: destinationSnapshotChecksumFromSummary(destination),
      });
    } catch (error) {
      setBindingError(
        error instanceof Error
          ? error.message
          : "The destination safety snapshot could not be bound.",
      );
    }
  }

  const verifyMutation = useMutation({
    mutationFn: (id: string) => verifyReportingDestination(id),
    onSuccess: async (_verified, id) => {
      setBindingError(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.reporting.destinations() });
      const refreshed = await destinationsQuery.refetch();
      bindDestination(id, refreshed.data);
    },
    onError: (error) => setBindingError(error.message),
  });

  return (
    <section>
      <h3 className="font-heading text-lg font-semibold text-navy">6. Destination & strategy</h3>
      <p className="text-sm text-steel">
        Choose a verified destination with health checked in the last 24 hours. Snapshot checksum and
        strategy are bound from the server-validated destination record.
      </p>

      {destinationsQuery.isLoading ? (
        <div className="mt-3">
          <TableLoadingState label="Loading destinations…" />
        </div>
      ) : destinationsQuery.isError ? (
        <div className="mt-3">
          <TableErrorState
            title="Unable to load destinations."
            error={
              destinationsQuery.error instanceof Error
                ? destinationsQuery.error.message
                : undefined
            }
            onRetry={() => void destinationsQuery.refetch()}
          />
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-[16rem] flex-1 text-sm font-semibold text-navy">
              Verified destination
              <select
                className={`${fieldClass} mt-1`}
                value={draft.destination_id}
                disabled={!owner}
                onChange={(event) => bindDestination(event.target.value)}
              >
                <option value="">Select a destination…</option>
                {destinations.map((destination) => (
                  <option
                    key={destination.id}
                    value={destination.id}
                    disabled={!canBindDestinationToDraft(destination)}
                  >
                    {destination.folder.name} · {destination.strategy} ·{" "}
                    {isDestinationHealthFresh(destination)
                      ? destination.access_status
                      : "stale"}
                  </option>
                ))}
              </select>
            </label>
            <Button
              type="button"
              variant="outline"
              onClick={() => void destinationsQuery.refetch()}
              disabled={destinationsQuery.isFetching}
            >
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
          </div>

          {destinations.length > 0 && bindableCount === 0 ? (
            <FeedbackMessage tone="warning">
              Destinations exist but none can be bound. They are unverified or their health is older
              than 24 hours. Verify on{" "}
              <InternalReportingLink href="/reporting/destinations">Destinations</InternalReportingLink>
              , then refresh.
            </FeedbackMessage>
          ) : null}

          {selectedMissing || (selected && !selectedBindable) ? (
            <FeedbackMessage tone="warning">
              This destination cannot be used for preview or run. It is unverified or its health is
              older than 24 hours.{" "}
              <InternalReportingLink href="/reporting/destinations">
                Open Destinations
              </InternalReportingLink>
              {draft.destination_id ? (
                <>
                  {" · "}
                  <InternalReportingLink href={`/reporting/destinations/${draft.destination_id}`}>
                    Open this destination
                  </InternalReportingLink>
                </>
              ) : null}
              {owner && selected && selectedStale ? (
                <div className="mt-2">
                  <Button
                    disabled={verifyMutation.isPending}
                    onClick={() => verifyMutation.mutate(selected.id)}
                  >
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    {verifyMutation.isPending ? "Verifying…" : "Verify destination"}
                  </Button>
                </div>
              ) : null}
            </FeedbackMessage>
          ) : null}

          {selected ? (
            <div className="rounded-md border border-steel-200 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <DestinationStatusBadge status={selected.access_status} />
                <DestinationHealthBadge fresh={!selectedStale} />
                <span className="font-semibold text-navy">{selected.strategy}</span>
              </div>
              <p className="mt-2 text-steel">{destinationDeliveryExplanation(selected.strategy)}</p>
              <p className="mt-2 text-steel">
                Folder: {selected.folder.name}{" "}
                <ExternalHref href={selected.folder.url}>Open folder</ExternalHref>
              </p>
              {selected.workbook ? (
                <p className="text-steel">
                  Spreadsheet: {selected.workbook.name}{" "}
                  <ExternalHref href={selected.workbook.url}>Open spreadsheet</ExternalHref>
                </p>
              ) : (
                <p className="text-steel">
                  No spreadsheet yet — write one by running a saved definition.
                </p>
              )}
              {selected.managed_tab ? (
                <p className="text-steel">
                  Managed tab: {selected.managed_tab.name} (sheet ID{" "}
                  {selected.managed_tab.immutable_sheet_id})
                </p>
              ) : null}
              <p className="mt-2 text-xs text-steel">
                Capacity: {selected.capacity.destination_available_cells.toLocaleString()} cells ·
                denylist checked{" "}
                {selected.denylist_checked_at
                  ? new Date(selected.denylist_checked_at).toLocaleString()
                  : "—"}
              </p>
            </div>
          ) : null}

          {selectedBindable && draft.destination_snapshot_checksum ? (
            <FeedbackMessage tone="success">
              Snapshot checksum bound:{" "}
              <span className="font-mono text-xs">{draft.destination_snapshot_checksum}</span>
            </FeedbackMessage>
          ) : selectedMissing || (selected && !selectedBindable) ? null : (
            <FeedbackMessage tone="warning">
              Select a verified destination with an available snapshot checksum before previewing.
            </FeedbackMessage>
          )}

          {bindingError ? (
            <FeedbackMessage tone="error">{bindingError}</FeedbackMessage>
          ) : null}

          {!owner ? (
            <FeedbackMessage tone="info">
              Read-only: destination binding is visible but cannot be changed.
            </FeedbackMessage>
          ) : null}
        </div>
      )}
    </section>
  );
}
