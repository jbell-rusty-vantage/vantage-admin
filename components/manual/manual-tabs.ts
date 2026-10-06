export const MANUAL_TABS = [
  { id: "create", label: "Create a Lead" },
  { id: "attach", label: "Connect Booking to Lead" },
] as const;

export type ManualTab = (typeof MANUAL_TABS)[number]["id"];

export function parseManualTab(value: string | null | undefined): ManualTab {
  return value === "attach" ? "attach" : "create";
}

/** Where each old Manual tab lives now (doc 01): New lead on the Leads workspace, Connect on Reconciliation. */
export function manualTabHref(tab: ManualTab): string {
  return tab === "attach" ? "/bookings/reconciliation?connect=1" : "/leads?new=1";
}
