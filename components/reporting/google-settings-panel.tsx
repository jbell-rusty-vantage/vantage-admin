"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, Plug, PlugZap, RefreshCw, Unplug } from "lucide-react";
import { useState } from "react";
import { useDashboardRole } from "@/components/layout/dashboard-role-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback";
import { TableErrorState, TableLoadingState } from "@/components/data-table/table-states";
import {
  beginGoogleDriveOAuth,
  disconnectGoogleDrive,
  fetchGoogleDriveStatus,
} from "@/lib/api/googleDrive";
import { queryKeys } from "@/lib/query/keys";

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleString() : "—";
}

export function GoogleSettingsPanel() {
  const role = useDashboardRole();
  const owner = role === "owner";
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);

  const statusQuery = useQuery({
    queryKey: queryKeys.reporting.googleDrive(),
    queryFn: fetchGoogleDriveStatus,
    enabled: owner,
    retry: 1,
  });

  const connectMutation = useMutation({
    mutationFn: beginGoogleDriveOAuth,
    onSuccess: (result) => {
      window.open(result.authorization_url, "_blank", "noopener,noreferrer");
      setMessage("Complete Google authorization in the new window, then refresh status.");
    },
    onError: (error) => setMessage(error.message),
  });

  const disconnectMutation = useMutation({
    mutationFn: disconnectGoogleDrive,
    onSuccess: async () => {
      setMessage("Google Drive disconnected. Destination mutations and new runs are blocked.");
      await queryClient.invalidateQueries({ queryKey: queryKeys.reporting.googleDrive() });
    },
    onError: (error) => setMessage(error.message),
  });

  if (!owner) {
    return (
      <FeedbackMessage tone="info">
        Owner Google OAuth settings are hidden for read-only admin access. Reporting destinations
        and run history remain visible when authorized.
      </FeedbackMessage>
    );
  }

  const status = statusQuery.data;
  const config = status?.config;
  const misconfigured =
    !config?.ownerEmailConfigured ||
    !config?.pickerConfigured ||
    !config?.exportFolderConfigured;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Owner Google connection</CardTitle>
            <CardDescription>
              Reporting delivery uses owner OAuth with least-privilege <code>drive.file</code> access.
              Ingestion service-account credentials are never used for reporting.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            onClick={() => void statusQuery.refetch()}
            disabled={statusQuery.isFetching}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {message ? <FeedbackMessage>{message}</FeedbackMessage> : null}
        {statusQuery.isLoading ? <TableLoadingState label="Loading Google connection status…" /> : null}
        {statusQuery.isError ? (
          <TableErrorState
            title="Unable to load Google connection status."
            error={statusQuery.error instanceof Error ? statusQuery.error.message : undefined}
            onRetry={() => void statusQuery.refetch()}
          />
        ) : null}
        {status ? (
          <>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
              <Metric
                label="Connection"
                value={status.connected ? "Connected" : "Not connected"}
              />
              <Metric label="Google account" value={status.google_email ?? "—"} />
              <Metric label="Configured owner" value={status.owner_email ?? "—"} />
              <Metric label="Picker ready" value={config?.pickerConfigured ? "Yes" : "No"} />
              <Metric
                label="Delivery gate"
                value={config?.reportingDeliveryEnabled ? "Enabled" : "Disabled"}
              />
            </div>
            {misconfigured ? (
              <FeedbackMessage tone="warning">
                Server or browser Picker configuration is incomplete. Connect/reconnect may fail until
                OAuth client, Picker API key, app ID, and export folder values are configured.
              </FeedbackMessage>
            ) : null}
            {!status.connected ? (
              <FeedbackMessage tone="info">
                Connect the configured owner account before creating destinations or running reports.
              </FeedbackMessage>
            ) : null}
            {!config?.reportingDeliveryEnabled ? (
              <FeedbackMessage tone="warning">
                Google reporting delivery is disabled in the server environment. Destination
                mutations and new runs remain blocked until the rollout gate is enabled.
              </FeedbackMessage>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => connectMutation.mutate()}
                disabled={connectMutation.isPending || disconnectMutation.isPending}
              >
                {status.connected ? (
                  <>
                    <PlugZap className="mr-2 h-4 w-4" /> Reconnect
                  </>
                ) : (
                  <>
                    <Plug className="mr-2 h-4 w-4" /> Connect Google Drive
                  </>
                )}
              </Button>
              <Button
                variant="destructive"
                onClick={() => disconnectMutation.mutate()}
                disabled={!status.connected || disconnectMutation.isPending}
              >
                <Unplug className="mr-2 h-4 w-4" /> Disconnect
              </Button>
            </div>
            {status.connected ? (
              <p className="text-xs text-steel">
                Connected {formatDate(status.connected_at)} · updated {formatDate(status.updated_at)}
                {status.last_used_at ? ` · last used ${formatDate(status.last_used_at)}` : ""}
              </p>
            ) : null}
            <p className="flex items-center gap-2 text-xs text-steel">
              <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
              OAuth opens in a separate window. Refresh tokens stay encrypted on the server and are
              never stored in the browser.
            </p>
          </>
        ) : null}
      </CardContent>
    </Card>
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
