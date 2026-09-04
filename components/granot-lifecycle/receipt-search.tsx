"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackMessage } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/components/data-table/formatters";
import { StatusBadge } from "@/components/data-table/status-badge";
import { SidePanel } from "@/components/ui/side-panel";
import { serializeFilters } from "@/lib/api/filters";
import {
  fetchGranotWebhookReceipts,
  GRANOT_WEBHOOK_BOOKING_ACTIONS,
  GRANOT_WEBHOOK_ROUTE_EVENT_CLASSES,
  type GranotWebhookBookingAction,
  type GranotWebhookReceiptListFilters,
  type GranotWebhookReceiptListItem,
  type GranotWebhookReceiptListPage,
  type GranotWebhookRouteEventClass,
} from "@/lib/api/granotLifecycle";
import { fetchLeadSourceCompanies, type LeadSourceCompany } from "@/lib/api/sourceCompanies";
import { applyUrlStateUpdate } from "@/lib/api/url-state-update";
import { buildJobTimelineHref } from "@/lib/api/jobNumberTimeline";
import { queryKeys } from "@/lib/query/keys";
import { GRANOT_LIFECYCLE_COPY } from "./granot-lifecycle-copy";
import { prettyJson } from "./pretty-json";

export const GRANOT_WEBHOOK_RECEIPT_FILTER_KEYS = [
  "ref_no",
  "job_no",
  "name",
  "phone",
  "email",
  "source_company_id",
  "route_event_class",
  "booking_action",
  "captured_from",
  "captured_to",
  "processing_state",
  "cursor",
  "limit",
] as const;

export const GRANOT_WEBHOOK_RECEIPT_PANEL_KEY = "receipt";

const PROCESSING_STATES = [
  "pending",
  "claimed",
  "retry_scheduled",
  "completed",
  "dead_letter",
] as const;

type ReceiptFilterDraft = {
  ref_no: string;
  job_no: string;
  name: string;
  phone: string;
  email: string;
  source_company_id: string;
  route_event_class: string;
  booking_action: string;
  captured_from: string;
  captured_to: string;
  processing_state: string;
  limit: string;
};

export function shouldShowBookingActionFilter(routeEventClass?: string): boolean {
  return !routeEventClass || routeEventClass === "booking_status_changed";
}

export function labelForRouteEventClass(value: GranotWebhookRouteEventClass): string {
  if (value === "lead_created") return GRANOT_LIFECYCLE_COPY.eventTypeLeadCreated;
  if (value === "priority_updated") return GRANOT_LIFECYCLE_COPY.eventTypePriorityUpdated;
  return GRANOT_LIFECYCLE_COPY.eventTypeBookingStatusChanged;
}

export function labelForBookingAction(value: GranotWebhookBookingAction): string {
  return value === "booked"
    ? GRANOT_LIFECYCLE_COPY.bookingActionBooked
    : GRANOT_LIFECYCLE_COPY.bookingActionRelease;
}

export function labelForProcessingState(value: string): string {
  if (value === "pending") return GRANOT_LIFECYCLE_COPY.processingStatePending;
  if (value === "claimed") return GRANOT_LIFECYCLE_COPY.processingStateClaimed;
  if (value === "retry_scheduled") return GRANOT_LIFECYCLE_COPY.processingStateRetryScheduled;
  if (value === "completed") return GRANOT_LIFECYCLE_COPY.processingStateCompleted;
  if (value === "dead_letter") return GRANOT_LIFECYCLE_COPY.processingStateDeadLetter;
  return value.replaceAll("_", " ");
}

export function parseGranotWebhookReceiptUrlFilters(
  params: URLSearchParams,
): GranotWebhookReceiptListFilters {
  const routeEventClass = params.get("route_event_class");
  const bookingAction = params.get("booking_action");
  const processingState = params.get("processing_state");
  const limit = Number(params.get("limit"));
  const parsed: GranotWebhookReceiptListFilters = {
    ref_no: params.get("ref_no") || undefined,
    job_no: params.get("job_no") || undefined,
    name: params.get("name") || undefined,
    phone: params.get("phone") || undefined,
    email: params.get("email") || undefined,
    source_company_id: params.get("source_company_id") || undefined,
    route_event_class: GRANOT_WEBHOOK_ROUTE_EVENT_CLASSES.includes(
      routeEventClass as GranotWebhookRouteEventClass,
    )
      ? (routeEventClass as GranotWebhookRouteEventClass)
      : undefined,
    booking_action: GRANOT_WEBHOOK_BOOKING_ACTIONS.includes(
      bookingAction as GranotWebhookBookingAction,
    )
      ? (bookingAction as GranotWebhookBookingAction)
      : undefined,
    captured_from: params.get("captured_from") || undefined,
    captured_to: params.get("captured_to") || undefined,
    processing_state: PROCESSING_STATES.includes(processingState as (typeof PROCESSING_STATES)[number])
      ? processingState as string
      : undefined,
    cursor: params.get("cursor") || undefined,
    limit: Number.isInteger(limit) && limit >= 1 && limit <= 100 ? limit : undefined,
  };
  return sanitizeReceiptFilters(parsed);
}

