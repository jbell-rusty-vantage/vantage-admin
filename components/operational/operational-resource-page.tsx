"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUp, ChevronDown, Download, Funnel, PanelLeftClose, PanelLeftOpen, Pencil, PlusCircle, X, XCircle } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/data-table/table-shell";
import { SortableHeader } from "@/components/data-table/sortable-header";
import { StatusBadge } from "@/components/data-table/status-badge";
import { TableEmptyState, TableErrorState, TableLoadingState } from "@/components/data-table/table-states";
import { DateRangeFilter } from "@/components/filters/date-range-filter";
import { FilterField } from "@/components/filters/filter-field";
import { SelectFilter } from "@/components/filters/select-filter";
import { Button } from "@/components/ui/button";
import { FeedbackMessage } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { SidePanel } from "@/components/ui/side-panel";
import { Textarea } from "@/components/ui/textarea";
import { DetailGrid, DetailItem, DetailSection } from "@/components/record-detail/detail-section";
import {
  adminExportUrl,
  fetchAdminDetail,
  fetchAdminList,
  getRecordId,
  resourceLabels,
  uiToAdminResource,
  updateFormLeadBadLead,
  updateProductionRecord,
  type AdminRecord,
  type AdminResource,
  type UiResource,
} from "@/lib/api/admin";
import { downloadCsvFromProxy } from "@/lib/api/csv";
import { useFacetOptions } from "@/lib/api/facets";
import type { SerializableFilters } from "@/lib/api/filters";
import { useUrlTableState, type UrlStateUpdate } from "@/lib/api/url-state";
import { useDatabaseScope } from "@/lib/state/database-scope";
import type { DatabaseScope, SelectOption, SortDirection, TableQueryParams } from "@/lib/api/types";
import {
  CALL_LEAD_SOURCE_LABEL_OPTIONS,
  CANCELLATION_REASON_OPTIONS,
  FORM_LEAD_BAD_LEAD_LABELS,
  FORM_LEAD_BAD_LEAD_REASON_OPTIONS,
  type FormLeadBadLeadReason,
  FORM_LEAD_SOURCE_LABEL_OPTIONS,
  getCallLeadSourceLabel,
  getFormLeadSourceLabel,
  LOCAL_TYPE_OPTIONS,
  MOVE_SIZE_OPTIONS,
  SOURCE_COMPANY_OPTIONS,
  SOURCE_LABEL_OPTIONS,
} from "@/lib/constants/domain";
import { queryKeys } from "@/lib/query/keys";
import { cn } from "@/lib/utils";

type FieldType = "text" | "date" | "number" | "textarea" | "select" | "boolean";

const filtersSidebarStorageKey = "vantage-admin-operational-filters-collapsed";

type ColumnConfig = {
  key: string;
  label: string;
  path: string;
  sort?: string;
  format?: "date" | "money" | "boolean" | "scope" | "badges";
};

type FilterConfig = {
  key: string;
  label: string;
  type: Exclude<FieldType, "textarea">;
  options?: readonly SelectOption<string>[];
};

type EditFieldConfig = {
  key: string;
  label: string;
  type: FieldType;
  options?: readonly SelectOption<string>[];
};

type ResourceConfig = {
  uiResource: UiResource;
  title: string;
  description: string;
  defaultSort: string;
  defaultDirection: SortDirection;
  dateField: string;
  columns: ColumnConfig[];
  filters: FilterConfig[];
  editFields: EditFieldConfig[];
  fixedListFilters?: SerializableFilters;
  readOnly?: boolean;
};

const yesNoOptions: SelectOption<string>[] = [
  { value: "true", label: "Yes" },
  { value: "false", label: "No" },
];

const formLeadColumns: ColumnConfig[] = [
  { key: "timestamp", label: "Created", path: "timestamp", sort: "timestamp", format: "date" },
  { key: "name", label: "Name", path: "name", sort: "name" },
  { key: "first_name", label: "First", path: "first_name" },
  { key: "last_name", label: "Last", path: "last_name" },
  { key: "phone", label: "Phone", path: "phone_number" },
  { key: "email", label: "Email", path: "email" },
  { key: "source", label: "Source", path: "source_company", sort: "source_company" },
  { key: "ref", label: "Ref", path: "ref_no", sort: "ref_no" },
  { key: "move", label: "Move", path: "move_size" },
  { key: "bad_lead", label: "Bad Lead", path: "bad_lead" },
  { key: "booked", label: "Booked", path: "booked", format: "boolean" },
  { key: "cancelled", label: "Cancelled", path: "cancelled", format: "boolean" },
];

const formLeadFilters: FilterConfig[] = [
  { key: "source_company", label: "Source company", type: "select", options: SOURCE_COMPANY_OPTIONS },
  { key: "name", label: "Name", type: "text" },
  { key: "email", label: "Email", type: "text" },
  { key: "phone_number", label: "Phone", type: "text" },
  { key: "ref_no", label: "Ref number", type: "text" },
  { key: "booked", label: "Booked", type: "select", options: yesNoOptions },
  { key: "cancelled", label: "Cancelled", type: "select", options: yesNoOptions },
  { key: "move_size", label: "Move size", type: "select", options: MOVE_SIZE_OPTIONS },
];

const formLeadEditFields: EditFieldConfig[] = [
  {
    key: "source_company",
    label: "Source company",
    type: "select",
    options: FORM_LEAD_SOURCE_LABEL_OPTIONS,
  },
  { key: "name", label: "Name", type: "text" },
  { key: "first_name", label: "First name", type: "text" },
  { key: "last_name", label: "Last name", type: "text" },
  { key: "timestamp", label: "Created", type: "date" },
  { key: "pickup_zip", label: "Pickup zip", type: "text" },
  { key: "destination_zip", label: "Destination zip", type: "text" },
  { key: "pickup_state", label: "Pickup state", type: "text" },
  { key: "delivery_state", label: "Delivery state", type: "text" },
  { key: "move_size", label: "Move size", type: "select", options: MOVE_SIZE_OPTIONS },
  { key: "move_date", label: "Move date", type: "date" },
  { key: "ref_no", label: "Ref number", type: "text" },
  { key: "email", label: "Email", type: "text" },
  { key: "phone_number", label: "Phone", type: "text" },
  { key: "quoted", label: "Quoted", type: "text" },
  { key: "cubic_feet", label: "Cubic feet", type: "number" },
];

