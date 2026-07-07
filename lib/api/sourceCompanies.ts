"use client";

import type { ApiResponse, SelectOption } from "./types";

export type LeadSourceChannel = "form" | "call";
export type LeadSourceLocal = "local" | "long_distance";

export type LeadSourceGranularity = {
  id: string;
  _id: string;
  granularity_key: string;
  channel: LeadSourceChannel;
  owner_label: string;
  crm_label: string;
  aliases: string[];
  active: boolean;
  cpl: number;
  local?: LeadSourceLocal;
  source_sites: string[];
  inbound_phone_numbers: string[];
  priority: number;
  sheet_tab_name?: string;
};

export type LeadSourceCompany = {
  id: string;
  _id: string;
  company_slug: string;
  name: string;
  owner_label: string;
  aliases: string[];
  active: boolean;
  default_form_granularity_key?: string;
  default_call_granularity_key?: string;
  sheet_config?: {
    spreadsheet_id?: string;
    has_bad_tabs: boolean;
  };
  granularities: LeadSourceGranularity[];
  created_from: string;
  createdAt?: string;
  updatedAt?: string;
};

export type LeadSourceGranularityPayload = {
  granularity_key: string;
  channel: LeadSourceChannel;
  owner_label: string;
  crm_label: string;
  aliases?: string[];
  active?: boolean;
  cpl?: number;
  local?: LeadSourceLocal;
  source_sites?: string[];
  inbound_phone_numbers?: string[];
  priority?: number;
  sheet_tab_name?: string;
};

export type LeadSourceCompanyPayload = {
  company_slug: string;
  name: string;
  owner_label?: string;
  aliases?: string[];
  active?: boolean;
  default_form_granularity_key?: string;
  default_call_granularity_key?: string;
  sheet_config?: {
    spreadsheet_id?: string;
    has_bad_tabs?: boolean;
  };
  granularities?: LeadSourceGranularityPayload[];
  created_from?: string;
};

type LeadSourceCompanyListResponse = {
  items: LeadSourceCompany[];
};

function proxyUrl(path: string): string {
  const normalized = path.startsWith("/") ? path.slice(1) : path;
  return `/api/proxy/${normalized}`;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const payload = (await response.json()) as ApiResponse<T>;

  if (!response.ok || !payload.ok) {
    throw new Error(payload.ok ? response.statusText : payload.error);
  }

  return payload.data;
}

export async function fetchLeadSourceCompanies(
  options: { includeInactive?: boolean } = {},
): Promise<LeadSourceCompany[]> {
  const search = options.includeInactive ? "?include_inactive=true" : "";
  const data = await requestJson<LeadSourceCompanyListResponse>(
    proxyUrl(`api/v1/admin/source-companies${search}`),
  );
  return data.items;
}

export async function createLeadSourceCompany(
  body: LeadSourceCompanyPayload,
): Promise<LeadSourceCompany> {
  return requestJson<LeadSourceCompany>(proxyUrl("api/v1/admin/source-companies"), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateLeadSourceCompany(
  id: string,
  body: Partial<Omit<LeadSourceCompanyPayload, "company_slug">>,
): Promise<LeadSourceCompany> {
  return requestJson<LeadSourceCompany>(
    proxyUrl(`api/v1/admin/source-companies/${encodeURIComponent(id)}`),
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
  );
}

export function toLeadSourceCompanyOptions(
  companies: LeadSourceCompany[] | undefined,
): SelectOption[] {
  return (companies ?? []).map((company) => ({
    value: company.company_slug,
    label: company.active ? company.owner_label : `${company.owner_label} (inactive)`,
  }));
}

export function toLeadSourceLabelOptions(
  companies: LeadSourceCompany[] | undefined,
): SelectOption[] {
  return (companies ?? []).flatMap((company) =>
    company.granularities.map((granularity) => ({
      value: granularity.crm_label,
      label: granularity.active
        ? granularity.crm_label
        : `${granularity.crm_label} (inactive)`,
    })),
  );
}
