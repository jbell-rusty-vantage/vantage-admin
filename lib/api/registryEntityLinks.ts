/**
 * Pure deep-link and remediation helpers for Operations Registry Health/Changes.
 * Kept free of React so node:test can cover every entity type.
 */

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
  | "review_source_resolution"
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

function encode(value: string): string {
  return encodeURIComponent(value);
}

/** Deep-link into the Operations Registry workspace for a typed entity. */
export function registryEntityHref(
  entityType?: string | null,
  entityId?: string | null,
): RegistryEntityLink | null {
  if (!entityType) {
    return null;
  }

  const id = entityId ? encode(entityId) : null;

  switch (entityType) {
    case "agent":
      return {
        href: id
          ? `/operations-registry?tab=agents&entity=${id}`
          : "/operations-registry?tab=agents",
        label: id ? "Open agent" : "Open agents",
      };
    case "merchant":
      return {
        href: id
          ? `/operations-registry?tab=merchants&entity=${id}`
          : "/operations-registry?tab=merchants",
        label: id ? "Open merchant" : "Open merchants",
      };
    case "source_company":
      return {
        href: id
          ? `/operations-registry?tab=lead-sources&entity=${id}`
          : "/operations-registry?tab=lead-sources",
        label: id ? "Open lead source" : "Open lead sources",
      };
    case "source_granularity":
      return {
        href: id
          ? `/operations-registry?tab=lead-sources&feed=${id}`
          : "/operations-registry?tab=lead-sources",
        label: id ? "Open feed" : "Open lead sources",
      };
    case "cpl_schedule":
      return {
        href: id
          ? `/operations-registry?tab=lead-costs&cpl_mode=advanced&entity=${id}`
          : "/operations-registry?tab=lead-costs&cpl_mode=advanced",
        label: id ? "Open lead cost schedule" : "Open lead costs",
      };
    case "cpl_correction_job":
    case "cpl_correction":
      return {
        href: id
          ? `/operations-registry?tab=lead-costs&cpl_mode=corrections&entity=${id}`
          : "/operations-registry?tab=lead-costs&cpl_mode=corrections",
        label: id ? "Open correction job" : "Open lead cost corrections",
      };
    case "ringcentral_route":
    case "ringcentral_assignment":
      return {
        href: id
          ? `/operations-registry?tab=inbound-numbers&entity=${id}`
          : "/operations-registry?tab=inbound-numbers",
        label: id ? "Open inbound number" : "Open inbound numbers",
      };
    case "granot_crm_source":
    case "granot_automation_source":
      return {
        href: id
          ? `/operations-registry?tab=granot-names&entity=${id}`
          : "/operations-registry?tab=granot-names",
        label: id ? "Open Granot name" : "Open Granot names",
      };
    case "registry":
    case "registry_cache":
    case "registry_compatibility":
    case "registry_migration":
      return {
        href: "/operations-registry",
        label: "Open registry overview",
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
        href: entity?.href ?? "/operations-registry?tab=lead-costs&cpl_mode=advanced",
        label: "Edit lead cost schedule",
        ownerActionable: true,
        reviewGuidance: null,
      };
    case "preview_cpl_correction":
      return {
        href: "/operations-registry?tab=lead-costs&cpl_mode=corrections",
        label: "Preview lead cost correction",
        ownerActionable: true,
        reviewGuidance: null,
      };
    case "review_cpl_correction_jobs":
      return {
        href: entity?.href ?? "/operations-registry?tab=lead-costs&cpl_mode=corrections",
        label: "Review correction jobs",
        ownerActionable: true,
        reviewGuidance: null,
      };
    case "validate_ringcentral_route":
      return {
        href: entity?.href ?? "/operations-registry?tab=inbound-numbers",
        label: "Check this number against RingCentral",
        ownerActionable: true,
        reviewGuidance: null,
      };
    case "edit_ringcentral_route":
      return {
        href: entity?.href ?? "/operations-registry?tab=inbound-numbers",
        label: "Edit inbound number",
        ownerActionable: true,
        reviewGuidance: null,
      };
    case "reassign_ringcentral_route":
      return {
        href: entity?.href ?? "/operations-registry?tab=inbound-numbers",
        label: "File calls under a different feed",
        ownerActionable: true,
        reviewGuidance: null,
      };
    case "set_source_default":
      return {
        href: entity?.href ?? "/operations-registry?tab=lead-sources",
        label: "Set the default feed",
        ownerActionable: true,
        reviewGuidance: null,
      };
    case "review_source_lifecycle":
    case "review_source_resolution":
    case "resolve_exact_identifier_conflict":
    case "resolve_fallback_priority_conflict":
      return {
        href: entity?.href ?? "/operations-registry?tab=lead-sources",
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
        href: "/operations-registry",
        label: "Review cache evidence",
        ownerActionable: false,
        reviewGuidance:
          "Cache refresh is server-side. Review evidence and redeploy/restart if staleness persists; no Owner UI mutation exists.",
      };
    case "review_compatibility_reads":
      return {
        href: "/operations-registry",
        label: "Review compatibility reads",
        ownerActionable: false,
        reviewGuidance:
          "Compatibility consumers still call retired paths. Review runtime telemetry and migration evidence before removal.",
      };
    case "review_migration_manifests":
      return {
        href: "/operations-registry?tab=changes",
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

/** Admin Audit deep link filtered by correlated request_id (Owner-only page). */
export function adminAuditRequestHref(requestId?: string | null): string | null {
  if (!requestId) {
    return null;
  }
  return `/audit-log?request_id=${encode(requestId)}`;
}

export function humanizeRegistryKey(value?: string | null): string {
  if (!value) {
    return "-";
  }
  return value
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
