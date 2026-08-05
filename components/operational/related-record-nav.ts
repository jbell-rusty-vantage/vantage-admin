/**
 * Pure helpers that resolve cross-links between leads, bookings, and
 * cancellations for the operational list/detail views.
 */

import { entityHref } from "@/components/observational/entity-link";

export type RelatedNavLink = {
  href: string;
  label: string;
};

type RelatedNavResource =
  | "form-leads"
  | "duplicate-form-leads"
  | "call-leads"
  | "duplicate-call-leads"
  | "bookings"
  | "cancellations";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Accepts a populated doc, bare ObjectId string, or nullish. */
export function relatedRecordId(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (!isRecord(value)) {
    return null;
  }
  const id = value._id ?? value.id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

export function leadModelToEntityType(leadModel: unknown): "form_lead" | "call_lead" | null {
  if (leadModel === "FormLead") {
    return "form_lead";
  }
  if (leadModel === "CallLead") {
    return "call_lead";
  }
  return null;
}

function isLeadResource(resource: RelatedNavResource): boolean {
  return (
    resource === "form-leads" ||
    resource === "duplicate-form-leads" ||
    resource === "call-leads" ||
    resource === "duplicate-call-leads"
  );
}

/**
 * Returns the primary cross-nav links for a row/detail panel:
 * - Lead → Booking
 * - Booking → Lead
 * - Cancellation → Booking
 */
export function getRelatedNavLinks(
  resource: RelatedNavResource,
  record: Record<string, unknown>,
): RelatedNavLink[] {
  const links: RelatedNavLink[] = [];

  if (isLeadResource(resource)) {
    const href = entityHref("booked_lead", relatedRecordId(record.booked));
    if (href) {
      links.push({ href, label: "View booking" });
    }
  }

  if (resource === "bookings") {
    const href = entityHref(
      leadModelToEntityType(record.lead_model),
      relatedRecordId(record.lead_ref),
    );
    if (href) {
      links.push({ href, label: "View lead" });
    }
  }

  if (resource === "cancellations") {
    const href = entityHref("booked_lead", relatedRecordId(record.booked_lead));
    if (href) {
      links.push({ href, label: "View booking" });
    }
  }

  return links;
}

/** Clickable Linked Context value for a known relation key, or null if not linkable. */
export function linkedContextHref(
  resource: RelatedNavResource,
  key: string,
  record: Record<string, unknown>,
): string | null {
  if (key === "booked" && isLeadResource(resource)) {
    return entityHref("booked_lead", relatedRecordId(record.booked));
  }
  if (key === "lead_ref" && (resource === "bookings" || resource === "cancellations")) {
    return entityHref(
      leadModelToEntityType(record.lead_model),
      relatedRecordId(record.lead_ref),
    );
  }
  if (key === "booked_lead" && resource === "cancellations") {
    return entityHref("booked_lead", relatedRecordId(record.booked_lead));
  }
  if (key === "customer") {
    return entityHref("customer", relatedRecordId(record.customer));
  }
  if (key === "cancelled" && (isLeadResource(resource) || resource === "bookings")) {
    return entityHref("cancelled_lead", relatedRecordId(record.cancelled));
  }
  return null;
}
