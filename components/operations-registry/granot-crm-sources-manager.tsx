"use client";

import { useMemo, useState } from "react";
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
  fetchGranotCrmSources,
  setGranotCrmSourceActivation,
  updateGranotCrmSource,
  type GranotCrmSourceItem,
  type GranotCrmSourceRoute,
  type GranotLeadCreatedPolicy,
  type GranotLifecycleDisposition,
} from "@/lib/api/registryGranotCrmSources";
import {
  fetchSourceCompanies,
  fetchSourceGranularities,
  type SourceCompanyItem,
  type SourceGranularityItem,
} from "@/lib/api/registrySources";
import { queryKeys } from "@/lib/query/keys";
import { cn } from "@/lib/utils";
import { RegistryApiErrorMessage } from "./registry-api-error";

const selectClassName =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

export const GRANOT_ROUTE_TEMPLATES = [
  { route_key: "call_any", lead_model: "CallLead", move_type: "any", label: "Call / any" },
  { route_key: "form_local", lead_model: "FormLead", move_type: "local", label: "Form / local" },
  {
    route_key: "form_long_distance",
    lead_model: "FormLead",
    move_type: "long_distance",
    label: "Form / long-distance",
  },
] as const;

export const CREATE_IF_MISSING_COPY =
  "Lead creation remains a later rollout. This editor can only persist link_only or observation_only.";

function matchingGranularities(
  granularities: SourceGranularityItem[],
  route: Pick<GranotCrmSourceRoute, "lead_model" | "move_type">,
  companyId?: string | null,
) {
  const channel = route.lead_model === "CallLead" ? "call" : "form";
  return granularities.filter((item) => {
    if (!item.active) return false;
    if (companyId && item.source_company !== companyId) return false;
    if (item.channel !== channel) return false;
    if (route.move_type === "any") return true;
    return item.local === route.move_type;
  });
}

