/** Owner-visible strings shared by every record workspace (Leads, All bookings, Cancellations; doc 03 "The shared frame"). */
export const RECORDS_COPY = {
  clearAll: "Clear all",
  moreFilters: "More filters",
  sortLabel: "Sort",
  verify: "Verify in Master Sheet",
  verifyDone: "Done selecting",
  verifying: "Verifying…",
  verifyUpTo: "Verify up to 25 at a time",
  selectedCount: (n: number) => `${n} selected`,
  selectAll: "Select all on this page",
  clearSelection: "Clear",
  close: "Close",
  searching: "Searching…",
  retry: "Retry",
  sheetCheckFailed: "Google Sheet check failed.",
} as const;
