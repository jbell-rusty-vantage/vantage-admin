/**
 * Pure deep-link and remediation helpers for Operations Registry Health/Changes.
 * Kept free of React so node:test can cover every entity type. Every href points into the Setup routes.
 */

import { SETUP_ROUTES, setupHrefForRegistryTab } from "@/lib/setup/setup-links";

export const REGISTRY_CHANGE_ENTITY_TYPES = [
  "agent",
  "merchant",
  "source_company",
  "source_granularity",
  "cpl_schedule",
  "ringcentral_route",
  "ringcentral_assignment",
  "granot_crm_source",
  "granot_automation_source",
  "systems_locations",
  "registry",
] as const;

export type RegistryChangeEntityType = (typeof REGISTRY_CHANGE_ENTITY_TYPES)[number];

export const REGISTRY_CHANGE_ACTIONS = [
  "create",
  "update",
  "activate",
  "deactivate",
  "rename",
  "schedule_apply",
  "validate",
  "reassign",
  "correction",
] as const;

export type RegistryChangeAction = (typeof REGISTRY_CHANGE_ACTIONS)[number];

/** Health finding entity_type values that may appear beyond change-log enums. */
export type RegistryHealthEntityType =
  | RegistryChangeEntityType
  | "cpl_correction_job"
  | "cpl_correction"
  | "registry_cache"
  | "registry_compatibility"
  | "registry_migration";

export type RegistryRemediationAction =
  | "configure_env"
  | "review_source_lifecycle"
  | "set_source_default"
  | "resolve_exact_identifier_conflict"
  | "resolve_fallback_priority_conflict"
  | "edit_cpl_schedule"
  | "preview_cpl_correction"
  | "review_cpl_correction_jobs"
  | "validate_ringcentral_route"
  | "edit_ringcentral_route"
  | "reassign_ringcentral_route"
  | "refresh_registry_cache"
  | "review_compatibility_reads"
  | "review_migration_manifests";

export type RegistryEntityLink = {
  href: string;
  label: string;
};

/**
 * Deep-link into the Setup section for a typed entity. Every href is built by `setupHrefForRegistryTab` (the old
 * `/operations-registry?tab=` model is gone), so the entity ids go into the Setup URL keys of doc 19:
 * `?source=`, `?feed=`, `?view=granot&granot=`, `?view=numbers&number=`, `?person=`. Merchants and lead cost schedules
 * have no per-record key in Setup, so they open their section.
 */
export function registryEntityHref(
  entityType?: string | null,
  entityId?: string | null,
): RegistryEntityLink | null {
  if (!entityType) {
    return null;
  }

  const id = entityId || null;

  switch (entityType) {
    case "agent":
      return {
        href: setupHrefForRegistryTab("agents", { entity: id }),
        label: id ? "Open agent" : "Open agents",
      };
    case "merchant":
      return {
        href: setupHrefForRegistryTab("merchants"),
        label: id ? "Open merchant" : "Open merchants",
      };
    case "source_company":
      return {
        href: setupHrefForRegistryTab("lead-sources", { entity: id }),
        label: id ? "Open lead source" : "Open lead sources",
      };
    case "source_granularity":
      return {
        href: setupHrefForRegistryTab("lead-sources", { feed: id }),
        label: id ? "Open feed" : "Open lead sources",
      };
    case "cpl_schedule":
      return {
        href: setupHrefForRegistryTab("lead-costs"),
        label: id ? "Open lead cost schedule" : "Open lead costs",
      };
    case "cpl_correction_job":
    case "cpl_correction":
      return {
        href: setupHrefForRegistryTab("lead-costs", { cpl_mode: "corrections" }),
        label: id ? "Open correction job" : "Open lead cost corrections",
      };
    case "ringcentral_route":
    case "ringcentral_assignment":
      return {
        href: setupHrefForRegistryTab("inbound-numbers", { entity: id }),
        label: id ? "Open inbound number" : "Open inbound numbers",
      };
    case "granot_crm_source":
    case "granot_automation_source":
      return {
        href: setupHrefForRegistryTab("granot-names", { entity: id }),
        label: id ? "Open Granot name" : "Open Granot names",
      };
    case "systems_locations":
      return { href: "/systems", label: "Open Systems" };
    case "registry":
    case "registry_cache":
    case "registry_compatibility":
    case "registry_migration":
      return {
        href: SETUP_ROUTES.connections,
        label: "Open connections and health",
      };
    default:
      return null;
  }
}

export type RegistryRemediationTarget = {
  href: string | null;
  label: string;
  /** True when Owner can run a registry mutation from the linked surface. */
  ownerActionable: boolean;
  /** Guidance when no safe automated remediation exists. */
  reviewGuidance: string | null;
};

/**
 * Map typed server remediation.action → UI target.
 * Never infer from finding.summary text.
 */
