"use client";

import { registryRequestJson } from "./registryRequest";

export type SourceChannel = "form" | "call";

export type SourceCompanyItem = {
  id: string;
  _id: string;
  company_slug: string;
  name: string;
  owner_label: string;
  aliases: string[];
  active: boolean;
  default_form_granularity?: string;
  default_call_granularity?: string;
  default_form_granularity_key?: string;
  default_call_granularity_key?: string;
  sheet_config: {
    spreadsheet_id?: string;
    has_bad_tabs: boolean;
    projection_mode: "derived_import" | "direct_write";
  };
  granularities?: Record<string, unknown>[];
  archived_at?: string;
  deactivation_reason?: string;
  created_from: string;
  createdAt?: string;
  updatedAt?: string;
};

export type SourceGranularityItem = {
  id: string;
  _id: string;
  source_company: string;
  granularity_key: string;
  channel: SourceChannel;
  owner_label: string;
  crm_label: string;
  aliases: string[];
  source_sites: string[];
  priority: number;
  local?: "local" | "long_distance";
  active: boolean;
  schedule_revision: number;
  sheet_tab_name?: string;
  activated_at?: string;
  archived_at?: string;
  deactivation_reason?: string;
  created_from: string;
};

export type SourceCompanyCreateInput = {
  company_slug: string;
  name: string;
  owner_label?: string;
  aliases?: string[];
  default_form_granularity?: string | null;
  default_call_granularity?: string | null;
  sheet_config?: {
    spreadsheet_id?: string;
    has_bad_tabs?: boolean;
    projection_mode?: "derived_import" | "direct_write";
  };
  created_from?: string;
  reason?: string;
};

export type SourceCompanyUpdateInput = {
  name?: string;
  owner_label?: string;
  aliases?: string[];
  default_form_granularity?: string | null;
  default_call_granularity?: string | null;
  sheet_config?: {
    spreadsheet_id?: string;
    has_bad_tabs?: boolean;
    projection_mode?: "derived_import" | "direct_write";
  };
  reason?: string;
};

export type SourceGranularityCreateInput = {
  source_company: string;
  granularity_key: string;
  channel: SourceChannel;
  owner_label: string;
  crm_label: string;
  aliases?: string[];
  local?: "local" | "long_distance" | null;
  source_sites?: string[];
  priority?: number;
  sheet_tab_name?: string | null;
  created_from?: string;
  reason?: string;
};

export type SourceGranularityUpdateInput = {
  owner_label?: string;
  crm_label?: string;
  aliases?: string[];
  local?: "local" | "long_distance" | null;
  source_sites?: string[];
  priority?: number;
  sheet_tab_name?: string | null;
  reason?: string;
};

export type SourceActivationInput = {
  active: boolean;
  reason?: string;
  replacement_default_id?: string;
  remove_automatic_use_for_channel?: boolean;
};

export type SourceResolutionPreviewInput = {
  channel: SourceChannel;
  company_slug?: string;
  granularity_key?: string;
  crm_label?: string;
  source_site?: string;
  fallback_alias?: string;
};

export type SourceResolutionPreview =
  | {
      status: "resolved";
      attribution: {
        company_id: string;
        company_slug: string;
        company_label_snapshot: string;
        granularity_id: string;
        granularity_key: string;
        granularity_label_snapshot: string;
        crm_label_snapshot: string;
        match_kind: "exact" | "default" | "fallback";
        registry_revision: number;
      };
    }
  | {
      status: "not_found";
      identifier_kind: "company" | "exact" | "default" | "fallback";
      identifier: string | null;
    }
  | {
      status: "ambiguous";
      identifier_kind: "company" | "exact" | "fallback";
      identifier: string;
      candidate_ids: string[];
      priority?: number;
    };

export type SourceDependencyPreview = {
  entity_type: string;
  entity_id: string;
  active: boolean;
  dependencies: Record<string, number>;
  total: number;
};

