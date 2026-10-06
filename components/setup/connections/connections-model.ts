/**
 * Pure helpers for Setup → Connections & health: the inbound number summary, the Granot findings filter and the Master
 * Sheet links. No React, so node:test covers them.
 */
import type { RegistryHealthFinding } from "@/lib/api/operationsRegistry";
import type { RingCentralRoute } from "@/lib/api/registryRingCentral";
import type { SourceCompanyItem } from "@/lib/api/registrySources";

export type RouteSummary = {
  total: number;
  verified: number;
  notChecked: number;
  invalid: number;
  filing: number;
  stopped: number;
};

/**
 * Counts the inbound numbers that are not archived. Verified is a number RingCentral confirmed; "not checked" has no
 * answer yet; invalid failed the check. Filing is a number that files calls under a feed; stopped is one that does not.
 */
export function summarizeRoutes(routes: readonly RingCentralRoute[]): RouteSummary {
  const live = routes.filter((route) => !route.archived_at);
  return {
    total: live.length,
    verified: live.filter((route) => route.validation_status === "valid").length,
    notChecked: live.filter((route) => route.validation_status === "unvalidated").length,
    invalid: live.filter((route) => route.validation_status === "invalid").length,
    filing: live.filter((route) => route.active).length,
    stopped: live.filter((route) => !route.active).length,
  };
}

/** Findings about Granot names (both entity types the registry uses for them). */
export function granotFindings(findings: readonly RegistryHealthFinding[]): RegistryHealthFinding[] {
  return findings.filter((finding) => finding.entity_type?.startsWith("granot"));
}

export function googleSheetUrl(spreadsheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}`;
}

export type MasterSheetLink = { key: string; name: string; href: string | null };

/** One row per active lead source: its Master Sheet link, or null when the source has no spreadsheet set. */
export function masterSheetLinks(companies: readonly SourceCompanyItem[]): MasterSheetLink[] {
  return companies
    .filter((company) => company.active)
    .map((company) => {
      const id = company.sheet_config?.spreadsheet_id?.trim();
      return { key: company.id, name: company.owner_label || company.name, href: id ? googleSheetUrl(id) : null };
    })
    .sort((left, right) => Number(Boolean(right.href)) - Number(Boolean(left.href)) || left.name.localeCompare(right.name));
}
