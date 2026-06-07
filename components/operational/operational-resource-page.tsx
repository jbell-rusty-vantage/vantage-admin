"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Pencil, PlusCircle, XCircle } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/data-table/table-shell";
import { PaginationControls } from "@/components/data-table/pagination-controls";
import { SortableHeader } from "@/components/data-table/sortable-header";
import { StatusBadge } from "@/components/data-table/status-badge";
import { TableEmptyState, TableErrorState, TableLoadingState } from "@/components/data-table/table-states";
import { DateRangeFilter } from "@/components/filters/date-range-filter";
import { FilterBar } from "@/components/filters/filter-bar";
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
  updateProductionRecord,
  type AdminRecord,
  type AdminResource,
  type UiResource,
} from "@/lib/api/admin";
import { downloadCsvFromProxy } from "@/lib/api/csv";
import { useFacetOptions } from "@/lib/api/facets";
import type { SerializableFilters } from "@/lib/api/filters";
import { useUrlTableState } from "@/lib/api/url-state";
import { useDatabaseScope } from "@/lib/state/database-scope";
import type { DatabaseScope, SelectOption, SortDirection, TableQueryParams } from "@/lib/api/types";
import {
  CALL_LEAD_SOURCE_LABEL_OPTIONS,
  CANCELLATION_REASON_OPTIONS,
  FORM_LEAD_SOURCE_LABEL_OPTIONS,
  getCallLeadSourceLabel,
  getFormLeadSourceLabel,
  LOCAL_TYPE_OPTIONS,
  MOVE_SIZE_OPTIONS,
  SOURCE_COMPANY_OPTIONS,
  SOURCE_LABEL_OPTIONS,
} from "@/lib/constants/domain";
import { queryKeys } from "@/lib/query/keys";

type FieldType = "text" | "date" | "number" | "textarea" | "select" | "boolean";

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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.lists.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.details.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.search.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.auditLog.all }),
      ]);
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

function WorkflowActions({
  uiResource,
  record,
  readOnly,
}: {
  uiResource: UiResource;
  record: AdminRecord;
  readOnly?: boolean;
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
          {isProduction ? <WorkflowActions uiResource={uiResource} record={record} readOnly={readOnly} /> : null}
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

function buildColumns(
  config: ResourceConfig,
  filters: TableQueryParams,
  setSort: (field: string, direction: SortDirection) => void,
  resource: UiResource,
  isProduction: boolean,
): DataTableColumn<AdminRecord>[] {
  const columns: DataTableColumn<AdminRecord>[] = config.columns.map((column) => ({
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
  const { filters, update, setSort, setPage, setLimit, reset } = useUrlTableState({
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
  const readOnly = Boolean(config.readOnly) || effectiveFilters.database_scope === "historical";
  const query = useQuery({
    queryKey: queryKeys.lists.resource(adminResource, effectiveFilters),
    queryFn: () => fetchAdminList<AdminRecord>(adminResource, effectiveFilters),
  });
  const isProduction = effectiveFilters.database_scope === "production";
  const columns = useMemo(
    () => buildColumns(config, filters, setSort, resource, isProduction),
    [config, filters, setSort, resource, isProduction],
  );

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

      <FilterBar onReset={reset}>
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
      </FilterBar>

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
      {query.data && query.data.items.length === 0 ? <TableEmptyState /> : null}
      {query.data && query.data.items.length > 0 ? (
        <>
          <DataTable items={query.data.items} columns={columns} getRowKey={getRecordId} onRowClick={setSelected} />
          <PaginationControls
            page={filters.page}
            limit={filters.limit}
            total={query.data.total}
            hasNextPage={query.data.has_next_page}
            onPageChange={setPage}
            onLimitChange={setLimit}
          />
        </>
      ) : null}

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
    </div>
  );
}

export { resourceLabels };
