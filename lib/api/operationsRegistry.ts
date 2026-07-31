"use client";

import { registryRequestJson } from "./registryRequest";

export type RegistryOverviewCounts = {
  agents_total: number;
  agents_active: number;
  merchants_total: number;
  merchants_active: number;
  source_companies_total: number;
  source_companies_active: number;
  source_granularities_total: number;
  source_granularities_active: number;
  ringcentral_routes_total: number;
  ringcentral_routes_active: number;
  registry_changes_total: number;
};

export type RegistryOverview = {
  generated_at: string;
  counts: RegistryOverviewCounts;
  signing: {
    secret_configured: boolean;
    preview_unsigned_allowed: boolean;
    signature_max_age_ms: number;
  };
  runtime?: Record<string, unknown>;
};

export type RegistryHealthFinding = {
  code: string;
  severity: "info" | "warn" | "error";
  summary: string;
  entity_type?: string;
  entity_id?: string;
  first_observed_at: string;
  last_observed_at: string;
  actionable: boolean;
  evidence?: Record<string, string | number | boolean | null>;
  remediation?: {
    summary: string;
    action?: string;
  };
};

export type RegistryHealth = {
  generated_at: string;
  findings: RegistryHealthFinding[];
};

export type RegistryChangeItem = {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_type: "owner" | "admin" | "system" | string;
  actor_id: string;
  actor_label: string;
  actor_role: string;
  request_id: string;
  reason: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type RegistryChangesResult = {
  items: RegistryChangeItem[];
  page: number;
  limit: number;
  total: number;
  has_next_page: boolean;
};

export async function fetchRegistryOverview(): Promise<RegistryOverview> {
  return registryRequestJson<RegistryOverview>("api/v1/admin/operations-registry/overview");
}

export async function fetchRegistryHealth(): Promise<RegistryHealth> {
  return registryRequestJson<RegistryHealth>("api/v1/admin/operations-registry/health");
}

export async function fetchRegistryChanges(
  filters: Record<string, string | number | undefined> = {},
): Promise<RegistryChangesResult> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }
  const search = params.toString();
  return registryRequestJson<RegistryChangesResult>(
    `api/v1/admin/operations-registry/changes${search ? `?${search}` : ""}`,
  );
}
