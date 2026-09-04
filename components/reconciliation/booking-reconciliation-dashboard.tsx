"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchBookingLeadReconciliationCase,
  fetchBookingLeadReconciliationCases,
  evaluateBookingLeadCandidateActionability,
  isStaleBookingLeadReconciliationError,
  refreshBookingLeadCandidates,
  reopenBookingLeadReconciliation,
  resolveBookingLeadReconciliation,
  updatePendingEmployeeBooking,
  type BookingLeadCandidate,
  type BookingLeadModel,
  type BookingLeadReconciliationCaseDetail,
  type BookingLeadReconciliationReason,
  type BookingLeadReconciliationStatus,
  type BookingLeadSourceResolution,
  type UpdatePendingEmployeeBookingBody,
} from "@/lib/api/bookingLeadReconciliation";
import { fetchLeadSourceCompanies, type LeadSourceCompany } from "@/lib/api/sourceCompanies";
import { useCatalogOptions } from "@/lib/api/use-catalog-options";
import { MOVE_SIZE_OPTIONS } from "@/lib/constants/domain";
import { queryKeys } from "@/lib/query/keys";
import { runWithCaseWriteLock } from "@/lib/reconciliation/caseWriteLock";
import {
  buildBookingReconciliationHref,
  nextSelectedBookingReconciliationCaseId,
  readBookingReconciliationCaseId,
} from "@/lib/reconciliation/queueSelection";
import { BookingLeadBrowser } from "@/components/reconciliation/booking-lead-browser";
import {
  ReconciliationLeadContacts,
  reconciliationLeadContactSourceFromSnapshot,
  reconciliationLeadDisplayName,
} from "@/components/reconciliation/reconciliation-lead-contacts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type QueueFilters = {
  status: BookingLeadReconciliationStatus | "";
  origin: "" | "employee_booking" | "external_sheet_ingestion";
  reason: BookingLeadReconciliationReason | "";
  q: string;
  lead_source_company: string;
  source_granularity_key: string;
  from: string;
  to: string;
  limit: string;
};

type PendingBookingForm = {
  source_key: string;
  lead_name: string;
  phone_number: string;
  email: string;
  lid: string;
  job_no: string;
  book_date: string;
  agent: string;
  split_agent: string;
  binder_amount: string;
  deposit_amount: string;
  merchant: string;
  notes: string;
};

type LeadActionDraft = {
  caseId: string;
  action: "attach_existing" | "reassign";
  lead_model: BookingLeadModel;
  lead_id: string;
  label: string;
  warnings: string[];
};

type CreateLeadForm = {
  lead_model: BookingLeadModel;
  notes: string;
  call_name: string;
  call_phone_number: string;
  call_email: string;
  call_job_no: string;
  form_name: string;
  form_phone_number: string;
  form_email: string;
  form_lid: string;
  form_pickup_zip: string;
  form_destination_zip: string;
  form_move_size: string;
  form_move_date: string;
};

