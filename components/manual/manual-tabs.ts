export const MANUAL_TABS = [
  { id: "create", label: "Create a Lead" },
  { id: "attach", label: "Connect Booking to Lead" },
] as const;

export type ManualTab = (typeof MANUAL_TABS)[number]["id"];

export function parseManualTab(value: string | null | undefined): ManualTab {
  return value === "attach" ? "attach" : "create";
}

export function manualTabHref(tab: ManualTab): string {
  return tab === "attach" ? "/manual?tab=attach" : "/manual";
}