export function sanitizeReceiptFilters(
  filters: GranotWebhookReceiptListFilters,
): GranotWebhookReceiptListFilters {
  const next = { ...filters };
  if (!shouldShowBookingActionFilter(next.route_event_class)) {
    delete next.booking_action;
  }
  return next;
}

export function buildGranotWebhookReceiptHref(
  pathname: string,
  filters: GranotWebhookReceiptListFilters,
): string {
  const query = serializeFilters(
    sanitizeReceiptFilters(filters) as Record<string, string | number | undefined>,
  ).toString();
  return query ? `${pathname}?${query}` : pathname;
}

function filtersToDraft(filters: GranotWebhookReceiptListFilters): ReceiptFilterDraft {
  return {
    ref_no: filters.ref_no ?? "",
    job_no: filters.job_no ?? "",
    name: filters.name ?? "",
    phone: filters.phone ?? "",
    email: filters.email ?? "",
    source_company_id: filters.source_company_id ?? "",
    route_event_class: filters.route_event_class ?? "",
    booking_action: filters.booking_action ?? "",
    captured_from: filters.captured_from?.slice(0, 10) ?? "",
    captured_to: filters.captured_to?.slice(0, 10) ?? "",
    processing_state: filters.processing_state ?? "",
    limit: !filters.limit || filters.limit === 25 ? "" : String(filters.limit),
  };
}

function isoStart(date: string): string | undefined {
  return date ? `${date}T00:00:00.000Z` : undefined;
}

function isoEnd(date: string): string | undefined {
  return date ? `${date}T23:59:59.999Z` : undefined;
}

function draftToFilters(draft: ReceiptFilterDraft): GranotWebhookReceiptListFilters {
  const limit = Number(draft.limit);
  return sanitizeReceiptFilters({
    ref_no: draft.ref_no.trim() || undefined,
    job_no: draft.job_no.trim() || undefined,
    name: draft.name.trim() || undefined,
    phone: draft.phone.trim() || undefined,
    email: draft.email.trim() || undefined,
    source_company_id: draft.source_company_id.trim() || undefined,
    route_event_class: GRANOT_WEBHOOK_ROUTE_EVENT_CLASSES.includes(
      draft.route_event_class as GranotWebhookRouteEventClass,
    )
      ? (draft.route_event_class as GranotWebhookRouteEventClass)
      : undefined,
    booking_action: GRANOT_WEBHOOK_BOOKING_ACTIONS.includes(
      draft.booking_action as GranotWebhookBookingAction,
    )
      ? (draft.booking_action as GranotWebhookBookingAction)
      : undefined,
    captured_from: isoStart(draft.captured_from),
    captured_to: isoEnd(draft.captured_to),
    processing_state: draft.processing_state.trim() || undefined,
    limit: Number.isInteger(limit) && limit >= 1 && limit <= 100 ? limit : undefined,
  });
}

function intakeHref(caseId: string): string {
  return `/intakes?case=${encodeURIComponent(caseId)}`;
}

export function receiptIdFromSearchParams(params: URLSearchParams): string | null {
  const value = params.get(GRANOT_WEBHOOK_RECEIPT_PANEL_KEY)?.trim();
  return value || null;
}

function missingFact(value: string | null | undefined): string {
  return value?.trim() ? value : "—";
}

export function ReceiptLeadContact({
  contact,
}: {
  contact: GranotWebhookReceiptListItem["contact"];
}) {
  const name = contact.display_name?.trim() ?? "";
  const phone = contact.phone?.trim() ?? "";
  const email = contact.email?.trim() ?? "";
  if (!name && !phone && !email) {
    return <span>—</span>;
  }
  return (
    <div className="space-y-0.5">
      <div className="font-semibold text-navy">{missingFact(contact.display_name)}</div>
      <div>{missingFact(contact.phone)}</div>
      <div>{missingFact(contact.email)}</div>
    </div>
  );
}

