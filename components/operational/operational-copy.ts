import type { FilterGroupId } from "@/components/operational/operational-filter-groups";
import type { DetailTabKey } from "@/components/operational/visible-detail-tabs";
import type { UiResource } from "@/lib/api/admin";

const LEAD_RESOURCES = new Set<UiResource>([
  "form-leads",
  "duplicate-form-leads",
  "call-leads",
  "duplicate-call-leads",
]);

export const OPERATIONAL_COPY = {
  duplicateReadOnlyBanner: {
    formLeads:
      "Duplicate Form Leads are read-only. Booking, cancellation, and edit actions are hidden.",
    callLeads:
      "Duplicate Call Leads are read-only. Booking, cancellation, and edit actions are hidden.",
  },
  tabs: {
    list: "Tabs",
    summary: "Summary",
    contact: "Contact",
    message: "Lead Message",
    actions: "Actions",
    production: "Production record",
    sourceLead: "Source Company",
    sourceOther: "Source",
  },
  leadMessage: {
    empty: "No Lead Message is associated with this Form Lead.",
    sentLabel: "Lead Message sent",
    sentTrue: "True",
    sentFalse: "False",
    viewEvents: "View messaging events",
    bodyLabel: "Message body",
  },
  production: {
    saved: "Saved. The table and detail caches were refreshed.",
    dangerTitle: "Delete this record",
    dangerDescription: "Leads and customers are preserved. Sheets update through Sheet Sync.",
    deleteBooking: "Delete booking",
    deleteBookingAndCancellation: "Delete booking and cancellation",
    deleteCancellation: "Delete cancellation",
  },
  deleteSuccess: {
    booking: "Booking deleted. Sheets update through Sheet Sync.",
    bookingAndCancellation: "Booking and attached cancellation deleted. Sheets update through Sheet Sync.",
    cancellation: "Cancellation deleted. Sheets update through Sheet Sync.",
  },
  source: {
    sourceCompany: "Source Company",
    sourceGranularity: "Source Granularity",
    sourceCompanyLabel: "Source Company label",
    sourceGranularityLabel: "Source Granularity label",
    granotCrmSourceLabel: "Granot CRM source label",
    sourceLabel: "Source",
  },
  linked: {
    booking: "Booking",
    cancellation: "Cancellation",
    customer: "Customer",
    lead: "Lead",
    viewBooking: "View booking",
  },
  historicalDetail: "Historical records are read-only. Mutation actions are hidden.",
  emptyEnterField: "Enter at least one field to update.",
  updateFailed: "Update failed.",
  filterGroups: {
    find: "Find",
    status: "Status",
    attribution: "Attribution",
    recordFields: "Record fields",
  },
  filters: {
    search: "Search",
    searchPlaceholder: "Name, phone, email, or ID…",
    dateSorting: "Date sorting",
    dateRange: "Date range",
  },
  row: {
    status: "Status",
    actions: "Actions",
    booked: "Booked",
    cancelled: "Cancelled",
    badLead: "Bad Lead",
    badLeadAction: "Bad",
    leadMessageSent: "Lead Message sent",
    book: "Book",
    cancel: "Cancel",
    delete: "Delete",
  },
  sheetContains: {
    action: "Check Google Sheet contains",
    selected: "selected",
    clear: "Clear",
    selectRow: "Select for sheet check",
    selectLoaded: "Select loaded rows for sheet check",
    maxSelected: "You can check 25 records at a time.",
    panelTitle: "Google Sheet check",
    panelDescription: "Live read of Master Leads or Master Booked. Mongo stays the source of truth.",
    checking: "Checking the Google Sheet…",
    close: "Close",
    verdictFound: "Found",
    verdictMissing: "Missing",
    verdictWrongTab: "Wrong tab",
    verdictNotExpected: "Not expected",
    verdictNotFound: "Not in Mongo",
    expected: "Expected",
    row: "Row",
    openSheet: "Open in Google Sheets",
    pendingJob: "Sheet Sync job still open",
    unmatchedCall:
      "This Call Lead was created only to anchor a Booking. Sheet Sync does not write it to Master Leads.",
    missingMongo: "This id is not in the production database.",
    missingExpected: "Missing from",
    hint: "Last Sheet Sync hint",
    emptyEvidence: "No evidence cells on this row.",
  },
} as const;

export function duplicateReadOnlyBannerCopy(resource: UiResource): string {
  return resource === "duplicate-call-leads"
    ? OPERATIONAL_COPY.duplicateReadOnlyBanner.callLeads
    : OPERATIONAL_COPY.duplicateReadOnlyBanner.formLeads;
}

export function detailTabLabel(tab: DetailTabKey, uiResource: UiResource): string {
  if (tab === "source") {
    return LEAD_RESOURCES.has(uiResource)
      ? OPERATIONAL_COPY.tabs.sourceLead
      : OPERATIONAL_COPY.tabs.sourceOther;
  }
  return OPERATIONAL_COPY.tabs[tab];
}

export function leadMessageSentValue(sent: boolean | undefined): string {
  return sent === true ? OPERATIONAL_COPY.leadMessage.sentTrue : OPERATIONAL_COPY.leadMessage.sentFalse;
}

export function deleteSuccessCopy(resource: "bookings" | "cancellations", hasCancellation: boolean): string {
  if (resource === "cancellations") {
    return OPERATIONAL_COPY.deleteSuccess.cancellation;
  }
  return hasCancellation
    ? OPERATIONAL_COPY.deleteSuccess.bookingAndCancellation
    : OPERATIONAL_COPY.deleteSuccess.booking;
}

export function productionDeleteLabel(
  resource: "bookings" | "cancellations",
  hasCancellation: boolean,
): string {
  if (resource === "cancellations") {
    return OPERATIONAL_COPY.production.deleteCancellation;
  }
  return hasCancellation
    ? OPERATIONAL_COPY.production.deleteBookingAndCancellation
    : OPERATIONAL_COPY.production.deleteBooking;
}

export function filterGroupTitle(group: FilterGroupId): string {
  if (group === "record") {
    return OPERATIONAL_COPY.filterGroups.recordFields;
  }
  return OPERATIONAL_COPY.filterGroups[group];
}