const operationalConfigs: Record<UiResource, ResourceConfig> = {
  "form-leads": {
    uiResource: "form-leads",
    title: "Form Leads",
    description: "Browse, inspect, edit, export, and book web form leads.",
    defaultSort: "timestamp",
    defaultDirection: "desc",
    dateField: "timestamp",
    fixedListFilters: { duplicate: false },
    columns: formLeadColumns,
    filters: formLeadFilters,
    editFields: formLeadEditFields,
  },
  "duplicate-form-leads": {
    uiResource: "duplicate-form-leads",
    title: "Duplicate Form Leads",
    description: "Browse and inspect quarantined duplicate web form submissions.",
    defaultSort: "timestamp",
    defaultDirection: "desc",
    dateField: "timestamp",
    fixedListFilters: { duplicate: true },
    readOnly: true,
    columns: formLeadColumns,
    filters: formLeadFilters,
    editFields: [],
  },
  "call-leads": {
    uiResource: "call-leads",
    title: "Call Leads",
    description: "Browse, inspect, edit, export, and book inbound call leads.",
    defaultSort: "timestamp",
    defaultDirection: "desc",
    dateField: "timestamp",
    columns: [
      { key: "timestamp", label: "Created", path: "timestamp", sort: "timestamp", format: "date" },
      { key: "name", label: "Name", path: "name", sort: "name" },
      { key: "first_name", label: "First", path: "first_name" },
      { key: "last_name", label: "Last", path: "last_name" },
      { key: "phone", label: "Phone", path: "phone_number" },
      { key: "email", label: "Email", path: "email" },
      { key: "job", label: "Job", path: "job_no", sort: "job_no" },
      { key: "source", label: "Source", path: "source_company", sort: "source_company" },
      { key: "local", label: "Local", path: "local" },
      { key: "booked", label: "Booked", path: "booked", format: "boolean" },
      { key: "cancelled", label: "Cancelled", path: "cancelled", format: "boolean" },
    ],
    filters: [
      { key: "source_company", label: "Source company", type: "select", options: SOURCE_COMPANY_OPTIONS },
      { key: "name", label: "Name", type: "text" },
      { key: "email", label: "Email", type: "text" },
      { key: "phone_number", label: "Phone", type: "text" },
      { key: "job_no", label: "Job number", type: "text" },
      { key: "booked", label: "Booked", type: "select", options: yesNoOptions },
      { key: "cancelled", label: "Cancelled", type: "select", options: yesNoOptions },
      { key: "local", label: "Local type", type: "select", options: LOCAL_TYPE_OPTIONS },
    ],
    editFields: [
      {
        key: "source_company",
        label: "Source company",
        type: "select",
        options: CALL_LEAD_SOURCE_LABEL_OPTIONS,
      },
      { key: "timestamp", label: "Created", type: "date" },
      { key: "job_no", label: "Job number", type: "text" },
      { key: "name", label: "Name", type: "text" },
      { key: "first_name", label: "First name", type: "text" },
      { key: "last_name", label: "Last name", type: "text" },
      { key: "email", label: "Email", type: "text" },
      { key: "phone_number", label: "Phone", type: "text" },
      { key: "duration", label: "Duration", type: "text" },
      { key: "start_time", label: "Start time", type: "text" },
      { key: "end_time", label: "End time", type: "text" },
      { key: "local", label: "Local type", type: "select", options: LOCAL_TYPE_OPTIONS },
      { key: "pickup_zip", label: "Pickup zip", type: "text" },
      { key: "delivery_zip", label: "Delivery zip", type: "text" },
      { key: "pickup_state", label: "Pickup state", type: "text" },
      { key: "delivery_state", label: "Delivery state", type: "text" },
      { key: "cubic_feet", label: "Cubic feet", type: "number" },
    ],
  },
  bookings: {
    uiResource: "bookings",
    title: "Bookings",
    description: "Browse bookings, edit production booking details, and start cancellations.",
    defaultSort: "book_date",
    defaultDirection: "desc",
    dateField: "book_date",
    columns: [
      { key: "book_date", label: "Book Date", path: "book_date", sort: "book_date", format: "date" },
      { key: "job", label: "Job", path: "job_no", sort: "job_no" },
      { key: "customer", label: "Customer", path: "customer.full_name" },
      { key: "phone", label: "Phone", path: "customer.phone_number" },
      { key: "source", label: "Source", path: "source", sort: "source" },
      { key: "binder", label: "Binder", path: "total_binder_amount", sort: "total_binder_amount", format: "money" },
      { key: "deposit", label: "Deposit", path: "deposit_amount", sort: "deposit_amount", format: "money" },
      { key: "merchant", label: "Merchant", path: "merchant", sort: "merchant" },
      { key: "cancelled", label: "Cancelled", path: "cancelled", format: "boolean" },
    ],
    filters: [
      { key: "source", label: "Source", type: "select", options: SOURCE_COMPANY_OPTIONS },
      { key: "agent", label: "Agent", type: "select" },
      { key: "customer_name", label: "Customer name", type: "text" },
      { key: "customer_phone", label: "Customer phone", type: "text" },
      { key: "job_no", label: "Job number", type: "text" },
      { key: "merchant", label: "Merchant", type: "select" },
      { key: "cancelled", label: "Cancelled", type: "select", options: yesNoOptions },
    ],
    editFields: [
      { key: "book_date", label: "Book date", type: "date" },
      { key: "job_no", label: "Job number", type: "text" },
      { key: "total_binder_amount", label: "Total binder amount", type: "number" },
      { key: "deposit_amount", label: "Deposit amount", type: "number" },
      { key: "merchant", label: "Merchant", type: "select" },
      { key: "source", label: "Source label", type: "select", options: SOURCE_LABEL_OPTIONS },
      { key: "local", label: "Local type", type: "select", options: LOCAL_TYPE_OPTIONS },
    ],
  },
  cancellations: {
    uiResource: "cancellations",
    title: "Cancellations",
    description: "Browse cancellations and update production cancellation metadata.",
    defaultSort: "cancel_date",
    defaultDirection: "desc",
    dateField: "cancel_date",
    columns: [
      { key: "cancel_date", label: "Cancelled", path: "cancel_date", sort: "cancel_date", format: "date" },
      { key: "job", label: "Job", path: "job_no", sort: "job_no" },
      { key: "customer", label: "Customer", path: "customer.full_name" },
      { key: "source", label: "Source", path: "source" },
      { key: "merchant", label: "Merchant", path: "merchant" },
      { key: "refund", label: "Refund", path: "refund_amount", sort: "refund_amount", format: "money" },
      { key: "reason", label: "Reason", path: "reason", sort: "reason" },
      { key: "by", label: "By", path: "cancelled_by" },
    ],
    filters: [
      { key: "source_company", label: "Source company", type: "select", options: SOURCE_COMPANY_OPTIONS },
      { key: "source", label: "Source label", type: "select", options: SOURCE_LABEL_OPTIONS },
      { key: "agent", label: "Agent", type: "select" },
      { key: "customer_name", label: "Customer name", type: "text" },
      { key: "customer_phone", label: "Customer phone", type: "text" },
      { key: "job_no", label: "Job number", type: "text" },
      { key: "merchant", label: "Merchant", type: "select" },
      { key: "reason", label: "Reason", type: "select", options: CANCELLATION_REASON_OPTIONS },
    ],
    editFields: [
      { key: "cancel_date", label: "Cancellation date", type: "date" },
      { key: "refund_amount", label: "Refund amount", type: "number" },
      { key: "reason", label: "Reason", type: "select", options: CANCELLATION_REASON_OPTIONS },
      { key: "notes", label: "Notes", type: "textarea" },
      { key: "cancelled_by", label: "Cancelled by", type: "text" },
    ],
  },
  customers: {
    uiResource: "customers",
    title: "Customers",
    description: "Browse customers, inspect their linked work, and update contact details.",
    defaultSort: "updatedAt",
    defaultDirection: "desc",
    dateField: "updatedAt",
    columns: [
      { key: "name", label: "Name", path: "full_name", sort: "full_name" },
      { key: "phone", label: "Phone", path: "phone_number" },
      { key: "email", label: "Email", path: "email" },
      { key: "bookings", label: "Bookings", path: "booking_count" },
      { key: "cancellations", label: "Cancellations", path: "cancellation_count" },
      { key: "deposit", label: "Deposit", path: "deposit_total", format: "money" },
      { key: "activity", label: "Last Activity", path: "updatedAt", sort: "updatedAt", format: "date" },
    ],
    filters: [
      { key: "name", label: "Name", type: "text" },
      { key: "phone_number", label: "Phone", type: "text" },
      { key: "email", label: "Email", type: "text" },
    ],
    editFields: [
      { key: "full_name", label: "Full name", type: "text" },
      { key: "phone_number", label: "Phone", type: "text" },
      { key: "email", label: "Email", type: "text" },
    ],
  },
  agents: {
    uiResource: "agents",
    title: "Agents",
    description: "Browse agents and inspect booking/cancellation performance.",
    defaultSort: "name",
    defaultDirection: "asc",
    dateField: "createdAt",
    columns: [
      { key: "name", label: "Name", path: "name", sort: "name" },
      { key: "active", label: "Active", path: "active", format: "boolean" },
      { key: "role", label: "Role", path: "role" },
      { key: "bookings", label: "Bookings", path: "booking_count" },
      { key: "binder", label: "Binder", path: "total_binder_amount", format: "money" },
      { key: "deposit", label: "Deposit", path: "total_deposit_amount", format: "money" },
      { key: "cancellations", label: "Cancellations", path: "cancellation_count" },
      { key: "rate", label: "Cancel Rate", path: "cancellation_rate" },
    ],
    filters: [
      { key: "name", label: "Name", type: "text" },
      { key: "active", label: "Active", type: "select", options: yesNoOptions },
      { key: "role", label: "Role", type: "text" },
    ],
    editFields: [],
  },
};

