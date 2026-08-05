"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useDashboardRole } from "@/components/layout/dashboard-role-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { TableErrorState, TableLoadingState } from "@/components/data-table/table-states";
import {
  archiveReportingDestination,
  fetchReportingDestination,
  updateReportingDestination,
  verifyReportingDestination,
} from "@/lib/api/reportingDestinations";
import { queryKeys } from "@/lib/query/keys";
import { ExternalHref } from "@/components/reporting/reporting-links";
import { DestinationStatusBadge } from "@/components/reporting/reporting-status";

export function DestinationDetailView({ destinationId }: { destinationId: string }) {
  const role = useDashboardRole();
  const owner = role === "owner";
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [managedTabName, setManagedTabName] = useState("");
  const [confirmArchive, setConfirmArchive] = useState(false);

  const detailQuery = useQuery({
    queryKey: queryKeys.reporting.destination(destinationId),
    queryFn: () => fetchReportingDestination(destinationId),
  });

  const verifyMutation = useMutation({
    mutationFn: () => verifyReportingDestination(destinationId),
    onSuccess: async () => {
      setMessage("Destination verification succeeded.");
      await queryClient.invalidateQueries({
        queryKey: queryKeys.reporting.destination(destinationId),
      });
    },
    onError: (error) => setMessage(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      const destination = detailQuery.data;
      if (!destination) throw new Error("Destination not loaded.");
      return updateReportingDestination(destinationId, {
        expected_version: destination.version,
        managed_tab_name: managedTabName.trim(),
      });
    },
    onSuccess: async () => {
      setMessage("Managed tab recreated with a new ownership marker.");
      setManagedTabName("");
      await queryClient.invalidateQueries({
        queryKey: queryKeys.reporting.destination(destinationId),
      });
    },
    onError: (error) => setMessage(error.message),
  });

  const archiveMutation = useMutation({
    mutationFn: () => {
      const destination = detailQuery.data;
      if (!destination) throw new Error("Destination not loaded.");
      return archiveReportingDestination(destinationId, destination.version);
    },
    onSuccess: async () => {
      setMessage("Destination archived.");
      await queryClient.invalidateQueries({ queryKey: queryKeys.reporting.destinations() });
    },
    onError: (error) => setMessage(error.message),
  });

  const destination = detailQuery.data;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link className="text-sm font-semibold text-trust-blue" href="/reporting/destinations">
            ← All destinations
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-navy">
            {destination?.folder.name ?? "Destination"}
          </h1>
        </div>
        <Button variant="outline" onClick={() => void detailQuery.refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </header>

      {message ? <FeedbackMessage>{message}</FeedbackMessage> : null}

      {detailQuery.isLoading ? <TableLoadingState label="Loading destination…" /> : null}
      {detailQuery.isError ? (
        <TableErrorState
          title="Unable to load destination."
          error={detailQuery.error instanceof Error ? detailQuery.error.message : undefined}
          onRetry={() => void detailQuery.refetch()}
        />
      ) : null}

      {destination ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Health & ownership</CardTitle>
              <CardDescription>
                Immutable artifact links, denylist verification, and capacity limits.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Metric label="Strategy" value={destination.strategy} />
              <Metric
                label="Access"
                value={<DestinationStatusBadge status={destination.access_status} />}
              />
              <Metric label="Version" value={destination.version} />
              <Metric label="Owner" value={destination.owner_identity_snapshot.masked_email} />
              <Metric
                label="Health verified"
                value={
                  destination.health_verified_at
                    ? new Date(destination.health_verified_at).toLocaleString()
                    : "—"
                }
              />
              <Metric
                label="Denylist checked"
                value={
                  destination.denylist_checked_at
                    ? new Date(destination.denylist_checked_at).toLocaleString()
                    : "—"
                }
              />
              <Metric
                label="Snapshot checksum"
                value={
                  destination.snapshot_checksum ? (
                    <span className="break-all font-mono text-xs">
                      {destination.snapshot_checksum}
                    </span>
                  ) : (
                    "Unavailable"
                  )
                }
              />
              <Metric
                label="Capacity"
                value={`${destination.capacity.destination_available_cells.toLocaleString()} / ${destination.capacity.provider_max_cells.toLocaleString()} cells`}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Managed artifacts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                Folder: {destination.folder.name}{" "}
                <ExternalHref href={destination.folder.url}>open in Drive</ExternalHref>
              </p>
              {destination.workbook ? (
                <p>
                  Workbook: {destination.workbook.name}{" "}
                  <ExternalHref href={destination.workbook.url}>open</ExternalHref>
                </p>
              ) : (
                <p className="text-steel">Snapshot strategy creates one workbook per run.</p>
              )}
              {destination.managed_tab ? (
                <p>
                  Managed tab: {destination.managed_tab.name} · sheet ID{" "}
                  {destination.managed_tab.immutable_sheet_id}
                </p>
              ) : null}
              <FeedbackMessage tone="info">
                Operational ingestion and projection workbooks are permanently denylisted. There is
                no owner override in v1.
              </FeedbackMessage>
            </CardContent>
          </Card>

          {owner && destination.state === "active" ? (
            <Card>
              <CardHeader>
                <CardTitle>Owner actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  variant="outline"
                  disabled={verifyMutation.isPending}
                  onClick={() => verifyMutation.mutate()}
                >
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  {verifyMutation.isPending ? "Verifying…" : "Verify destination"}
                </Button>

                {destination.strategy === "replace_tab" ? (
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-navy">
                      Replace managed tab name
                      <Input
                        className="mt-1 max-w-sm"
                        value={managedTabName}
                        onChange={(event) => setManagedTabName(event.target.value)}
                        placeholder="New published tab name"
                      />
                    </label>
                    <Button
                      disabled={!managedTabName.trim() || updateMutation.isPending}
                      onClick={() => updateMutation.mutate()}
                    >
                      Recreate managed tab
                    </Button>
                    <p className="text-xs text-steel">
                      Creates a new Vantage-managed tab when the published name collides or ownership
                      is unhealthy.
                    </p>
                  </div>
                ) : null}

                {!confirmArchive ? (
                  <Button variant="destructive" onClick={() => setConfirmArchive(true)}>
                    Archive destination
                  </Button>
                ) : (
                  <FeedbackMessage tone="warning">
                    Archive v{destination.version}? Google artifacts remain until explicit cleanup.
                    <div className="mt-2 flex gap-2">
                      <Button
                        variant="destructive"
                        disabled={archiveMutation.isPending}
                        onClick={() => archiveMutation.mutate()}
                      >
                        Confirm archive
                      </Button>
                      <Button variant="ghost" onClick={() => setConfirmArchive(false)}>
                        Cancel
                      </Button>
                    </div>
                  </FeedbackMessage>
                )}
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-steel-100 bg-white p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-steel">{label}</p>
      <p className="mt-1 wrap-break-word font-semibold text-navy">{value}</p>
    </div>
  );
}
