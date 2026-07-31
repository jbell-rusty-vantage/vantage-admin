"use client";

import { useEffect, useMemo, useState } from "react";
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
import { invalidateRegistryQueries } from "@/lib/api/registryInvalidation";
import {
  createSourceCompany,
  createSourceGranularity,
  fetchSourceCompanies,
  fetchSourceGranularities,
  previewSourceCompanyDependencies,
  previewSourceGranularityDependencies,
  previewSourceResolution,
  setSourceCompanyActivation,
  setSourceGranularityActivation,
  updateSourceCompany,
  updateSourceGranularity,
  type SourceActivationInput,
  type SourceCompanyItem,
  type SourceDependencyPreview,
  type SourceGranularityItem,
  type SourceResolutionPreview,
} from "@/lib/api/registrySources";
import { queryKeys } from "@/lib/query/keys";
import { cn } from "@/lib/utils";
import { RegistryApiErrorMessage } from "./registry-api-error";

const selectClassName =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

export function SourceCompaniesManager({ readOnly }: { readOnly: boolean }) {
  const searchParams = useSearchParams();
  const initialEntity = searchParams.get("entity");
  const initialGranularity = searchParams.get("granularity");
  const [includeInactive, setIncludeInactive] = useState(Boolean(initialEntity || initialGranularity));
  const [selectedId, setSelectedId] = useState<string | null>(initialEntity);
  const [message, setMessage] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<unknown>(null);
  const queryClient = useQueryClient();

  const companiesQuery = useQuery({
    queryKey: queryKeys.operationsRegistry.sourceCompanies(includeInactive),
    queryFn: () => fetchSourceCompanies({ includeInactive }),
  });

  const companies = companiesQuery.data ?? [];

  const allGranularitiesForLinkQuery = useQuery({
    queryKey: queryKeys.operationsRegistry.sourceGranularities({
      includeInactive: true,
      deepLink: initialGranularity ?? "",
    }),
    queryFn: () => fetchSourceGranularities({ includeInactive: true }),
    enabled: Boolean(initialGranularity) && !initialEntity && !selectedId,
  });

  const linkedCompanyFromGranularity = useMemo(() => {
    if (!initialGranularity) {
      return null;
    }
    return (
      (allGranularitiesForLinkQuery.data ?? []).find((item) => item.id === initialGranularity)
        ?.source_company ?? null
    );
  }, [allGranularitiesForLinkQuery.data, initialGranularity]);

  const effectiveSelectedId =
    selectedId ?? linkedCompanyFromGranularity ?? companies[0]?.id ?? null;
  const selectedCompany = companies.find((c) => c.id === effectiveSelectedId) ?? null;
  const highlightGranularityId = initialGranularity;

  const granularitiesQuery = useQuery({
    queryKey: queryKeys.operationsRegistry.sourceGranularities({
      sourceCompany: effectiveSelectedId ?? undefined,
      includeInactive,
    }),
    queryFn: () =>
      fetchSourceGranularities({
        sourceCompany: effectiveSelectedId ?? undefined,
        includeInactive,
      }),
    enabled: Boolean(effectiveSelectedId),
  });

  const createCompanyMutation = useMutation({
    mutationFn: createSourceCompany,
    onSuccess: async (created) => {
      await invalidateRegistryQueries(queryClient);
      setSelectedId(created.id);
      setMutationError(null);
      setMessage("Source company created.");
    },
    onError: (error) => {
      setMessage(null);
      setMutationError(error);
    },
  });

  const updateCompanyMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof updateSourceCompany>[1] }) =>
      updateSourceCompany(id, body),
    onSuccess: async () => {
      await invalidateRegistryQueries(queryClient);
      setMutationError(null);
      setMessage("Source company updated.");
    },
    onError: (error) => {
      setMessage(null);
      setMutationError(error);
    },
  });

  const activationMutation = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: SourceActivationInput;
    }) => setSourceCompanyActivation(id, body),
    onSuccess: async (_result, variables) => {
      await invalidateRegistryQueries(queryClient);
      setMutationError(null);
      setMessage(variables.body.active ? "Company reactivated." : "Company deactivated.");
    },
    onError: (error) => {
      setMessage(null);
      setMutationError(error);
    },
  });

  return (
    <div className="grid gap-5 xl:grid-cols-[280px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Companies</CardTitle>
          <CardDescription>Select a company to edit granularities and defaults.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(event) => setIncludeInactive(event.target.checked)}
            />
            Show inactive
          </label>
          {companiesQuery.isPending ? <TableLoadingState label="Loading companies..." /> : null}
          {companiesQuery.isError ? (
            <TableErrorState
              title="Unable to load source companies."
              error={companiesQuery.error instanceof Error ? companiesQuery.error.message : undefined}
              onRetry={() => companiesQuery.refetch()}
            />
          ) : null}
          {!companiesQuery.isPending && companies.length === 0 ? (
            <TableEmptyState label="No source companies found." />
          ) : null}
          <div className="space-y-1">
            {companies.map((company) => (
              <button
                key={company.id}
                type="button"
                onClick={() => setSelectedId(company.id)}
                className={cn(
                  "w-full rounded-md border px-3 py-2 text-left text-sm transition-colors",
                  effectiveSelectedId === company.id
                    ? "border-gold bg-pale-gold/50 text-navy"
                    : "border-transparent hover:bg-steel-100",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{company.name}</span>
                  <StatusBadge tone={company.active ? "success" : "muted"}>
                    {company.active ? "Active" : "Inactive"}
                  </StatusBadge>
                </div>
                <p className="text-xs text-muted-foreground">{company.company_slug}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-5">
        {message ? <FeedbackMessage tone="success">{message}</FeedbackMessage> : null}
        {mutationError ? <RegistryApiErrorMessage error={mutationError} /> : null}

        {!readOnly ? (
          <CreateCompanyForm
            onSubmit={(body) => createCompanyMutation.mutate(body)}
            isPending={createCompanyMutation.isPending}
          />
        ) : null}

        {selectedCompany ? (
          <CompanyEditor
            key={`${selectedCompany.id}-${selectedCompany.updatedAt ?? selectedCompany.name}`}
            company={selectedCompany}
            granularities={granularitiesQuery.data ?? []}
            granularitiesLoading={granularitiesQuery.isPending}
            highlightGranularityId={highlightGranularityId}
            readOnly={readOnly}
            onSave={(body) => updateCompanyMutation.mutate({ id: selectedCompany.id, body })}
            onActivation={async (body) => {
              await activationMutation.mutateAsync({ id: selectedCompany.id, body });
            }}
            onGranularitySaved={async () => {
              await invalidateRegistryQueries(queryClient);
              await granularitiesQuery.refetch();
              setMutationError(null);
              setMessage("Granularity saved.");
            }}
            onGranularityError={(error) => {
              setMessage(null);
              setMutationError(error);
            }}
          />
        ) : null}

        <ResolutionPreviewPanel />
      </div>
    </div>
  );
}

function CreateCompanyForm({
  onSubmit,
  isPending,
}: {
  onSubmit: (body: Parameters<typeof createSourceCompany>[0]) => void;
  isPending: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create company</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-3 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const formData = new FormData(form);
            const aliases = String(formData.get("aliases") ?? "")
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean);
            onSubmit({
              company_slug: String(formData.get("company_slug") ?? "").trim(),
              name: String(formData.get("name") ?? "").trim(),
              owner_label: String(formData.get("owner_label") ?? "").trim() || undefined,
              aliases,
              sheet_config: {
                spreadsheet_id: String(formData.get("spreadsheet_id") ?? "").trim() || undefined,
                projection_mode: "derived_import",
              },
            });
            form.reset();
          }}
        >
          <FilterField label="Company slug">
            <Input name="company_slug" placeholder="new_source_leads" required />
          </FilterField>
          <FilterField label="Name">
            <Input name="name" placeholder="New Source Leads" required />
          </FilterField>
          <FilterField label="Owner label">
            <Input name="owner_label" placeholder="Display label" />
          </FilterField>
          <FilterField label="Aliases">
            <Input name="aliases" placeholder="comma-separated" />
          </FilterField>
          <FilterField label="Spreadsheet ID">
            <Input name="spreadsheet_id" placeholder="Stored config; not active direct write" />
          </FilterField>
          <FilterField label="&nbsp;">
            <Button type="submit" disabled={isPending}>
              Create company
            </Button>
          </FilterField>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">
          Sheet IDs are stored configuration. Direct writes require explicit projection_mode opt-in after
          create.
        </p>
      </CardContent>
    </Card>
  );
}