function getValue(record: AdminRecord, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (current && typeof current === "object" && key in current) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, record);
}

function isReferralBooking(record: AdminRecord | null | undefined): boolean {
  return record?.is_referral_booking === true;
}

function isFormLeadBadLeadReason(value: unknown): value is FormLeadBadLeadReason {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(FORM_LEAD_BAD_LEAD_LABELS, value)
  );
}

function formatBadLead(value: unknown): string {
  return isFormLeadBadLeadReason(value) ? FORM_LEAD_BAD_LEAD_LABELS[value] : "";
}

function canMarkFormLeadBad(record: AdminRecord): boolean {
  return !record.duplicate && !record.booked && !record.cancelled;
}

async function invalidateOperationalMutations(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.lists.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.details.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.search.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.auditLog.all }),
  ]);
}

function formatDate(value: unknown): string {
  if (!value) {
    return "-";
  }
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
}

function formatMoney(value: unknown): string {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) {
    return "-";
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(number);
}

function formatPlain(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  if (typeof value === "boolean") {
    return <StatusBadge tone={value ? "success" : "muted"}>{value ? "Yes" : "No"}</StatusBadge>;
  }
  if (Array.isArray(value)) {
    return value.length ? `${value.length} item${value.length === 1 ? "" : "s"}` : "-";
  }
  if (typeof value === "object") {
    return "Linked";
  }
  return String(value);
}

function formatCell(record: AdminRecord, column: ColumnConfig) {
  let value = getValue(record, column.path);
  if ((value === null || value === undefined || value === "") && column.path === "customer.full_name") {
    value = getValue(record, "customer_name");
  }
  if (column.path === "bad_lead") {
    return formatBadLead(value) || "-";
  }
  if (column.format === "date") {
    return formatDate(value);
  }
  if (column.format === "money") {
    return formatMoney(value);
  }
  return formatPlain(value);
}

function toInputValue(value: unknown, type: FieldType): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (type === "date") {
    return String(value).slice(0, 10);
  }
  return String(value);
}

function resolveEditFieldValue(
  record: AdminRecord,
  field: EditFieldConfig,
  uiResource: UiResource,
): string {
  if (field.key === "source_company") {
    const storedSourceCompany = getValue(record, "source_company");
    if (uiResource === "form-leads" || uiResource === "duplicate-form-leads") {
      return getFormLeadSourceLabel(
        storedSourceCompany == null ? undefined : String(storedSourceCompany),
        getValue(record, "local") == null ? undefined : String(getValue(record, "local")),
      );
    }
    if (uiResource === "call-leads") {
      return getCallLeadSourceLabel(
        storedSourceCompany == null ? undefined : String(storedSourceCompany),
      );
    }
  }
  return toInputValue(getValue(record, field.key), field.type);
}

function buildUpdatePayload(formData: FormData, fields: EditFieldConfig[]) {
  const payload: Record<string, unknown> = {};
  for (const field of fields) {
    const raw = String(formData.get(field.key) ?? "").trim();
    if (!raw) {
      continue;
    }
    if (field.type === "number") {
      const number = Number(raw);
      if (Number.isFinite(number)) {
        payload[field.key] = number;
      }
    } else {
      payload[field.key] = raw;
    }
  }
  return payload;
}

