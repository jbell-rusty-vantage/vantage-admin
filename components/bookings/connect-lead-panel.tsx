"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FeedbackMessage } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/data-table/status-badge";
import {
  IntakeKnownContactsChip,
  IntakeKnownContactsCards,
} from "@/components/intakes/intake-known-contacts";
import {
  CandidateLeadFacts,
  candidateLeadName,
  candidateLeadTypeLabel,
} from "@/components/granot-lifecycle/candidate-lead-facts";
import { isSameCandidate } from "@/components/granot-lifecycle/lead-candidate-browser";
import {
  connectBookingToLead,
  fetchConnectLeadCandidates,
  type GranotLeadModel,
  type GranotLifecycleCandidateItem,
} from "@/lib/api/granotLifecycle";
import { getRecordId, type AdminRecord } from "@/lib/api/admin";
import { queryKeys } from "@/lib/query/keys";
import { invalidateGranotLifecycleCommandViews } from "@/lib/query/granotLifecycle";
import { cn } from "@/lib/utils";
import { BOOKINGS_CONNECT_COPY } from "./bookings-copy";

export function ConnectLeadPanel({ record }: { record: AdminRecord }) {
  const bookingId = getRecordId(record);
  const queryClient = useQueryClient();
  const [draftQuery, setDraftQuery] = useState("");
  const [draftLeadModel, setDraftLeadModel] = useState<GranotLeadModel | "">("");
  const [applied, setApplied] = useState<{ q?: string; lead_model?: GranotLeadModel; cursor?: string }>({});
  const [selected, setSelected] = useState<GranotLifecycleCandidateItem>();
  const [overrideReason, setOverrideReason] = useState("");
  const [notice, setNotice] = useState<string>();

  const search = useQuery({
    queryKey: queryKeys.granotLifecycle.connectCandidates(bookingId, applied),
    queryFn: () => fetchConnectLeadCandidates(bookingId, { ...applied, limit: 25 }),
    enabled: Boolean(applied.q),
  });

  const connect = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error("Select a lead first.");
      return connectBookingToLead(
        bookingId,
        {
          expected_booking_revision: Number(record.domain_revision ?? 0),
          selected_lead: { lead_model: selected.lead_ref.model, lead_id: selected.lead_ref.id },
          ...(selected.requires_override_reason
            ? { out_of_scope_override_reason: overrideReason.trim() }
            : {}),
        },
        crypto.randomUUID(),
      );
    },
    async onSuccess(result) {
      setNotice(result.owner_notice ?? BOOKINGS_CONNECT_COPY.success);
      await Promise.all([
        invalidateGranotLifecycleCommandViews(queryClient, {
          bookingId,
          jobNo: typeof record.job_no === "string" ? record.job_no : undefined,
          lead: selected
            ? { model: selected.lead_ref.model, id: selected.lead_ref.id }
            : undefined,
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.details.resource("booked-leads", bookingId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.lists.resource("booked-leads") }),
      ]);
    },
  });

  return (
    <section aria-labelledby="connect-lead-heading" className="space-y-4 rounded-md border p-3">
      <div>
        <h3 id="connect-lead-heading" className="text-base font-semibold text-navy">
          {BOOKINGS_CONNECT_COPY.searchTitle}
        </h3>
        <p className="text-sm text-muted-foreground">{BOOKINGS_CONNECT_COPY.searchHint}</p>
      </div>
      <form
        className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          setApplied({
            q: draftQuery.trim() || undefined,
            lead_model: draftLeadModel || undefined,
          });
        }}
      >
        <div className="space-y-1">
          <Label htmlFor="connect-lead-query">{BOOKINGS_CONNECT_COPY.searchLabel}</Label>
          <Input
            id="connect-lead-query"
            maxLength={100}
            value={draftQuery}
            onChange={(event) => setDraftQuery(event.target.value)}
            placeholder={BOOKINGS_CONNECT_COPY.searchPlaceholder}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="connect-lead-model">How they came in</Label>
          <select
            id="connect-lead-model"
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={draftLeadModel}
            onChange={(event) => setDraftLeadModel(event.target.value as GranotLeadModel | "")}
          >
            <option value="">Any way</option>
            <option value="FormLead">Web form</option>
            <option value="CallLead">Phone call</option>
          </select>
        </div>
        <Button className="self-end" type="submit">Search</Button>
      </form>
      {search.isFetching ? <p role="status" className="text-sm text-muted-foreground">Searching customers…</p> : null}
      {search.isError ? (
        <FeedbackMessage tone="error">
          {search.error instanceof Error ? search.error.message : "Unable to search customers."}
        </FeedbackMessage>
      ) : null}
      {applied.q && search.data ? (
        <ConnectCandidateResults items={search.data.items} selected={selected} onSelect={setSelected} />
      ) : null}
      {selected ? (
        <div className="space-y-3 rounded-md border p-3">
          <p className="font-semibold text-navy">{BOOKINGS_CONNECT_COPY.reviewTitle}</p>
          <p className="text-sm text-muted-foreground">
            Job {typeof record.job_no === "string" ? record.job_no : "—"}
            {typeof record.customer_name === "string" ? ` · ${record.customer_name}` : ""}
          </p>
          <p className="text-sm">{candidateLeadName(selected)}</p>
          <IntakeKnownContactsCards item={selected} />
          {selected.requires_override_reason ? (
            <div className="space-y-1">
              <Label htmlFor="connect-override">{BOOKINGS_CONNECT_COPY.overrideLabel}</Label>
              <Textarea
                id="connect-override"
                minLength={10}
                maxLength={500}
                value={overrideReason}
                onChange={(event) => setOverrideReason(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">{BOOKINGS_CONNECT_COPY.overrideHint}</p>
            </div>
          ) : null}
          <Button
            type="button"
            disabled={connect.isPending || (selected.requires_override_reason && overrideReason.trim().length < 10)}
            onClick={() => connect.mutate()}
          >
            {BOOKINGS_CONNECT_COPY.connectLead}
          </Button>
        </div>
      ) : null}
      {connect.isError ? (
        <FeedbackMessage tone="error">
          {connect.error instanceof Error ? connect.error.message : "Unable to connect this lead."}
        </FeedbackMessage>
      ) : null}
      {notice ? <FeedbackMessage tone="success">{notice}</FeedbackMessage> : null}
    </section>
  );
}