export function GranotCrmSourcesManager({ readOnly }: { readOnly: boolean }) {
  const searchParams = useSearchParams();
  const initialEntity = searchParams.get("entity");
  const [selectedId, setSelectedId] = useState<string | null>(initialEntity);
  const [message, setMessage] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<unknown>(null);
  const queryClient = useQueryClient();

  const sourcesQuery = useQuery({
    queryKey: queryKeys.operationsRegistry.granotCrmSources(),
    queryFn: fetchGranotCrmSources,
  });
  const companiesQuery = useQuery({
    queryKey: queryKeys.operationsRegistry.sourceCompanies(false),
    queryFn: () => fetchSourceCompanies({ includeInactive: false }),
  });
  const granularitiesQuery = useQuery({
    queryKey: queryKeys.operationsRegistry.sourceGranularities({ includeInactive: false }),
    queryFn: () => fetchSourceGranularities({ includeInactive: false }),
  });

  const sources = sourcesQuery.data ?? [];
  const selected = sources.find((item) => item.id === (selectedId ?? sources[0]?.id)) ?? null;

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof updateGranotCrmSource>[1] }) =>
      updateGranotCrmSource(id, body),
    onSuccess: async () => {
      await invalidateRegistryQueries(queryClient);
      setMutationError(null);
      setMessage("Granot source policy saved.");
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
      body: Parameters<typeof setGranotCrmSourceActivation>[1];
    }) => setGranotCrmSourceActivation(id, body),
    onSuccess: async () => {
      await invalidateRegistryQueries(queryClient);
      setMutationError(null);
      setMessage("Granot source lifecycle activation updated.");
    },
    onError: (error) => {
      setMessage(null);
      setMutationError(error);
    },
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Granot CRM sources</CardTitle>
          <CardDescription>
            Every operational label stays visible, including disabled, deferred, unmatched, and
            ambiguous rows. Classification is server-owned.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sourcesQuery.isPending ? <TableLoadingState /> : null}
          {sourcesQuery.isError ? (
            <TableErrorState
              error={
                sourcesQuery.error instanceof Error
                  ? sourcesQuery.error.message
                  : "Unable to load Granot CRM sources."
              }
            />
          ) : null}
          {sourcesQuery.isSuccess && sources.length === 0 ? (
            <TableEmptyState label="No Granot CRM sources" />
          ) : null}
          <ul className="grid gap-2">
            {sources.map((source) => {
              const active = source.id === selected?.id;
              return (
                <li key={source.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(source.id)}
                    className={cn(
                      "w-full rounded-md border px-3 py-2 text-left",
                      active ? "border-navy bg-pale-gold/40" : "border-input bg-background",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-navy">{source.granot_label}</span>
                      <StatusBadge tone={source.lifecycle_enabled ? "success" : "muted"}>
                        {source.lifecycle_enabled ? "lifecycle on" : "lifecycle off"}
                      </StatusBadge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {source.normalized_granot_label ?? "normalized label pending"} ·{" "}
                      {source.lifecycle_disposition} · {source.lead_created_policy}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {message ? <FeedbackMessage tone="success">{message}</FeedbackMessage> : null}
        {mutationError ? <RegistryApiErrorMessage error={mutationError} /> : null}
        {selected ? (
          <GranotCrmSourceEditor
            key={selected.id}
            source={selected}
            companies={companiesQuery.data ?? []}
            granularities={granularitiesQuery.data ?? []}
            readOnly={readOnly}
            isPending={updateMutation.isPending || activationMutation.isPending}
            onSave={(body) => updateMutation.mutate({ id: selected.id, body })}
            onActivate={(body) => activationMutation.mutate({ id: selected.id, body })}
          />
        ) : sourcesQuery.isSuccess ? (
          <FeedbackMessage tone="warning">Select a Granot source to inspect.</FeedbackMessage>
        ) : null}
      </div>
    </div>
  );
}

export function GranotCrmSourceEditor({
  source,
  companies,
  granularities,
  readOnly,
  isPending,
  onSave,
  onActivate,
}: {
  source: GranotCrmSourceItem;
  companies: SourceCompanyItem[];
  granularities: SourceGranularityItem[];
  readOnly: boolean;
  isPending: boolean;
  onSave: (body: Parameters<typeof updateGranotCrmSource>[1]) => void;
  onActivate: (body: Parameters<typeof setGranotCrmSourceActivation>[1]) => void;
}) {
  const [granotLabel, setGranotLabel] = useState(source.granot_label);
  const [enabled, setEnabled] = useState(source.enabled);
  const [disposition, setDisposition] = useState<GranotLifecycleDisposition>(
    source.lifecycle_disposition,
  );
  const [policy, setPolicy] = useState<GranotLeadCreatedPolicy>(
    source.lead_created_policy === "create_if_missing" ? "link_only" : source.lead_created_policy,
  );
  const [companyId, setCompanyId] = useState(source.lead_source_company ?? "");
  const [routes, setRoutes] = useState<GranotCrmSourceRoute[]>(source.lifecycle_routes);
  const [reason, setReason] = useState("");
  const [activationReason, setActivationReason] = useState("");

  const routeOptions = useMemo(
    () =>
      GRANOT_ROUTE_TEMPLATES.filter(
        (template) => !routes.some((route) => route.route_key === template.route_key),
      ),
    [routes],
  );

  function addRoute(routeKey: string) {
    const template = GRANOT_ROUTE_TEMPLATES.find((item) => item.route_key === routeKey);
    if (!template) return;
    setRoutes((current) => [
      ...current,
      {
        route_key: template.route_key,
        lead_model: template.lead_model,
        move_type: template.move_type,
        source_granularity_id: "",
      },
    ]);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{source.granot_label}</CardTitle>
        <CardDescription>
          Normalized label is server-derived and cannot be submitted. Operational enabled is
          separate from lifecycle activation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid gap-2 text-sm md:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Normalized label</dt>
            <dd className="font-medium text-navy">{source.normalized_granot_label ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Policy version</dt>
            <dd className="font-medium text-navy">{source.lifecycle_policy_version}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Operational enabled</dt>
            <dd className="font-medium text-navy">{source.enabled ? "yes" : "no"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Company dependency</dt>
            <dd className="font-medium text-navy">
              {source.lead_source_company_label ?? "none"} ({source.lead_source_company_status ?? "n/a"})
            </dd>
          </div>
        </dl>

        {source.automation_sources.length > 0 ? (
          <div>
            <h3 className="text-sm font-semibold text-navy">Automation references</h3>
            <ul className="mt-2 grid gap-2">
              {source.automation_sources.map((automation) => (
                <li key={automation.id} className="rounded-md border border-input px-3 py-2 text-sm">
                  <p className="font-medium text-navy">{automation.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {automation.compatibility.status}
                    {automation.compatibility.available_for_apply ? "" : " · unavailable for apply"}
                  </p>
                  {automation.compatibility.issues.map((issue) => (
                    <p key={issue.code} className="text-xs text-red-700">
                      {issue.message}
                    </p>
                  ))}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {source.latest_audit ? (
          <p className="text-xs text-muted-foreground">
            Latest audit: {source.latest_audit.action} by {source.latest_audit.actor_label} (
            {source.latest_audit.actor_role})
            {source.latest_audit.reason ? ` — ${source.latest_audit.reason}` : ""}
          </p>
        ) : null}

        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            onSave({
              granot_label: granotLabel.trim(),
              enabled,
              lifecycle_enabled: source.lifecycle_enabled,
              lifecycle_disposition: disposition,
              lead_created_policy: policy,
              lead_source_company: companyId || null,
              lifecycle_routes: routes.map((route) => ({
                route_key: route.route_key,
                lead_model: route.lead_model,
                move_type: route.move_type,
                source_granularity_id: route.source_granularity_id,
              })),
              reason: reason.trim(),
            });
          }}
        >
          <FilterField label="Operational label">
            <Input
              value={granotLabel}
              disabled={readOnly}
              onChange={(event) => setGranotLabel(event.target.value)}
            />
          </FilterField>
          <label className="flex items-center gap-2 text-sm text-navy">
            <input
              type="checkbox"
              checked={enabled}
              disabled={readOnly}
              onChange={(event) => setEnabled(event.target.checked)}
            />
            Operational CSV enabled
          </label>
          <FilterField label="Lifecycle disposition">
            <select
              className={selectClassName}
              value={disposition}
              disabled={readOnly}
              onChange={(event) =>
                setDisposition(event.target.value as GranotLifecycleDisposition)
              }
            >
              <option value="source_scoped_lead">source_scoped_lead</option>
              <option value="referral_booking">referral_booking</option>
              <option value="deferred">deferred</option>
            </select>
          </FilterField>
          <FilterField label="Lead created policy">
            <select
              className={selectClassName}
              value={policy}
              disabled={readOnly}
              onChange={(event) => setPolicy(event.target.value as GranotLeadCreatedPolicy)}
            >
              <option value="link_only">link_only</option>
              <option value="observation_only">observation_only</option>
              <option value="create_if_missing" disabled>
                create_if_missing (later rollout)
              </option>
            </select>
          </FilterField>
          <p className="text-xs text-muted-foreground">{CREATE_IF_MISSING_COPY}</p>
          <FilterField label="Source company">
            <select
              className={selectClassName}
              value={companyId}
              disabled={readOnly}
              onChange={(event) => setCompanyId(event.target.value)}
            >
              <option value="">None</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.owner_label || company.name} ({company.company_slug})
                </option>
              ))}
            </select>
          </FilterField>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-navy">Lifecycle routes</h3>
            {routes.map((route, index) => {
              const options = matchingGranularities(granularities, route, companyId || null);
              return (
                <div key={`${route.route_key}-${index}`} className="grid gap-2 rounded-md border p-3">
                  <p className="text-sm font-medium text-navy">
                    {route.route_key} · {route.lead_model} · {route.move_type}
                    {route.source_granularity_status
                      ? ` · ${route.source_granularity_status}`
                      : ""}
                  </p>
                  <FilterField label="Source granularity">
                    <select
                      className={selectClassName}
                      value={route.source_granularity_id}
                      disabled={readOnly}
                      onChange={(event) =>
                        setRoutes((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, source_granularity_id: event.target.value }
                              : item,
                          ),
                        )
                      }
                    >
                      <option value="">Select an active granularity</option>
                      {options.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.owner_label || item.crm_label} ({item.granularity_key})
                        </option>
                      ))}
                    </select>
                  </FilterField>
                  {!readOnly ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setRoutes((current) => current.filter((_, itemIndex) => itemIndex !== index))
                      }
                    >
                      Remove route
                    </Button>
                  ) : null}
                </div>
              );
            })}
            {!readOnly && routeOptions.length > 0 ? (
              <FilterField label="Add reviewed route">
                <select
                  className={selectClassName}
                  defaultValue=""
                  onChange={(event) => {
                    if (event.target.value) {
                      addRoute(event.target.value);
                      event.target.value = "";
                    }
                  }}
                >
                  <option value="">Select a constrained route</option>
                  {routeOptions.map((template) => (
                    <option key={template.route_key} value={template.route_key}>
                      {template.label}
                    </option>
                  ))}
                </select>
              </FilterField>
            ) : null}
          </div>

          <FilterField label="Review reason">
            <Input
              value={reason}
              disabled={readOnly}
              minLength={10}
              maxLength={1000}
              placeholder="Required 10–1000 character Owner reason"
              onChange={(event) => setReason(event.target.value)}
            />
          </FilterField>
          {!readOnly ? (
            <Button type="submit" disabled={isPending || reason.trim().length < 10}>
              Save reviewed policy
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">Admin role is read-only.</p>
          )}
        </form>

        <form
          className="grid gap-3 rounded-md border border-dashed p-3"
          onSubmit={(event) => {
            event.preventDefault();
            onActivate({
              lifecycle_enabled: !source.lifecycle_enabled,
              reason: activationReason.trim(),
            });
          }}
        >
          <h3 className="text-sm font-semibold text-navy">Lifecycle activation</h3>
          <p className="text-xs text-muted-foreground">
            Enabling revalidates the complete current policy. This does not create Leads or change
            Booking facts. Operational CSV enabled stays {source.enabled ? "on" : "off"}.
          </p>
          <FilterField label="Activation reason">
            <Input
              value={activationReason}
              disabled={readOnly}
              minLength={10}
              maxLength={1000}
              onChange={(event) => setActivationReason(event.target.value)}
            />
          </FilterField>
          {!readOnly ? (
            <Button
              type="submit"
              variant="outline"
              disabled={isPending || activationReason.trim().length < 10}
            >
              {source.lifecycle_enabled ? "Disable lifecycle" : "Enable lifecycle"}
            </Button>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