function withFacetOptions(config: ResourceConfig, options: {
  agentOptions: readonly SelectOption[];
  merchantOptions: readonly SelectOption[];
  sourceCompanyOptions: readonly SelectOption[];
}): ResourceConfig {
  const applyOptions = <TField extends FilterConfig | EditFieldConfig>(field: TField): TField => {
    if (field.key === "agent") {
      return { ...field, options: options.agentOptions } as TField;
    }
    if (field.key === "merchant") {
      return { ...field, options: options.merchantOptions } as TField;
    }
    if (field.key === "source" && field.label === "Source") {
      return { ...field, options: options.sourceCompanyOptions } as TField;
    }
    return field;
  };
  return {
    ...config,
    filters: config.filters.map(applyOptions),
    editFields: config.editFields.map(applyOptions),
  };
}

function getBookingQuery(resource: UiResource, record: AdminRecord) {
  const params = new URLSearchParams();
  const id = getRecordId(record);
  if (resource === "form-leads") {
    params.set("lead_type", "FormLead");
    params.set("lead_id", id);
  }
  if (resource === "call-leads") {
    params.set("lead_type", "CallLead");
    const phone = getValue(record, "phone_number");
    if (phone) params.set("call_phone_number", String(phone));
  }
  return params.toString();
}

function getCancellationQuery(resource: UiResource, record: AdminRecord) {
  const params = new URLSearchParams();
  const id = getRecordId(record);
  if (resource === "bookings") {
    params.set("booked_lead", id);
  } else {
    params.set("lead_id", id);
  }
  return params.toString();
}

function FilterInput({
  filter,
  value,
  onChange,
}: {
  filter: FilterConfig;
  value: string;
  onChange: (value: string) => void;
}) {
  if (filter.type === "select" && filter.options) {
    return <SelectFilter value={value} options={filter.options} onChange={onChange} />;
  }
  return <Input value={value} onChange={(event) => onChange(event.target.value)} />;
}

function getFilterDisplayValue(filter: FilterConfig, value: unknown): string {
  if (value === undefined || value === null || value === "") {
    return "";
  }
  const stringValue = String(value);
  return filter.options?.find((option) => option.value === stringValue)?.label ?? stringValue;
}

function getActiveFilterChips(config: ResourceConfig, filters: TableQueryParams) {
  const filterMap = new Map(config.filters.map((filter) => [filter.key, filter]));
  const chips: Array<{ key: string; label: string; value: string; clear: UrlStateUpdate }> = [];

  if (filters.q) {
    chips.push({ key: "q", label: "Search", value: String(filters.q), clear: { q: null } });
  }
  if (filters.from || filters.to) {
    chips.push({
      key: "date",
      label: "Date",
      value: `${filters.from ?? "Any"} to ${filters.to ?? "Any"}`,
      clear: { from: null, to: null },
    });
  }

  for (const filter of config.filters) {
    const value = filters[filter.key];
    const displayValue = getFilterDisplayValue(filter, value);
    if (displayValue) {
      chips.push({
        key: filter.key,
        label: filter.label,
        value: displayValue,
        clear: { [filter.key]: null },
      });
    }
  }

  return chips.filter((chip) => filterMap.has(chip.key) || chip.key === "q" || chip.key === "date");
}

function FilterFields({
  config,
  filters,
  update,
}: {
  config: ResourceConfig;
  filters: TableQueryParams;
  update: (next: UrlStateUpdate) => void;
}) {
  return (
    <div className="space-y-4">
      <FilterField label="Search">
        <Input value={String(filters.q ?? "")} onChange={(event) => update({ q: event.target.value })} />
      </FilterField>
      <FilterField label="Date range">
        <DateRangeFilter
          from={typeof filters.from === "string" ? filters.from : undefined}
          to={typeof filters.to === "string" ? filters.to : undefined}
          onChange={(range) => update(range)}
        />
      </FilterField>
      {config.filters.map((filter) => (
        <FilterField key={filter.key} label={filter.label}>
          <FilterInput
            filter={filter}
            value={String(filters[filter.key] ?? "")}
            onChange={(value) => update({ [filter.key]: value })}
          />
        </FilterField>
      ))}
    </div>
  );
}

function ActiveFilterChips({
  config,
  filters,
  update,
  reset,
}: {
  config: ResourceConfig;
  filters: TableQueryParams;
  update: (next: UrlStateUpdate) => void;
  reset: () => void;
}) {
  const chips = getActiveFilterChips(config, filters);
  if (chips.length === 0) {
    return <p className="text-sm text-muted-foreground">No filters applied.</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          className="inline-flex items-center gap-1 rounded-full border bg-white px-3 py-1 text-xs font-semibold text-navy shadow-sm hover:bg-steel-100"
          onClick={() => update(chip.clear)}
        >
          <span>{chip.label}: {chip.value}</span>
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      ))}
      <Button variant="ghost" className="h-8 px-2 text-xs" onClick={reset}>
        Reset all
      </Button>
    </div>
  );
}

