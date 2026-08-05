"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderPlus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
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
  createReportingDestination,
  fetchReportingDestinations,
  type CreateReportingDestinationInput,
  type ReportingDestinationStrategy,
  type ReportingDestinationSummary,
} from "@/lib/api/reportingDestinations";
import {
  bootstrapGooglePicker,
  createGoogleDriveFolder,
  verifyGooglePickerSelection,
} from "@/lib/api/googleDrive";
import { openGooglePicker } from "@/lib/google/picker";
import { queryKeys } from "@/lib/query/keys";
import { ExternalHref } from "@/components/reporting/reporting-links";
import { DestinationStatusBadge } from "@/components/reporting/reporting-status";

const fieldClass =
  "h-10 w-full rounded-md border border-input bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export function DestinationManager() {
  const role = useDashboardRole();
  const owner = role === "owner";
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const destinationsQuery = useQuery({
    queryKey: queryKeys.reporting.destinations("active"),
    queryFn: () => fetchReportingDestinations("active"),
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-trust-blue">
            Reporting destinations
          </p>
          <h2 className="text-xl font-semibold text-navy">Google delivery targets</h2>
          <p className="mt-1 max-w-3xl text-sm text-steel">
            Safe owner-OAuth folders and managed tabs. Operational workbooks are hard-denylisted with
            no override.
          </p>
        </div>
        <div className="flex gap-2">
          <Link className="inline-flex h-10 items-center text-sm font-semibold text-trust-blue" href="/reporting">
            Reporting home
          </Link>
          <Button variant="outline" onClick={() => void destinationsQuery.refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          {owner ? (
            <Button onClick={() => setShowCreate((value) => !value)}>
              <FolderPlus className="mr-2 h-4 w-4" />
              {showCreate ? "Hide create form" : "New destination"}
            </Button>
          ) : null}
        </div>
      </header>

      {!owner ? (
        <FeedbackMessage tone="info">
          Read-only admin access. Destination health and artifact links are visible; mutations are
          owner-only.
        </FeedbackMessage>
      ) : null}
      {message ? <FeedbackMessage>{message}</FeedbackMessage> : null}

      {showCreate && owner ? (
        <DestinationCreateForm
          onCreated={async () => {
            setShowCreate(false);
            setMessage("Destination created and verified where required.");
            await queryClient.invalidateQueries({ queryKey: queryKeys.reporting.destinations() });
          }}
          onError={(error) => setMessage(error)}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Active destinations</CardTitle>
          <CardDescription>
            Immutable artifact links, strategy, health, and denylist verification timestamps.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {destinationsQuery.isLoading ? (
            <TableLoadingState label="Loading destinations…" />
          ) : destinationsQuery.isError ? (
            <TableErrorState
              title="Unable to load destinations."
              error={
                destinationsQuery.error instanceof Error
                  ? destinationsQuery.error.message
                  : undefined
              }
              onRetry={() => void destinationsQuery.refetch()}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b text-xs uppercase text-steel">
                  <tr>
                    <th className="py-2">Folder</th>
                    <th>Strategy</th>
                    <th>Health</th>
                    <th>Capacity</th>
                    <th>Updated</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {(destinationsQuery.data ?? []).map((destination) => (
                    <DestinationRow
                      key={destination.id}
                      destination={destination}
                      owner={owner}
                      onMessage={setMessage}
                    />
                  ))}
                  {!destinationsQuery.data?.length ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-steel">
                        No active reporting destinations.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DestinationRow({
  destination,
  owner,
  onMessage,
}: {
  destination: ReportingDestinationSummary;
  owner: boolean;
  onMessage: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const [confirmArchive, setConfirmArchive] = useState(false);

  const archiveMutation = useMutation({
    mutationFn: () => archiveReportingDestination(destination.id, destination.version),
    onSuccess: async () => {
      onMessage("Destination archived. Managed Google artifacts remain until explicit cleanup.");
      setConfirmArchive(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.reporting.destinations() });
    },
    onError: (error) => onMessage(error.message),
  });

  return (
    <tr className="border-b border-steel-100 align-top">
      <td className="py-3">
        <div className="font-semibold text-navy">{destination.folder.name}</div>
        <ExternalHref href={destination.folder.url}>{destination.folder.id}</ExternalHref>
        {destination.workbook ? (
          <div className="mt-1 text-xs text-steel">
            Workbook: {destination.workbook.name}{" "}
            <ExternalHref href={destination.workbook.url}>open</ExternalHref>
          </div>
        ) : null}
        {destination.managed_tab ? (
          <div className="mt-1 text-xs text-steel">
            Managed tab: {destination.managed_tab.name} (ID {destination.managed_tab.immutable_sheet_id})
          </div>
        ) : null}
      </td>
      <td>{destination.strategy}</td>
      <td>
        <DestinationStatusBadge status={destination.access_status} />
        <p className="mt-1 text-xs text-steel">
          Verified {destination.health_verified_at ? new Date(destination.health_verified_at).toLocaleString() : "—"}
        </p>
      </td>
      <td className="text-xs text-steel">
        {destination.capacity.destination_available_cells.toLocaleString()} cells available
        <br />
        of {destination.capacity.provider_max_cells.toLocaleString()} provider max
      </td>
      <td className="text-xs text-steel">
        {destination.updated_at ? new Date(destination.updated_at).toLocaleString() : "—"}
      </td>
      <td className="py-3 text-right">
        <Link
          className="text-sm font-semibold text-trust-blue hover:underline"
          href={`/reporting/destinations/${destination.id}`}
        >
          Details
        </Link>
        {owner ? (
          <div className="mt-2">
            {!confirmArchive ? (
              <Button variant="ghost" onClick={() => setConfirmArchive(true)}>
                <Trash2 className="mr-1 h-3.5 w-3.5" /> Archive
              </Button>
            ) : (
              <div className="space-y-2 rounded border border-amber-200 bg-amber-50 p-2 text-left text-xs">
                <p className="font-semibold text-amber-900">
                  Archive destination v{destination.version}? Google artifacts are not deleted automatically.
                </p>
                {destination.managed_tab ? (
                  <p className="text-amber-800">
                    Managed tab: {destination.managed_tab.name} in {destination.workbook?.name}
                  </p>
                ) : null}
                <div className="flex gap-2">
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
              </div>
            )}
          </div>
        ) : null}
      </td>
    </tr>
  );
}

function DestinationCreateForm({
  onCreated,
  onError,
}: {
  onCreated: () => void | Promise<void>;
  onError: (message: string) => void;
}) {
  const [strategy, setStrategy] = useState<ReportingDestinationStrategy>("snapshot");
  const [folderSelectionRef, setFolderSelectionRef] = useState<string | null>(null);
  const [workbookSelectionRef, setWorkbookSelectionRef] = useState<string | null>(null);
  const [createFolderName, setCreateFolderName] = useState("");
  const [createWorkbookName, setCreateWorkbookName] = useState("");
  const [managedTabName, setManagedTabName] = useState("Report");
  const [pickerBusy, setPickerBusy] = useState<"folder" | "spreadsheet" | null>(null);

  const createMutation = useMutation({
    mutationFn: (input: CreateReportingDestinationInput) => createReportingDestination(input),
    onSuccess: async () => {
      await onCreated();
    },
    onError: (error) => onError(error.message),
  });

  async function pick(flow: "folder" | "spreadsheet") {
    setPickerBusy(flow);
    try {
      const bootstrap = await bootstrapGooglePicker(flow);
      const picked = await openGooglePicker({
        bootstrap,
        title: flow === "folder" ? "Select export folder" : "Select spreadsheet",
      });
      const verified = await verifyGooglePickerSelection({
        selection_nonce: bootstrap.selection_nonce,
        file_id: picked.id,
        display_name: picked.name,
        display_url: picked.url,
        parent_folder_id: picked.parentId,
      });
      if (flow === "folder") {
        setFolderSelectionRef(verified.selection_reference);
        setCreateFolderName("");
      } else {
        setWorkbookSelectionRef(verified.selection_reference);
        setCreateWorkbookName("");
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : "Picker selection failed.");
    } finally {
      setPickerBusy(null);
    }
  }

  async function createFolderViaApi() {
    if (!createFolderName.trim()) {
      onError("Enter a folder name to create.");
      return;
    }
    try {
      const folder = await createGoogleDriveFolder({ name: createFolderName.trim() });
      const bootstrap = await bootstrapGooglePicker("folder");
      const verified = await verifyGooglePickerSelection({
        selection_nonce: bootstrap.selection_nonce,
        file_id: folder.id,
        display_name: folder.name,
        display_url: folder.url,
      });
      setFolderSelectionRef(verified.selection_reference);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Folder creation failed.");
    }
  }

  function submit() {
    const input: CreateReportingDestinationInput = { strategy };
    if (folderSelectionRef) input.folder_selection_reference = folderSelectionRef;
    else if (createFolderName.trim()) input.create_folder_name = createFolderName.trim();
    else {
      onError("Select or create an export folder.");
      return;
    }
    if (strategy === "replace_tab") {
      if (workbookSelectionRef) input.workbook_selection_reference = workbookSelectionRef;
      else if (createWorkbookName.trim()) input.create_workbook_name = createWorkbookName.trim();
      else {
        onError("Select or name a workbook for replace_tab.");
        return;
      }
      if (!managedTabName.trim()) {
        onError("Managed tab name is required.");
        return;
      }
      input.managed_tab_name = managedTabName.trim();
    }
    createMutation.mutate(input);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create destination</CardTitle>
        <CardDescription>
          Picker selections are verified server-side with a one-time nonce. Browser metadata is never
          trusted for authorization.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="block text-sm font-semibold text-navy">
          Strategy
          <select
            className={`${fieldClass} mt-1 max-w-xs`}
            value={strategy}
            onChange={(event) =>
              setStrategy(event.target.value as ReportingDestinationStrategy)
            }
          >
            <option value="snapshot">Snapshot workbook (one file per run)</option>
            <option value="replace_tab">Replace managed tab</option>
          </select>
        </label>

        <section className="space-y-2">
          <h3 className="font-semibold text-navy">Export folder</h3>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={pickerBusy !== null}
              onClick={() => void pick("folder")}
            >
              {pickerBusy === "folder" ? "Opening Picker…" : "Pick existing folder"}
            </Button>
            <Input
              className="max-w-xs"
              placeholder="Or create folder name"
              value={createFolderName}
              onChange={(event) => {
                setCreateFolderName(event.target.value);
                setFolderSelectionRef(null);
              }}
            />
            <Button type="button" variant="outline" onClick={() => void createFolderViaApi()}>
              Create folder
            </Button>
          </div>
          {folderSelectionRef ? (
            <FeedbackMessage tone="success">
              <ShieldCheck className="mr-2 inline h-4 w-4" />
              Folder selection verified (reference ready).
            </FeedbackMessage>
          ) : null}
        </section>

        {strategy === "replace_tab" ? (
          <section className="space-y-2">
            <h3 className="font-semibold text-navy">Workbook & managed tab</h3>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={pickerBusy !== null}
                onClick={() => void pick("spreadsheet")}
              >
                {pickerBusy === "spreadsheet" ? "Opening Picker…" : "Pick spreadsheet"}
              </Button>
              <Input
                className="max-w-xs"
                placeholder="Or create workbook name"
                value={createWorkbookName}
                onChange={(event) => {
                  setCreateWorkbookName(event.target.value);
                  setWorkbookSelectionRef(null);
                }}
              />
            </div>
            <label className="block text-sm font-semibold text-navy">
              Managed tab name
              <Input
                className="mt-1 max-w-xs"
                value={managedTabName}
                onChange={(event) => setManagedTabName(event.target.value)}
              />
            </label>
            <p className="text-xs text-steel">
              Vantage creates a new managed tab with an ownership marker. Human-created tabs cannot
              be claimed by name alone.
            </p>
          </section>
        ) : null}

        <Button disabled={createMutation.isPending} onClick={submit}>
          {createMutation.isPending ? "Creating…" : "Create destination"}
        </Button>
      </CardContent>
    </Card>
  );
}