export function ReceiptEventTypeChip({ value }: { value: GranotWebhookRouteEventClass }) {
  return (
    <span className="inline-flex max-w-[12rem] whitespace-normal leading-tight rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
      {labelForRouteEventClass(value)}
    </span>
  );
}

function ReceiptFact({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 wrap-break-word text-sm">{missingFact(value)}</dd>
    </div>
  );
}

function processingLine(item: GranotWebhookReceiptListItem): string {
  return [
    labelForProcessingState(item.processing_state),
    item.decision_outcome ? item.decision_outcome.replaceAll("_", " ") : null,
  ].filter(Boolean).join(" · ");
}

export function GranotWebhookReceiptPayloadPanel({
  item,
  open,
  onClose,
}: {
  item: GranotWebhookReceiptListItem | null;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <SidePanel title={GRANOT_LIFECYCLE_COPY.payloadPanelTitle} open={open} onClose={onClose}>
      {item ? (
        <div className="space-y-5">
          <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
            <ReceiptFact label={GRANOT_LIFECYCLE_COPY.factName} value={item.contact.display_name} />
            <ReceiptFact label={GRANOT_LIFECYCLE_COPY.factPhone} value={item.contact.phone} />
            <ReceiptFact label={GRANOT_LIFECYCLE_COPY.factEmail} value={item.contact.email} />
            <ReceiptFact label={GRANOT_LIFECYCLE_COPY.columnJobNo} value={item.job_no} />
            <ReceiptFact label={GRANOT_LIFECYCLE_COPY.columnRefNo} value={item.ref_no} />
            <ReceiptFact
              label={GRANOT_LIFECYCLE_COPY.columnSourceCompany}
              value={item.source_company?.owner_label}
            />
            <ReceiptFact
              label={GRANOT_LIFECYCLE_COPY.columnCaptured}
              value={formatDateTime(item.captured_at)}
            />
            <ReceiptFact
              label={GRANOT_LIFECYCLE_COPY.columnProcessing}
              value={processingLine(item) || undefined}
            />
          </dl>
          {item.granot_statement == null ? (
            <p className="text-sm text-muted-foreground">{GRANOT_LIFECYCLE_COPY.emptyPayload}</p>
          ) : (
            <div>
              <h3 className="text-sm font-semibold text-navy">
                {GRANOT_LIFECYCLE_COPY.fullGranotPayload}
              </h3>
              <pre className="mt-2 max-h-96 overflow-auto rounded-md border bg-steel-100 p-3 text-xs leading-5">
                {prettyJson(item.granot_statement)}
              </pre>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{GRANOT_LIFECYCLE_COPY.emptyPayload}</p>
      )}
    </SidePanel>
  );
}

export function GranotWebhookReceiptsFilterBar({
  filters,
  sourceCompanies,
  onSubmit,
  onReset,
}: {
  filters: GranotWebhookReceiptListFilters;
  sourceCompanies: Pick<LeadSourceCompany, "id" | "owner_label">[];
  onSubmit: (next: GranotWebhookReceiptListFilters) => void;
  onReset?: () => void;
}) {
  const [draft, setDraft] = useState<ReceiptFilterDraft>(() => filtersToDraft(filters));
  const showBookingAction = shouldShowBookingActionFilter(draft.route_event_class);

  return (
    <form
      className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(draftToFilters(draft));
      }}
    >
      <FilterInput
        id="receipts-ref-no"
        label={GRANOT_LIFECYCLE_COPY.filterTrackingReference}
        value={draft.ref_no}
        onChange={(value) => setDraft((current) => ({ ...current, ref_no: value }))}
      />
      <FilterInput
        id="receipts-job-no"
        label={GRANOT_LIFECYCLE_COPY.filterJobNumber}
        value={draft.job_no}
        onChange={(value) => setDraft((current) => ({ ...current, job_no: value }))}
      />
      <FilterInput
        id="receipts-name"
        label={GRANOT_LIFECYCLE_COPY.filterLeadName}
        value={draft.name}
        onChange={(value) => setDraft((current) => ({ ...current, name: value }))}
      />
      <FilterInput
        id="receipts-phone"
        label={GRANOT_LIFECYCLE_COPY.filterPhone}
        value={draft.phone}
        onChange={(value) => setDraft((current) => ({ ...current, phone: value }))}
      />
      <FilterInput
        id="receipts-email"
        label={GRANOT_LIFECYCLE_COPY.filterEmail}
        value={draft.email}
        onChange={(value) => setDraft((current) => ({ ...current, email: value }))}
      />
      <FilterSelect
        id="receipts-source-company"
        label={GRANOT_LIFECYCLE_COPY.filterSourceCompany}
        value={draft.source_company_id}
        onChange={(value) => setDraft((current) => ({ ...current, source_company_id: value }))}
        options={[
          ["", GRANOT_LIFECYCLE_COPY.sourceCompanyAll],
          ...sourceCompanies.map((company) => [company.id, company.owner_label] as const),
        ]}
      />
      <FilterSelect
        id="receipts-event-type"
        label={GRANOT_LIFECYCLE_COPY.filterEventType}
        value={draft.route_event_class}
        onChange={(value) => setDraft((current) => ({
          ...current,
          route_event_class: value,
          booking_action: shouldShowBookingActionFilter(value) ? current.booking_action : "",
        }))}
        options={[
          ["", GRANOT_LIFECYCLE_COPY.eventTypeAll],
          ["lead_created", GRANOT_LIFECYCLE_COPY.eventTypeLeadCreated],
          ["priority_updated", GRANOT_LIFECYCLE_COPY.eventTypePriorityUpdated],
          ["booking_status_changed", GRANOT_LIFECYCLE_COPY.eventTypeBookingStatusChanged],
        ]}
      />
      {showBookingAction ? (
        <FilterSelect
          id="receipts-booking-action"
          label={GRANOT_LIFECYCLE_COPY.filterBookingAction}
          value={draft.booking_action}
          onChange={(value) => setDraft((current) => ({ ...current, booking_action: value }))}
          options={[
            ["", GRANOT_LIFECYCLE_COPY.bookingActionAll],
            ["booked", GRANOT_LIFECYCLE_COPY.bookingActionBooked],
            ["release", GRANOT_LIFECYCLE_COPY.bookingActionRelease],
          ]}
        />
      ) : null}
      <FilterInput
        id="receipts-captured-from"
        label={GRANOT_LIFECYCLE_COPY.filterCapturedFrom}
        type="date"
        value={draft.captured_from}
        onChange={(value) => setDraft((current) => ({ ...current, captured_from: value }))}
      />
      <FilterInput
        id="receipts-captured-to"
        label={GRANOT_LIFECYCLE_COPY.filterCapturedTo}
        type="date"
        value={draft.captured_to}
        onChange={(value) => setDraft((current) => ({ ...current, captured_to: value }))}
      />
      <FilterSelect
        id="receipts-processing-state"
        label={GRANOT_LIFECYCLE_COPY.filterProcessingState}
        value={draft.processing_state}
        onChange={(value) => setDraft((current) => ({ ...current, processing_state: value }))}
        options={[
          ["", GRANOT_LIFECYCLE_COPY.processingStateAll],
          ["pending", GRANOT_LIFECYCLE_COPY.processingStatePending],
          ["claimed", GRANOT_LIFECYCLE_COPY.processingStateClaimed],
          ["retry_scheduled", GRANOT_LIFECYCLE_COPY.processingStateRetryScheduled],
          ["completed", GRANOT_LIFECYCLE_COPY.processingStateCompleted],
          ["dead_letter", GRANOT_LIFECYCLE_COPY.processingStateDeadLetter],
        ]}
      />
      <FilterSelect
        id="receipts-limit"
        label={GRANOT_LIFECYCLE_COPY.filterLimit}
        value={draft.limit}
        onChange={(value) => setDraft((current) => ({ ...current, limit: value }))}
        options={[["", "25"], ["50", "50"], ["100", "100"]]}
      />
      <div className="flex items-end gap-2 md:col-span-2">
        <Button type="submit">{GRANOT_LIFECYCLE_COPY.applyFilters}</Button>
        <Button type="button" variant="outline" onClick={onReset}>
          {GRANOT_LIFECYCLE_COPY.resetFilters}
        </Button>
      </div>
    </form>
  );
}

