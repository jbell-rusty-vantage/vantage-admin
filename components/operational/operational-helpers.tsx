import type { useQueryClient } from "@tanstack/react-query";
import { formatDate as formatCalendarDate } from "@/components/data-table/formatters";
import { StatusBadge } from "@/components/data-table/status-badge";
import { getRelatedNavLinks, type RelatedNavLink } from "@/components/operational/related-record-nav";
import type { DeleteTarget } from "@/components/operational/operational-configs";
import type { AdminRecord, UiResource } from "@/lib/api/admin";
import { queryKeys } from "@/lib/query/keys";

export function getValue(record: AdminRecord, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (current && typeof current === "object" && key in current) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, record);
}

export function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function isReferralBooking(record: AdminRecord | null | undefined): boolean {
  return record?.is_referral_booking === true;
}

export function isDeleteResource(resource: UiResource): resource is DeleteTarget["resource"] {
  return resource === "bookings" || resource === "cancellations";
}

export function hasAttachedCancellation(record: AdminRecord): boolean {
  return Boolean(getValue(record, "cancelled"));
}

export function isLeadResource(resource: UiResource): boolean {
  return (
    resource === "form-leads" ||
    resource === "duplicate-form-leads" ||
    resource === "call-leads" ||
    resource === "duplicate-call-leads"
  );
}

export function supportsRelatedNav(
  resource: UiResource,
): resource is
  | "form-leads"
  | "duplicate-form-leads"
  | "call-leads"
  | "duplicate-call-leads"
  | "bookings"
  | "cancellations" {
  return (
    isLeadResource(resource) || resource === "bookings" || resource === "cancellations"
  );
}

export function relatedNavLinksFor(resource: UiResource, record: AdminRecord): RelatedNavLink[] {
  if (!supportsRelatedNav(resource)) {
    return [];
  }
  return getRelatedNavLinks(resource, record);
}

export async function invalidateOperationalMutations(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.lists.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.details.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.search.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.auditLog.all }),
  ]);
}

export function formatDate(value: unknown): string {
  if (!value) {
    return "-";
  }
  const formatted = formatCalendarDate(String(value));
  return formatted === "-" ? String(value) : formatted;
}

export function formatMoney(value: unknown): string {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) {
    return "-";
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(number);
}

export function formatRate(value: unknown): string {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) {
    return "-";
  }
  return `${(number * 100).toFixed(1)}%`;
}

export function formatPlain(value: unknown): React.ReactNode {
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

export function isLeadRecordWithSourceMetadata(record: AdminRecord): boolean {
  return Boolean(
    getValue(record, "lead_source_company") ||
      getValue(record, "source_granularity_id") ||
      getValue(record, "source_granularity_key") ||
      getValue(record, "source_company_label_snapshot") ||
      getValue(record, "source_granularity_label_snapshot") ||
      getValue(record, "crm_source_label_snapshot"),
  );
}
