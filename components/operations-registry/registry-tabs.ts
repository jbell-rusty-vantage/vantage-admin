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

/** UI2-USERS: the Owner-only Users tab. Not in REGISTRY_TABS: it is listed (and `?tab=users` honoured) only for the Owner. */
export const USERS_TAB = { id: "users", label: "Users" } as const;

export type RegistryTab = (typeof REGISTRY_TABS)[number]["id"] | typeof USERS_TAB.id;

/** The tabs a role sees: every role gets REGISTRY_TABS; the Owner also gets Users, last. */
export function registryTabsFor(role: string | null): ReadonlyArray<{ id: RegistryTab; label: string }> {
  return role === "owner" ? [...REGISTRY_TABS, USERS_TAB] : REGISTRY_TABS;
}

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

export function parseRegistryTab(value: string | null, role: string | null = null): RegistryTab {
  if (!value) {
    return "overview";
  }
  if (value === USERS_TAB.id) {
    return role === "owner" ? USERS_TAB.id : "overview";
  }
  if (isLegacyRegistryTab(value)) {
    return LEGACY_REGISTRY_TAB_REDIRECTS[value];
  }
  return (REGISTRY_TABS.some((tab) => tab.id === value) ? value : "overview") as RegistryTab;
}
