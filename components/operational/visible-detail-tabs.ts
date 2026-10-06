import { hasAttachedCancellation, isReferralBooking, relatedNavLinksFor } from "@/components/operational/operational-helpers";
import type { AdminRecord, UiResource } from "@/lib/api/admin";

export const DETAIL_TAB_KEYS = [
  "summary",
  "contact",
  "cancellation",
  "message",
  "actions",
  "production",
  "source",
] as const;

export type DetailTabKey = (typeof DETAIL_TAB_KEYS)[number];

export type VisibleDetailTabsContext = {
  readOnly: boolean;
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
    return !ctx.readOnly;
  }
  if (uiResource === "bookings") {
    return bookingHasActionContent(record, ctx.readOnly);
  }
  return false;
}

function includeProduction(uiResource: UiResource, ctx: VisibleDetailTabsContext): boolean {
  if (uiResource === "duplicate-form-leads" || uiResource === "duplicate-call-leads") {
    return false;
  }
  if (uiResource === "bookings" || uiResource === "cancellations") {
    return ctx.productionEditAllowed || ctx.canDelete;
  }
  return ctx.productionEditAllowed;
}

export function visibleDetailTabs(
  uiResource: UiResource,
  record: AdminRecord,
  ctx: VisibleDetailTabsContext,
): DetailTabKey[] {
  const tabs: DetailTabKey[] = ["summary", "contact"];
  // A cancelled booking shows its cancellation (doc 03 booking panel); the cancellation card links here.
  if (uiResource === "bookings" && hasAttachedCancellation(record)) {
    tabs.push("cancellation");
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
  tabs.push("source");
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
  options: { readOnly?: boolean },
): boolean {
  if (options.readOnly) {
    return false;
  }
  if (uiResource === "duplicate-form-leads" || uiResource === "duplicate-call-leads") {
    return false;
  }
  if (isReferralBooking(record)) {
    return false;
  }
  return true;
}