export function remediationTarget(
  action?: string | null,
  entityType?: string | null,
  entityId?: string | null,
): RegistryRemediationTarget {
  const entity = registryEntityHref(entityType, entityId);

  switch (action) {
    case "edit_cpl_schedule":
      return {
        href: entity?.href ?? SETUP_ROUTES.leadCosts,
        label: "Edit lead cost schedule",
        ownerActionable: true,
        reviewGuidance: null,
      };
    case "preview_cpl_correction":
      return {
        href: setupHrefForRegistryTab("lead-costs", { cpl_mode: "corrections" }),
        label: "Preview lead cost correction",
        ownerActionable: true,
        reviewGuidance: null,
      };
    case "review_cpl_correction_jobs":
      return {
        href: entity?.href ?? setupHrefForRegistryTab("lead-costs", { cpl_mode: "corrections" }),
        label: "Review correction jobs",
        ownerActionable: true,
        reviewGuidance: null,
      };
    case "validate_ringcentral_route":
      return {
        href: entity?.href ?? setupHrefForRegistryTab("inbound-numbers"),
        label: "Check this number against RingCentral",
        ownerActionable: true,
        reviewGuidance: null,
      };
    case "edit_ringcentral_route":
      return {
        href: entity?.href ?? setupHrefForRegistryTab("inbound-numbers"),
        label: "Edit inbound number",
        ownerActionable: true,
        reviewGuidance: null,
      };
    case "reassign_ringcentral_route":
      return {
        href: entity?.href ?? setupHrefForRegistryTab("inbound-numbers"),
        label: "File calls under a different feed",
        ownerActionable: true,
        reviewGuidance: null,
      };
    case "set_source_default":
      return {
        href: entity?.href ?? SETUP_ROUTES.leadSources,
        label: "Set the default feed",
        ownerActionable: true,
        reviewGuidance: null,
      };
    case "review_source_lifecycle":
    case "resolve_exact_identifier_conflict":
    case "resolve_fallback_priority_conflict":
      return {
        href: entity?.href ?? SETUP_ROUTES.leadSources,
        label: "Review lead sources",
        ownerActionable: true,
        reviewGuidance: null,
      };
    case "configure_env":
      return {
        href: null,
        label: "Configure environment",
        ownerActionable: false,
        reviewGuidance:
          "Owner must set VANTAGE_ADMIN_PROXY_SIGNING_SECRET in the admin/server environment. No dashboard mutation can fix this.",
      };
    case "refresh_registry_cache":
      return {
        href: SETUP_ROUTES.connections,
        label: "Review cache evidence",
        ownerActionable: false,
        reviewGuidance:
          "Cache refresh is server-side. Review evidence and redeploy/restart if staleness persists; no Owner UI mutation exists.",
      };
    case "review_compatibility_reads":
      return {
        href: SETUP_ROUTES.connections,
        label: "Review compatibility reads",
        ownerActionable: false,
        reviewGuidance:
          "Compatibility consumers still call retired paths. Review runtime telemetry and migration evidence before removal.",
      };
    case "review_migration_manifests":
      return {
        href: SETUP_ROUTES.changes,
        label: "Review migration evidence",
        ownerActionable: false,
        reviewGuidance:
          "Inspect migration manifests and Registry Changes for cutover evidence. No automated remediation mutation.",
      };
    default:
      return {
        href: entity?.href ?? null,
        label: entity?.label ?? "Review finding",
        ownerActionable: false,
        reviewGuidance: action
          ? null
          : "No typed remediation action. Owner review of evidence is required.",
      };
  }
}

/**
 * Engineering words that must not reach the Owner (lib/operations-registry/ownerLanguageDeck.ts), said in the glossary's
 * words. Applied to field names, evidence keys and enum codes shown in the Setup surfaces.
 */
const OWNER_WORDS: ReadonlyArray<readonly [RegExp, string]> = [
  [/owner[ _]label/gi, "name"],
  [/display[ _]label/gi, "name"],
  [/operational[ _]label/gi, "label"],
  [/crm[ _]label/gi, "Granot label"],
  [/validation[ _]status/gi, "check result"],
  [/route[ _]assignment/gi, "number filing"],
  [/outbound[ _]sms/gi, "outgoing text"],
  [/consent[ _]basis/gi, "consent"],
  [/template[ _]version/gi, "template"],
  [/granot[ _]sources/gi, "Granot names"],
  [/lifecycle[ _](route|activation)/gi, "Granot $1"],
  [/lead[ _]created[ _]policy/gi, "new lead policy"],
  [/operational[ _]csv[ _]enabled/gi, "sheet export on"],
  [/(link|observation)_only/gi, "$1 only"],
  [/create_if_missing/gi, "create if missing"],
  [/granularity/gi, "feed"],
  [/lifecycle/gi, "Granot"],
  [/disposition/gi, "outcome"],
  [/route[ _]key/gi, "route"],
  [/lead[ _]model/gi, "lead type"],
  [/policy[ _]version/gi, "policy"],
];

export function ownerWords(text: string): string {
  let out = text;
  for (const [pattern, word] of OWNER_WORDS) out = out.replace(pattern, word);
  return out;
}

export function humanizeRegistryKey(value?: string | null): string {
  if (!value) {
    return "-";
  }
  return ownerWords(value)
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