function CompanyEditor({
  company,
  granularities,
  granularitiesLoading,
  highlightGranularityId,
  readOnly,
  onSave,
  onActivation,
  onGranularitySaved,
  onGranularityError,
}: {
  company: SourceCompanyItem;
  granularities: SourceGranularityItem[];
  granularitiesLoading: boolean;
  highlightGranularityId?: string | null;
  readOnly: boolean;
  onSave: (body: Parameters<typeof updateSourceCompany>[1]) => void;
  onActivation: (body: SourceActivationInput) => Promise<void>;
  onGranularitySaved: () => Promise<void>;
  onGranularityError: (error: unknown) => void;
}) {
  const [name, setName] = useState(company.name);
  const [ownerLabel, setOwnerLabel] = useState(company.owner_label);
  const [aliases, setAliases] = useState(company.aliases.join(", "));
  const [spreadsheetId, setSpreadsheetId] = useState(company.sheet_config?.spreadsheet_id ?? "");
  const [projectionMode, setProjectionMode] = useState(
    company.sheet_config?.projection_mode ?? "derived_import",
  );
  const [defaultForm, setDefaultForm] = useState(company.default_form_granularity ?? "");
  const [defaultCall, setDefaultCall] = useState(company.default_call_granularity ?? "");
  const [reason, setReason] = useState("");
  const [activationPreview, setActivationPreview] = useState<SourceDependencyPreview | null>(null);
  const [activationError, setActivationError] = useState<unknown>(null);
  const [replacementDefaultId, setReplacementDefaultId] = useState("");

  const formOptions = useMemo(
    () => granularities.filter((g) => g.channel === "form" && g.active),
    [granularities],
  );
  const callOptions = useMemo(
    () => granularities.filter((g) => g.channel === "call" && g.active),
    [granularities],
  );

  const changed =
    name.trim() !== company.name ||
    ownerLabel.trim() !== company.owner_label ||
    aliases !== company.aliases.join(", ") ||
    spreadsheetId.trim() !== (company.sheet_config?.spreadsheet_id ?? "") ||
    projectionMode !== (company.sheet_config?.projection_mode ?? "derived_import") ||
    defaultForm !== (company.default_form_granularity ?? "") ||
    defaultCall !== (company.default_call_granularity ?? "");

  async function previewDeactivation() {
    setActivationError(null);
    try {
      const preview = await previewSourceCompanyDependencies(company.id);
      setActivationPreview(preview);
    } catch (error) {
      setActivationError(error);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>{company.name}</CardTitle>
          <StatusBadge tone={company.active ? "success" : "muted"}>
            {company.active ? "Active" : "Inactive"}
          </StatusBadge>
        </div>
        <CardDescription>
          {company.company_slug} · Sheet projection: {company.sheet_config?.projection_mode ?? "derived_import"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <FilterField label="Company slug">
            <Input value={company.company_slug} readOnly />
          </FilterField>
          <FilterField label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} readOnly={readOnly} />
          </FilterField>
          <FilterField label="Owner label">
            <Input value={ownerLabel} onChange={(e) => setOwnerLabel(e.target.value)} readOnly={readOnly} />
          </FilterField>
          <FilterField label="Aliases">
            <Input value={aliases} onChange={(e) => setAliases(e.target.value)} readOnly={readOnly} />
          </FilterField>
          <FilterField label="Spreadsheet ID">
            <Input value={spreadsheetId} onChange={(e) => setSpreadsheetId(e.target.value)} readOnly={readOnly} />
          </FilterField>
          <FilterField label="Projection mode">
            <select
              className={selectClassName}
              value={projectionMode}
              onChange={(e) =>
                setProjectionMode(e.target.value as "derived_import" | "direct_write")
              }
              disabled={readOnly}
            >
              <option value="derived_import">derived_import (default)</option>
              <option value="direct_write">direct_write (opt-in)</option>
            </select>
          </FilterField>
          <FilterField label="Default form granularity">
            <select
              className={selectClassName}
              value={defaultForm}
              onChange={(e) => setDefaultForm(e.target.value)}
              disabled={readOnly}
            >
              <option value="">None</option>
              {formOptions.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.granularity_key} · {g.owner_label}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Default call granularity">
            <select
              className={selectClassName}
              value={defaultCall}
              onChange={(e) => setDefaultCall(e.target.value)}
              disabled={readOnly}
            >
              <option value="">None</option>
              {callOptions.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.granularity_key} · {g.owner_label}
                </option>
              ))}
            </select>
          </FilterField>
        </div>

        {!readOnly ? (
          <div className="flex flex-wrap items-end gap-3">
            <FilterField label="Reason (optional)" className="min-w-[200px] flex-1">
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Audit reason" />
            </FilterField>
            <Button
              variant="outline"
              disabled={!changed}
              onClick={() =>
                onSave({
                  name: name.trim(),
                  owner_label: ownerLabel.trim(),
                  aliases: aliases
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean),
                  default_form_granularity: defaultForm || null,
                  default_call_granularity: defaultCall || null,
                  sheet_config: {
                    spreadsheet_id: spreadsheetId.trim() || undefined,
                    projection_mode: projectionMode,
                  },
                  ...(reason ? { reason } : {}),
                })
              }
            >
              Save company
            </Button>
            {company.active ? (
              <Button variant="destructive" onClick={() => void previewDeactivation()}>
                Deactivate
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => {
                  setActivationError(null);
                  void onActivation({ active: true, ...(reason ? { reason } : {}) }).catch(
                    (error) => setActivationError(error),
                  );
                }}
              >
                Reactivate
              </Button>
            )}
          </div>
        ) : null}

        {activationPreview ? (
          <DependencyPreviewPanel
            preview={activationPreview}
            replacementDefaultId={replacementDefaultId}
            onReplacementChange={setReplacementDefaultId}
            replacementOptions={[...formOptions, ...callOptions]}
            onConfirm={() => {
              void onActivation({
                active: false,
                reason: reason || undefined,
                ...(replacementDefaultId ? { replacement_default_id: replacementDefaultId } : {}),
              })
                .then(() => setActivationPreview(null))
                .catch((error) => setActivationError(error));
            }}
            onCancel={() => setActivationPreview(null)}
          />
        ) : null}
        {activationError ? <RegistryApiErrorMessage error={activationError} /> : null}

        <GranularitiesSection
          companyId={company.id}
          granularities={granularities}
          loading={granularitiesLoading}
          highlightGranularityId={highlightGranularityId}
          readOnly={readOnly}
          onSaved={onGranularitySaved}
          onError={onGranularityError}
        />
      </CardContent>
    </Card>
  );
}

