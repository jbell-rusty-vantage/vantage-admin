"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { StatusBadge } from "@/components/data-table/status-badge";
import { FilterField } from "@/components/filters/filter-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import {
  createLeadSourceCompany,
  fetchLeadSourceCompanies,
  updateLeadSourceCompany,
  type LeadSourceCompany,
  type LeadSourceGranularity,
  type LeadSourceGranularityPayload,
} from "@/lib/api/sourceCompanies";
import { queryKeys } from "@/lib/query/keys";

const selectClassName =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

export function SourceCompanyManager() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const query = useQuery({
    queryKey: queryKeys.sourceCompanies.list(true),
    queryFn: () => fetchLeadSourceCompanies({ includeInactive: true }),
  });
  const createMutation = useMutation({
    mutationFn: createSourceFromForm,
    onSuccess: async () => {
      await invalidateSourceCompanies(queryClient);
      setMessage("Source company created.");
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "Create failed."),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof updateLeadSourceCompany>[1] }) =>
      updateLeadSourceCompany(id, body),
    onSuccess: async () => {
      await invalidateSourceCompanies(queryClient);
      setMessage("Source company updated.");
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "Update failed."),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lead Source Companies</CardTitle>
        <CardDescription>
          Create source companies and manage their Form and Call label granularities, CPL rates, aliases,
          and RingCentral routing numbers.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {message ? (
          <FeedbackMessage tone={message.includes("failed") ? "error" : "success"}>{message}</FeedbackMessage>
        ) : null}
        <CreateSourceCompanyForm
          onSubmit={(form) => createMutation.mutate(form)}
          isPending={createMutation.isPending}
        />
        {query.isLoading ? <FeedbackMessage>Loading source companies...</FeedbackMessage> : null}
        {query.isError ? (
          <FeedbackMessage tone="error">
            {query.error instanceof Error ? query.error.message : "Failed to load source companies."}
          </FeedbackMessage>
        ) : null}
        <div className="space-y-3">
          {(query.data ?? []).map((company) => (
            <SourceCompanyRow
              key={company.id}
              company={company}
              isPending={updateMutation.isPending}
              onSave={(body) => updateMutation.mutate({ id: company.id, body })}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CreateSourceCompanyForm({
  onSubmit,
  isPending,
}: {
  onSubmit: (form: HTMLFormElement) => void;
  isPending: boolean;
}) {
  return (
    <form
      className="rounded-md border bg-background p-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(event.currentTarget);
        event.currentTarget.reset();
      }}
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <FilterField label="Company name">
          <Input name="name" placeholder="e.g. New Source Leads" required />
        </FilterField>
        <FilterField label="Company slug">
          <Input name="company_slug" placeholder="new_source_leads" required />
        </FilterField>
        <FilterField label="Form label">
          <Input name="form_label" placeholder="New Source Forms" required />
        </FilterField>
        <FilterField label="Call label">
          <Input name="call_label" placeholder="New Source Inbounds" required />
        </FilterField>
        <FilterField label="Form CPL">
          <Input name="form_cpl" type="number" min={0} step="1" defaultValue="0" />
        </FilterField>
        <FilterField label="Call CPL">
          <Input name="call_cpl" type="number" min={0} step="1" defaultValue="0" />
        </FilterField>
        <FilterField label="Aliases">
          <Input name="aliases" placeholder="comma-separated" />
        </FilterField>
        <FilterField label="RingCentral numbers">
          <Input name="inbound_phone_numbers" placeholder="+18885551212, +18885553434" />
        </FilterField>
      </div>
      <div className="mt-3 flex justify-end">
        <Button type="submit" disabled={isPending}>
          Add Source Company
        </Button>
      </div>
    </form>
  );
}

function SourceCompanyRow({
  company,
  onSave,
  isPending,
}: {
  company: LeadSourceCompany;
  onSave: (body: Parameters<typeof updateLeadSourceCompany>[1]) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(company.name);
  const [ownerLabel, setOwnerLabel] = useState(company.owner_label);
  const [aliases, setAliases] = useState(company.aliases.join(", "));
  const [spreadsheetId, setSpreadsheetId] = useState(company.sheet_config?.spreadsheet_id ?? "");
  const [hasBadTabs, setHasBadTabs] = useState(company.sheet_config?.has_bad_tabs === true);
  const [defaultFormGranularityKey, setDefaultFormGranularityKey] = useState(
    company.default_form_granularity_key ?? "",
  );
  const [defaultCallGranularityKey, setDefaultCallGranularityKey] = useState(
    company.default_call_granularity_key ?? "",
  );
  const [granularities, setGranularities] = useState(company.granularities);
  const changed =
    name.trim() !== company.name ||
    ownerLabel.trim() !== company.owner_label ||
    aliases !== company.aliases.join(", ") ||
    spreadsheetId.trim() !== (company.sheet_config?.spreadsheet_id ?? "") ||
    hasBadTabs !== (company.sheet_config?.has_bad_tabs === true) ||
    defaultFormGranularityKey !== (company.default_form_granularity_key ?? "") ||
    defaultCallGranularityKey !== (company.default_call_granularity_key ?? "") ||
    JSON.stringify(granularities) !== JSON.stringify(company.granularities);

  useEffect(() => {
    setName(company.name);
    setOwnerLabel(company.owner_label);
    setAliases(company.aliases.join(", "));
    setSpreadsheetId(company.sheet_config?.spreadsheet_id ?? "");
    setHasBadTabs(company.sheet_config?.has_bad_tabs === true);
    setDefaultFormGranularityKey(company.default_form_granularity_key ?? "");
    setDefaultCallGranularityKey(company.default_call_granularity_key ?? "");
    setGranularities(company.granularities);
  }, [company]);

  const formGranularities = granularities.filter((granularity) => granularity.channel === "form");
  const callGranularities = granularities.filter((granularity) => granularity.channel === "call");

  return (
    <div className="space-y-3 rounded-md border bg-background p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">{company.owner_label}</h3>
            <StatusBadge tone={company.active ? "success" : "muted"}>
              {company.active ? "Active" : "Inactive"}
            </StatusBadge>
          </div>
          <p className="text-xs text-muted-foreground">
            {company.company_slug} · {company.created_from || "unknown"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={!changed || isPending}
            onClick={() =>
              onSave({
                name: name.trim(),
                owner_label: ownerLabel.trim(),
                aliases: parseList(aliases),
                sheet_config: {
                  spreadsheet_id: spreadsheetId.trim() || undefined,
                  has_bad_tabs: hasBadTabs,
                },
                granularities: granularities.map(toGranularityPayload),
                default_form_granularity_key: defaultFormGranularityKey || undefined,
                default_call_granularity_key: defaultCallGranularityKey || undefined,
              })
            }
          >
            Save
          </Button>
          <Button
            variant={company.active ? "destructive" : "outline"}
            disabled={isPending}
            onClick={() => onSave({ active: !company.active })}
          >
            {company.active ? "Deactivate" : "Reactivate"}
          </Button>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <FilterField label="Name">
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </FilterField>
        <FilterField label="Owner label">
          <Input value={ownerLabel} onChange={(event) => setOwnerLabel(event.target.value)} />
        </FilterField>
        <FilterField label="Aliases">
          <Input value={aliases} onChange={(event) => setAliases(event.target.value)} />
        </FilterField>
        <FilterField label="Source spreadsheet ID">
          <Input
            value={spreadsheetId}
            onChange={(event) => setSpreadsheetId(event.target.value)}
            placeholder="Optional per-source sheet"
          />
        </FilterField>
        <FilterField label="Default form granularity">
          <select
            className={selectClassName}
            value={defaultFormGranularityKey}
            onChange={(event) => setDefaultFormGranularityKey(event.target.value)}
          >
            <option value="">Select default form granularity</option>
            {formGranularities.map((granularity) => (
              <option key={granularity.granularity_key} value={granularity.granularity_key}>
                {granularity.owner_label || granularity.granularity_key}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Default call granularity">
          <select
            className={selectClassName}
            value={defaultCallGranularityKey}
            onChange={(event) => setDefaultCallGranularityKey(event.target.value)}
          >
            <option value="">Select default call granularity</option>
            {callGranularities.map((granularity) => (
              <option key={granularity.granularity_key} value={granularity.granularity_key}>
                {granularity.owner_label || granularity.granularity_key}
              </option>
            ))}
          </select>
        </FilterField>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={hasBadTabs}
          onChange={(event) => setHasBadTabs(event.target.checked)}
        />
        This source uses bad-lead tabs in its sheet.
      </label>
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            setGranularities((current) => [
              ...current,
              buildNewGranularity(company.company_slug, current.length),
            ])
          }
        >
          Add Granularity
        </Button>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        {granularities.map((granularity, index) => (
          <GranularityEditor
            key={granularity.id || granularity.granularity_key}
            granularity={granularity}
            onChange={(next) =>
              setGranularities((current) =>
                current.map((item, itemIndex) => (itemIndex === index ? next : item)),
              )
            }
          />
        ))}
      </div>
    </div>
  );
}

function GranularityEditor({
  granularity,
  onChange,
}: {
  granularity: LeadSourceGranularity;
  onChange: (granularity: LeadSourceGranularity) => void;
}) {
  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{granularity.crm_label}</p>
          <p className="text-xs text-muted-foreground">
            {granularity.channel} · {granularity.granularity_key}
          </p>
        </div>
        <Button
          variant={granularity.active ? "destructive" : "outline"}
          onClick={() => onChange({ ...granularity, active: !granularity.active })}
        >
          {granularity.active ? "Deactivate" : "Reactivate"}
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <FilterField label="Granularity key">
          <Input
            value={granularity.granularity_key}
            onChange={(event) => onChange({ ...granularity, granularity_key: event.target.value })}
          />
        </FilterField>
        <FilterField label="Channel">
          <select
            className={selectClassName}
            value={granularity.channel}
            onChange={(event) =>
              onChange({
                ...granularity,
                channel: event.target.value === "call" ? "call" : "form",
              })
            }
          >
            <option value="form">Form</option>
            <option value="call">Call</option>
          </select>
        </FilterField>
        <FilterField label="Owner label">
          <Input
            value={granularity.owner_label}
            onChange={(event) => onChange({ ...granularity, owner_label: event.target.value })}
          />
        </FilterField>
        <FilterField label="CRM label">
          <Input
            value={granularity.crm_label}
            onChange={(event) => onChange({ ...granularity, crm_label: event.target.value })}
          />
        </FilterField>
        <FilterField label="CPL">
          <Input
            type="number"
            min={0}
            value={granularity.cpl}
            onChange={(event) =>
              onChange({ ...granularity, cpl: Number(event.target.value) || 0 })
            }
          />
        </FilterField>
        <FilterField label="Priority">
          <Input
            type="number"
            value={granularity.priority}
            onChange={(event) =>
              onChange({ ...granularity, priority: Number(event.target.value) || 0 })
            }
          />
        </FilterField>
        <FilterField label="Local routing">
          <select
            className={selectClassName}
            value={granularity.local ?? ""}
            onChange={(event) =>
              onChange({
                ...granularity,
                local:
                  event.target.value === "local" || event.target.value === "long_distance"
                    ? event.target.value
                    : undefined,
              })
            }
          >
            <option value="">No local constraint</option>
            <option value="long_distance">Long distance</option>
            <option value="local">Local</option>
          </select>
        </FilterField>
        <FilterField label="Sheet tab name">
          <Input
            value={granularity.sheet_tab_name ?? ""}
            onChange={(event) =>
              onChange({
                ...granularity,
                sheet_tab_name: event.target.value,
              })
            }
            placeholder="Optional source tab override"
          />
        </FilterField>
        <FilterField label="Aliases">
          <Input
            value={granularity.aliases.join(", ")}
            onChange={(event) =>
              onChange({ ...granularity, aliases: parseList(event.target.value) })
            }
          />
        </FilterField>
        <FilterField label="Source sites">
          <Input
            value={granularity.source_sites.join(", ")}
            onChange={(event) =>
              onChange({
                ...granularity,
                source_sites: parseList(event.target.value),
              })
            }
            placeholder="main-site, landing-page-a"
          />
        </FilterField>
        <FilterField label="Inbound numbers">
          <Input
            value={granularity.inbound_phone_numbers.join(", ")}
            onChange={(event) =>
              onChange({
                ...granularity,
                inbound_phone_numbers: parseList(event.target.value),
              })
            }
          />
        </FilterField>
      </div>
    </div>
  );
}

function buildNewGranularity(
  companySlug: string,
  index: number,
): LeadSourceGranularity {
  const suffix = Date.now().toString(36);
  const granularityKey = `${companySlug}_granularity_${index + 1}_${suffix}`;
  return {
    id: granularityKey,
    _id: granularityKey,
    granularity_key: granularityKey,
    channel: "form",
    owner_label: "New Granularity",
    crm_label: "New Granularity",
    aliases: [],
    active: true,
    cpl: 0,
    source_sites: [],
    inbound_phone_numbers: [],
    priority: 0,
  };
}

function createSourceFromForm(form: HTMLFormElement) {
  const formData = new FormData(form);
  const companySlug = String(formData.get("company_slug") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const formLabel = String(formData.get("form_label") ?? "").trim();
  const callLabel = String(formData.get("call_label") ?? "").trim();
  const formGranularityKey = `${companySlug}_form`;
  const callGranularityKey = `${companySlug}_call`;
  return createLeadSourceCompany({
    company_slug: companySlug,
    name,
    owner_label: name,
    aliases: parseList(String(formData.get("aliases") ?? "")),
    active: true,
    default_form_granularity_key: formGranularityKey,
    default_call_granularity_key: callGranularityKey,
    granularities: [
      {
        granularity_key: formGranularityKey,
        channel: "form",
        owner_label: formLabel,
        crm_label: formLabel,
        aliases: [formLabel],
        active: true,
        cpl: Number(formData.get("form_cpl") ?? 0) || 0,
      },
      {
        granularity_key: callGranularityKey,
        channel: "call",
        owner_label: callLabel,
        crm_label: callLabel,
        aliases: [callLabel],
        active: true,
        cpl: Number(formData.get("call_cpl") ?? 0) || 0,
        inbound_phone_numbers: parseList(String(formData.get("inbound_phone_numbers") ?? "")),
      },
    ],
    created_from: "admin",
  });
}

function toGranularityPayload(
  granularity: LeadSourceGranularity,
): LeadSourceGranularityPayload {
  return {
    granularity_key: granularity.granularity_key,
    channel: granularity.channel,
    owner_label: granularity.owner_label,
    crm_label: granularity.crm_label,
    aliases: granularity.aliases,
    active: granularity.active,
    cpl: granularity.cpl,
    ...(granularity.local ? { local: granularity.local } : {}),
    source_sites: granularity.source_sites,
    inbound_phone_numbers: granularity.inbound_phone_numbers,
    priority: granularity.priority,
    ...(granularity.sheet_tab_name ? { sheet_tab_name: granularity.sheet_tab_name } : {}),
  };
}

function parseList(value: string): string[] {
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
}

async function invalidateSourceCompanies(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.sourceCompanies.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.facets.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.cplRates.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.lists.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.search.all }),
  ]);
}
