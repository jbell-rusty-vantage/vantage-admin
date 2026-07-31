"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  TableEmptyState,
  TableErrorState,
  TableLoadingState,
} from "@/components/data-table/table-states";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback";
import { invalidateRegistryQueries } from "@/lib/api/registryInvalidation";
import {
  activateRingCentralRoute,
  createRingCentralRoute,
  deactivateRingCentralRoute,
  deriveRingCentralRouteUiState,
  fetchRingCentralRoute,
  fetchRingCentralRoutes,
  previewRingCentralRouteDependencies,
  reassignRingCentralRoute,
  updateRingCentralRoute,
  validateRingCentralRoute,
  type RingCentralRoute,
} from "@/lib/api/registryRingCentral";
import { fetchSourceCompanies, fetchSourceGranularities } from "@/lib/api/registrySources";
import { queryKeys } from "@/lib/query/keys";
import { cn } from "@/lib/utils";
import { RegistryApiErrorMessage } from "../registry-api-error";
import { RouteDetail } from "./route-detail";
import { RouteDraftCreateForm } from "./route-editor";
import { RouteLifecycleBadge } from "./validation-status";

type StatusFilter = "all" | "active" | "inactive";

const selectClassName =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

function matchesFilter(route: RingCentralRoute, filter: StatusFilter): boolean {
  if (filter === "active") return route.active;
  if (filter === "inactive") return !route.active;
  return true;
}