const statusOptions: Array<{ value: QueueFilters["status"]; label: string }> = [
  { value: "", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Dismissed" },
];

const reasonOptions: Array<{ value: QueueFilters["reason"]; label: string }> = [
  { value: "", label: "All reasons" },
  { value: "no_match", label: "No match" },
  { value: "multiple_matches", label: "Multiple matches" },
  { value: "identity_conflict", label: "Identity conflict" },
  { value: "source_conflict", label: "Source conflict" },
  { value: "channel_conflict", label: "Channel conflict" },
  { value: "duplicate_lead", label: "Duplicate lead" },
  { value: "lead_already_booked", label: "Lead already booked" },
  { value: "lead_cancelled", label: "Lead cancelled" },
  { value: "matching_unavailable", label: "Matching unavailable" },
];

const sourceResolutionOptions: Array<{ value: BookingLeadSourceResolution | ""; label: string }> = [
  { value: "", label: "No source change" },
  { value: "preserve_lead_source", label: "Preserve lead source" },
  { value: "apply_submission_source", label: "Apply submission source" },
];

const limitOptions = ["25", "50", "100"];

const initialQueueFilters: QueueFilters = {
  status: "pending",
  origin: "",
  reason: "",
  q: "",
  lead_source_company: "",
  source_granularity_key: "",
  from: "",
  to: "",
  limit: "25",
};

const initialCreateLeadForm: CreateLeadForm = {
  lead_model: "CallLead",
  notes: "",
  call_name: "",
  call_phone_number: "",
  call_email: "",
  call_job_no: "",
  form_name: "",
  form_phone_number: "",
  form_email: "",
  form_lid: "",
  form_pickup_zip: "",
  form_destination_zip: "",
  form_move_size: "",
  form_move_date: "",
};

function formatDateTime(value?: string | null): string {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatMoney(value?: number | string | null): string {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) {
    return "-";
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function maskPhone(phone?: string | null): string {
  if (!phone) {
    return "-";
  }
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) {
    return phone;
  }
  return `***-***-${digits.slice(-4)}`;
}

function relativeAge(value?: string | null): string {
  if (!value) {
    return "-";
  }
  const diff = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(diff) || diff < 0) {
    return "-";
  }
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h`;
  }
  return `${Math.floor(hours / 24)}d`;
}

function sourceCompositeValue(
  submission: BookingLeadReconciliationCaseDetail["submission"],
): string {
  return `${submission.source_assignment.lead_source_company}::${submission.source_assignment.source_granularity_key}`;
}

function toPendingBookingForm(detail: BookingLeadReconciliationCaseDetail): PendingBookingForm {
  return {
    source_key: sourceCompositeValue(detail.submission),
    lead_name: detail.submission.lead_name,
    phone_number: detail.submission.phone_number,
    email: detail.submission.email ?? "",
    lid: detail.submission.lid ?? "",
    job_no: detail.submission.job_no,
    book_date: detail.submission.book_date.slice(0, 10),
    agent: detail.submission.agent,
    split_agent: detail.submission.split_agent ?? "",
    binder_amount: String(detail.submission.binder_amount),
    deposit_amount: String(detail.submission.deposit_amount),
    merchant: detail.submission.merchant,
    notes: "",
  };
}

function sourceOptionGroups(companies: LeadSourceCompany[] | undefined) {
  return (companies ?? [])
    .filter((company) => company.active)
    .map((company) => ({
      label: company.owner_label,
      options: company.granularities
        .filter((granularity) => granularity.active)
        .map((granularity) => ({
          value: `${company.id}::${granularity.granularity_key}`,
          label: `${granularity.owner_label} (${granularity.channel === "form" ? "Form" : "Call"})`,
        })),
    }))
    .filter((group) => group.options.length > 0);
}

async function invalidateReconciliationMutations(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.bookingReconciliation.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.lists.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.details.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.search.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.auditLog.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.observability.sheetSync.all }),
  ]);
}

export function BookingReconciliationDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedCaseId = readBookingReconciliationCaseId(searchParams);
  const queryClient = useQueryClient();
  const catalog = useCatalogOptions();
  const sourceCompaniesQuery = useQuery({
    queryKey: queryKeys.sourceCompanies.list(false),
    queryFn: () => fetchLeadSourceCompanies(),
    staleTime: 5 * 60 * 1000,
  });
  const [filters, setFilters] = useState<QueueFilters>(initialQueueFilters);
  const [selectedCaseId, setSelectedCaseId] = useState(requestedCaseId);
  const selectedCaseIdRef = useRef(requestedCaseId);
  const [queueCursor, setQueueCursor] = useState<string | undefined>();
  const [queueCursorHistory, setQueueCursorHistory] = useState<string[]>([]);
  const [queueMessage, setQueueMessage] = useState<string | null>(null);
  const [pendingBookingForm, setPendingBookingForm] = useState<PendingBookingForm | null>(null);
  const [selectedLeadAction, setSelectedLeadAction] = useState<LeadActionDraft | null>(null);
  const [selectedLeadNotes, setSelectedLeadNotes] = useState("");
  const [selectedLeadSourceResolution, setSelectedLeadSourceResolution] =
    useState<BookingLeadSourceResolution | "">("");
  const [acknowledgedWarnings, setAcknowledgedWarnings] = useState<string[]>([]);
  const [dismissNotes, setDismissNotes] = useState("");
  const [reopenNotes, setReopenNotes] = useState("");
  const [createLeadForm, setCreateLeadForm] = useState<CreateLeadForm>(initialCreateLeadForm);
  const pendingWriteCaseIdsRef = useRef(new Set<string>());
  const recoveringCaseIdsRef = useRef(new Set<string>());
  const [pendingWriteCaseIds, setPendingWriteCaseIds] = useState<Set<string>>(new Set());
  const [recoveringCaseIds, setRecoveringCaseIds] = useState<Set<string>>(new Set());

  const updateCaseMembership = useCallback(
    (
      ref: React.MutableRefObject<Set<string>>,
      setter: React.Dispatch<React.SetStateAction<Set<string>>>,
      caseId: string,
      pending: boolean,
    ) => {
      const next = new Set(ref.current);
      if (pending) {
        next.add(caseId);
      } else {
        next.delete(caseId);
      }
      ref.current = next;
      setter(next);
    },
    [],
  );
  const runCaseWrite = useCallback(
    async <Result,>(caseId: string, operation: () => Promise<Result>): Promise<Result> => {
      try {
        return await runWithCaseWriteLock(
          pendingWriteCaseIdsRef.current,
          caseId,
          operation,
          setPendingWriteCaseIds,
        );
      } catch (error) {
        if (isStaleBookingLeadReconciliationError(error)) {
          updateCaseMembership(recoveringCaseIdsRef, setRecoveringCaseIds, caseId, true);
        }
        throw error;
      }
    },
    [updateCaseMembership],
  );

  const queueFilters = useMemo(
    () => ({
      status: filters.status || undefined,
      origin: filters.origin || undefined,
      reason: filters.reason || undefined,
      q: filters.q || undefined,
      lead_source_company: filters.lead_source_company || undefined,
      source_granularity_key: filters.source_granularity_key || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
      limit: Number(filters.limit),
      cursor: queueCursor,
      sort: filters.status === "pending" || !filters.status ? "createdAt" : "updatedAt",
      direction: "asc",
    }),
    [filters, queueCursor],
  );

  const queueQuery = useQuery({
    queryKey: queryKeys.bookingReconciliation.list(queueFilters),
    queryFn: () => fetchBookingLeadReconciliationCases(queueFilters),
  });

  const detailQuery = useQuery({
    queryKey: queryKeys.bookingReconciliation.detail(selectedCaseId),
    queryFn: () => fetchBookingLeadReconciliationCase(selectedCaseId),
    enabled: Boolean(selectedCaseId),
  });

  useEffect(() => {
    if (detailQuery.data) {
      setPendingBookingForm(toPendingBookingForm(detailQuery.data));
      setSelectedLeadAction(null);
      setSelectedLeadNotes("");
      setSelectedLeadSourceResolution("");
      setAcknowledgedWarnings([]);
      setDismissNotes("");
      setReopenNotes("");
      setCreateLeadForm(initialCreateLeadForm);
    }
  }, [detailQuery.data]);

  const clearUnsafeDrafts = useCallback(() => {
    setSelectedLeadAction(null);
    setSelectedLeadNotes("");
    setSelectedLeadSourceResolution("");
    setAcknowledgedWarnings([]);
    setCreateLeadForm(initialCreateLeadForm);
    setPendingBookingForm(null);
  }, []);
  const selectCase = useCallback(
    (caseId: string, options?: { skipUrl?: boolean }) => {
      if (caseId !== selectedCaseIdRef.current) {
        selectedCaseIdRef.current = caseId;
        clearUnsafeDrafts();
        setSelectedCaseId(caseId);
      }
      if (!options?.skipUrl) {
        router.replace(buildBookingReconciliationHref(caseId), { scroll: false });
      }
    },
    [clearUnsafeDrafts, router],
  );

  useEffect(() => {
    const nextId = nextSelectedBookingReconciliationCaseId({
      requestedCaseId,
      selectedCaseId,
      firstQueueId: queueQuery.data?.items[0]?._id ?? "",
    });
    if (nextId && nextId !== selectedCaseId) {
      selectCase(nextId, { skipUrl: Boolean(requestedCaseId) });
    }
  }, [queueQuery.data, requestedCaseId, selectCase, selectedCaseId]);

  const refreshMutation = useMutation({
    mutationFn: ({ caseId, revision }: { caseId: string; revision: number }) =>
      runCaseWrite(caseId, () => refreshBookingLeadCandidates(caseId, revision)),
    onSuccess: async (detail, variables) => {
      queryClient.setQueryData(queryKeys.bookingReconciliation.detail(variables.caseId), detail);
      await invalidateReconciliationMutations(queryClient);
      if (selectedCaseIdRef.current === variables.caseId) {
        setQueueMessage("Candidates refreshed.");
      }
    },
    onError: (error, variables) => {
      void handleMutationError(error, variables.caseId, "Candidate refresh failed.");
    },
  });

  const updateBookingMutation = useMutation({
    mutationFn: ({
      caseId,
      body,
    }: {
      caseId: string;
      body: UpdatePendingEmployeeBookingBody;
    }) => runCaseWrite(caseId, () => updatePendingEmployeeBooking(caseId, body)),
    onSuccess: async (detail, variables) => {
      queryClient.setQueryData(queryKeys.bookingReconciliation.detail(variables.caseId), detail);
      await invalidateReconciliationMutations(queryClient);
      if (selectedCaseIdRef.current === variables.caseId) {
        setQueueMessage("Pending booking updated.");
      }
    },
    onError: (error, variables) => {
      void handleMutationError(error, variables.caseId, "Pending booking update failed.");
    },
  });

  const resolveMutation = useMutation({
    mutationFn: ({
      caseId,
      command,
    }: {
      caseId: string;
      command: Parameters<typeof resolveBookingLeadReconciliation>[1];
    }) => runCaseWrite(caseId, () => resolveBookingLeadReconciliation(caseId, command)),
    onSuccess: async (detail, variables) => {
      queryClient.setQueryData(queryKeys.bookingReconciliation.detail(variables.caseId), detail);
      await invalidateReconciliationMutations(queryClient);
      if (selectedCaseIdRef.current === variables.caseId) {
        clearUnsafeDrafts();
        setQueueMessage("Reconciliation command completed.");
      }
    },
    onError: (error, variables) => {
      void handleMutationError(error, variables.caseId, "Reconciliation command failed.");
    },
  });

  const reopenMutation = useMutation({
    mutationFn: ({
      caseId,
      revision,
      notes,
    }: {
      caseId: string;
      revision: number;
      notes?: string;
    }) => runCaseWrite(caseId, () => reopenBookingLeadReconciliation(caseId, revision, notes)),
    onSuccess: async (detail, variables) => {
      queryClient.setQueryData(queryKeys.bookingReconciliation.detail(variables.caseId), detail);
      await invalidateReconciliationMutations(queryClient);
      if (selectedCaseIdRef.current === variables.caseId) {
        clearUnsafeDrafts();
        setQueueMessage("Case reopened.");
      }
    },
    onError: (error, variables) => {
      void handleMutationError(error, variables.caseId, "Case reopen failed.");
    },
  });

  const detail = detailQuery.data;
  const sourceGroups = sourceOptionGroups(sourceCompaniesQuery.data);
  const pendingCount =
    queueQuery.data?.items.filter((item) => item.status === "pending").length ?? 0;
  const oldestPending = queueQuery.data?.items.find((item) => item.status === "pending");
  const selectedCaseWritePending = detail ? pendingWriteCaseIds.has(detail._id) : false;
  const selectedCaseRecovering = detail ? recoveringCaseIds.has(detail._id) : false;
  const caseActionsDisabled =
    !detail ||
    detail._id !== selectedCaseId ||
    selectedCaseWritePending ||
    selectedCaseRecovering ||
    detailQuery.isFetching;

  function updateQueueFilter<Key extends keyof QueueFilters>(key: Key, value: QueueFilters[Key]) {
    setFilters((current) => ({ ...current, [key]: value }));
    setQueueCursor(undefined);
    setQueueCursorHistory([]);
  }

  async function handleMutationError(error: unknown, caseId: string, fallback: string) {
    if (isStaleBookingLeadReconciliationError(error)) {
      if (selectedCaseIdRef.current === caseId) {
        clearUnsafeDrafts();
        setQueueMessage("This case changed on the server. Reloading the latest version...");
      }
      try {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: queryKeys.bookingReconciliation.detail(caseId),
            exact: true,
            refetchType: "active",
          }),
          queryClient.invalidateQueries({
            queryKey: queryKeys.bookingReconciliation.candidates(caseId),
            refetchType: "active",
          }),
          queryClient.invalidateQueries({
            queryKey: [...queryKeys.bookingReconciliation.all, "list"],
            refetchType: "active",
          }),
        ]);
      } finally {
        updateCaseMembership(recoveringCaseIdsRef, setRecoveringCaseIds, caseId, false);
      }
      if (selectedCaseIdRef.current === caseId) {
        setQueueMessage("This case changed on the server. The latest version is now loaded.");
      }
      return;
    }
    if (selectedCaseIdRef.current === caseId) {
      setQueueMessage(error instanceof Error ? error.message : fallback);
    }
  }

  function selectLeadAction(
    caseId: string,
    action: "attach_existing" | "reassign",
    input: Pick<LeadActionDraft, "lead_model" | "lead_id" | "label" | "warnings">,
  ) {
    setSelectedLeadAction({
      caseId,
      action,
      lead_model: input.lead_model,
      lead_id: input.lead_id,
      label: input.label,
      warnings: input.warnings,
    });
    setSelectedLeadNotes("");
    setSelectedLeadSourceResolution("");
    setAcknowledgedWarnings([]);
  }

  function toggleWarning(warning: string) {
    setAcknowledgedWarnings((current) =>
      current.includes(warning) ? current.filter((item) => item !== warning) : [...current, warning],
    );
  }

  function submitLeadResolution() {
    if (
      !detail ||
      !selectedLeadAction ||
      selectedLeadAction.caseId !== detail._id ||
      selectedLeadAction.caseId !== selectedCaseId ||
      caseActionsDisabled ||
      !["pending", "resolved", "dismissed"].includes(detail.status) ||
      (selectedLeadAction.warnings.includes("source_conflict") &&
        !selectedLeadSourceResolution) ||
      !selectedLeadAction.warnings.every((warning) => acknowledgedWarnings.includes(warning))
    ) {
      return;
    }
    const warningOverrides = selectedLeadAction.warnings.filter((warning) =>
      acknowledgedWarnings.includes(warning),
    );
    resolveMutation.mutate({
      caseId: detail._id,
      command: {
        action: selectedLeadAction.action,
        revision: detail.revision,
        lead_model: selectedLeadAction.lead_model,
        lead_id: selectedLeadAction.lead_id,
        source_resolution: selectedLeadSourceResolution || undefined,
        overridden_warnings: warningOverrides.length > 0 ? warningOverrides : undefined,
        notes: selectedLeadNotes || undefined,
      },
    });
  }

  function submitCreateAndAttach() {
    if (!detail || detail.status !== "pending" || caseActionsDisabled) {
      return;
    }
    if (createLeadForm.lead_model === "CallLead") {
      resolveMutation.mutate({
        caseId: detail._id,
        command: {
          action: "create_and_attach",
          revision: detail.revision,
          lead_model: "CallLead",
          lead_fields: {
            name: createLeadForm.call_name || undefined,
            phone_number: createLeadForm.call_phone_number || undefined,
            email: createLeadForm.call_email || undefined,
            job_no: createLeadForm.call_job_no || undefined,
          },
          notes: createLeadForm.notes || undefined,
        },
      });
      return;
    }

    resolveMutation.mutate({
      caseId: detail._id,
      command: {
        action: "create_and_attach",
        revision: detail.revision,
        lead_model: "FormLead",
        lead_fields: {
          name: createLeadForm.form_name,
          phone_number: createLeadForm.form_phone_number,
          email: createLeadForm.form_email || undefined,
          lid: createLeadForm.form_lid || undefined,
          pickup_zip: createLeadForm.form_pickup_zip,
          destination_zip: createLeadForm.form_destination_zip,
          move_size: createLeadForm.form_move_size,
          move_date: createLeadForm.form_move_date,
        },
        notes: createLeadForm.notes || undefined,
      },
    });
  }

  function submitPendingBookingUpdate() {
    if (
      !detail ||
      detail.status !== "pending" ||
      !pendingBookingForm ||
      caseActionsDisabled
    ) {
      return;
    }

    const [lead_source_company_id, source_granularity_key] = pendingBookingForm.source_key.split("::");
    updateBookingMutation.mutate({
      caseId: detail._id,
      body: {
        revision: detail.revision,
        lead_name: pendingBookingForm.lead_name,
        phone_number: pendingBookingForm.phone_number,
        email: pendingBookingForm.email || undefined,
        lid: pendingBookingForm.lid || undefined,
        job_no: pendingBookingForm.job_no,
        lead_source_company_id,
        source_granularity_key,
        book_date: pendingBookingForm.book_date,
        agent: pendingBookingForm.agent,
        split_agent: pendingBookingForm.split_agent || undefined,
        binder_amount: Number(pendingBookingForm.binder_amount),
        deposit_amount: Number(pendingBookingForm.deposit_amount),
        merchant: pendingBookingForm.merchant,
        notes: pendingBookingForm.notes || undefined,
      },
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Booking Reconciliation</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Owner-only queue for employee bookings that need lead review, correction, or
            attachment.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SummaryStat label="Pending shown" value={String(pendingCount)} />
          <SummaryStat label="Oldest pending" value={relativeAge(oldestPending?.createdAt)} />
          <SummaryStat label="Selected case" value={detail?._id ?? selectedCaseId ?? "-"} />
        </div>
      </div>

      {queueMessage ? <FeedbackMessage>{queueMessage}</FeedbackMessage> : null}

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Queue</CardTitle>
            <CardDescription>
              Search pending, resolved, or dismissed cases. Pending cases default to oldest first.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <Field label="Status" htmlFor="queue-status">
                <select
                  id="queue-status"
                  value={filters.status}
                  onChange={(event) =>
                    updateQueueFilter("status", event.target.value as QueueFilters["status"])
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
                >
                  {statusOptions.map((option) => (
                    <option key={option.label} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Origin" htmlFor="queue-origin">
                <select
                  id="queue-origin"
                  value={filters.origin}
                  onChange={(event) =>
                    updateQueueFilter(
                      "origin",
                      event.target.value as QueueFilters["origin"],
                    )
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
                >
                  <option value="">All origins</option>
                  <option value="employee_booking">Employee booking</option>
                  <option value="external_sheet_ingestion">
                    External sheet ingestion
                  </option>
                </select>
              </Field>
              <Field label="Reason" htmlFor="queue-reason">
                <select
                  id="queue-reason"
                  value={filters.reason}
                  onChange={(event) =>
                    updateQueueFilter("reason", event.target.value as QueueFilters["reason"])
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
                >
                  {reasonOptions.map((option) => (
                    <option key={option.label} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Search" htmlFor="queue-q">
                <Input
                  id="queue-q"
                  value={filters.q}
                  onChange={(event) => updateQueueFilter("q", event.target.value)}
                  placeholder="Job, name, phone, LID, source, booking ID"
                />
              </Field>
              <Field label="Source company" htmlFor="queue-source-company">
                <select
                  id="queue-source-company"
                  value={filters.lead_source_company}
                  onChange={(event) =>
                    updateQueueFilter("lead_source_company", event.target.value)
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
                >
                  <option value="">All source companies</option>
                  {(sourceCompaniesQuery.data ?? []).map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.owner_label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Source granularity" htmlFor="queue-source-granularity">
                <Input
                  id="queue-source-granularity"
                  value={filters.source_granularity_key}
                  onChange={(event) =>
                    updateQueueFilter("source_granularity_key", event.target.value)
                  }
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="From" htmlFor="queue-from">
                  <Input
                    id="queue-from"
                    type="date"
                    value={filters.from}
                    onChange={(event) => updateQueueFilter("from", event.target.value)}
                  />
                </Field>
                <Field label="To" htmlFor="queue-to">
                  <Input
                    id="queue-to"
                    type="date"
                    value={filters.to}
                    onChange={(event) => updateQueueFilter("to", event.target.value)}
                  />
                </Field>
              </div>
              <Field label="Limit" htmlFor="queue-limit">
                <select
                  id="queue-limit"
                  value={filters.limit}
                  onChange={(event) => updateQueueFilter("limit", event.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
                >
                  {limitOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {queueQuery.isLoading ? <FeedbackMessage>Loading reconciliation queue...</FeedbackMessage> : null}
            {queueQuery.isError ? (
              <FeedbackMessage tone="error">
                {queueQuery.error instanceof Error
                  ? queueQuery.error.message
                  : "Unable to load reconciliation queue."}
              </FeedbackMessage>
            ) : null}
            {selectedCaseId &&
            queueQuery.data &&
            !queueQuery.data.items.some((item) => item._id === selectedCaseId) ? (
              <FeedbackMessage>
                This case is open from a direct link. It may not appear in the current queue
                filter.
              </FeedbackMessage>
            ) : null}

            <div className="space-y-2">
              {(queueQuery.data?.items ?? []).map((item) => {
                const active = item._id === selectedCaseId;
                return (
                  <button
                    key={item._id}
                    type="button"
                    onClick={() => selectCase(item._id)}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                      active ? "border-primary bg-primary/5" : "hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">
                          {item.submission.job_no} · {item.submission.lead_name}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {maskPhone(item.submission.phone_number)} ·{" "}
                          {item.submission.source_assignment.source_granularity_label_snapshot}
                        </p>
                      </div>
                      <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-semibold uppercase tracking-wide">
                        {item.status}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>{item.reason}</span>
                      <span>•</span>
                      <span>
                        {item.origin === "external_sheet_ingestion"
                          ? "External sheet"
                          : "Employee booking"}
                      </span>
                      <span>•</span>
                      <span>{formatDateTime(item.createdAt)}</span>
                      <span>•</span>
                      <span>Oldest age {relativeAge(item.createdAt)}</span>
                    </div>
                  </button>
                );
              })}
              {queueQuery.data && queueQuery.data.items.length === 0 ? (
                <FeedbackMessage>No reconciliation cases matched the current filters.</FeedbackMessage>
              ) : null}
            </div>
            <div className="flex items-center justify-between gap-2 border-t pt-3">
              <Button
                type="button"
                variant="outline"
                disabled={queueCursorHistory.length === 0 || queueQuery.isFetching}
                onClick={() => {
                  const previous = queueCursorHistory.at(-1);
                  setQueueCursorHistory((current) => current.slice(0, -1));
                  setQueueCursor(previous || undefined);
                }}
              >
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {queueCursorHistory.length + 1}
              </span>
              <Button
                type="button"
                variant="outline"
                disabled={!queueQuery.data?.next_cursor || queueQuery.isFetching}
                onClick={() => {
                  const nextCursor = queueQuery.data?.next_cursor;
                  if (!nextCursor) {
                    return;
                  }
                  setQueueCursorHistory((current) => [...current, queueCursor ?? ""]);
                  setQueueCursor(nextCursor);
                }}
              >
                Next
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          {!selectedCaseId ? (
            <FeedbackMessage>Select a reconciliation case to review it.</FeedbackMessage>
          ) : null}
          {detailQuery.isLoading ? <FeedbackMessage>Loading case detail...</FeedbackMessage> : null}
          {detailQuery.isError ? (
            <FeedbackMessage tone="error">
              {detailQuery.error instanceof Error
                ? detailQuery.error.message
                : "Unable to load case detail."}
            </FeedbackMessage>
          ) : null}

          {detail ? (
            <>
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <CardTitle className="text-xl">
                        {detail.submission.job_no} · {detail.submission.lead_name}
                      </CardTitle>
                      <CardDescription>
                        Case {detail._id} · Booking{" "}
                        <Link
                          href={`/bookings?record=${encodeURIComponent(detail.booking_id)}`}
                          className="font-medium text-primary underline-offset-4 hover:underline"
                        >
                          {detail.booking_id}
                        </Link>
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {detail.status === "pending" ? (
                        <>
                          <Button
                            variant="outline"
                            onClick={() =>
                              refreshMutation.mutate({
                                caseId: detail._id,
                                revision: detail.revision,
                              })
                            }
                            disabled={caseActionsDisabled}
                          >
                            {selectedCaseWritePending ? "Updating..." : "Refresh candidates"}
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => {
                              if (
                                window.confirm(
                                  "Dismiss this pending reconciliation case? It can be reopened later.",
                                )
                              ) {
                                resolveMutation.mutate({
                                  caseId: detail._id,
                                  command: {
                                    action: "dismiss",
                                    revision: detail.revision,
                                    notes: dismissNotes || undefined,
                                  },
                                });
                              }
                            }}
                            disabled={caseActionsDisabled}
                          >
                            {selectedCaseWritePending ? "Updating..." : "Dismiss"}
                          </Button>
                        </>
                      ) : (
                        <Button
                          onClick={() =>
                            reopenMutation.mutate({
                              caseId: detail._id,
                              revision: detail.revision,
                              notes: reopenNotes || undefined,
                            })
                          }
                          disabled={caseActionsDisabled}
                        >
                          {selectedCaseWritePending ? "Updating..." : "Reopen"}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <SummaryStat label="Status" value={detail.status} />
                    <SummaryStat label="Reason" value={detail.reason} />
                    <SummaryStat
                      label="Lead connection"
                      value={detail.attached_lead?.lead_model ?? detail.booking?.lead_model ?? "Leadless"}
                    />
                    <SummaryStat
                      label="Retry state"
                      value={detail.retry?.next_attempt_at ? formatDateTime(detail.retry.next_attempt_at) : "No retry scheduled"}
                    />
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <Card className="shadow-none">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg">Submission</CardTitle>
                      </CardHeader>
                      <CardContent className="grid gap-2 text-sm">
                        <DetailRow label="Job number" value={detail.submission.job_no} />
                        <DetailRow label="Lead name" value={detail.submission.lead_name} />
                        <DetailRow label="Phone" value={detail.submission.phone_number} />
                        <DetailRow label="Email" value={detail.submission.email ?? "-"} />
                        <DetailRow label="LID" value={detail.submission.lid ?? "-"} />
                        <DetailRow label="Book date" value={formatDateTime(detail.submission.book_date)} />
                        <DetailRow label="Primary agent" value={detail.submission.agent} />
                        <DetailRow label="Secondary agent" value={detail.submission.split_agent ?? "-"} />
                        <DetailRow label="Binder" value={formatMoney(detail.submission.binder_amount)} />
                        <DetailRow label="Deposit" value={formatMoney(detail.submission.deposit_amount)} />
                        <DetailRow label="Merchant" value={detail.submission.merchant} />
                        <DetailRow
                          label="Source"
                          value={`${detail.submission.source_assignment.source_granularity_label_snapshot} (${detail.submission.source_assignment.channel})`}
                        />
                      </CardContent>
                    </Card>

                    <Card className="shadow-none">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg">Booking and Sheet Sync</CardTitle>
                      </CardHeader>
                      <CardContent className="grid gap-2 text-sm">
                        <DetailRow label="Booking ID" value={detail.booking_id} />
                        <DetailRow label="Booking source" value={detail.booking?.source ?? "-"} />
                        <DetailRow
                          label="Attached lead"
                          value={
                            detail.attached_lead
                              ? `${detail.attached_lead.lead_model ?? ""} ${detail.attached_lead.id ?? detail.attached_lead._id ?? ""}`
                              : "-"
                          }
                        />
                        <DetailRow label="Revision" value={String(detail.revision)} />
                        <DetailRow label="Created" value={formatDateTime(detail.createdAt)} />
                        <DetailRow label="Updated" value={formatDateTime(detail.updatedAt)} />
                        {detail.sheet_sync_jobs?.length ? (
                          <div className="space-y-2 pt-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Related sheet sync jobs
                            </p>
                            {detail.sheet_sync_jobs.map((job) => (
                              <Link
                                key={job.id}
                                href={`/observational?tab=sheet-sync&q=${encodeURIComponent(job.id)}`}
                                className="block rounded-md border bg-muted/20 px-3 py-2 text-sm hover:bg-muted/40"
                              >
                                {job.operation ?? "sheet-sync"} · {job.status ?? "unknown"} · {job.id}
                              </Link>
                            ))}
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>

              <BookingLeadBrowser
                key={detail._id}
                caseId={detail._id}
                mode={detail.status === "resolved" ? "reassign" : "attach"}
                disabled={caseActionsDisabled}
                sourceCompanies={sourceCompaniesQuery.data ?? []}
                onSelect={(candidate, overrideableWarnings) =>
                  selectLeadAction(
                    detail._id,
                    detail.status === "resolved" ? "reassign" : "attach_existing",
                    {
                      lead_model: candidate.lead_model,
                      lead_id: candidate._id,
                      label: candidate.name ?? candidate._id,
                      warnings: overrideableWarnings,
                    },
                  )
                }
              />

              {selectedLeadAction && selectedLeadAction.caseId === detail._id ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl">
                      {selectedLeadAction.action === "attach_existing"
                        ? "Attach existing lead"
                        : "Reassign attached lead"}
                    </CardTitle>
                    <CardDescription>{selectedLeadAction.label}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {selectedLeadAction.warnings.length > 0 ? (
                      <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3">
                        <p className="text-sm font-semibold text-amber-900">
                          Acknowledge current warnings before continuing.
                        </p>
                        {selectedLeadAction.warnings.map((warning) => (
                          <label key={warning} className="flex items-start gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={acknowledgedWarnings.includes(warning)}
                              onChange={() => toggleWarning(warning)}
                            />
                            <span>{warning}</span>
                          </label>
                        ))}
                      </div>
                    ) : null}
                    <Field label="Source resolution" htmlFor="lead-source-resolution">
                      <select
                        id="lead-source-resolution"
                        value={selectedLeadSourceResolution}
                        onChange={(event) =>
                          setSelectedLeadSourceResolution(
                            event.target.value as BookingLeadSourceResolution | "",
                          )
                        }
                        className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
                      >
                        {sourceResolutionOptions.map((option) => (
                          <option key={option.label} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Notes" htmlFor="lead-action-notes">
                      <Textarea
                        id="lead-action-notes"
                        value={selectedLeadNotes}
                        onChange={(event) => setSelectedLeadNotes(event.target.value)}
                      />
                    </Field>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={submitLeadResolution}
                        disabled={
                          caseActionsDisabled ||
                          (selectedLeadAction.warnings.includes("source_conflict") &&
                            !selectedLeadSourceResolution) ||
                          !selectedLeadAction.warnings.every((warning) =>
                            acknowledgedWarnings.includes(warning),
                          )
                        }
                      >
                        {selectedCaseWritePending
                          ? "Saving..."
                          : selectedLeadAction.action === "attach_existing"
                            ? "Attach lead"
                            : "Reassign lead"}
                      </Button>
                      <Button variant="outline" onClick={() => setSelectedLeadAction(null)}>
                        Clear selection
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Latest candidates</CardTitle>
                  <CardDescription>
                    These are the last persisted candidates and warnings from the backend evaluator.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {detail.latest_candidates.length === 0 ? (
                    <FeedbackMessage>No candidates were stored for the current case.</FeedbackMessage>
                  ) : null}
                  {detail.latest_candidates.map((candidate) => (
                    <CandidateCard
                      key={`${candidate.lead_model}:${candidate.lead_id}`}
                      candidate={candidate}
                      onAttach={(overrideableWarnings) =>
                        selectLeadAction(
                          detail._id,
                          detail.status === "resolved" ? "reassign" : "attach_existing",
                          {
                            lead_model: candidate.lead_model,
                            lead_id: candidate.lead_id,
                            label: candidate.snapshot.name ?? candidate.lead_id,
                            warnings: overrideableWarnings,
                          },
                        )
                      }
                      mode={detail.status === "resolved" ? "reassign" : "attach"}
                      canAct={
                        ["pending", "resolved", "dismissed"].includes(detail.status) &&
                        !caseActionsDisabled
                      }
                    />
                  ))}
                </CardContent>
              </Card>

              {/*
                The former mutation-based, single-page search and its duplicate
                confirmation card were replaced by BookingLeadBrowser above.
              <Card className={detail.status === "dismissed" ? "hidden" : undefined}>
                <CardHeader>
                  <CardTitle className="text-xl">Lead search</CardTitle>
                  <CardDescription>
                    Search current production leads, then attach or reassign from the result list.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <Field label="Free text" htmlFor="candidate-q">
                      <Input
                        id="candidate-q"
                        value={candidateSearchFilters.q ?? ""}
                        onChange={(event) =>
                          setCandidateSearchFilters((current) => ({
                            ...current,
                            q: event.target.value || undefined,
                          }))
                        }
                      />
                    </Field>
                    <Field label="Lead model" htmlFor="candidate-model">
                      <select
                        id="candidate-model"
                        value={candidateSearchFilters.lead_model ?? ""}
                        onChange={(event) =>
                          setCandidateSearchFilters((current) => ({
                            ...current,
                            lead_model: (event.target.value || undefined) as BookingLeadModel | undefined,
                          }))
                        }
                        className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
                      >
                        <option value="">Any model</option>
                        <option value="FormLead">Form Lead</option>
                        <option value="CallLead">Call Lead</option>
                      </select>
                    </Field>
                    <Field label="Mongo ID" htmlFor="candidate-mongo-id">
                      <Input
                        id="candidate-mongo-id"
                        value={candidateSearchFilters.mongo_id ?? ""}
                        onChange={(event) =>
                          setCandidateSearchFilters((current) => ({
                            ...current,
                            mongo_id: event.target.value || undefined,
                          }))
                        }
                      />
                    </Field>
                    <Field label="LID" htmlFor="candidate-lid">
                      <Input
                        id="candidate-lid"
                        value={candidateSearchFilters.lid ?? ""}
                        onChange={(event) =>
                          setCandidateSearchFilters((current) => ({
                            ...current,
                            lid: event.target.value || undefined,
                          }))
                        }
                      />
                    </Field>
                    <Field label="Job number" htmlFor="candidate-job-no">
                      <Input
                        id="candidate-job-no"
                        value={candidateSearchFilters.job_no ?? ""}
                        onChange={(event) =>
                          setCandidateSearchFilters((current) => ({
                            ...current,
                            job_no: event.target.value || undefined,
                          }))
                        }
                      />
                    </Field>
                    <Field label="Phone" htmlFor="candidate-phone">
                      <Input
                        id="candidate-phone"
                        value={candidateSearchFilters.phone_number ?? ""}
                        onChange={(event) =>
                          setCandidateSearchFilters((current) => ({
                            ...current,
                            phone_number: event.target.value || undefined,
                          }))
                        }
                      />
                    </Field>
                    <Field label="Name" htmlFor="candidate-name">
                      <Input
                        id="candidate-name"
                        value={candidateSearchFilters.name ?? ""}
                        onChange={(event) =>
                          setCandidateSearchFilters((current) => ({
                            ...current,
                            name: event.target.value || undefined,
                          }))
                        }
                      />
                    </Field>
                    <Field label="Email" htmlFor="candidate-email">
                      <Input
                        id="candidate-email"
                        value={candidateSearchFilters.email ?? ""}
                        onChange={(event) =>
                          setCandidateSearchFilters((current) => ({
                            ...current,
                            email: event.target.value || undefined,
                          }))
                        }
                      />
                    </Field>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() =>
                        candidateSearchMutation.mutate({
                          caseId: detail._id,
                          filters: candidateSearchFilters,
                        })
                      }
                      disabled={candidateSearchMutation.isPending || caseActionsDisabled}
                    >
                      {candidateSearchMutation.isPending ? "Searching..." : "Search leads"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setCandidateSearchFilters({ limit: 25 });
                        candidateSearchMutation.reset();
                        setCandidateSearchResult(null);
                      }}
                    >
                      Reset search
                    </Button>
                  </div>
                  {candidateSearchMutation.isError ? (
                    <FeedbackMessage tone="error">
                      {candidateSearchMutation.error instanceof Error
                        ? candidateSearchMutation.error.message
                        : "Candidate search failed."}
                    </FeedbackMessage>
                  ) : null}
                  {searchResults.length > 0 ? (
                    <div className="space-y-3">
                      {searchResults.map((candidate) => (
                        <SearchResultCard
                          key={`${candidate.lead_model}:${candidate._id}`}
                          candidate={candidate}
                          onUse={(overrideableWarnings) =>
                            selectLeadAction(
                              detail._id,
                              detail.status === "resolved" ? "reassign" : "attach_existing",
                              {
                                lead_model: candidate.lead_model,
                                lead_id: candidate._id,
                                label: candidate.name ?? candidate._id,
                                warnings: overrideableWarnings,
                              },
                            )
                          }
                          mode={detail.status === "resolved" ? "reassign" : "attach"}
                          canAct={!caseActionsDisabled}
                        />
                      ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              {selectedLeadAction &&
              selectedLeadAction.caseId === detail._id &&
              detail.status !== "dismissed" ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl">
                      {selectedLeadAction.action === "attach_existing"
                        ? "Attach existing lead"
                        : "Reassign attached lead"}
                    </CardTitle>
                    <CardDescription>{selectedLeadAction.label}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {selectedLeadAction.warnings.length > 0 ? (
                      <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3">
                        <p className="text-sm font-semibold text-amber-900">
                          Acknowledge current warnings before continuing.
                        </p>
                        {selectedLeadAction.warnings.map((warning) => (
                          <label key={warning} className="flex items-start gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={acknowledgedWarnings.includes(warning)}
                              onChange={() => toggleWarning(warning)}
                            />
                            <span>{warning}</span>
                          </label>
                        ))}
                      </div>
                    ) : null}
                    <Field label="Source resolution" htmlFor="lead-source-resolution">
                      <select
                        id="lead-source-resolution"
                        value={selectedLeadSourceResolution}
                        onChange={(event) =>
                          setSelectedLeadSourceResolution(
                            event.target.value as BookingLeadSourceResolution | "",
                          )
                        }
                        className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
                      >
                        {sourceResolutionOptions.map((option) => (
                          <option key={option.label} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Notes" htmlFor="lead-action-notes">
                      <Textarea
                        id="lead-action-notes"
                        value={selectedLeadNotes}
                        onChange={(event) => setSelectedLeadNotes(event.target.value)}
                      />
                    </Field>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={submitLeadResolution}
                        disabled={
                          caseActionsDisabled ||
                          (selectedLeadAction.warnings.includes("source_conflict") &&
                            !selectedLeadSourceResolution) ||
                          !selectedLeadAction.warnings.every((warning) =>
                            acknowledgedWarnings.includes(warning),
                          )
                        }
                      >
                        {selectedCaseWritePending
                          ? "Saving..."
                          : selectedLeadAction.action === "attach_existing"
                            ? "Attach lead"
                            : "Reassign lead"}
                      </Button>
                      <Button variant="outline" onClick={() => setSelectedLeadAction(null)}>
                        Clear selection
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : null}
              */}

              <Card className={detail.status !== "pending" ? "hidden" : undefined}>
                <CardHeader>
                  <CardTitle className="text-xl">Edit pending booking</CardTitle>
                  <CardDescription>
                    Revalidate the submission snapshot and leadless booking without changing the
                    generic booking edit path.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {pendingBookingForm ? (
                    <>
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        <Field label="Source granularity" htmlFor="pending-source">
                          <select
                            id="pending-source"
                            value={pendingBookingForm.source_key}
                            onChange={(event) =>
                              setPendingBookingForm((current) =>
                                current ? { ...current, source_key: event.target.value } : current,
                              )
                            }
                            className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
                          >
                            {sourceGroups.map((group) => (
                              <optgroup key={group.label} label={group.label}>
                                {group.options.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        </Field>
                        <Field label="Lead name" htmlFor="pending-lead-name">
                          <Input
                            id="pending-lead-name"
                            value={pendingBookingForm.lead_name}
                            onChange={(event) =>
                              setPendingBookingForm((current) =>
                                current ? { ...current, lead_name: event.target.value } : current,
                              )
                            }
                          />
                        </Field>
                        <Field label="Phone number" htmlFor="pending-phone">
                          <Input
                            id="pending-phone"
                            value={pendingBookingForm.phone_number}
                            onChange={(event) =>
                              setPendingBookingForm((current) =>
                                current ? { ...current, phone_number: event.target.value } : current,
                              )
                            }
                          />
                        </Field>
                        <Field label="Email" htmlFor="pending-email">
                          <Input
                            id="pending-email"
                            value={pendingBookingForm.email}
                            onChange={(event) =>
                              setPendingBookingForm((current) =>
                                current ? { ...current, email: event.target.value } : current,
                              )
                            }
                          />
                        </Field>
                        <Field label="LID" htmlFor="pending-lid">
                          <Input
                            id="pending-lid"
                            value={pendingBookingForm.lid}
                            onChange={(event) =>
                              setPendingBookingForm((current) =>
                                current ? { ...current, lid: event.target.value } : current,
                              )
                            }
                          />
                        </Field>
                        <Field label="Job number" htmlFor="pending-job-no">
                          <Input
                            id="pending-job-no"
                            value={pendingBookingForm.job_no}
                            onChange={(event) =>
                              setPendingBookingForm((current) =>
                                current ? { ...current, job_no: event.target.value } : current,
                              )
                            }
                          />
                        </Field>
                        <Field label="Book date" htmlFor="pending-book-date">
                          <Input
                            id="pending-book-date"
                            type="date"
                            value={pendingBookingForm.book_date}
                            onChange={(event) =>
                              setPendingBookingForm((current) =>
                                current ? { ...current, book_date: event.target.value } : current,
                              )
                            }
                          />
                        </Field>
                        <Field label="Primary agent" htmlFor="pending-agent">
                          <select
                            id="pending-agent"
                            value={pendingBookingForm.agent}
                            onChange={(event) =>
                              setPendingBookingForm((current) =>
                                current ? { ...current, agent: event.target.value } : current,
                              )
                            }
                            className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
                          >
                            <option value="">Choose agent</option>
                            {catalog.agentOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Secondary agent" htmlFor="pending-split-agent">
                          <select
                            id="pending-split-agent"
                            value={pendingBookingForm.split_agent}
                            onChange={(event) =>
                              setPendingBookingForm((current) =>
                                current ? { ...current, split_agent: event.target.value } : current,
                              )
                            }
                            className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
                          >
                            <option value="">No secondary agent</option>
                            {catalog.agentOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Binder amount" htmlFor="pending-binder">
                          <Input
                            id="pending-binder"
                            type="number"
                            min="0"
                            step="0.01"
                            value={pendingBookingForm.binder_amount}
                            onChange={(event) =>
                              setPendingBookingForm((current) =>
                                current ? { ...current, binder_amount: event.target.value } : current,
                              )
                            }
                          />
                        </Field>
                        <Field label="Deposit amount" htmlFor="pending-deposit">
                          <Input
                            id="pending-deposit"
                            type="number"
                            min="0"
                            step="0.01"
                            value={pendingBookingForm.deposit_amount}
                            onChange={(event) =>
                              setPendingBookingForm((current) =>
                                current ? { ...current, deposit_amount: event.target.value } : current,
                              )
                            }
                          />
                        </Field>
                        <Field label="Merchant" htmlFor="pending-merchant">
                          <select
                            id="pending-merchant"
                            value={pendingBookingForm.merchant}
                            onChange={(event) =>
                              setPendingBookingForm((current) =>
                                current ? { ...current, merchant: event.target.value } : current,
                              )
                            }
                            className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
                          >
                            <option value="">Choose merchant</option>
                            {catalog.merchantOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </Field>
                      </div>
                      <Field label="Notes" htmlFor="pending-notes">
                        <Textarea
                          id="pending-notes"
                          value={pendingBookingForm.notes}
                          onChange={(event) =>
                            setPendingBookingForm((current) =>
                              current ? { ...current, notes: event.target.value } : current,
                            )
                          }
                        />
                      </Field>
                      <Button
                        onClick={submitPendingBookingUpdate}
                        disabled={caseActionsDisabled}
                      >
                        {selectedCaseWritePending ? "Updating..." : "Save pending booking"}
                      </Button>
                    </>
                  ) : null}
                </CardContent>
              </Card>

              <Card className={detail.status !== "pending" ? "hidden" : undefined}>
                <CardHeader>
                  <CardTitle className="text-xl">Create and attach lead</CardTitle>
                  <CardDescription>
                    Create a real production lead and attach it atomically from reconciliation.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Field label="Lead model" htmlFor="create-lead-model">
                    <select
                      id="create-lead-model"
                      value={createLeadForm.lead_model}
                      onChange={(event) =>
                        setCreateLeadForm((current) => ({
                          ...current,
                          lead_model: event.target.value as BookingLeadModel,
                        }))
                      }
                      className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
                    >
                      <option value="CallLead">Call Lead</option>
                      <option value="FormLead">Form Lead</option>
                    </select>
                  </Field>

                  {createLeadForm.lead_model === "CallLead" ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      <Field label="Name" htmlFor="create-call-name">
                        <Input
                          id="create-call-name"
                          value={createLeadForm.call_name}
                          onChange={(event) =>
                            setCreateLeadForm((current) => ({
                              ...current,
                              call_name: event.target.value,
                            }))
                          }
                        />
                      </Field>
                      <Field label="Phone number" htmlFor="create-call-phone">
                        <Input
                          id="create-call-phone"
                          value={createLeadForm.call_phone_number}
                          onChange={(event) =>
                            setCreateLeadForm((current) => ({
                              ...current,
                              call_phone_number: event.target.value,
                            }))
                          }
                        />
                      </Field>
                      <Field label="Email" htmlFor="create-call-email">
                        <Input
                          id="create-call-email"
                          value={createLeadForm.call_email}
                          onChange={(event) =>
                            setCreateLeadForm((current) => ({
                              ...current,
                              call_email: event.target.value,
                            }))
                          }
                        />
                      </Field>
                      <Field label="Job number" htmlFor="create-call-job">
                        <Input
                          id="create-call-job"
                          value={createLeadForm.call_job_no}
                          onChange={(event) =>
                            setCreateLeadForm((current) => ({
                              ...current,
                              call_job_no: event.target.value,
                            }))
                          }
                        />
                      </Field>
                    </div>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      <Field label="Name" htmlFor="create-form-name">
                        <Input
                          id="create-form-name"
                          value={createLeadForm.form_name}
                          onChange={(event) =>
                            setCreateLeadForm((current) => ({
                              ...current,
                              form_name: event.target.value,
                            }))
                          }
                        />
                      </Field>
                      <Field label="Phone number" htmlFor="create-form-phone">
                        <Input
                          id="create-form-phone"
                          value={createLeadForm.form_phone_number}
                          onChange={(event) =>
                            setCreateLeadForm((current) => ({
                              ...current,
                              form_phone_number: event.target.value,
                            }))
                          }
                        />
                      </Field>
                      <Field label="Email" htmlFor="create-form-email">
                        <Input
                          id="create-form-email"
                          value={createLeadForm.form_email}
                          onChange={(event) =>
                            setCreateLeadForm((current) => ({
                              ...current,
                              form_email: event.target.value,
                            }))
                          }
                        />
                      </Field>
                      <Field label="LID" htmlFor="create-form-lid">
                        <Input
                          id="create-form-lid"
                          value={createLeadForm.form_lid}
                          onChange={(event) =>
                            setCreateLeadForm((current) => ({
                              ...current,
                              form_lid: event.target.value,
                            }))
                          }
                        />
                      </Field>
                      <Field label="Pickup ZIP" htmlFor="create-form-pickup-zip">
                        <Input
                          id="create-form-pickup-zip"
                          value={createLeadForm.form_pickup_zip}
                          onChange={(event) =>
                            setCreateLeadForm((current) => ({
                              ...current,
                              form_pickup_zip: event.target.value,
                            }))
                          }
                        />
                      </Field>
                      <Field label="Destination ZIP" htmlFor="create-form-destination-zip">
                        <Input
                          id="create-form-destination-zip"
                          value={createLeadForm.form_destination_zip}
                          onChange={(event) =>
                            setCreateLeadForm((current) => ({
                              ...current,
                              form_destination_zip: event.target.value,
                            }))
                          }
                        />
                      </Field>
                      <Field label="Move size" htmlFor="create-form-move-size">
                        <select
                          id="create-form-move-size"
                          value={createLeadForm.form_move_size}
                          onChange={(event) =>
                            setCreateLeadForm((current) => ({
                              ...current,
                              form_move_size: event.target.value,
                            }))
                          }
                          className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
                        >
                          <option value="">Choose move size</option>
                          {MOVE_SIZE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Move date" htmlFor="create-form-move-date">
                        <Input
                          id="create-form-move-date"
                          type="date"
                          value={createLeadForm.form_move_date}
                          onChange={(event) =>
                            setCreateLeadForm((current) => ({
                              ...current,
                              form_move_date: event.target.value,
                            }))
                          }
                        />
                      </Field>
                    </div>
                  )}

                  <Field label="Notes" htmlFor="create-lead-notes">
                    <Textarea
                      id="create-lead-notes"
                      value={createLeadForm.notes}
                      onChange={(event) =>
                        setCreateLeadForm((current) => ({
                          ...current,
                          notes: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Button onClick={submitCreateAndAttach} disabled={caseActionsDisabled}>
                    {selectedCaseWritePending ? "Updating..." : "Create and attach"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Case history</CardTitle>
                  <CardDescription>Match attempts and resolution history are append-only.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-5 xl:grid-cols-2">
                  <div className="space-y-3">
                    <p className="text-sm font-semibold">Match attempts</p>
                    {detail.match_attempts.length === 0 ? (
                      <FeedbackMessage>No match attempts were stored.</FeedbackMessage>
                    ) : null}
                    {detail.match_attempts.map((attempt, index) => (
                      <div key={`${attempt.attempted_at}-${index}`} className="rounded-md border p-3 text-sm">
                        <p className="font-semibold">
                          {attempt.trigger} · {attempt.outcome}
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          {attempt.reason} · {attempt.candidate_count} candidates
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDateTime(attempt.attempted_at)} · {attempt.auto_match_policy_version}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm font-semibold">Resolution history</p>
                    {detail.resolution_history.length === 0 ? (
                      <FeedbackMessage>No resolution history yet.</FeedbackMessage>
                    ) : null}
                    {detail.resolution_history.map((entry, index) => (
                      <div key={`${entry.occurred_at}-${index}`} className="rounded-md border p-3 text-sm">
                        <p className="font-semibold">
                          {entry.action} · {entry.actor}
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          {entry.lead_model ?? "no lead"} {entry.lead_id ?? ""}{" "}
                          {entry.source_resolution ? `· ${entry.source_resolution}` : ""}
                        </p>
                        {entry.notes ? <p className="mt-2 whitespace-pre-wrap">{entry.notes}</p> : null}
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDateTime(entry.occurred_at)}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Dismiss and reopen notes</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 xl:grid-cols-2">
                  <Field label="Dismiss notes" htmlFor="dismiss-notes">
                    <Textarea
                      id="dismiss-notes"
                      value={dismissNotes}
                      onChange={(event) => setDismissNotes(event.target.value)}
                    />
                  </Field>
                  <Field label="Reopen notes" htmlFor="reopen-notes">
                    <Textarea
                      id="reopen-notes"
                      value={reopenNotes}
                      onChange={(event) => setReopenNotes(event.target.value)}
                    />
                  </Field>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b pb-2 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function CandidateCard({
  candidate,
  onAttach,
  mode,
  canAct,
}: {
  candidate: BookingLeadCandidate;
  onAttach: (overrideableWarnings: string[]) => void;
  mode: "attach" | "reassign";
  canAct: boolean;
}) {
  const actionability = evaluateBookingLeadCandidateActionability(candidate);
  const actionDisabled = !canAct || !actionability.canAct;

  return (
    <div className="rounded-md border p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1 text-sm">
          <p className="font-semibold">
            {candidate.lead_model} ·{" "}
            {reconciliationLeadDisplayName(
              reconciliationLeadContactSourceFromSnapshot(candidate.lead_model, candidate.snapshot),
              candidate.lead_id,
            )}
          </p>
          <ReconciliationLeadContacts
            source={reconciliationLeadContactSourceFromSnapshot(
              candidate.lead_model,
              candidate.snapshot,
            )}
          />
          <p className="text-muted-foreground">
            Confidence {candidate.confidence} · {candidate.source_compatibility} · {candidate.eligibility}
          </p>
          <p className="text-xs text-muted-foreground">
            Match methods: {candidate.match_methods.join(", ") || "none"}
          </p>
          {candidate.warnings.length > 0 ? (
            <ul className="list-disc pl-5 text-xs text-amber-800">
              {candidate.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
          {actionability.hardBlockReasons.length > 0 ? (
            <p className="text-xs font-semibold text-destructive">
              Cannot attach: {actionability.hardBlockReasons.join(", ")}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/${candidate.lead_model === "FormLead" ? "form-leads" : "call-leads"}?record=${encodeURIComponent(candidate.lead_id)}`}
            className="inline-flex h-10 items-center justify-center rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            View lead
          </Link>
          <Button
            onClick={() => onAttach(actionability.overrideableWarnings)}
            disabled={actionDisabled}
          >
            {mode === "attach" ? "Attach" : "Reassign"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/*
function SearchResultCard({
  candidate,
  onUse,
  mode,
  canAct,
}: {
  candidate: BookingLeadCandidateSearchResult;
  onUse: (overrideableWarnings: string[]) => void;
  mode: "attach" | "reassign";
  canAct: boolean;
}) {
  const actionability = evaluateBookingLeadCandidateActionability(candidate);

  return (
    <div className="rounded-md border p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1 text-sm">
          <p className="font-semibold">
            {candidate.lead_model} · {candidate.name ?? candidate._id}
          </p>
          <p className="text-muted-foreground">
            {candidate.phone_number ?? "-"} · {candidate.email ?? "-"}
          </p>
          <p className="text-muted-foreground">
            Job {candidate.job_no ?? "-"} · LID {candidate.lid ?? "-"}
          </p>
          <p className="text-xs text-muted-foreground">
            {candidate.source_company ?? "-"} / {candidate.source_granularity_key ?? "-"}
          </p>
          {(candidate.warnings ?? []).length > 0 ? (
            <ul className="list-disc pl-5 text-xs text-amber-800">
              {(candidate.warnings ?? []).map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
          {actionability.hardBlockReasons.length > 0 ? (
            <p className="text-xs font-semibold text-destructive">
              Cannot attach: {actionability.hardBlockReasons.join(", ")}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/${candidate.lead_model === "FormLead" ? "form-leads" : "call-leads"}?record=${encodeURIComponent(candidate._id)}`}
            className="inline-flex h-10 items-center justify-center rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            View lead
          </Link>
          <Button
            onClick={() => onUse(actionability.overrideableWarnings)}
            disabled={!canAct || !actionability.canAct}
          >
            {mode === "attach" ? "Use for attach" : "Use for reassign"}
          </Button>
        </div>
      </div>
    </div>
  );
}
*/