export function GranotWebhookReceiptRow({
  item,
  selected,
  onSelect,
}: {
  item: GranotWebhookReceiptListItem;
  selected?: boolean;
  onSelect?: (receiptId: string) => void;
}) {
  const processing = processingLine(item);

  return (
    <tr
      className={selected ? "cursor-pointer bg-steel-100" : "cursor-pointer hover:bg-steel-100"}
      onClick={() => onSelect?.(item.receipt_id)}
    >
      <td className="px-3 py-3 align-top text-sm">
        <ReceiptLeadContact contact={item.contact} />
      </td>
      <td className="px-3 py-3 align-top">
        <ReceiptEventTypeChip value={item.route_event_class} />
      </td>
      <td className="px-3 py-3 align-top">
        {item.booking_action ? (
          <StatusBadge tone={item.booking_action === "booked" ? "success" : "warning"}>
            {labelForBookingAction(item.booking_action)}
          </StatusBadge>
        ) : "—"}
      </td>
      <td className="px-3 py-3 align-top text-sm">
        {item.source_company?.owner_label ?? "—"}
      </td>
      <td className="px-3 py-3 align-top text-sm text-muted-foreground">{processing || "—"}</td>
      <td className="px-3 py-3 align-top font-mono text-xs">{item.ref_no ?? "—"}</td>
      <td className="px-3 py-3 align-top font-mono text-xs">{item.job_no ?? "—"}</td>
      <td className="px-3 py-3 align-top text-xs text-muted-foreground">
        {formatDateTime(item.captured_at)}
      </td>
      <td className="px-3 py-3 align-top">
        <div className="flex flex-col items-start gap-1">
          <button
            type="button"
            className="text-sm font-semibold text-trust-blue hover:underline"
            onClick={(event) => {
              event.stopPropagation();
              onSelect?.(item.receipt_id);
            }}
          >
            {GRANOT_LIFECYCLE_COPY.viewPayload}
          </button>
          {item.job_no ? (
            <Link
              className="text-sm font-semibold text-trust-blue hover:underline"
              href={buildJobTimelineHref({ job: item.job_no })}
              onClick={(event) => event.stopPropagation()}
            >
              {GRANOT_LIFECYCLE_COPY.openJobTimeline}
            </Link>
          ) : null}
          {item.intake_case_id ? (
            <Link
              className="text-sm font-semibold text-trust-blue hover:underline"
              href={intakeHref(item.intake_case_id)}
              onClick={(event) => event.stopPropagation()}
            >
              {GRANOT_LIFECYCLE_COPY.openIntake}
            </Link>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

export function GranotWebhookReceiptsList({
  items,
  selectedReceiptId,
  onSelectReceipt,
}: {
  items: GranotWebhookReceiptListItem[];
  selectedReceiptId?: string | null;
  onSelectReceipt?: (receiptId: string) => void;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{GRANOT_LIFECYCLE_COPY.empty}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2">{GRANOT_LIFECYCLE_COPY.columnContact}</th>
            <th scope="col" className="px-3 py-2">{GRANOT_LIFECYCLE_COPY.columnEventType}</th>
            <th scope="col" className="px-3 py-2">{GRANOT_LIFECYCLE_COPY.columnBookingAction}</th>
            <th scope="col" className="px-3 py-2">{GRANOT_LIFECYCLE_COPY.columnSourceCompany}</th>
            <th scope="col" className="px-3 py-2">{GRANOT_LIFECYCLE_COPY.columnProcessing}</th>
            <th scope="col" className="px-3 py-2">{GRANOT_LIFECYCLE_COPY.columnRefNo}</th>
            <th scope="col" className="px-3 py-2">{GRANOT_LIFECYCLE_COPY.columnJobNo}</th>
            <th scope="col" className="px-3 py-2">{GRANOT_LIFECYCLE_COPY.columnCaptured}</th>
            <th scope="col" className="px-3 py-2">{GRANOT_LIFECYCLE_COPY.columnActions}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((item) => (
            <GranotWebhookReceiptRow
              key={item.receipt_id}
              item={item}
              selected={item.receipt_id === selectedReceiptId}
              onSelect={onSelectReceipt}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function GranotWebhookReceiptsView({
  filters,
  sourceCompanies = [],
  data,
  loading,
  error,
  selectedReceiptId,
  onFilterSubmit,
  onReset,
  onNextPage,
  onSelectReceipt,
  onCloseReceipt,
}: {
  filters: GranotWebhookReceiptListFilters;
  sourceCompanies?: Pick<LeadSourceCompany, "id" | "owner_label">[];
  data?: Partial<GranotWebhookReceiptListPage>;
  loading?: boolean;
  error?: string;
  selectedReceiptId?: string | null;
  onFilterSubmit?: (next: GranotWebhookReceiptListFilters) => void;
  onReset?: () => void;
  onNextPage?: () => void;
  onSelectReceipt?: (receiptId: string) => void;
  onCloseReceipt?: () => void;
}) {
  const items = data?.items ?? [];
  const selected = selectedReceiptId
    ? items.find((item) => item.receipt_id === selectedReceiptId) ?? null
    : null;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold text-navy">{GRANOT_LIFECYCLE_COPY.receiptsPageTitle}</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          {GRANOT_LIFECYCLE_COPY.receiptsPageDescription}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{GRANOT_LIFECYCLE_COPY.receiptsTab}</CardTitle>
          <CardDescription>{GRANOT_LIFECYCLE_COPY.receiptsPageDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <GranotWebhookReceiptsFilterBar
            key={serializeFilters(filters as Record<string, string | number | undefined>).toString()}
            filters={filters}
            sourceCompanies={sourceCompanies}
            onSubmit={onFilterSubmit ?? (() => undefined)}
            onReset={onReset}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <FeedbackMessage>{GRANOT_LIFECYCLE_COPY.loading}</FeedbackMessage>
          ) : null}
          {error ? <FeedbackMessage tone="error">{error}</FeedbackMessage> : null}
          {!loading && !error && data ? (
            <GranotWebhookReceiptsList
              items={items}
              selectedReceiptId={selectedReceiptId}
              onSelectReceipt={onSelectReceipt}
            />
          ) : null}
        </CardContent>
      </Card>

      {data?.next_cursor && onNextPage ? (
        <Button type="button" variant="outline" onClick={onNextPage}>
          {GRANOT_LIFECYCLE_COPY.nextPage}
        </Button>
      ) : null}

      <GranotWebhookReceiptPayloadPanel
        item={selected}
        open={Boolean(selectedReceiptId)}
        onClose={onCloseReceipt ?? (() => undefined)}
      />
    </div>
  );
}

export function GranotWebhookReceiptsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams?.toString() ?? "";
  const filters = useMemo(
    () => parseGranotWebhookReceiptUrlFilters(new URLSearchParams(queryString)),
    [queryString],
  );
  const selectedReceiptId = useMemo(
    () => receiptIdFromSearchParams(new URLSearchParams(queryString)),
    [queryString],
  );

  const receipts = useQuery({
    queryKey: queryKeys.granotLifecycle.receipts(filters),
    queryFn: () => fetchGranotWebhookReceipts(filters),
  });

  const companies = useQuery({
    queryKey: queryKeys.sourceCompanies.list(),
    queryFn: () => fetchLeadSourceCompanies(),
  });

  function writeFilters(next: GranotWebhookReceiptListFilters) {
    const cleared = applyUrlStateUpdate(
      queryString,
      Object.fromEntries(GRANOT_WEBHOOK_RECEIPT_FILTER_KEYS.map((key) => [key, ""])),
    );
    const params = applyUrlStateUpdate(
      cleared.toString(),
      sanitizeReceiptFilters(next) as Record<string, string | number | undefined>,
    );
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function writeReceipt(id: string | null) {
    const params = applyUrlStateUpdate(queryString, {
      [GRANOT_WEBHOOK_RECEIPT_PANEL_KEY]: id ?? "",
    });
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <GranotWebhookReceiptsView
      filters={filters}
      sourceCompanies={companies.data ?? []}
      data={receipts.data}
      loading={receipts.isPending}
      selectedReceiptId={selectedReceiptId}
      error={
        receipts.isError
          ? (receipts.error instanceof Error ? receipts.error.message : GRANOT_LIFECYCLE_COPY.loadError)
          : undefined
      }
      onFilterSubmit={(next) => writeFilters({ ...next, cursor: undefined })}
      onReset={() => writeFilters({})}
      onNextPage={
        receipts.data?.next_cursor
          ? () => writeFilters({ ...filters, cursor: receipts.data?.next_cursor ?? undefined })
          : undefined
      }
      onSelectReceipt={(id) => writeReceipt(id)}
      onCloseReceipt={() => writeReceipt(null)}
    />
  );
}

function FilterInput({
  id,
  label,
  value,
  onChange,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly (readonly [string, string])[];
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue || "all"} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </div>
  );
}
