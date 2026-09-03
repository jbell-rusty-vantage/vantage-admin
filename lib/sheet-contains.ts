import type { UiResource } from "@/lib/api/admin";

export const SHEET_CONTAINS_RESOURCES = [
  "form-leads",
  "duplicate-form-leads",
  "call-leads",
  "duplicate-call-leads",
  "bookings",
  "cancellations",
] as const;

export type SheetContainsResource = (typeof SHEET_CONTAINS_RESOURCES)[number];

export type SheetContainsEntityModel = "FormLead" | "CallLead" | "BookedLead" | "CancelledLead";

export const SHEET_CONTAINS_MAX_IDS = 25;

export function isSheetContainsResource(resource: UiResource): resource is SheetContainsResource {
  return (SHEET_CONTAINS_RESOURCES as readonly string[]).includes(resource);
}

export function sheetContainsEntityModel(resource: SheetContainsResource): SheetContainsEntityModel {
  switch (resource) {
    case "form-leads":
    case "duplicate-form-leads":
      return "FormLead";
    case "call-leads":
    case "duplicate-call-leads":
      return "CallLead";
    case "bookings":
      return "BookedLead";
    case "cancellations":
      return "CancelledLead";
  }
}
