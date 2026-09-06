"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
import { fetchLeadSourceCompanies } from "@/lib/api/sourceCompanies";
import { MOVE_SIZE_OPTIONS } from "@/lib/constants/domain";
import { queryKeys } from "@/lib/query/keys";
import { MANUAL_COPY } from "./manual-copy";
import {
  buildManualCreateLeadPayload,
  channelForLeadKind,
  createdLeadRecordHref,
  defaultSourceChoice,
  emptyManualCreateLeadDraft,
  findSourceChoice,
  sourceChoicesForChannel,
  validateManualCreateLeadDraft,
  type ManualCreateLeadDraft,
  type ManualLeadKind,
} from "./manual-create-lead";

type FormMessage = {
  tone: "success" | "warning" | "error";
  text: string;
  href?: string;
};

const SELECT_CLASS = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

export function CreateLeadForm() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<ManualCreateLeadDraft>(emptyManualCreateLeadDraft());
  const [message, setMessage] = useState<FormMessage | null>(null);
  const sourceCompaniesQuery = useQuery({
    queryKey: queryKeys.sourceCompanies.list(false),
    queryFn: () => fetchLeadSourceCompanies(),
    staleTime: 5 * 60 * 1000,
  });
  const sourceChoices = useMemo(
    () => sourceChoicesForChannel(sourceCompaniesQuery.data, channelForLeadKind(draft.kind)),
    [sourceCompaniesQuery.data, draft.kind],
  );

  useEffect(() => {
    if (draft.source_granularity_key) return;
    const next = defaultSourceChoice(sourceChoices);
    if (!next) return;
    setDraft((current) => ({
      ...current,
      source_company: next.source_company,
      source_granularity_key: next.source_granularity_key,
    }));
  }, [draft.source_granularity_key, sourceChoices]);

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
    const nextChoices = sourceChoicesForChannel(sourceCompaniesQuery.data, channelForLeadKind(kind));
    const nextChoice = defaultSourceChoice(nextChoices);
    patch({
      kind,
      source_company: nextChoice?.source_company ?? "",
      source_granularity_key: nextChoice?.source_granularity_key ?? "",
      post_to_granot: kind === "FormLead" ? draft.post_to_granot : false,
    });
  }

  function handleSourceChoiceChange(value: string) {
    const choice = findSourceChoice(sourceChoices, value);
    patch({
      source_company: choice?.source_company ?? "",
      source_granularity_key: value,
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
      {sourceCompaniesQuery.isError ? (
        <FeedbackMessage tone="error">{MANUAL_COPY.sourceCatalogError}</FeedbackMessage>
      ) : null}
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
            className={SELECT_CLASS}
          >
            <option value="FormLead">{MANUAL_COPY.formLead}</option>
            <option value="CallLead">{MANUAL_COPY.callLead}</option>
          </select>
        </FilterField>
        <FilterField label={MANUAL_COPY.sourceCompany}>
          <select
            value={draft.source_granularity_key}
            required
            onChange={(event) => handleSourceChoiceChange(event.target.value)}
            className={SELECT_CLASS}
          >
            {sourceChoices.length === 1 ? null : (
              <option value="">{MANUAL_COPY.sourceCompanyPlaceholder}</option>
            )}
            {sourceChoices.map((option) => (
              <option key={option.source_granularity_key} value={option.source_granularity_key}>
                {option.owner_label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">{MANUAL_COPY.sourceCompanyHint}</p>
        </FilterField>
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
                className={SELECT_CLASS}
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
        <label className="flex items-start gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            className="mt-1"
            checked={draft.hide_from_master_leads}
            onChange={(event) => patch({ hide_from_master_leads: event.target.checked })}
          />
          <span>
            {MANUAL_COPY.hideFromMasterLeads}
            <span className="mt-1 block text-xs text-muted-foreground">
              {MANUAL_COPY.hideFromMasterLeadsHint}
            </span>
          </span>
        </label>
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
