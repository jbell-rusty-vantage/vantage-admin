"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { canConnectBookingToLead } from "@/components/bookings/booking-stored-lead";
import { FilterField } from "@/components/filters/filter-field";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fetchAdminDetail, fetchAdminList, getRecordId, type AdminRecord } from "@/lib/api/admin";
import { connectBookingToLead } from "@/lib/api/granotLifecycle";
import { fetchLeadSourceCompanies } from "@/lib/api/sourceCompanies";
import { queryKeys } from "@/lib/query/keys";
import { invalidateGranotLifecycleCommandViews } from "@/lib/query/granotLifecycle";
import { cn } from "@/lib/utils";
import { MANUAL_COPY } from "./manual-copy";
import {
  allSourceChoices,
  bookingJobExplainFilters,
  bookingJobSearchFilters,
  bookingRecordHref,
  createdLeadRecordHref,
  findSourceChoice,
  hasLeadSearchCriteria,
  leadSearchFilters,
  leadSearchResources,
  sanitizeLeadSearchDraft,
  emptyManualLeadSearchDraft,
  type ManualLeadKind,
  type ManualLeadSearchDraft,
} from "./manual-create-lead";

const SELECT_CLASS = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

type SelectedLead = {
  id: string;
  kind: ManualLeadKind;
  record: AdminRecord;
};