function GranularitiesSection({
  companyId,
  granularities,
  loading,
  highlightGranularityId,
  readOnly,
  onSaved,
  onError,
}: {
  companyId: string;
  granularities: SourceGranularityItem[];
  loading: boolean;
  highlightGranularityId?: string | null;
  readOnly: boolean;
  onSaved: () => Promise<void>;
  onError: (error: unknown) => void;
}) {
  const [createKey, setCreateKey] = useState("");
  const [createChannel, setCreateChannel] = useState<"form" | "call">("form");
  const [createOwnerLabel, setCreateOwnerLabel] = useState("");
  const [createCrmLabel, setCreateCrmLabel] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!highlightGranularityId) {
      return;
    }
    document.getElementById(`registry-granularity-${highlightGranularityId}`)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [highlightGranularityId, granularities]);

  async function handleCreate() {
    setCreating(true);
    try {
      await createSourceGranularity({
        source_company: companyId,
        granularity_key: createKey.trim(),
        channel: createChannel,
        owner_label: createOwnerLabel.trim(),
        crm_label: createCrmLabel.trim(),
      });
      setCreateKey("");
      setCreateOwnerLabel("");
      setCreateCrmLabel("");
      await onSaved();
    } catch (error) {
      onError(error);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-3 border-t pt-4">
      <h3 className="text-sm font-semibold text-navy">Granularities</h3>
      {loading ? <TableLoadingState label="Loading granularities..." /> : null}
      {!loading && granularities.length === 0 ? (
        <TableEmptyState label="No granularities for this company." />
      ) : null}
      <div className="space-y-3">
        {granularities.map((granularity) => (
          <GranularityRow
            key={`${granularity.id}-${granularity.owner_label}-${granularity.active}`}
            granularity={granularity}
            highlighted={highlightGranularityId === granularity.id}
            readOnly={readOnly}
            onSaved={onSaved}
            onError={onError}
          />
        ))}
      </div>
      {!readOnly ? (
        <div className="grid gap-3 rounded-md border bg-background p-3 md:grid-cols-2">
          <FilterField label="Granularity key">
            <Input value={createKey} onChange={(e) => setCreateKey(e.target.value)} placeholder="forms" />
          </FilterField>
          <FilterField label="Channel">
            <select
              className={selectClassName}
              value={createChannel}
              onChange={(e) => setCreateChannel(e.target.value as "form" | "call")}
            >
              <option value="form">form</option>
              <option value="call">call</option>
            </select>
          </FilterField>
          <FilterField label="Owner label">
            <Input value={createOwnerLabel} onChange={(e) => setCreateOwnerLabel(e.target.value)} />
          </FilterField>
          <FilterField label="CRM label">
            <Input value={createCrmLabel} onChange={(e) => setCreateCrmLabel(e.target.value)} />
          </FilterField>
          <FilterField label="&nbsp;">
            <Button
              type="button"
              disabled={creating || !createKey.trim() || !createOwnerLabel.trim() || !createCrmLabel.trim()}
              onClick={() => void handleCreate()}
            >
              Add granularity
            </Button>
          </FilterField>
        </div>
      ) : null}
    </div>
  );
}

