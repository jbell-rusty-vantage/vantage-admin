"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StatusBadge } from "@/components/data-table/status-badge";
import {
  TableEmptyState,
  TableErrorState,
  TableLoadingState,
} from "@/components/data-table/table-states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback";
import { createGranotNameFromOwnerIntent, type OwnerGranotNameCommand } from "@/lib/api/leadSources";
import { invalidateRegistryQueries } from "@/lib/api/registryInvalidation";
import {
  fetchGranotCrmSources,
  setGranotCrmSourceActivation,
  setGranotCrmSourceOutboundSms,
  updateGranotCrmSource,
} from "@/lib/api/registryGranotCrmSources";
import { fetchSourceCompanies, fetchSourceGranularities } from "@/lib/api/registrySources";
import { formatRegistryError } from "@/lib/api/registryRequest";
import { queryKeys } from "@/lib/query/keys";
import { cn } from "@/lib/utils";
import { GranotNameEditor } from "./granot-names/granot-name-editor";
import { renderGranotLeadSmsPreview } from "@/lib/operations-registry/smsPreview";

export { renderGranotLeadSmsPreview };
export { GranotNameEditor as GranotCrmSourceEditor };

export function GranotCrmSourcesManager({ readOnly }: { readOnly: boolean }) {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("entity"));
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sourcesQuery = useQuery({
    queryKey: queryKeys.operationsRegistry.granotCrmSources(),
    queryFn: fetchGranotCrmSources,
  });
  const companiesQuery = useQuery({
    queryKey: queryKeys.operationsRegistry.sourceCompanies(true),
    queryFn: () => fetchSourceCompanies({ includeInactive: true }),
  });
  const feedsQuery = useQuery({
    queryKey: queryKeys.operationsRegistry.sourceGranularities({ includeInactive: true }),
    queryFn: () => fetchSourceGranularities({ includeInactive: true }),
  });

  const sources = sourcesQuery.data ?? [];
  const selected = creating
    ? null
    : sources.find((item) => item.id === (selectedId ?? sources[0]?.id)) ?? null;

  const createMutation = useMutation({
    mutationFn: (body: OwnerGranotNameCommand) => createGranotNameFromOwnerIntent(body),
    onSuccess: async () => {
      await invalidateRegistryQueries(queryClient);
      setCreating(false);
      setMessage("Granot name saved. It is not live yet.");
    },
    onError: (caught) => setError(formatRegistryError(caught)),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof updateGranotCrmSource>[1] }) =>
      updateGranotCrmSource(id, body),
    onSuccess: async () => {
      await invalidateRegistryQueries(queryClient);
      setMessage("Granot name saved.");
    },
    onError: (caught) => setError(formatRegistryError(caught)),
  });
  const smsMutation = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: Parameters<typeof setGranotCrmSourceOutboundSms>[1];
    }) => setGranotCrmSourceOutboundSms(id, body),
    onSuccess: async () => {
      await invalidateRegistryQueries(queryClient);
      setMessage("Customer text saved.");
    },
    onError: (caught) => setError(formatRegistryError(caught)),
  });
  const activationMutation = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: Parameters<typeof setGranotCrmSourceActivation>[1];
    }) => setGranotCrmSourceActivation(id, body),
    onSuccess: async () => {
      await invalidateRegistryQueries(queryClient);
      setMessage("Live processing updated.");
    },
    onError: (caught) => setError(formatRegistryError(caught)),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Granot names</CardTitle>
          <CardDescription>
            The exact name Granot sends. Each name lands in one lead source and one feed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!readOnly ? (
            <Button type="button" onClick={() => setCreating(true)}>
              New Granot name
            </Button>
          ) : null}
          {sourcesQuery.isPending ? <TableLoadingState /> : null}
          {sourcesQuery.isError ? (
            <TableErrorState error={formatRegistryError(sourcesQuery.error)} />
          ) : null}
          {sourcesQuery.isSuccess && sources.length === 0 ? (
            <TableEmptyState label="This list has no Granot names." />
          ) : null}
          <ul className="grid gap-2">
            {sources.map((source) => (
              <li key={source.id}>
                <button
                  type="button"
                  onClick={() => {
                    setCreating(false);
                    setSelectedId(source.id);
                  }}
                  className={cn(
                    "w-full rounded-md border px-3 py-2 text-left",
                    !creating && source.id === selected?.id
                      ? "border-navy bg-pale-gold/40"
                      : "border-input",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-navy">{source.granot_label}</span>
                    <StatusBadge tone={source.lifecycle_enabled ? "success" : "muted"}>
                      {source.lifecycle_enabled ? "Live" : "Draft"}
                    </StatusBadge>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {message ? <FeedbackMessage tone="success">{message}</FeedbackMessage> : null}
        {error ? <FeedbackMessage tone="error">{error}</FeedbackMessage> : null}
        {creating ? (
          <GranotNameEditor
            mode="create"
            companies={companiesQuery.data ?? []}
            feeds={feedsQuery.data ?? []}
            readOnly={readOnly}
            isPending={createMutation.isPending}
            onCreate={(body) => createMutation.mutate(body)}
          />
        ) : selected ? (
          <GranotNameEditor
            key={selected.id}
            mode="edit"
            source={selected}
            companies={companiesQuery.data ?? []}
            feeds={feedsQuery.data ?? []}
            readOnly={readOnly}
            isPending={
              updateMutation.isPending || smsMutation.isPending || activationMutation.isPending
            }
            onSave={(body) => updateMutation.mutate({ id: selected.id, body })}
            onSaveSms={(body) => smsMutation.mutate({ id: selected.id, body })}
            onActivate={(body) => activationMutation.mutate({ id: selected.id, body })}
          />
        ) : sourcesQuery.isSuccess ? (
          <FeedbackMessage tone="info">Select a Granot name, or add one.</FeedbackMessage>
        ) : null}
      </div>
    </div>
  );
}