function OperationalFilterPanel({
  config,
  filters,
  update,
  reset,
  collapsed,
  onToggleCollapsed,
}: {
  config: ResourceConfig;
  filters: TableQueryParams;
  update: (next: UrlStateUpdate) => void;
  reset: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeCount = getActiveFilterChips(config, filters).length;

  return (
    <>
      <div className="sticky top-20 z-20 rounded-lg border bg-background/95 p-3 shadow-sm backdrop-blur xl:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="outline" className="gap-2" onClick={() => setMobileOpen(true)}>
            <Funnel className="h-4 w-4" aria-hidden="true" />
            Filters{activeCount ? ` (${activeCount})` : ""}
          </Button>
          <Button variant="ghost" onClick={reset}>
            Reset
          </Button>
        </div>
        <div className="mt-3">
          <ActiveFilterChips config={config} filters={filters} update={update} reset={reset} />
        </div>
      </div>

      <aside className="hidden xl:block">
        {collapsed ? (
          <div className="sticky top-24 flex flex-col items-center gap-3 rounded-lg border bg-background p-2 shadow-sm">
            <Button
              variant="ghost"
              className="h-9 w-9 px-0"
              onClick={onToggleCollapsed}
              aria-label="Expand filters"
              title="Expand filters"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </Button>
            <div className="flex flex-col items-center gap-2 py-2 text-muted-foreground">
              <Funnel className="h-4 w-4" aria-hidden="true" />
              {activeCount ? (
                <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-white">
                  {activeCount}
                </span>
              ) : null}
              <span className="sr-only">Filters collapsed</span>
            </div>
          </div>
        ) : (
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-lg border bg-background p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Filters</h2>
                <p className="text-xs text-muted-foreground">Always available while scrolling.</p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" className="h-8 px-2 text-xs" onClick={reset}>
                  Reset
                </Button>
                <Button
                  variant="ghost"
                  className="h-8 w-8 px-0"
                  onClick={onToggleCollapsed}
                  aria-label="Collapse filters"
                  title="Collapse filters"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <FilterFields config={config} filters={filters} update={update} />
          </div>
        )}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 xl:hidden">
          <button
            type="button"
            aria-label="Close filters"
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l bg-background shadow-xl">
            <header className="flex items-start justify-between gap-4 border-b p-5">
              <div>
                <h2 className="text-lg font-semibold">Filters</h2>
                <p className="mt-1 text-sm text-muted-foreground">Refine this operational view.</p>
              </div>
              <Button variant="ghost" className="h-9 w-9 px-0" onClick={() => setMobileOpen(false)} aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </header>
            <div className="flex-1 overflow-y-auto p-5">
              <FilterFields config={config} filters={filters} update={update} />
            </div>
            <footer className="flex items-center justify-between gap-3 border-t p-5">
              <Button variant="outline" onClick={reset}>
                Reset filters
              </Button>
              <Button onClick={() => setMobileOpen(false)}>Show results</Button>
            </footer>
          </aside>
        </div>
      ) : null}
    </>
  );
}