function GranularityRow({
  granularity,
  highlighted = false,
  readOnly,
  onSaved,
  onError,
}: {
  granularity: SourceGranularityItem;
  highlighted?: boolean;
  readOnly: boolean;
  onSaved: () => Promise<void>;
  onError: (error: unknown) => void;
}) {
  const [ownerLabel, setOwnerLabel] = useState(granularity.owner_label);
  const [crmLabel, setCrmLabel] = useState(granularity.crm_label);
  const [aliases, setAliases] = useState(granularity.aliases.join(", "));
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<SourceDependencyPreview | null>(null);
  const [previewError, setPreviewError] = useState<unknown>(null);
  const [replacementDefaultId, setReplacementDefaultId] = useState("");
  const [saving, setSaving] = useState(false);
  const channelLocked = granularity.active;

  async function save() {
    setSaving(true);
    try {
      await updateSourceGranularity(granularity.id, {
        owner_label: ownerLabel.trim(),
        crm_label: crmLabel.trim(),
        aliases: aliases
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
        ...(reason ? { reason } : {}),
      });
      await onSaved();
    } catch (error) {
      onError(error);
    } finally {
      setSaving(false);
    }
  }

  async function previewDeactivation() {
    setPreviewError(null);
    try {
      setPreview(await previewSourceGranularityDependencies(granularity.id));
    } catch (error) {
      setPreviewError(error);
    }
  }

  async function deactivate() {
    setSaving(true);
    try {
      await setSourceGranularityActivation(granularity.id, {
        active: false,
        reason: reason || undefined,
        ...(replacementDefaultId ? { replacement_default_id: replacementDefaultId } : {}),
      });
      setPreview(null);
      await onSaved();
    } catch (error) {
      onError(error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      id={`registry-granularity-${granularity.id}`}
      className={cn(
        "space-y-3 rounded-md border bg-background p-3",
        highlighted ? "border-trust-blue ring-2 ring-trust-blue/30" : undefined,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">{granularity.granularity_key}</span>
        <StatusBadge tone={granularity.active ? "success" : "muted"}>
          {granularity.active ? "Active" : "Inactive"}
        </StatusBadge>
        <StatusBadge tone="default">{granularity.channel}</StatusBadge>
        {channelLocked ? (
          <span className="text-xs text-muted-foreground">Channel locked after activation</span>
        ) : null}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <FilterField label="Granularity key">
          <Input value={granularity.granularity_key} readOnly />
        </FilterField>
        <FilterField label="Channel">
          <Input value={granularity.channel} readOnly />
        </FilterField>
        <FilterField label="Owner label">
          <Input value={ownerLabel} onChange={(e) => setOwnerLabel(e.target.value)} readOnly={readOnly} />
        </FilterField>
        <FilterField label="CRM label">
          <Input value={crmLabel} onChange={(e) => setCrmLabel(e.target.value)} readOnly={readOnly} />
        </FilterField>
        <FilterField label="Aliases">
          <Input value={aliases} onChange={(e) => setAliases(e.target.value)} readOnly={readOnly} />
        </FilterField>
      </div>
      {!readOnly ? (
        <div className="flex flex-wrap gap-2">
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional)"
            className="max-w-xs"
          />
          <Button variant="outline" disabled={saving} onClick={() => void save()}>
            Save
          </Button>
          {granularity.active ? (
            <Button variant="destructive" disabled={saving} onClick={() => void previewDeactivation()}>
              Deactivate
            </Button>
          ) : (
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => {
                void (async () => {
                  setSaving(true);
                  try {
                    await setSourceGranularityActivation(granularity.id, {
                      active: true,
                      reason: reason || undefined,
                    });
                    await onSaved();
                  } catch (error) {
                    onError(error);
                  } finally {
                    setSaving(false);
                  }
                })();
              }}
            >
              Reactivate
            </Button>
          )}
        </div>
      ) : null}
      {preview ? (
        <DependencyPreviewPanel
          preview={preview}
          replacementDefaultId={replacementDefaultId}
          onReplacementChange={setReplacementDefaultId}
          onConfirm={() => void deactivate()}
          onCancel={() => setPreview(null)}
        />
      ) : null}
      {previewError ? <RegistryApiErrorMessage error={previewError} /> : null}
    </div>
  );
}

function DependencyPreviewPanel({
  preview,
  replacementDefaultId,
  onReplacementChange,
  replacementOptions = [],
  onConfirm,
  onCancel,
}: {
  preview: SourceDependencyPreview;
  replacementDefaultId: string;
  onReplacementChange: (value: string) => void;
  replacementOptions?: SourceGranularityItem[];
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const needsReplacement = preview.total > 0;
  return (
    <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
      <p className="font-medium">Dependency preview</p>
      <p className="mt-1 text-muted-foreground">Total: {preview.total}</p>
      <ul className="mt-2 list-inside list-disc text-muted-foreground">
        {Object.entries(preview.dependencies).map(([key, count]) => (
          <li key={key}>
            {key}: {count}
          </li>
        ))}
      </ul>
      {needsReplacement && replacementOptions.length > 0 ? (
        <FilterField label="Replacement default ID" className="mt-3">
          <select
            className={selectClassName}
            value={replacementDefaultId}
            onChange={(e) => onReplacementChange(e.target.value)}
          >
            <option value="">Select replacement</option>
            {replacementOptions.map((g) => (
              <option key={g.id} value={g.id}>
                {g.granularity_key} · {g.channel}
              </option>
            ))}
          </select>
        </FilterField>
      ) : null}
      <div className="mt-3 flex gap-2">
        <Button variant="destructive" onClick={onConfirm}>
          Confirm
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function ResolutionPreviewPanel() {
  const [channel, setChannel] = useState<"form" | "call">("form");
  const [companySlug, setCompanySlug] = useState("");
  const [granularityKey, setGranularityKey] = useState("");
  const [crmLabel, setCrmLabel] = useState("");
  const [sourceSite, setSourceSite] = useState("");
  const [fallbackAlias, setFallbackAlias] = useState("");
  const [result, setResult] = useState<SourceResolutionPreview | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  async function handlePreview() {
    setLoading(true);
    setError(null);
    try {
      setResult(
        await previewSourceResolution({
          channel,
          company_slug: companySlug.trim() || undefined,
          granularity_key: granularityKey.trim() || undefined,
          crm_label: crmLabel.trim() || undefined,
          source_site: sourceSite.trim() || undefined,
          fallback_alias: fallbackAlias.trim() || undefined,
        }),
      );
    } catch (previewError) {
      setError(previewError);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resolution preview</CardTitle>
        <CardDescription>Test how inbound attribution resolves against the active registry.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <FilterField label="Channel">
            <select
              className={selectClassName}
              value={channel}
              onChange={(e) => setChannel(e.target.value as "form" | "call")}
            >
              <option value="form">form</option>
              <option value="call">call</option>
            </select>
          </FilterField>
          <FilterField label="Company slug">
            <Input value={companySlug} onChange={(e) => setCompanySlug(e.target.value)} />
          </FilterField>
          <FilterField label="Granularity key">
            <Input value={granularityKey} onChange={(e) => setGranularityKey(e.target.value)} />
          </FilterField>
          <FilterField label="CRM label">
            <Input value={crmLabel} onChange={(e) => setCrmLabel(e.target.value)} />
          </FilterField>
          <FilterField label="Source site">
            <Input value={sourceSite} onChange={(e) => setSourceSite(e.target.value)} />
          </FilterField>
          <FilterField label="Fallback alias">
            <Input value={fallbackAlias} onChange={(e) => setFallbackAlias(e.target.value)} />
          </FilterField>
        </div>
        <Button type="button" disabled={loading} onClick={() => void handlePreview()}>
          Preview resolution
        </Button>
        {error ? <RegistryApiErrorMessage error={error} /> : null}
        {result ? (
          <pre className="overflow-x-auto rounded-md border bg-muted/30 p-3 text-xs">
            {JSON.stringify(result, null, 2)}
          </pre>
        ) : null}
      </CardContent>
    </Card>
  );
}
