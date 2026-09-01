export const REGISTRY_TABS = [
  { id: "overview", label: "Overview" },
  { id: "agents", label: "Agents" },
  { id: "merchants", label: "Merchants" },
  { id: "lead-sources", label: "Lead sources" },
  { id: "granot-names", label: "Granot names" },
  { id: "inbound-numbers", label: "Inbound numbers" },
  { id: "moving-carriers", label: "Moving Carriers" },
  { id: "lead-costs", label: "Lead costs" },
  { id: "legacy-cpl", label: "Legacy CPL" },
  { id: "changes", label: "Changes" },
] as const;

export type RegistryTab = (typeof REGISTRY_TABS)[number]["id"];

/**
 * Old `?tab=` values kept as redirects for one release.
 * Proposed drop date: 2026-12-01.
 */
export const LEGACY_REGISTRY_TAB_REDIRECTS = {
  sources: "lead-sources",
  "granot-sources": "granot-names",
  ringcentral: "inbound-numbers",
  cpl: "lead-costs",
} as const satisfies Record<string, RegistryTab>;

export const LEGACY_REGISTRY_TAB_DROP_DATE = "2026-12-01";

export function isLegacyRegistryTab(
  value: string | null,
): value is keyof typeof LEGACY_REGISTRY_TAB_REDIRECTS {
  return Boolean(value && value in LEGACY_REGISTRY_TAB_REDIRECTS);
}

export function parseRegistryTab(value: string | null): RegistryTab {
  if (!value) {
    return "overview";
  }
  if (isLegacyRegistryTab(value)) {
    return LEGACY_REGISTRY_TAB_REDIRECTS[value];
  }
  return (REGISTRY_TABS.some((tab) => tab.id === value) ? value : "overview") as RegistryTab;
}