function EditForm({
  config,
  record,
  resource,
  uiResource,
  onSaved,
}: {
  config: ResourceConfig;
  record: AdminRecord;
  resource: Exclude<AdminResource, "agents">;
  uiResource: UiResource;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      updateProductionRecord<AdminRecord>(resource, getRecordId(record), payload),
    onSuccess: async () => {
      await invalidateOperationalMutations(queryClient);
      setMessage("Saved. The table and detail caches were refreshed.");
      onSaved();
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "Update failed."),
  });

  if (config.editFields.length === 0) {
    return <FeedbackMessage>Editing is not enabled for this model in v1.</FeedbackMessage>;
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const payload = buildUpdatePayload(new FormData(event.currentTarget), config.editFields);
        if (Object.keys(payload).length === 0) {
          setMessage("Enter at least one field to update.");
          return;
        }
        mutation.mutate(payload);
      }}
    >
      {message ? <FeedbackMessage tone={mutation.isError ? "error" : "success"}>{message}</FeedbackMessage> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {config.editFields.map((field) => {
          const value = resolveEditFieldValue(record, field, uiResource);
          return (
            <FilterField key={field.key} label={field.label}>
              {field.type === "select" && field.options ? (
                <select
                  name={field.key}
                  defaultValue={value}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">No change</option>
                  {field.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : field.type === "textarea" ? (
                <Textarea name={field.key} defaultValue={value} />
              ) : (
                <Input
                  name={field.key}
                  type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                  defaultValue={value}
                  step={field.type === "number" ? "0.01" : undefined}
                />
              )}
            </FilterField>
          );
        })}
      </div>
      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Saving..." : "Save changes"}
      </Button>
    </form>
  );
}

function MarkBadLeadControl({
  record,
  compact = false,
  onSaved,
}: {
  record: AdminRecord;
  compact?: boolean;
  onSaved?: () => void;
}) {
  const queryClient = useQueryClient();
  const currentBadLead = isFormLeadBadLeadReason(record.bad_lead) ? record.bad_lead : "";
  const [selectedReason, setSelectedReason] = useState(currentBadLead);
  const [message, setMessage] = useState<string | null>(null);
  const [compactOpen, setCompactOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [popoverPosition, setPopoverPosition] = useState({ left: 0, top: 0 });
  const eligible = canMarkFormLeadBad(record);
  const mutation = useMutation({
    mutationFn: (badLead: string | null) =>
      updateFormLeadBadLead<AdminRecord>(getRecordId(record), badLead),
    onSuccess: async () => {
      await invalidateOperationalMutations(queryClient);
      setMessage("Bad Lead status updated.");
      onSaved?.();
    },
    onError: (error) =>
      setMessage(error instanceof Error ? error.message : "Bad Lead update failed."),
  });

  const canSubmit = selectedReason !== currentBadLead;
  const isMarkedBad = Boolean(currentBadLead);
  const updatePopoverPosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) {
      return;
    }

    const margin = 12;
    const gap = 8;
    const width = 288;
    const anchorRect = anchor.getBoundingClientRect();
    const popoverHeight = popoverRef.current?.offsetHeight ?? 260;
    const left = Math.min(
      Math.max(anchorRect.left, margin),
      Math.max(margin, window.innerWidth - width - margin),
    );
    const belowTop = anchorRect.bottom + gap;
    const top =
      belowTop + popoverHeight + margin > window.innerHeight && anchorRect.top > popoverHeight + margin
        ? anchorRect.top - popoverHeight - gap
        : belowTop;

    setPopoverPosition({ left, top: Math.max(margin, top) });
  }, []);

  useLayoutEffect(() => {
    if (!compactOpen) {
      return;
    }

    updatePopoverPosition();
  }, [compactOpen, updatePopoverPosition, selectedReason, message]);

  useEffect(() => {
    if (!compactOpen) {
      return;
    }

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target) || popoverRef.current?.contains(target)) {
        return;
      }
      setCompactOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setCompactOpen(false);
      }
    }

    window.addEventListener("resize", updatePopoverPosition);
    window.addEventListener("scroll", updatePopoverPosition, true);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("resize", updatePopoverPosition);
      window.removeEventListener("scroll", updatePopoverPosition, true);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [compactOpen, updatePopoverPosition]);

  if (!eligible) {
    return compact ? null : (
      <FeedbackMessage tone="warning">
        Bad Lead can only be changed for non-booked, non-cancelled form leads.
      </FeedbackMessage>
    );
  }

  if (compact) {
    const compactPopover =
      compactOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popoverRef}
              className="fixed z-50 w-72 rounded-lg border bg-background p-3 shadow-xl"
              style={{ left: popoverPosition.left, top: popoverPosition.top }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-navy">Bad Lead Reason</p>
                  <p className="text-xs text-muted-foreground">Applies to this form lead only.</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-7 w-7 px-0"
                  onClick={() => setCompactOpen(false)}
                  aria-label="Close bad lead menu"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              <select
                value={selectedReason}
                onChange={(event) => setSelectedReason(event.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">{isMarkedBad ? "Clear Bad Lead" : "Choose reason"}</option>
                {FORM_LEAD_BAD_LEAD_REASON_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {message ? (
                <p className="mt-2 text-xs text-muted-foreground">{message}</p>
              ) : null}
              <div className="mt-3 flex justify-end gap-2">
                <Button type="button" variant="outline" className="h-8 px-3 text-xs" onClick={() => setCompactOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant={selectedReason ? "destructive" : "outline"}
                  disabled={mutation.isPending || !canSubmit}
                  className="h-8 px-3 text-xs"
                  onClick={() => {
                    mutation.mutate(selectedReason || null, {
                      onSuccess: () => setCompactOpen(false),
                    });
                  }}
                >
                  {mutation.isPending ? "Saving..." : selectedReason ? "Mark Bad" : isMarkedBad ? "Clear Bad" : "Save"}
                </Button>
              </div>
            </div>,
            document.body,
          )
        : null;

    return (
      <div ref={anchorRef} onClick={(event) => event.stopPropagation()}>
        <Button
          type="button"
          variant={isMarkedBad ? "destructive" : "outline"}
          className="h-8 min-w-24 gap-1 px-2 text-xs"
          onClick={() => setCompactOpen((current) => !current)}
          aria-expanded={compactOpen}
        >
          <span className="max-w-28 truncate">{isMarkedBad ? formatBadLead(currentBadLead) : "Bad Lead"}</span>
          <ChevronDown className="h-3 w-3" aria-hidden="true" />
        </Button>
        {compactPopover}
      </div>
    );
  }

  return (
    <div className={compact ? "flex min-w-[230px] items-center gap-2" : "space-y-3"}>
      {message && !compact ? (
        <FeedbackMessage tone={mutation.isError ? "error" : "success"}>{message}</FeedbackMessage>
      ) : null}
      <div className={compact ? "flex items-center gap-2" : "flex flex-wrap items-end gap-2"}>
        <label className={compact ? "flex items-center" : "grid gap-1 text-sm font-medium"}>
          <span className={compact ? "sr-only" : undefined}>
            {!compact ? "Bad Lead Reason" : "Bad Lead"}
          </span>
          <select
            value={selectedReason}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => setSelectedReason(event.target.value)}
            className={
              compact
                ? "h-8 w-36 rounded-md border border-input bg-background px-2 text-xs"
                : "flex h-10 min-w-60 rounded-md border border-input bg-background px-3 py-2 text-sm"
            }
          >
            <option value="">{isMarkedBad ? "Clear Bad Lead" : "Choose reason"}</option>
            {FORM_LEAD_BAD_LEAD_REASON_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <Button
          type="button"
          variant={selectedReason ? "destructive" : "outline"}
          disabled={mutation.isPending || !canSubmit}
          onClick={(event) => {
            event.stopPropagation();
            mutation.mutate(selectedReason || null);
          }}
          className={compact ? "h-8 px-3 text-xs" : undefined}
        >
          {mutation.isPending ? "Saving..." : selectedReason ? "Mark Bad" : isMarkedBad ? "Clear Bad" : "Mark Bad"}
        </Button>
      </div>
      {compact && isMarkedBad ? (
        <span className="text-xs text-muted-foreground">{formatBadLead(currentBadLead)}</span>
      ) : null}
    </div>
  );
}

function WorkflowActions({
  uiResource,
  record,
  readOnly,
  onSaved,
}: {
  uiResource: UiResource;
  record: AdminRecord;
  readOnly?: boolean;
  onSaved?: () => void;
}) {
  if (readOnly) {
    return null;
  }
  const canBook = uiResource === "form-leads" || uiResource === "call-leads";
  const canCancel =
    (uiResource === "bookings" && !isReferralBooking(record)) ||
    uiResource === "form-leads" ||
    uiResource === "call-leads";
  if (!canBook && !canCancel) {
    return null;
  }
  const description =
    uiResource === "bookings"
      ? "Start a cancellation with the booking identifiers prefilled."
      : uiResource === "form-leads"
        ? "Book this lead (Mongo ID prefilled) or start a cancellation."
        : "Book this lead (job number and phone prefilled) or start a cancellation.";
  return (
    <DetailSection title="Workflow Actions" description={description}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {canBook ? (
            <Link
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-navy hover:text-white"
              href={`/bookings/new?${getBookingQuery(uiResource, record)}`}
            >
              <PlusCircle className="h-4 w-4" aria-hidden="true" />
              Book this lead
            </Link>
          ) : null}
          {canCancel ? (
            <Link
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
              href={`/cancellations/new?${getCancellationQuery(uiResource, record)}`}
            >
              <XCircle className="h-4 w-4" aria-hidden="true" />
              {uiResource === "bookings" ? "Cancel this booking" : "Start cancellation"}
            </Link>
          ) : null}
        </div>
        {uiResource === "form-leads" ? (
          <div className="rounded-md border bg-muted/30 p-3">
            <MarkBadLeadControl record={record} onSaved={onSaved} />
          </div>
        ) : null}
      </div>
    </DetailSection>
  );
}

function DetailPanel({
  config,
  resource,
  uiResource,
  selected,
  scope,
  filters,
  onClose,
  readOnly,
}: {
  config: ResourceConfig;
  resource: AdminResource;
  uiResource: UiResource;
  selected: AdminRecord | null;
  scope: DatabaseScope;
  filters: SerializableFilters;
  onClose: () => void;
  readOnly?: boolean;
}) {
  const id = selected ? getRecordId(selected) : "";
  const effectiveScope = scope === "combined" ? "production" : scope;
  const detailQuery = useQuery({
    queryKey: queryKeys.details.resource(resource, id, effectiveScope, filters),
    queryFn: () => fetchAdminDetail<AdminRecord>(resource, id, effectiveScope, filters),
    enabled: Boolean(id),
  });
  const record = detailQuery.data ?? selected;
  const isProduction = effectiveScope === "production";
  const editableResource =
    readOnly || resource === "agents" || isReferralBooking(record) ? null : resource;

  return (
    <SidePanel
      open={Boolean(selected)}
      onClose={onClose}
      title={`${config.title} Detail`}
      description={id ? `Mongo ID: ${id}` : undefined}
    >
      {detailQuery.isLoading ? <TableLoadingState label="Loading detail..." /> : null}
      {detailQuery.isError ? (
        <TableErrorState error={detailQuery.error instanceof Error ? detailQuery.error.message : undefined} />
      ) : null}
      {record ? (
        <div className="space-y-4">
          {effectiveScope === "historical" ? (
            <FeedbackMessage tone="warning">Historical records are read-only. Mutation actions are hidden.</FeedbackMessage>
          ) : null}
          <DetailSection title="Summary">
            <DetailGrid>
              {config.columns.map((column) => (
                <DetailItem key={column.key} label={column.label} value={formatCell(record, column)} />
              ))}
              <DetailItem label="Database scope" value={record.database_scope ?? effectiveScope} />
              <DetailItem label="Mongo ID" value={id} />
            </DetailGrid>
          </DetailSection>
          <DetailSection title="Linked Context" description="Populated values from the backend detail endpoint.">
            <DetailGrid>
              {["customer", "booked", "cancelled", "lead_ref", "booked_lead", "related_bookings", "related_cancellations", "recent_bookings"].map((key) => (
                <DetailItem key={key} label={key.replaceAll("_", " ")} value={formatPlain(getValue(record, key))} />
              ))}
            </DetailGrid>
          </DetailSection>
          {isProduction ? (
            <WorkflowActions
              uiResource={uiResource}
              record={record}
              readOnly={readOnly}
              onSaved={() => detailQuery.refetch()}
            />
          ) : null}
          {isProduction && editableResource ? (
            <DetailSection title="Edit Production Record" description="Only safe v1 fields are exposed here.">
              <EditForm
                config={config}
                record={record}
                resource={editableResource}
                uiResource={uiResource}
                onSaved={() => detailQuery.refetch()}
              />
            </DetailSection>
          ) : null}
          <DetailSection title="Raw Identifiers">
            <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs">
              {JSON.stringify(record, null, 2)}
            </pre>
          </DetailSection>
        </div>
      ) : null}
    </SidePanel>
  );
}

const hiddenTableColumnsByResource: Partial<Record<UiResource, Set<string>>> = {
  "form-leads": new Set(["first_name", "last_name", "email"]),
  "duplicate-form-leads": new Set(["first_name", "last_name", "email"]),
  "call-leads": new Set(["first_name", "last_name", "email"]),
};

const truncateTableColumns = new Set([
  "name",
  "customer",
  "phone",
  "email",
  "source",
  "merchant",
  "reason",
  "by",
]);

function getTableColumnClassName(column: ColumnConfig): string | undefined {
  switch (column.key) {
    case "timestamp":
    case "book_date":
    case "cancel_date":
    case "activity":
      return "min-w-28";
    case "name":
    case "customer":
      return "min-w-44";
    case "phone":
      return "min-w-32";
    case "source":
    case "merchant":
    case "move":
    case "reason":
      return "min-w-40";
    case "ref":
    case "job":
      return "min-w-36";
    case "binder":
    case "deposit":
    case "refund":
      return "min-w-28";
    default:
      return undefined;
  }
}

function buildColumns(
  config: ResourceConfig,
  filters: TableQueryParams,
  setSort: (field: string, direction: SortDirection) => void,
  resource: UiResource,
  isProduction: boolean,
): DataTableColumn<AdminRecord>[] {
  const hiddenColumns = hiddenTableColumnsByResource[resource];
  const columns: DataTableColumn<AdminRecord>[] = config.columns
    .filter((column) => !hiddenColumns?.has(column.key))
    .map((column) => ({
      key: column.key,
      header: column.sort ? (
        <SortableHeader
          field={column.sort}
          label={column.label}
          activeSort={filters.sort}
          direction={filters.direction}
          onSort={setSort}
        />
      ) : (
        column.label
      ),
      cell: (item) => formatCell(item, column),
      truncate: truncateTableColumns.has(column.key),
      className: getTableColumnClassName(column),
    }));

  const canBook =
    isProduction &&
    !config.readOnly &&
    (resource === "form-leads" || resource === "call-leads");
  if (canBook) {
    columns.unshift({
      key: "__book",
      header: "",
      className: "w-px",
      cell: (item) => (
        <Link
          href={`/bookings/new?${getBookingQuery(resource, item)}`}
          onClick={(event) => event.stopPropagation()}
          className="inline-flex h-8 items-center justify-center gap-1 rounded-md bg-primary px-3 text-xs font-semibold text-white hover:bg-navy hover:text-white"
        >
          <PlusCircle className="h-3.5 w-3.5" aria-hidden="true" />
          Book
        </Link>
      ),
    });
  }

  if (isProduction && !config.readOnly && resource === "form-leads") {
    columns.unshift({
      key: "__mark_bad",
      header: "Bad",
      className: "w-px",
      sticky: "left",
      cell: (item) => (
        <div onClick={(event) => event.stopPropagation()}>
          <MarkBadLeadControl record={item} compact />
        </div>
      ),
    });
  }

  const canCancel = isProduction && resource === "bookings";
  if (canCancel) {
    columns.unshift({
      key: "__cancel",
      header: "",
      className: "w-px",
      cell: (item) =>
        isReferralBooking(item) ? null : (
          <Link
            href={`/cancellations/new?${getCancellationQuery(resource, item)}`}
            onClick={(event) => event.stopPropagation()}
            className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-input bg-background px-3 text-xs font-semibold hover:bg-muted"
          >
            <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
            Cancel
          </Link>
        ),
    });
  }

  return columns;
}

function InfiniteTableFooter({
  shown,
  total,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: {
  shown: number;
  total?: number;
  hasNextPage?: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-background p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="text-muted-foreground">
        Showing {shown}
        {typeof total === "number" ? ` of ${total}` : null}
      </div>
      <Button variant="outline" disabled={!hasNextPage || isFetchingNextPage} onClick={onLoadMore}>
        {isFetchingNextPage ? "Loading..." : hasNextPage ? "Load more" : "All rows loaded"}
      </Button>
    </div>
  );
}

function BackToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > 600);
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <Button
      className="fixed bottom-5 right-5 z-40 gap-2 shadow-lg"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
    >
      <ArrowUp className="h-4 w-4" aria-hidden="true" />
      Back to top
    </Button>
  );
}

