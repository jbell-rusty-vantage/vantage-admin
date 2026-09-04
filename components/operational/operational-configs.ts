import type { AdminRecord, UiResource } from "@/lib/api/admin";
import type { SerializableFilters } from "@/lib/api/filters";
import type { DatabaseScope, SelectOption, SortDirection } from "@/lib/api/types";
import {
  CANCELLATION_REASON_OPTIONS,
  LOCAL_TYPE_OPTIONS,
  MOVE_SIZE_OPTIONS,
  SOURCE_COMPANY_OPTIONS,
  SOURCE_LABEL_OPTIONS,
} from "@/lib/constants/domain";

export type FieldType = "text" | "date" | "number" | "textarea" | "select" | "boolean";

export type ColumnConfig = {
  key: string;
  label: string;
  path: string;
  sort?: string;
  format?: "date" | "money" | "boolean" | "scope" | "badges" | "rate";
};

export type FilterConfig = {
  key: string;
  label: string;
  type: Exclude<FieldType, "textarea">;
  options?: readonly SelectOption<string>[];
};

export type EditFieldConfig = {
  key: string;
  label: string;
  type: FieldType;
  options?: readonly SelectOption<string>[];
};

export type DateSortConfig = {
  field: string;
  label: string;
};

export type ResourceConfig = {
  uiResource: UiResource;
  title: string;
  description: string;
  defaultSort: string;
  defaultDirection: SortDirection;
  dateField: string;
  dateSort?: DateSortConfig;
  columns: ColumnConfig[];
  filters: FilterConfig[];
  editFields: EditFieldConfig[];
  fixedListFilters?: SerializableFilters;
  readOnly?: boolean;
};

export type DeleteTarget = {
  resource: Extract<UiResource, "bookings" | "cancellations">;
  record: AdminRecord;
};

export type DeleteDialogCopy = {
  title: string;
  description: string;
  bullets: string[];
  confirmLabel: string;
};

const yesNoOptions: SelectOption<string>[] = [
  { value: "true", label: "Yes" },
  { value: "false", label: "No" },
];

const formLeadColumns: ColumnConfig[] = [
  { key: "timestamp", label: "Created", path: "timestamp", sort: "timestamp", format: "date" },
  { key: "name", label: "Name", path: "name", sort: "name" },
  { key: "ref", label: "Ref", path: "ref_no", sort: "ref_no" },
  { key: "job", label: "Job", path: "job_no", sort: "job_no" },
  { key: "source", label: "Source Company", path: "source_company", sort: "source_company" },
  { key: "first_name", label: "First", path: "first_name" },
  { key: "last_name", label: "Last", path: "last_name" },
  { key: "phone", label: "Phone", path: "phone_number" },
  { key: "granot_contact", label: "Granot contact", path: "granot_contact_snapshot" },
  { key: "email", label: "Email", path: "email" },
  { key: "pickup_city", label: "Pickup City", path: "pickup_city" },
  { key: "delivery_city", label: "Delivery City", path: "delivery_city" },
  { key: "move", label: "Move", path: "move_size" },
  { key: "bad_lead", label: "Bad Lead", path: "bad_lead" },
  { key: "sms_message_sent", label: "SMS Sent", path: "sms_message_sent", format: "boolean" },
  { key: "booked", label: "Booked", path: "booked", format: "boolean" },
  { key: "cancelled", label: "Cancelled", path: "cancelled", format: "boolean" },
];

const formLeadFilters: FilterConfig[] = [
  { key: "source_granularity_key", label: "Source Company", type: "select" },
  { key: "receiver_agent", label: "Receiver agent", type: "select" },
  { key: "name", label: "Name", type: "text" },
  { key: "email", label: "Email", type: "text" },
  { key: "phone_number", label: "Phone", type: "text" },
  { key: "ref_no", label: "Ref number", type: "text" },
  { key: "booked", label: "Booked", type: "select", options: yesNoOptions },
  { key: "cancelled", label: "Cancelled", type: "select", options: yesNoOptions },
  {
    key: "past_move_date",
    label: "Move date before created",
    type: "select",
    options: yesNoOptions,
  },
  { key: "move_size", label: "Move size", type: "select", options: MOVE_SIZE_OPTIONS },
];