function textField(record: AdminRecord, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

function bookingLabel(record: AdminRecord): string {
  const job = textField(record, "job_no") || "No job number";
  const name = textField(record, "customer_name") || customerFullName(record) || "No customer name";
  return `${job} · ${name}`;
}

function customerFullName(record: AdminRecord): string {
  const customer = record.customer;
  if (!customer || typeof customer !== "object") return "";
  const name = (customer as { full_name?: unknown }).full_name;
  return typeof name === "string" ? name.trim() : "";
}

function leadName(record: AdminRecord): string {
  const name = textField(record, "name");
  if (name) return name;
  return [textField(record, "first_name"), textField(record, "last_name")].filter(Boolean).join(" ") || "No name";
}

function leadSourceLabel(record: AdminRecord): string {
  return (
    textField(record, "source_granularity_label_snapshot") ||
    textField(record, "source_company_label_snapshot") ||
    textField(record, "source_company")
  );
}

function leadFacts(record: AdminRecord, kind: ManualLeadKind): string {
  return [
    kind === "CallLead" ? MANUAL_COPY.callLead : MANUAL_COPY.formLead,
    leadSourceLabel(record),
    textField(record, "phone_number"),
    textField(record, "email"),
    kind === "CallLead" ? textField(record, "job_no") : textField(record, "ref_no"),
  ]
    .filter(Boolean)
    .join(" · ");
}

export function ConnectBookingSection() {
  const queryClient = useQueryClient();
  const [jobDraft, setJobDraft] = useState("");
  const [appliedJob, setAppliedJob] = useState("");
  const [leadDraft, setLeadDraft] = useState<ManualLeadSearchDraft>(emptyManualLeadSearchDraft());
  const [appliedLead, setAppliedLead] = useState<ManualLeadSearchDraft | null>(null);
  const [selectedBookingId, setSelectedBookingId] = useState<string>();
  const [selectedLead, setSelectedLead] = useState<SelectedLead>();
  const [overrideReason, setOverrideReason] = useState("");
  const [notice, setNotice] = useState<string>();

  const sourceCompaniesQuery = useQuery({
    queryKey: queryKeys.sourceCompanies.list(false),
    queryFn: () => fetchLeadSourceCompanies(),
    staleTime: 5 * 60 * 1000,
  });
  const sourceChoices = useMemo(
    () => allSourceChoices(sourceCompaniesQuery.data),
    [sourceCompaniesQuery.data],
  );
  const selectedSourceChoice = findSourceChoice(sourceChoices, leadDraft.source_granularity_key);

  const bookingFilters = bookingJobSearchFilters(appliedJob);
  const bookingList = useQuery({
    queryKey: queryKeys.lists.resource("booked-leads", bookingFilters),
    queryFn: () => fetchAdminList<AdminRecord>("booked-leads", bookingFilters),
    enabled: Boolean(appliedJob),
  });
  const explainFilters = bookingJobExplainFilters(appliedJob);
  const connectableBookings = (bookingList.data?.items ?? []).filter((record) =>
    canConnectBookingToLead(record),
  );
  const bookingExplain = useQuery({
    queryKey: queryKeys.lists.resource("booked-leads", explainFilters),
    queryFn: () => fetchAdminList<AdminRecord>("booked-leads", explainFilters),
    enabled:
      Boolean(appliedJob) &&
      bookingList.isSuccess &&
      !bookingList.isFetching &&
      connectableBookings.length === 0,
  });

  const selectedBookingDetail = useQuery({
    queryKey: queryKeys.details.resource("booked-leads", selectedBookingId ?? "", "production"),
    queryFn: () => fetchAdminDetail<AdminRecord>("booked-leads", selectedBookingId!, "production"),
    enabled: Boolean(selectedBookingId),
  });

  const appliedLeadChannel = appliedLead
    ? findSourceChoice(sourceChoices, appliedLead.source_granularity_key)?.channel
    : undefined;
  const leadResources = appliedLead ? leadSearchResources(appliedLead, appliedLeadChannel) : [];
  const formLeadFilters = appliedLead ? leadSearchFilters(appliedLead, "form-leads") : null;
  const callLeadFilters = appliedLead ? leadSearchFilters(appliedLead, "call-leads") : null;
  const formLeadList = useQuery({
    queryKey: queryKeys.lists.resource("form-leads", formLeadFilters ?? {}),
    queryFn: () => fetchAdminList<AdminRecord>("form-leads", formLeadFilters!),
    enabled: Boolean(formLeadFilters) && leadResources.includes("form-leads"),
  });
  const callLeadList = useQuery({
    queryKey: queryKeys.lists.resource("call-leads", callLeadFilters ?? {}),
    queryFn: () => fetchAdminList<AdminRecord>("call-leads", callLeadFilters!),
    enabled: Boolean(callLeadFilters) && leadResources.includes("call-leads"),
  });

  const leadResults = useMemo(() => {
    const rows: SelectedLead[] = [];
    if (leadResources.includes("form-leads")) {
      for (const record of formLeadList.data?.items ?? []) {
        const id = getRecordId(record);
        if (id) rows.push({ id, kind: "FormLead", record });
      }
    }
    if (leadResources.includes("call-leads")) {
      for (const record of callLeadList.data?.items ?? []) {
        const id = getRecordId(record);
        if (id) rows.push({ id, kind: "CallLead", record });
      }
    }
    return rows;
  }, [callLeadList.data?.items, formLeadList.data?.items, leadResources]);

  const selectedBooking = selectedBookingDetail.data;
  const canConnectSelectedBooking = selectedBooking ? canConnectBookingToLead(selectedBooking) : false;
  const bookingsFoundElsewhere = (bookingExplain.data?.items ?? []).length > 0;

  const connect = useMutation({
    mutationFn: () => {
      if (!selectedBookingId || !selectedBooking || !selectedLead) {
        throw new Error(MANUAL_COPY.needBoth);
      }
      return connectBookingToLead(
        selectedBookingId,
        {
          expected_booking_revision: Number(selectedBooking.domain_revision ?? 0),
          selected_lead: { lead_model: selectedLead.kind, lead_id: selectedLead.id },
          ...(overrideReason.trim() ? { out_of_scope_override_reason: overrideReason.trim() } : {}),
        },
        crypto.randomUUID(),
      );
    },
    async onSuccess(result) {
      const ownerNotice = result.owner_notice ?? MANUAL_COPY.connectSuccess;
      setNotice(ownerNotice);
      await Promise.all([
        invalidateGranotLifecycleCommandViews(queryClient, {
          bookingId: selectedBookingId,
          jobNo: selectedBooking && typeof selectedBooking.job_no === "string" ? selectedBooking.job_no : undefined,
          lead: selectedLead ? { model: selectedLead.kind, id: selectedLead.id } : undefined,
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.details.resource("booked-leads", selectedBookingId ?? "") }),
        queryClient.invalidateQueries({ queryKey: queryKeys.lists.resource("booked-leads") }),
        queryClient.invalidateQueries({ queryKey: queryKeys.lists.resource("form-leads") }),
        queryClient.invalidateQueries({ queryKey: queryKeys.lists.resource("call-leads") }),
      ]);
      setSelectedBookingId(undefined);
      setSelectedLead(undefined);
      setOverrideReason("");
    },
  });

  function patchLeadDraft(next: Partial<ManualLeadSearchDraft>) {
    setLeadDraft((current) => ({ ...current, ...next }));
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">{MANUAL_COPY.connectTitle}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{MANUAL_COPY.connectHint}</p>
      </div>
      {notice ? <FeedbackMessage tone="success">{notice}</FeedbackMessage> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4 rounded-md border p-4">
          <h3 className="text-sm font-semibold text-navy">{MANUAL_COPY.findBookingTitle}</h3>
          <form
            className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              setNotice(undefined);
              setAppliedJob(jobDraft.trim());
            }}
          >
            <FilterField label={MANUAL_COPY.searchJobNumber}>
              <Input
                value={jobDraft}
                onChange={(event) => setJobDraft(event.target.value)}
                placeholder={MANUAL_COPY.searchJobNumberPlaceholder}
              />
            </FilterField>
            <Button className="self-end" type="submit">
              {MANUAL_COPY.searchBookingsAction}
            </Button>
          </form>
          {bookingList.isFetching ? (
            <p role="status" className="text-sm text-muted-foreground">
              {MANUAL_COPY.findingBookings}
            </p>
          ) : null}
          {bookingList.isError ? (
            <FeedbackMessage tone="error">
              {bookingList.error instanceof Error ? bookingList.error.message : "Unable to find bookings."}
            </FeedbackMessage>
          ) : null}
          {!appliedJob ? (
            <p className="text-sm text-muted-foreground">{MANUAL_COPY.enterJobNumber}</p>
          ) : null}
          {appliedJob && !bookingList.isFetching && connectableBookings.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {bookingsFoundElsewhere ? MANUAL_COPY.bookingNotConnectable : MANUAL_COPY.noBookingMatch}
            </p>
          ) : null}
          {connectableBookings.length > 0 ? (
            <ul className="space-y-2" aria-label={MANUAL_COPY.findBookingTitle}>
              {connectableBookings.map((record) => {
                const id = getRecordId(record);
                const selected = id === selectedBookingId;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBookingId(id);
                        setNotice(undefined);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-md border p-3 text-left text-sm",
                        selected && "border-trust-blue bg-trust-blue/5 ring-1 ring-trust-blue",
                      )}
                    >
                      <span className="text-navy">{bookingLabel(record)}</span>
                      <span className="shrink-0 font-medium text-trust-blue">
                        {selected ? MANUAL_COPY.selectedBooking : MANUAL_COPY.chooseBooking}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
          {selectedBookingId && selectedBooking ? (
            <p className="text-sm">
              <span className="font-medium text-navy">{bookingLabel(selectedBooking)}</span>
              {" · "}
              <Link className="underline" href={bookingRecordHref(selectedBookingId)}>
                {MANUAL_COPY.viewBooking}
              </Link>
            </p>
          ) : null}
        </div>

        <div className="space-y-4 rounded-md border p-4">
          <h3 className="text-sm font-semibold text-navy">{MANUAL_COPY.findLeadTitle}</h3>
          {sourceCompaniesQuery.isError ? (
            <FeedbackMessage tone="error">{MANUAL_COPY.sourceCatalogError}</FeedbackMessage>
          ) : null}
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              setNotice(undefined);
              const next = sanitizeLeadSearchDraft(leadDraft, selectedSourceChoice?.channel);
              if (!hasLeadSearchCriteria(next)) return;
              setLeadDraft(next);
              setAppliedLead(next);
            }}
          >
            <FilterField label={MANUAL_COPY.sourceCompany} className="sm:col-span-2">
              <select
                value={leadDraft.source_granularity_key}
                onChange={(event) => {
                  const choice = findSourceChoice(sourceChoices, event.target.value);
                  patchLeadDraft(
                    sanitizeLeadSearchDraft(
                      { ...leadDraft, source_granularity_key: event.target.value },
                      choice?.channel,
                    ),
                  );
                }}
                className={SELECT_CLASS}
              >
                <option value="">{MANUAL_COPY.sourceCompanyPlaceholder}</option>
                {sourceChoices.map((option) => (
                  <option key={option.source_granularity_key} value={option.source_granularity_key}>
                    {option.owner_label}
                  </option>
                ))}
              </select>
            </FilterField>
            <FilterField label={MANUAL_COPY.phone}>
              <Input
                type="tel"
                value={leadDraft.phone_number}
                onChange={(event) => patchLeadDraft({ phone_number: event.target.value })}
              />
            </FilterField>
            <FilterField label={MANUAL_COPY.name}>
              <Input value={leadDraft.name} onChange={(event) => patchLeadDraft({ name: event.target.value })} />
            </FilterField>
            <FilterField label={MANUAL_COPY.email}>
              <Input
                type="email"
                value={leadDraft.email}
                onChange={(event) => patchLeadDraft({ email: event.target.value })}
              />
            </FilterField>
            <FilterField label={MANUAL_COPY.refNumber}>
              <Input
                value={leadDraft.ref_no}
                onChange={(event) => patchLeadDraft({ ref_no: event.target.value })}
                disabled={selectedSourceChoice?.channel === "call"}
              />
            </FilterField>
            <FilterField label={MANUAL_COPY.jobNumber}>
              <Input
                value={leadDraft.job_no}
                onChange={(event) => patchLeadDraft({ job_no: event.target.value })}
                disabled={selectedSourceChoice?.channel === "form"}
              />
            </FilterField>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={!hasLeadSearchCriteria(leadDraft)}>
                {MANUAL_COPY.searchLeadsAction}
              </Button>
            </div>
          </form>
          {formLeadList.isFetching || callLeadList.isFetching ? (
            <p role="status" className="text-sm text-muted-foreground">
              {MANUAL_COPY.findingLeads}
            </p>
          ) : null}
          {formLeadList.isError || callLeadList.isError ? (
            <FeedbackMessage tone="error">
              {(formLeadList.error instanceof Error && formLeadList.error.message) ||
                (callLeadList.error instanceof Error && callLeadList.error.message) ||
                "Unable to find leads."}
            </FeedbackMessage>
          ) : null}
          {!appliedLead ? (
            <p className="text-sm text-muted-foreground">{MANUAL_COPY.enterLeadSearch}</p>
          ) : null}
          {appliedLead && !formLeadList.isFetching && !callLeadList.isFetching && leadResults.length === 0 ? (
            <p className="text-sm text-muted-foreground">{MANUAL_COPY.noLeadMatch}</p>
          ) : null}
          {leadResults.length > 0 ? (
            <ul className="space-y-2" aria-label={MANUAL_COPY.findLeadTitle}>
              {leadResults.map((item) => {
                const selected = selectedLead?.id === item.id && selectedLead.kind === item.kind;
                return (
                  <li key={`${item.kind}:${item.id}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedLead(item);
                        setNotice(undefined);
                      }}
                      className={cn(
                        "flex w-full flex-col gap-1 rounded-md border p-3 text-left",
                        selected && "border-trust-blue bg-trust-blue/5 ring-1 ring-trust-blue",
                      )}
                    >
                      <span className="flex items-center justify-between gap-2 text-sm font-medium text-navy">
                        {leadName(item.record)}
                        <span className="shrink-0 font-medium text-trust-blue">
                          {selected ? MANUAL_COPY.selectedLead : MANUAL_COPY.chooseLead}
                        </span>
                      </span>
                      <span className="text-xs text-muted-foreground">{leadFacts(item.record, item.kind)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
          {selectedLead ? (
            <p className="text-sm">
              <span className="font-medium text-navy">{leadName(selectedLead.record)}</span>
              {" · "}
              <Link className="underline" href={createdLeadRecordHref(selectedLead.kind, selectedLead.id)}>
                {MANUAL_COPY.viewLead}
              </Link>
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-3 rounded-md border p-4">
        <p className="font-semibold text-navy">{MANUAL_COPY.reviewTitle}</p>
        {!selectedBookingId || !selectedLead ? (
          <p className="text-sm text-muted-foreground">{MANUAL_COPY.needBoth}</p>
        ) : selectedBookingDetail.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading booking…</p>
        ) : !canConnectSelectedBooking ? (
          <FeedbackMessage tone="warning">{MANUAL_COPY.bookingNotConnectable}</FeedbackMessage>
        ) : (
          <>
            <p className="text-sm">
              {bookingLabel(selectedBooking!)}
              {" → "}
              {leadName(selectedLead.record)}
              {leadSourceLabel(selectedLead.record) ? ` · ${leadSourceLabel(selectedLead.record)}` : ""}
            </p>
            <div className="space-y-1">
              <Label htmlFor="manual-connect-override">{MANUAL_COPY.overrideLabel}</Label>
              <Textarea
                id="manual-connect-override"
                minLength={10}
                maxLength={500}
                value={overrideReason}
                onChange={(event) => setOverrideReason(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">{MANUAL_COPY.overrideHint}</p>
            </div>
            <Button type="button" disabled={connect.isPending} onClick={() => connect.mutate()}>
              {connect.isPending ? MANUAL_COPY.connecting : MANUAL_COPY.connectLead}
            </Button>
          </>
        )}
        {connect.isError ? (
          <FeedbackMessage tone="error">
            {connect.error instanceof Error ? connect.error.message : "Unable to connect this lead."}
          </FeedbackMessage>
        ) : null}
      </div>
    </section>
  );
}