function ConnectCandidateResults({
  items,
  selected,
  onSelect,
}: {
  items: GranotLifecycleCandidateItem[];
  selected?: GranotLifecycleCandidateItem;
  onSelect: (item: GranotLifecycleCandidateItem) => void;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No customers match this search.</p>;
  }
  return (
    <ul className="space-y-3" aria-label="Customers you can connect">
      {items.map((item) => {
        const isSelected = isSameCandidate(selected, item);
        return (
          <li key={`${item.lead_ref.model}:${item.lead_ref.id}`}>
            <label className={cn(
              "block cursor-pointer space-y-3 rounded-md border p-3",
              isSelected && "border-trust-blue bg-trust-blue/5 ring-1 ring-trust-blue",
            )}>
              <span className="flex items-center gap-2 text-sm font-semibold">
                <input
                  type="radio"
                  name="connect-selected-lead"
                  checked={isSelected}
                  onChange={() => onSelect(item)}
                />
                {candidateLeadName(item)}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <IntakeKnownContactsChip item={item} />
                {isSelected ? <StatusBadge tone="success">Selected</StatusBadge> : null}
              </div>
              <p className="text-xs text-muted-foreground">
                {candidateLeadTypeLabel(item.lead_ref.model)}
                {item.job_no ? ` · job ${item.job_no}` : ""}
              </p>
              <p className="text-sm text-muted-foreground">{BOOKINGS_CONNECT_COPY.contactCycle.line}</p>
              {item.known_contacts?.granot?.differs_from_ingested === true ? (
                <p className="text-sm text-muted-foreground">{BOOKINGS_CONNECT_COPY.contactCycle.changed}</p>
              ) : null}
              <CandidateLeadFacts item={item} className="sm:grid-cols-2" />
            </label>
          </li>
        );
      })}
    </ul>
  );
}