const formLeadEditFields: EditFieldConfig[] = [
  {
    key: "receiver_agent",
    label: "Sales Rep",
    type: "select",
  },
  {
    key: "source_granularity_key",
    label: "Source Company",
    type: "select",
  },
  { key: "name", label: "Name", type: "text" },
  { key: "first_name", label: "First name", type: "text" },
  { key: "last_name", label: "Last name", type: "text" },
  { key: "timestamp", label: "Created", type: "date" },
  { key: "pickup_city", label: "Pickup city", type: "text" },
  { key: "pickup_zip", label: "Pickup zip", type: "text" },
  { key: "delivery_city", label: "Delivery city", type: "text" },
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

const callLeadColumns: ColumnConfig[] = [
  { key: "timestamp", label: "Created", path: "timestamp", sort: "timestamp", format: "date" },
  { key: "name", label: "Name", path: "name", sort: "name" },
  { key: "job", label: "Job", path: "job_no", sort: "job_no" },
  { key: "source", label: "Source Company", path: "source_company", sort: "source_company" },
  { key: "first_name", label: "First", path: "first_name" },
  { key: "last_name", label: "Last", path: "last_name" },
  { key: "phone", label: "Phone", path: "phone_number" },
  { key: "granot_contact", label: "Granot contact", path: "granot_contact_snapshot" },
  { key: "email", label: "Email", path: "email" },
  { key: "pickup_city", label: "Pickup City", path: "pickup_city" },
  { key: "delivery_city", label: "Delivery City", path: "delivery_city" },
  { key: "local", label: "Local", path: "local" },
  { key: "booked", label: "Booked", path: "booked", format: "boolean" },
  { key: "cancelled", label: "Cancelled", path: "cancelled", format: "boolean" },
];

const callLeadFilters: FilterConfig[] = [
  { key: "source_granularity_key", label: "Source Company", type: "select" },
  { key: "receiver_agent", label: "Receiver agent", type: "select" },
  { key: "name", label: "Name", type: "text" },
  { key: "email", label: "Email", type: "text" },
  { key: "phone_number", label: "Phone", type: "text" },
  { key: "job_no", label: "Job number", type: "text" },
  { key: "booked", label: "Booked", type: "select", options: yesNoOptions },
  { key: "cancelled", label: "Cancelled", type: "select", options: yesNoOptions },
  { key: "local", label: "Local type", type: "select", options: LOCAL_TYPE_OPTIONS },
];

const callLeadEditFields: EditFieldConfig[] = [
  {
    key: "receiver_agent",
    label: "Sales Rep",
    type: "select",
  },
  {
    key: "source_granularity_key",
    label: "Source Company",
    type: "select",
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
  { key: "pickup_city", label: "Pickup city", type: "text" },
  { key: "pickup_zip", label: "Pickup zip", type: "text" },
  { key: "delivery_city", label: "Delivery city", type: "text" },
  { key: "delivery_zip", label: "Delivery zip", type: "text" },
  { key: "pickup_state", label: "Pickup state", type: "text" },
  { key: "delivery_state", label: "Delivery state", type: "text" },
  { key: "cubic_feet", label: "Cubic feet", type: "number" },
];

export const operationalConfigs: Record<UiResource, ResourceConfig> = {
  "form-leads": {
    uiResource: "form-leads",
    title: "Form Leads",
    description: "Browse, inspect, edit, export, and book web form leads.",
    defaultSort: "timestamp",
    defaultDirection: "desc",
    dateField: "timestamp",
    dateSort: { field: "timestamp", label: "Timestamp" },
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
    dateSort: { field: "timestamp", label: "Timestamp" },
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
    dateSort: { field: "timestamp", label: "Timestamp" },
    fixedListFilters: { duplicate: false },
    columns: callLeadColumns,
    filters: callLeadFilters,
    editFields: callLeadEditFields,
  },
  "duplicate-call-leads": {
    uiResource: "duplicate-call-leads",
    title: "Duplicate Call Leads",
    description: "Browse and inspect quarantined duplicate inbound call leads.",
    defaultSort: "timestamp",
    defaultDirection: "desc",
    dateField: "timestamp",
    dateSort: { field: "timestamp", label: "Timestamp" },
    fixedListFilters: { duplicate: true },
    readOnly: true,
    columns: callLeadColumns,
    filters: callLeadFilters,
    editFields: [],
  },
  bookings: {
    uiResource: "bookings",
    title: "Bookings",
    description: "Browse bookings, edit production booking details, and start cancellations.",
    defaultSort: "book_date",
    defaultDirection: "desc",
    dateField: "book_date",
    dateSort: { field: "book_date", label: "Book Date" },
    columns: [
      { key: "book_date", label: "Book Date", path: "book_date", sort: "book_date", format: "date" },
      { key: "job", label: "Job", path: "job_no", sort: "job_no" },
      { key: "customer", label: "Customer", path: "customer.full_name" },
      { key: "phone", label: "Phone", path: "customer.phone_number" },
      { key: "stored_lead", label: "Stored lead", path: "lead_ref" },
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
      { key: "leadless", label: "Leadless", type: "select", options: yesNoOptions },
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
    dateSort: { field: "book_date", label: "Book Date" },
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
    description:
      "Booking performance for the selected date range (book date), not Agent created-at.",
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
      { key: "rate", label: "Cancel Rate", path: "cancellation_rate", format: "rate" },
    ],
    filters: [
      { key: "name", label: "Name", type: "text" },
      { key: "active", label: "Active", type: "select", options: yesNoOptions },
      { key: "role", label: "Role", type: "text" },
    ],
    editFields: [],
  },
};

export function withFacetOptions(config: ResourceConfig, options: {
  agentOptions: readonly SelectOption[];
  agentIdOptions: readonly SelectOption[];
  merchantOptions: readonly SelectOption[];
  sourceCompanyOptions: readonly SelectOption[];
  sourceOptions: readonly SelectOption[];
  formSourceOptions: readonly SelectOption[];
  callSourceOptions: readonly SelectOption[];
  sourceGranularityOptions: readonly SelectOption[];
  scope: DatabaseScope;
}): ResourceConfig {
  const applyOptions = <TField extends FilterConfig | EditFieldConfig>(field: TField): TField => {
    if (field.key === "agent") {
      return { ...field, options: options.agentOptions } as TField;
    }
    if (field.key === "receiver_agent") {
      return { ...field, options: options.agentIdOptions } as TField;
    }
    if (field.key === "merchant") {
      return { ...field, options: options.merchantOptions } as TField;
    }
    if (field.key === "source_granularity_key") {
      const channelOptions =
        config.uiResource === "call-leads" || config.uiResource === "duplicate-call-leads"
          ? options.callSourceOptions
          : options.formSourceOptions;
      return { ...field, options: channelOptions } as TField;
    }
    return field;
  };
  return {
    ...config,
    filters: config.filters
      .filter((field) => !(options.scope === "historical" && field.key === "receiver_agent"))
      .map(applyOptions),
    editFields: config.editFields.map(applyOptions),
  };
}
