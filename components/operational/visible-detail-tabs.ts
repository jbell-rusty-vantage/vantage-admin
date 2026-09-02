import { isReferralBooking, relatedNavLinksFor } from "@/components/operational/operational-helpers";
import type { AdminRecord, UiResource } from "@/lib/api/admin";
import type { DatabaseScope } from "@/lib/api/types";

export const DETAIL_TAB_KEYS = [
  "summary",
  "contact",
  "message",
  "actions",
  "production",
  "source",
] as const;

export type DetailTabKey = (typeof DETAIL_TAB_KEYS)[number];

export type VisibleDetailTabsContext = {
  readOnly: boolean;
  database_scope: DatabaseScope;
  canDelete: boolean;
  productionEditAllowed: boolean;
};

const LEAD_RESOURCES = new Set<UiResource>([
  "form-leads",
  "duplicate-form-leads",
  "call-leads",
  "duplicate-call-leads",
]);

export function isDetailTabKey(value: string | undefined): value is DetailTabKey {
  return Boolean(value && (DETAIL_TAB_KEYS as readonly string[]).includes(value));
}

export function isLeadUiResource(resource: UiResource): boolean {
  return LEAD_RESOURCES.has(resource);
}

function isProductionScope(scope: DatabaseScope): boolean {
  return scope === "production";
}

function bookingHasActionContent(record: AdminRecord, readOnly: boolean): boolean {
  const canCancel = !readOnly && !isReferralBooking(record);
  const hasRelated = relatedNavLinksFor("bookings", record).length > 0;
  return canCancel || hasRelated;
}

function includeActions(
  uiResource: UiResource,
  record: AdminRecord,
  ctx: VisibleDetailTabsContext,
): boolean {
  if (uiResource === "form-leads" || uiResource === "call-leads") {
    return isProductionScope(ctx.database_scope) && !ctx.readOnly;
  }
  if (uiResource === "bookings") {
    return isProductionScope(ctx.database_scope) && bookingHasActionContent(record, ctx.readOnly);
  }
  return false;
}

function includeProduction(uiResource: UiResource, ctx: VisibleDetailTabsContext): boolean {
  if (
    uiResource === "agents" ||
    uiResource === "duplicate-form-leads" ||
    uiResource === "duplicate-call-leads"
  ) {
    return false;
  }
  if (uiResource === "bookings" || uiResource === "cancellations") {
    return ctx.productionEditAllowed || ctx.canDelete;
  }
  return ctx.productionEditAllowed;
}

function includeSource(uiResource: UiResource): boolean {
  return isLeadUiResource(uiResource) || uiResource === "bookings" || uiResource === "cancellations";
}

export function visibleDetailTabs(
  uiResource: UiResource,
  record: AdminRecord,
  ctx: VisibleDetailTabsContext,
): DetailTabKey[] {
  const tabs: DetailTabKey[] = ["summary"];
  if (uiResource !== "agents") {
    tabs.push("contact");
  }
  if (uiResource === "form-leads" || uiResource === "duplicate-form-leads") {
    tabs.push("message");
  }
  if (includeActions(uiResource, record, ctx)) {
    tabs.push("actions");
  }
  if (includeProduction(uiResource, ctx)) {
    tabs.push("production");
  }
  if (includeSource(uiResource)) {
    tabs.push("source");
  }
  return tabs;
}

export function resolveActivePanel(
  visible: readonly DetailTabKey[],
  requested: string | undefined,
  options: { connect?: boolean; uiResource: UiResource },
): DetailTabKey {
  if (isDetailTabKey(requested) && visible.includes(requested)) {
    return requested;
  }
  if (
    options.connect &&
    options.uiResource === "bookings" &&
    visible.includes("contact")
  ) {
    return "contact";
  }
  return visible.includes("summary") ? "summary" : (visible[0] ?? "summary");
}

export function productionEditAllowedFor(
  uiResource: UiResource,
  record: AdminRecord | null,
  options: { readOnly?: boolean; database_scope: DatabaseScope },
): boolean {
  if (options.readOnly) {
    return false;
  }
  if (options.database_scope !== "production") {
    return false;
  }
  if (uiResource === "agents" || uiResource === "duplicate-form-leads" || uiResource === "duplicate-call-leads") {
    return false;
  }
  if (isReferralBooking(record)) {
    return false;
  }
  return true;
}
