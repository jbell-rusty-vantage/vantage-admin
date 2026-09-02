import { formatBadLead } from "@/components/operational/mark-bad-lead-control";
import { OPERATIONAL_COPY } from "@/components/operational/operational-copy";
import {
  getValue,
  isDeleteResource,
  isReferralBooking,
  relatedNavLinksFor,
  stringValue,
} from "@/components/operational/operational-helpers";
import type { RelatedNavLink } from "@/components/operational/related-record-nav";
import type { AdminRecord, UiResource } from "@/lib/api/admin";

export type RowIdentity = {
  primary: string;
  secondary?: string;
};

export type RowStatusChipKey = "booked" | "cancelled" | "bad_lead" | "lead_message_sent";

export type RowStatusChip = {
  key: RowStatusChipKey;
  label: string;
  tone: "success" | "warning" | "destructive" | "default";
};

export type RowActionClusterContext = {
  isProduction: boolean;
  readOnly: boolean;
  canDelete: boolean;
};

export type RowActionCluster = {
  book: boolean;
  badLead: boolean;
  cancel: boolean;
  delete: boolean;
  related: RelatedNavLink[];
};

const LEAD_RESOURCES = new Set<UiResource>([
  "form-leads",
  "duplicate-form-leads",
  "call-leads",
  "duplicate-call-leads",
]);

const FORM_LEAD_RESOURCES = new Set<UiResource>(["form-leads", "duplicate-form-leads"]);

function isPresent(value: unknown): boolean {
  if (value === true) {
    return true;
  }
  if (value === false || value == null || value === "") {
    return false;
  }
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  if (typeof value === "object") {
    return true;
  }
  return Boolean(value);
}

function customerName(record: AdminRecord): string {
  return (
    stringValue(getValue(record, "customer.full_name")) ??
    stringValue(getValue(record, "customer_name")) ??
    "-"
  );
}

function customerPhone(record: AdminRecord): string | undefined {
  return (
    stringValue(getValue(record, "customer.phone_number")) ??
    stringValue(getValue(record, "customer_phone"))
  );
}

export function rowIdentity(resource: UiResource, record: AdminRecord): RowIdentity {
  if (LEAD_RESOURCES.has(resource)) {
    return {
      primary: stringValue(getValue(record, "name")) ?? "-",
      secondary: stringValue(getValue(record, "phone_number")),
    };
  }
  if (resource === "bookings" || resource === "cancellations") {
    return {
      primary: customerName(record),
      secondary: customerPhone(record),
    };
  }
  if (resource === "customers") {
    return {
      primary: stringValue(getValue(record, "full_name")) ?? "-",
      secondary: stringValue(getValue(record, "phone_number")),
    };
  }
  if (resource === "agents") {
    return {
      primary: stringValue(getValue(record, "name")) ?? "-",
      secondary: stringValue(getValue(record, "role")),
    };
  }
  return { primary: "-" };
}

export function rowStatusChips(resource: UiResource, record: AdminRecord): RowStatusChip[] {
  const chips: RowStatusChip[] = [];
  const copy = OPERATIONAL_COPY.row;

  if (LEAD_RESOURCES.has(resource) || resource === "bookings") {
    if (isPresent(record.booked) && resource !== "bookings") {
      chips.push({ key: "booked", label: copy.booked, tone: "success" });
    }
    if (isPresent(record.cancelled)) {
      chips.push({ key: "cancelled", label: copy.cancelled, tone: "destructive" });
    }
  }

  if (FORM_LEAD_RESOURCES.has(resource)) {
    const badLeadLabel = formatBadLead(record.bad_lead);
    if (badLeadLabel) {
      chips.push({ key: "bad_lead", label: badLeadLabel, tone: "warning" });
    }
    if (record.sms_message_sent === true) {
      chips.push({ key: "lead_message_sent", label: copy.leadMessageSent, tone: "default" });
    }
  }

  return chips;
}

export function rowActionCluster(
  resource: UiResource,
  record: AdminRecord,
  ctx: RowActionClusterContext,
): RowActionCluster {
  const related = relatedNavLinksFor(resource, record);
  const mutationsOpen = ctx.isProduction && !ctx.readOnly;
  const bookable = resource === "form-leads" || resource === "call-leads";

  return {
    book: mutationsOpen && bookable && !isPresent(record.booked),
    badLead: mutationsOpen && resource === "form-leads",
    cancel: mutationsOpen && resource === "bookings" && !isReferralBooking(record),
    delete: ctx.canDelete && ctx.isProduction && isDeleteResource(resource),
    related,
  };
}

export function rowActionClusterHasItems(cluster: RowActionCluster): boolean {
  return cluster.book || cluster.badLead || cluster.cancel || cluster.delete || cluster.related.length > 0;
}

export function resourceShowsStatusChips(resource: UiResource): boolean {
  return LEAD_RESOURCES.has(resource) || resource === "bookings";
}

export function resourceShowsActionsCluster(resource: UiResource): boolean {
  return (
    LEAD_RESOURCES.has(resource) || resource === "bookings" || resource === "cancellations"
  );
}

export function isIdentityColumnKey(resource: UiResource, key: string): boolean {
  if (resource === "bookings" || resource === "cancellations") {
    return key === "customer";
  }
  return key === "name";
}