type ListResponse<T> = { items: T[] } | T[];

function unwrapList<T>(data: ListResponse<T>): T[] {
  return Array.isArray(data) ? data : data.items;
}

export async function fetchSourceCompanies(
  options: { includeInactive?: boolean } = {},
): Promise<SourceCompanyItem[]> {
  const search = options.includeInactive ? "?include_inactive=true" : "";
  const data = await registryRequestJson<ListResponse<SourceCompanyItem>>(
    `api/v1/admin/source-companies${search}`,
  );
  return unwrapList(data);
}

export async function fetchSourceCompany(id: string): Promise<SourceCompanyItem> {
  return registryRequestJson<SourceCompanyItem>(
    `api/v1/admin/source-companies/${encodeURIComponent(id)}`,
  );
}

export async function createSourceCompany(
  body: SourceCompanyCreateInput,
): Promise<SourceCompanyItem> {
  return registryRequestJson<SourceCompanyItem>("api/v1/admin/source-companies", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateSourceCompany(
  id: string,
  body: SourceCompanyUpdateInput,
): Promise<SourceCompanyItem> {
  return registryRequestJson<SourceCompanyItem>(
    `api/v1/admin/source-companies/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
  );
}

export async function setSourceCompanyActivation(
  id: string,
  body: SourceActivationInput,
): Promise<SourceCompanyItem> {
  return registryRequestJson<SourceCompanyItem>(
    `api/v1/admin/source-companies/${encodeURIComponent(id)}/activation`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

export async function previewSourceCompanyDependencies(
  id: string,
): Promise<SourceDependencyPreview> {
  return registryRequestJson<SourceDependencyPreview>(
    `api/v1/admin/source-companies/${encodeURIComponent(id)}/dependencies`,
  );
}

export async function fetchSourceGranularities(filters: {
  includeInactive?: boolean;
  sourceCompany?: string;
  channel?: SourceChannel;
} = {}): Promise<SourceGranularityItem[]> {
  const params = new URLSearchParams();
  if (filters.includeInactive) params.set("include_inactive", "true");
  if (filters.sourceCompany) params.set("source_company", filters.sourceCompany);
  if (filters.channel) params.set("channel", filters.channel);
  const search = params.toString();
  const data = await registryRequestJson<ListResponse<SourceGranularityItem>>(
    `api/v1/admin/source-granularities${search ? `?${search}` : ""}`,
  );
  return unwrapList(data);
}

export async function fetchSourceGranularity(id: string): Promise<SourceGranularityItem> {
  return registryRequestJson<SourceGranularityItem>(
    `api/v1/admin/source-granularities/${encodeURIComponent(id)}`,
  );
}

export async function createSourceGranularity(
  body: SourceGranularityCreateInput,
): Promise<SourceGranularityItem> {
  return registryRequestJson<SourceGranularityItem>("api/v1/admin/source-granularities", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateSourceGranularity(
  id: string,
  body: SourceGranularityUpdateInput,
): Promise<SourceGranularityItem> {
  return registryRequestJson<SourceGranularityItem>(
    `api/v1/admin/source-granularities/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
  );
}

export async function setSourceGranularityActivation(
  id: string,
  body: SourceActivationInput,
): Promise<SourceGranularityItem> {
  return registryRequestJson<SourceGranularityItem>(
    `api/v1/admin/source-granularities/${encodeURIComponent(id)}/activation`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

export async function previewSourceGranularityDependencies(
  id: string,
): Promise<SourceDependencyPreview> {
  return registryRequestJson<SourceDependencyPreview>(
    `api/v1/admin/source-granularities/${encodeURIComponent(id)}/dependencies`,
  );
}

export async function previewSourceResolution(
  body: SourceResolutionPreviewInput,
): Promise<SourceResolutionPreview> {
  return registryRequestJson<SourceResolutionPreview>("api/v1/admin/source-resolution/preview", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
