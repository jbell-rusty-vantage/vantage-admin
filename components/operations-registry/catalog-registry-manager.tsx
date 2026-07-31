"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StatusBadge } from "@/components/data-table/status-badge";
import {
  TableEmptyState,
  TableErrorState,
  TableLoadingState,
} from "@/components/data-table/table-states";
import { FilterField } from "@/components/filters/filter-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import {
  createRegistryCatalogItem,
  fetchRegistryCatalog,
  previewRegistryCatalogDependencies,
  setRegistryCatalogActivation,
  updateRegistryCatalogItem,
  type CatalogUpdateInput,
  type RegistryCatalogItem,
  type RegistryCatalogKind,
  type RegistryDependencyPreview,
} from "@/lib/api/registryAgents";
import { invalidateRegistryQueries } from "@/lib/api/registryInvalidation";
import { queryKeys } from "@/lib/query/keys";
import { cn } from "@/lib/utils";
import { RegistryApiErrorMessage } from "./registry-api-error";

const labels: Record<RegistryCatalogKind, { singular: string; plural: string }> = {
  agents: { singular: "Agent", plural: "Agents" },
  merchants: { singular: "Merchant", plural: "Merchants" },
};

export function CatalogRegistryManager({
  kind,
  readOnly,
}: {
  kind: RegistryCatalogKind;
  readOnly: boolean;
}) {
  const label = labels[kind];
  const searchParams = useSearchParams();
  const deepLinkEntity = searchParams.get("entity");
  const [includeInactive, setIncludeInactive] = useState(Boolean(deepLinkEntity));
  const [message, setMessage] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<unknown>(null);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.operationsRegistry[kind](includeInactive),
    queryFn: () => fetchRegistryCatalog(kind, { includeInactive }),
  });

  useEffect(() => {
    if (!deepLinkEntity || !query.data) {
      return;
    }
    document.getElementById(`registry-catalog-${deepLinkEntity}`)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [deepLinkEntity, query.data]);

  const createMutation = useMutation({
    mutationFn: createRegistryCatalogItem.bind(null, kind),
    onSuccess: async () => {
      await invalidateRegistryQueries(queryClient);
      setMutationError(null);
      setMessage(`${label.singular} created.`);
    },
    onError: (error) => {
      setMessage(null);
      setMutationError(error);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof updateRegistryCatalogItem>[2] }) =>
      updateRegistryCatalogItem(kind, id, body),
    onSuccess: async () => {
      await invalidateRegistryQueries(queryClient);
      setMutationError(null);
      setMessage(`${label.singular} updated.`);
    },
    onError: (error) => {
      setMessage(null);
      setMutationError(error);
    },
  });

  const activationMutation = useMutation({
    mutationFn: ({
      id,
      active,
      reason,
    }: {
      id: string;
      active: boolean;
      reason?: string;
    }) => setRegistryCatalogActivation(kind, id, { active, reason }),
    onSuccess: async () => {
      await invalidateRegistryQueries(queryClient);
      setMutationError(null);
      const active = activationMutation.variables?.active;
      setMessage(`${label.singular} ${active ? "reactivated" : "deactivated"}.`);
    },
    onError: (error) => {
      setMessage(null);
      setMutationError(error);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{label.plural}</CardTitle>
        <CardDescription>
          Registry-managed {label.plural.toLowerCase()}. Deactivation is dependency-aware; records are
          never deleted.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {message ? (
          <FeedbackMessage tone="success">{message}</FeedbackMessage>
        ) : null}
        {mutationError ? <RegistryApiErrorMessage error={mutationError} /> : null}

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(event) => setIncludeInactive(event.target.checked)}
          />
          Show inactive
        </label>

        {!readOnly ? (
          <form
            className={`grid gap-3 rounded-md border bg-background p-3 ${kind === "agents" ? "md:grid-cols-3" : "md:grid-cols-2"}`}
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const formData = new FormData(form);
              const name = String(formData.get("name") ?? "").trim();
              const granotCrmUsername =
                kind === "agents"
                  ? String(formData.get("granot_crm_username") ?? "")
                      .trim()
                      .toUpperCase()
                  : undefined;
              if (!name) {
                setMutationError(new Error(`${label.singular} name is required.`));
                return;
              }
              createMutation.mutate({
                name,
                ...(granotCrmUsername ? { granot_crm_username: granotCrmUsername } : {}),
              });
              form.reset();
            }}
          >
            <FilterField label={`${label.singular} name`}>
              <Input name="name" placeholder={`New ${label.singular.toLowerCase()}`} />
            </FilterField>
            {kind === "agents" ? (
              <FilterField label="Granot CRM username">
                <Input
                  name="granot_crm_username"
                  placeholder="e.g. MIKEM"
                  className="uppercase"
                  autoComplete="off"
                />
              </FilterField>
            ) : null}
            <FilterField label="&nbsp;">
              <Button type="submit" disabled={createMutation.isPending}>
                Add {label.singular}
              </Button>
            </FilterField>
          </form>
        ) : null}

        {query.isPending ? <TableLoadingState label={`Loading ${label.plural.toLowerCase()}...`} /> : null}
        {query.isError ? (
          <TableErrorState
            title={`Unable to load ${label.plural.toLowerCase()}.`}
            error={query.error instanceof Error ? query.error.message : undefined}
            onRetry={() => query.refetch()}
          />
        ) : null}

        {!query.isPending && !query.isError && (query.data ?? []).length === 0 ? (
          <TableEmptyState label={`No ${label.plural.toLowerCase()} found.`} />
        ) : null}

        <div className="space-y-3">
          {(query.data ?? []).map((item) => (
            <CatalogRow
              key={`${item.id}-${item.name}-${item.active}-${item.granot_crm_username ?? ""}`}
              item={item}
              kind={kind}
              highlighted={deepLinkEntity === item.id}
              readOnly={readOnly}
              onSave={(body) => updateMutation.mutate({ id: item.id, body })}
              onActivation={(active, reason) =>
                activationMutation.mutate({ id: item.id, active, reason })
              }
              isPending={updateMutation.isPending || activationMutation.isPending}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CatalogRow({
  item,
  kind,
  highlighted = false,
  readOnly,
  onSave,
  onActivation,
  isPending,
}: {
  item: RegistryCatalogItem;
  kind: RegistryCatalogKind;
  highlighted?: boolean;
  readOnly: boolean;
  onSave: (body: CatalogUpdateInput) => void;
  onActivation: (active: boolean, reason?: string) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(item.name);
  const [granotCrmUsername, setGranotCrmUsername] = useState(item.granot_crm_username ?? "");
  const [reason, setReason] = useState("");
  const [deactivateStep, setDeactivateStep] = useState<"idle" | "confirm">("idle");
  const [dependencyPreview, setDependencyPreview] = useState<RegistryDependencyPreview | null>(null);
  const [previewError, setPreviewError] = useState<unknown>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const usernameConfigured = Boolean(item.granot_crm_username);
  const normalizedDraftUsername = granotCrmUsername.trim().toUpperCase();
  const existingUsername = (item.granot_crm_username ?? "").trim().toUpperCase();
  const nameChanged = name.trim() !== item.name;
  const usernameChanged =
    kind === "agents" && normalizedDraftUsername !== existingUsername;
  const changed = nameChanged || usernameChanged;

  async function startDeactivationPreview() {
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const preview = await previewRegistryCatalogDependencies(kind, item.id);
      setDependencyPreview(preview);
      setDeactivateStep("confirm");
    } catch (error) {
      setPreviewError(error);
    } finally {
      setPreviewLoading(false);
    }
  }

  function saveChanges() {
    const body: CatalogUpdateInput = {
      ...(nameChanged ? { name: name.trim() } : {}),
      ...(usernameChanged && normalizedDraftUsername
        ? { granot_crm_username: normalizedDraftUsername }
        : {}),
      ...(reason ? { reason } : {}),
    };
    if (!body.name && !body.granot_crm_username) {
      return;
    }
    onSave(body);
  }

  return (
    <div
      id={`registry-catalog-${item.id}`}
      className={cn(
        "space-y-3 rounded-md border bg-background p-3",
        highlighted ? "border-trust-blue ring-2 ring-trust-blue/30" : undefined,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{item.name}</h3>
          <StatusBadge tone={item.active ? "success" : "muted"}>
            {item.active ? "Active" : "Inactive"}
          </StatusBadge>
        </div>
        <p className="text-xs text-muted-foreground">{item.normalized_name}</p>
      </div>

      {readOnly ? (
        <p className="text-sm text-muted-foreground">{item.name}</p>
      ) : (
        <FilterField label="Display name">
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </FilterField>
      )}

      {kind === "agents" ? (
        <div className="space-y-2 text-sm">
          {readOnly ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground">Granot CRM username:</span>
              {usernameConfigured ? (
                <>
                  <StatusBadge tone="success">Configured</StatusBadge>
                  <span className="font-mono uppercase">{item.granot_crm_username}</span>
                </>
              ) : (
                <StatusBadge tone="muted">Not configured</StatusBadge>
              )}
            </div>
          ) : (
            <FilterField label="Granot CRM username">
              <Input
                value={granotCrmUsername}
                onChange={(event) => setGranotCrmUsername(event.target.value.toUpperCase())}
                placeholder="e.g. MIKEM"
                className="uppercase font-mono"
                autoComplete="off"
              />
            </FilterField>
          )}
          <p className="text-xs text-muted-foreground">
            Must be unique across Agents. Correct misspellings here so browser-extension
            matching resolves to this Agent. Verification/last-observed fields are not
            exposed on the admin HTTP catalog contract.
          </p>
        </div>
      ) : null}

      {!readOnly ? (
        <div className="flex flex-wrap items-end gap-3">
          <FilterField label="Reason (optional)" className="min-w-[200px] flex-1">
            <Input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Audit reason"
            />
          </FilterField>
          <Button
            variant="outline"
            onClick={saveChanges}
            disabled={!changed || isPending || (usernameChanged && !normalizedDraftUsername)}
          >
            Save
          </Button>
          {item.active ? (
            <Button variant="destructive" disabled={isPending || previewLoading} onClick={() => void startDeactivationPreview()}>
              Deactivate
            </Button>
          ) : (
            <Button
              variant="outline"
              disabled={isPending}
              onClick={() => onActivation(true, reason || undefined)}
            >
              Reactivate
            </Button>
          )}
        </div>
      ) : null}

      {deactivateStep === "confirm" && item.active ? (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
          {previewError ? <RegistryApiErrorMessage error={previewError} /> : null}
          {dependencyPreview ? (
            <>
              <p className="font-medium">Dependency preview before deactivation</p>
              <p className="mt-1 text-muted-foreground">Total dependent records: {dependencyPreview.total}</p>
              {Object.keys(dependencyPreview.dependencies).length > 0 ? (
                <ul className="mt-2 list-inside list-disc text-muted-foreground">
                  {Object.entries(dependencyPreview.dependencies).map(([key, count]) => (
                    <li key={key}>
                      {key}: {count}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-muted-foreground">No dependencies reported.</p>
              )}
              <div className="mt-3 flex gap-2">
                <Button
                  variant="destructive"
                  disabled={isPending}
                  onClick={() => {
                    onActivation(false, reason || undefined);
                    setDeactivateStep("idle");
                    setDependencyPreview(null);
                  }}
                >
                  Confirm deactivation
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setDeactivateStep("idle");
                    setDependencyPreview(null);
                    setPreviewError(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {item.deactivation_reason ? (
        <p className="text-xs text-muted-foreground">Deactivation reason: {item.deactivation_reason}</p>
      ) : null}
    </div>
  );
}
