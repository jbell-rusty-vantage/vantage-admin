export const REGISTRY_TABS = [
  { id: "overview", label: "Overview" },
  { id: "agents", label: "Agents" },
  { id: "merchants", label: "Merchants" },
  { id: "sources", label: "Sources" },
  { id: "granot-sources", label: "Granot sources" },
  { id: "ringcentral", label: "RingCentral" },
  { id: "moving-carriers", label: "Moving Carriers" },
  { id: "cpl", label: "CPL" },
  { id: "legacy-cpl", label: "Legacy CPL" },
  { id: "changes", label: "Changes" },
] as const;

export type RegistryTab = (typeof REGISTRY_TABS)[number]["id"];