export function OperationalResourcePage({ resource }: { resource: UiResource }) {
  const baseConfig = operationalConfigs[resource];
  const adminResource = uiToAdminResource[resource];
  const { scope } = useDatabaseScope();
  const facetOptions = useFacetOptions(scope);
  const config = useMemo(
    () => withFacetOptions(baseConfig, facetOptions),
    [baseConfig, facetOptions],
  );
  const [selected, setSelected] = useState<AdminRecord | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const { filters, update, setSort, reset } = useUrlTableState({
    database_scope: scope,
    sort: config.defaultSort,
    direction: config.defaultDirection,
    date_field: config.dateField,
  });
  const effectiveFilters: SerializableFilters = {
    ...filters,
    ...config.fixedListFilters,
    database_scope: filters.database_scope === "combined" ? "production" : filters.database_scope,
    sort: filters.sort ?? config.defaultSort,
    direction: filters.direction ?? config.defaultDirection,
    date_field: filters.date_field ?? config.dateField,
  };
  const listFilters: SerializableFilters = {
    ...effectiveFilters,
    page: 1,
  };
  const readOnly = Boolean(config.readOnly) || effectiveFilters.database_scope === "historical";
  const query = useInfiniteQuery({
    queryKey: queryKeys.lists.resource(adminResource, listFilters),
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      fetchAdminList<AdminRecord>(adminResource, {
        ...listFilters,
        page: Number(pageParam),
      }),
    getNextPageParam: (lastPage) => (
      lastPage.has_next_page ? lastPage.page + 1 : undefined
    ),
  });
  const pages = query.data?.pages ?? [];
  const items = pages.flatMap((page) => page.items);
  const lastPage = pages[pages.length - 1];
  const isProduction = effectiveFilters.database_scope === "production";
  const columns = useMemo(
    () => buildColumns(config, filters, setSort, resource, isProduction),
    [config, filters, setSort, resource, isProduction],
  );

  function toggleFiltersCollapsed() {
    setFiltersCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(filtersSidebarStorageKey, String(next));
      return next;
    });
  }

  useEffect(() => {
    setFiltersCollapsed(window.localStorage.getItem(filtersSidebarStorageKey) === "true");
  }, []);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !query.hasNextPage) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && query.hasNextPage && !query.isFetchingNextPage) {
          query.fetchNextPage();
        }
      },
      { rootMargin: "400px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [query]);

  async function onExport() {
    setExportMessage(null);
    try {
      await downloadCsvFromProxy(adminExportUrl(adminResource, effectiveFilters), `${adminResource}.csv`);
      setExportMessage("CSV export downloaded and audit logged.");
    } catch (error) {
      setExportMessage(error instanceof Error ? error.message : "CSV export failed.");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{config.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{config.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {resource === "bookings" ? (
            <Link
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-navy hover:text-white"
              href="/bookings/new"
            >
                <PlusCircle className="h-4 w-4" aria-hidden="true" />
                New booking
            </Link>
          ) : null}
          {resource === "cancellations" ? (
            <Link
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-navy hover:text-white"
              href="/cancellations/new"
            >
                <PlusCircle className="h-4 w-4" aria-hidden="true" />
                New cancellation
            </Link>
          ) : null}
          <Button variant="outline" onClick={onExport}>
            <Download className="mr-2 h-4 w-4" aria-hidden="true" />
            Export CSV
          </Button>
        </div>
      </div>

      {exportMessage ? <FeedbackMessage>{exportMessage}</FeedbackMessage> : null}
      {effectiveFilters.database_scope === "historical" ? (
        <FeedbackMessage tone="warning">Historical mode is read-only. Edit and workflow actions are hidden.</FeedbackMessage>
      ) : null}
      {config.readOnly ? (
        <FeedbackMessage tone="warning">
          Duplicate form leads are read-only. Booking, cancellation, and edit actions are hidden.
        </FeedbackMessage>
      ) : null}

      <div
        className={cn(
          "grid gap-5 transition-[grid-template-columns] duration-200",
          filtersCollapsed ? "xl:grid-cols-[4rem_minmax(0,1fr)]" : "xl:grid-cols-[18rem_minmax(0,1fr)]",
        )}
      >
        <OperationalFilterPanel
          config={config}
          filters={filters}
          update={update}
          reset={reset}
          collapsed={filtersCollapsed}
          onToggleCollapsed={toggleFiltersCollapsed}
        />

        <div className="min-w-0 space-y-4">
          <div className="hidden rounded-lg border bg-background p-3 xl:block">
            <ActiveFilterChips config={config} filters={filters} update={update} reset={reset} />
          </div>

          {isProduction && !readOnly && (resource === "form-leads" || resource === "call-leads" || resource === "bookings") ? (
            <div className="rounded-lg border bg-background p-3 text-sm">
              {resource === "bookings"
                ? "Select a booking row to inspect it, or use the row detail to start a cancellation."
                : "Select a lead row to inspect it, then start a booking with identifiers prefilled."}
            </div>
          ) : null}

          {query.isLoading ? <TableLoadingState /> : null}
          {query.isError ? (
            <TableErrorState error={query.error instanceof Error ? query.error.message : undefined} onRetry={() => query.refetch()} />
          ) : null}
          {query.data && items.length === 0 ? <TableEmptyState /> : null}
          {items.length > 0 ? (
            <>
              <DataTable
                items={items}
                columns={columns}
                getRowKey={getRecordId}
                onRowClick={setSelected}
                stickyHeader
                compact
                horizontalControls
              />
              <div ref={loadMoreRef} aria-hidden="true" />
              <InfiniteTableFooter
                shown={items.length}
                total={lastPage?.total}
                hasNextPage={query.hasNextPage}
                isFetchingNextPage={query.isFetchingNextPage}
                onLoadMore={() => query.fetchNextPage()}
              />
            </>
          ) : null}
        </div>
      </div>

      {selected && isProduction && !readOnly ? (
        <div className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 gap-2 rounded-lg border bg-background p-2 shadow-lg">
          {(resource === "form-leads" || resource === "call-leads") ? (
            <Link
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-navy hover:text-white"
              href={`/bookings/new?${getBookingQuery(resource, selected)}`}
            >
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Start booking
            </Link>
          ) : null}
          {((resource === "bookings" && !isReferralBooking(selected)) || resource === "form-leads" || resource === "call-leads") ? (
            <Link
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
              href={`/cancellations/new?${getCancellationQuery(resource, selected)}`}
            >
                <XCircle className="h-4 w-4" aria-hidden="true" />
                Start cancellation
            </Link>
          ) : null}
          <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
        </div>
      ) : null}

      <DetailPanel
        config={config}
        resource={adminResource}
        uiResource={resource}
        selected={selected}
        scope={effectiveFilters.database_scope as DatabaseScope}
        filters={effectiveFilters}
        onClose={() => setSelected(null)}
        readOnly={readOnly}
      />
      <BackToTopButton />
    </div>
  );
}

export { resourceLabels };
