"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FilterField } from "@/components/filters/filter-field";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import {
  createCallLead,
  createFormLead,
  getRecordId,
  type CreateFormLeadResult,
} from "@/lib/api/admin";
import {
  fetchLeadSourceCompanies,
  toLeadSourceCompanyOptions,
  type LeadSourceChannel,
} from "@/lib/api/sourceCompanies";
import { MOVE_SIZE_OPTIONS } from "@/lib/constants/domain";
import { queryKeys } from "@/lib/query/keys";
import { MANUAL_COPY } from "./manual-copy";
import {
  buildManualCreateLeadPayload,
  createdLeadRecordHref,
  defaultGranularityKey,
  emptyManualCreateLeadDraft,
  granularitiesForChannel,
  validateManualCreateLeadDraft,
  type ManualCreateLeadDraft,
  type ManualLeadKind,
} from "./manual-create-lead";

type FormMessage = {
  tone: "success" | "warning" | "error";
  text: string;
  href?: string;
};

function channelForKind(kind: ManualLeadKind): LeadSourceChannel {
  return kind === "CallLead" ? "call" : "form";
}

export function CreateLeadForm() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<ManualCreateLeadDraft>(emptyManualCreateLeadDraft());
  const [message, setMessage] = useState<FormMessage | null>(null);
  const sourceCompaniesQuery = useQuery({
    queryKey: queryKeys.sourceCompanies.list(false),
    queryFn: () => fetchLeadSourceCompanies(),
    staleTime: 5 * 60 * 1000,
  });
  const sourceCompanyOptions = useMemo(
    () => toLeadSourceCompanyOptions(sourceCompaniesQuery.data),
    [sourceCompaniesQuery.data],
  );
  const selectedCompany = sourceCompaniesQuery.data?.find(
    (company) => company.company_slug === draft.source_company,
  );
  const granularityOptions = granularitiesForChannel(selectedCompany, channelForKind(draft.kind));

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = buildManualCreateLeadPayload(draft);
      if (draft.kind === "FormLead") {
        return { kind: draft.kind, result: await createFormLead(payload) };
      }
      return { kind: draft.kind, result: await createCallLead(payload) };
    },
    onSuccess: async ({ kind, result }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.lists.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.details.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.search.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.auditLog.all }),
      ]);
      const leadId =
        kind === "FormLead"
          ? getRecordId((result as CreateFormLeadResult).lead)
          : getRecordId(result);
      const duplicate =
        kind === "FormLead" && (result as CreateFormLeadResult).lead.duplicate === true;
      setDraft(emptyManualCreateLeadDraft(kind));
      setMessage({
        tone: duplicate ? "warning" : "success",
        text: duplicate
          ? `${MANUAL_COPY.successForm} ${MANUAL_COPY.duplicateNotice}`
          : kind === "FormLead"
            ? MANUAL_COPY.successForm
            : MANUAL_COPY.successCall,
        href: leadId ? createdLeadRecordHref(kind, leadId) : undefined,
      });
    },
    onError: (error) =>
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Lead was not created.",
      }),
  });

  function patch(next: Partial<ManualCreateLeadDraft>) {
    setDraft((current) => ({ ...current, ...next }));
    setMessage(null);
  }

  function handleKindChange(value: string) {
    const kind: ManualLeadKind = value === "CallLead" ? "CallLead" : "FormLead";
    const nextGranularities = granularitiesForChannel(selectedCompany, channelForKind(kind));
    patch({
      kind,
      source_granularity_key: defaultGranularityKey(nextGranularities),
      post_to_granot: kind === "FormLead" ? draft.post_to_granot : false,
    });
  }

  function handleSourceCompanyChange(value: string) {
    const company = sourceCompaniesQuery.data?.find((item) => item.company_slug === value);
    const nextGranularities = granularitiesForChannel(company, channelForKind(draft.kind));
    patch({
      source_company: value,
      source_granularity_key: defaultGranularityKey(nextGranularities),
    });
  }

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const missing = validateManualCreateLeadDraft(draft);
        if (missing.length > 0) {
          setMessage({
            tone: "error",
            text: `Please enter the required ${missing.join(", ")} before creating the lead.`,
          });
          return;
        }
        mutation.mutate();
      }}
    >
      <div>
        <h2 className="text-sm font-semibold">{MANUAL_COPY.createTitle}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{MANUAL_COPY.createHint}</p>
      </div>
      {message ? (
        <FeedbackMessage tone={message.tone}>
          <span>{message.text}</span>
          {message.href ? (
            <>
              {" "}
              <Link className="underline" href={message.href}>
                {MANUAL_COPY.viewLead}
              </Link>
            </>
          ) : null}
        </FeedbackMessage>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <FilterField label={MANUAL_COPY.kindLabel}>
          <select
            value={draft.kind}
            onChange={(event) => handleKindChange(event.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="FormLead">{MANUAL_COPY.formLead}</option>
            <option value="CallLead">{MANUAL_COPY.callLead}</option>
          </select>
        </FilterField>
        <FilterField label={MANUAL_COPY.sourceCompany}>
          <select
            value={draft.source_company}
            required
            onChange={(event) => handleSourceCompanyChange(event.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">{MANUAL_COPY.sourceCompanyPlaceholder}</option>
            {sourceCompanyOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FilterField>
        {granularityOptions.length > 0 ? (
          <FilterField label={MANUAL_COPY.sourceGranularity} className="sm:col-span-2">
            <select
              value={draft.source_granularity_key}
              onChange={(event) => patch({ source_granularity_key: event.target.value })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {granularityOptions.length > 1 ? (
                <option value="">{MANUAL_COPY.sourceGranularityPlaceholder}</option>
              ) : null}
              {granularityOptions.map((option) => (
                <option key={option.granularity_key} value={option.granularity_key}>
                  {option.owner_label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">{MANUAL_COPY.sourceGranularityHint}</p>
          </FilterField>
        ) : null}
        <FilterField label={MANUAL_COPY.name}>
          <Input value={draft.name} onChange={(event) => patch({ name: event.target.value })} required />
        </FilterField>
        <FilterField label={MANUAL_COPY.phone}>
          <Input
            type="tel"
            value={draft.phone_number}
            onChange={(event) => patch({ phone_number: event.target.value })}
            required={draft.kind === "FormLead"}
          />
        </FilterField>
        <FilterField label={MANUAL_COPY.email}>
          <Input
            type="email"
            value={draft.email}
            onChange={(event) => patch({ email: event.target.value })}
          />
        </FilterField>
        {draft.kind === "CallLead" ? (
          <FilterField label={MANUAL_COPY.jobNumber}>
            <Input value={draft.job_no} onChange={(event) => patch({ job_no: event.target.value })} />
          </FilterField>
        ) : (
          <>
            <FilterField label={MANUAL_COPY.pickupZip}>
              <Input
                inputMode="numeric"
                maxLength={5}
                value={draft.pickup_zip}
                onChange={(event) => patch({ pickup_zip: event.target.value })}
                required
              />
            </FilterField>
            <FilterField label={MANUAL_COPY.destinationZip}>
              <Input
                inputMode="numeric"
                maxLength={5}
                value={draft.destination_zip}
                onChange={(event) => patch({ destination_zip: event.target.value })}
                required
              />
            </FilterField>
            <FilterField label={MANUAL_COPY.moveSize}>
              <select
                value={draft.move_size}
                onChange={(event) => patch({ move_size: event.target.value })}
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Choose move size</option>
                {MOVE_SIZE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FilterField>
            <FilterField label={MANUAL_COPY.moveDate}>
              <Input
                type="date"
                value={draft.move_date}
                onChange={(event) => patch({ move_date: event.target.value })}
              />
            </FilterField>
            <label className="flex items-start gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={draft.post_to_granot}
                onChange={(event) => patch({ post_to_granot: event.target.checked })}
              />
              <span>
                {MANUAL_COPY.postToGranot}
                <span className="mt-1 block text-xs text-muted-foreground">
                  {MANUAL_COPY.postToGranotHint}
                </span>
              </span>
            </label>
          </>
        )}
      </div>
      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending
          ? draft.kind === "CallLead"
            ? MANUAL_COPY.creatingCall
            : MANUAL_COPY.creatingForm
          : draft.kind === "CallLead"
            ? MANUAL_COPY.createCall
            : MANUAL_COPY.createForm}
      </Button>
    </form>
  );
}