export function RingCentralRoutesManager({ readOnly }: { readOnly: boolean }) {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<unknown>(null);

  // Drafts are operational work items — always fetch inactive routes.
  const listQuery = useQuery({
    queryKey: queryKeys.operationsRegistry.ringCentralRoutes({
      includeInactive: true,
      includeHistory: false,
    }),
    queryFn: () => fetchRingCentralRoutes({ includeInactive: true }),
  });

  const routes = useMemo(
    () => (listQuery.data ?? []).filter((route) => matchesFilter(route, statusFilter)),
    [listQuery.data, statusFilter],
  );

  const effectiveSelectedId = selectedId ?? routes[0]?.id ?? null;

  const detailQuery = useQuery({
    queryKey: queryKeys.operationsRegistry.ringCentralRouteDetail(effectiveSelectedId ?? ""),
    queryFn: () => fetchRingCentralRoute(effectiveSelectedId!),
    enabled: Boolean(effectiveSelectedId),
  });

  const companiesQuery = useQuery({
    queryKey: queryKeys.operationsRegistry.sourceCompanies(true),
    queryFn: () => fetchSourceCompanies({ includeInactive: true }),
  });

  const granularitiesQuery = useQuery({
    queryKey: queryKeys.operationsRegistry.sourceGranularities({
      channel: "call",
      includeInactive: true,
    }),
    queryFn: () => fetchSourceGranularities({ channel: "call", includeInactive: true }),
  });

  async function afterMutation(successMessage: string) {
    await invalidateRegistryQueries(queryClient);
    setMutationError(null);
    setMessage(successMessage);
  }

  const createMutation = useMutation({
    mutationFn: createRingCentralRoute,
    onSuccess: async (created) => {
      await afterMutation("Draft route created (inactive, unvalidated).");
      setSelectedId(created.id);
    },
    onError: (error) => {
      setMessage(null);
      setMutationError(error);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof updateRingCentralRoute>[1] }) =>
      updateRingCentralRoute(id, body),
    onSuccess: async () => afterMutation("Route updated."),
    onError: (error) => {
      setMessage(null);
      setMutationError(error);
    },
  });

  const validateMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      validateRingCentralRoute(id, { reason }),
    onSuccess: async (route) => {
      // Persisted validation (including invalid/unavailable) changes registry state.
      const state = deriveRingCentralRouteUiState(route);
      const label =
        state === "valid_inactive" || state === "valid_active"
          ? "Validation succeeded."
          : state === "invalid"
            ? "Validation completed: number is invalid."
            : state === "validation_unavailable"
              ? "Validation unavailable; draft remains editable."
              : "Validation completed.";
      await afterMutation(label);
    },
    onError: (error) => {
      setMessage(null);
      setMutationError(error);
    },
  });

  const activateMutation = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: Parameters<typeof activateRingCentralRoute>[1];
    }) => activateRingCentralRoute(id, body),
    onSuccess: async () => afterMutation("Route activated. Phone number is now locked."),
    onError: (error) => {
      setMessage(null);
      setMutationError(error);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      deactivateRingCentralRoute(id, { reason }),
    onSuccess: async () =>
      afterMutation("Route deactivated. Prior assignment and Call Lead history preserved."),
    onError: (error) => {
      setMessage(null);
      setMutationError(error);
    },
  });

  const reassignMutation = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: Parameters<typeof reassignRingCentralRoute>[1];
    }) => reassignRingCentralRoute(id, body),
    onSuccess: async () => afterMutation("Route reassigned immediately."),
    onError: (error) => {
      setMessage(null);
      setMutationError(error);
    },
  });

  const mutationPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    validateMutation.isPending ||
    activateMutation.isPending ||
    deactivateMutation.isPending ||
    reassignMutation.isPending;

  const selected = detailQuery.data;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>RingCentral Queue Numbers</CardTitle>
          <CardDescription>
            Draft, validate, activate, and reassign inbound phone identities against first-class call
            Source Granularities. Qualification duration remains the global 120-second policy and is
            not configured per route.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {message ? <FeedbackMessage tone="success">{message}</FeedbackMessage> : null}
          {mutationError && !selected ? <RegistryApiErrorMessage error={mutationError} /> : null}

          <div className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Status filter</span>
              <select
                className={selectClassName}
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              >
                <option value="all">All (includes drafts)</option>
                <option value="active">Active only</option>
                <option value="inactive">Inactive / drafts</option>
              </select>
            </label>
            <p className="text-xs text-muted-foreground max-w-xl">
              Default shows all routes so inactive drafts remain visible as operational work items.
            </p>
          </div>

          <RouteDraftCreateForm
            disabled={readOnly}
            isPending={createMutation.isPending}
            onCreate={(input) =>
              createMutation.mutate({
                ...input,
                created_from: "admin",
              })
            }
          />
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Routes</CardTitle>
            <CardDescription>{routes.length} shown</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {listQuery.isPending ? <TableLoadingState label="Loading routes..." /> : null}
            {listQuery.isError ? (
              <TableErrorState
                title="Unable to load RingCentral routes."
                error={listQuery.error instanceof Error ? listQuery.error.message : undefined}
                onRetry={() => listQuery.refetch()}
              />
            ) : null}
            {!listQuery.isPending && !listQuery.isError && routes.length === 0 ? (
              <TableEmptyState label="No routes match this filter." />
            ) : null}
            <ul className="space-y-2">
              {routes.map((route) => {
                const selectedRow = route.id === effectiveSelectedId;
                return (
                  <li key={route.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(route.id)}
                      className={cn(
                        "w-full rounded-md border px-3 py-2 text-left transition-colors",
                        selectedRow
                          ? "border-pale-gold bg-pale-gold/40"
                          : "bg-background hover:bg-muted/40",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold">{route.display_label}</p>
                          <p className="font-mono text-xs text-muted-foreground">
                            {route.phone_number}
                          </p>
                        </div>
                        <RouteLifecycleBadge route={route} />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {effectiveSelectedId && detailQuery.isPending ? (
            <TableLoadingState label="Loading route detail..." />
          ) : null}
          {detailQuery.isError ? (
            <TableErrorState
              title="Unable to load route detail."
              error={detailQuery.error instanceof Error ? detailQuery.error.message : undefined}
              onRetry={() => detailQuery.refetch()}
            />
          ) : null}
          {selected ? (
            <RouteDetail
              route={selected}
              companies={companiesQuery.data ?? []}
              granularities={granularitiesQuery.data ?? []}
              readOnly={readOnly}
              isPending={mutationPending}
              mutationError={mutationError}
              onSave={(body) => updateMutation.mutate({ id: selected.id, body })}
              onValidate={(reason) => validateMutation.mutate({ id: selected.id, reason })}
              onActivate={(body) => activateMutation.mutate({ id: selected.id, body })}
              onDeactivate={(reason) => deactivateMutation.mutate({ id: selected.id, reason })}
              onReassign={(body) => reassignMutation.mutate({ id: selected.id, body })}
              onPreviewDependencies={() => previewRingCentralRouteDependencies(selected.id)}
            />
          ) : !listQuery.isPending && routes.length === 0 ? (
            <FeedbackMessage tone="info">
              Create an inactive draft to begin validation and activation.
            </FeedbackMessage>
          ) : null}
        </div>
      </div>
    </div>
  );
}
