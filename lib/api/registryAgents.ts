"use client";

import { registryRequestJson } from "./registryRequest";

export type RegistryCatalogKind = "agents" | "merchants";

/**
 * HTTP catalog shape from vantage-main-server `CatalogItem`.
 * Nested `granot_identity` is not exposed over the admin HTTP contract today;
 * only the flattened `granot_crm_username` is returned.
 */
export type RegistryCatalogItem = {
  id: string;
  _id?: string;
  name: string;
  normalized_name: string;
  name_aliases?: string[];
  active: boolean;
  role?: string;
  granot_crm_username?: string;
  archived_at?: string;
  deactivation_reason?: string;
  created_from: string;
  createdAt?: string;
  updatedAt?: string;
};

export type RegistryDependencyPreview = {
  entity_type: "agent" | "merchant" | "source_company" | "source_granularity";
  entity_id: string;
  active: boolean;
  dependencies: Record<string, number>;
  total: number;
};

export type CatalogCreateInput = {
  name: string;
  role?: string;
  granot_crm_username?: string;
  created_from?: string;
};

export type CatalogUpdateInput = {
  name?: string;
  role?: string;
  granot_crm_username?: string;
  reason?: string;
};

export type CatalogActivationInput = {
  active: boolean;
  reason?: string;
};

type CatalogListResponse = {
  items: RegistryCatalogItem[];
};

function listPath(kind: RegistryCatalogKind, includeInactive: boolean): string {
  const search = includeInactive ? "?include_inactive=true" : "";
  return `api/v1/admin/${kind}${search}`;
}

export async function fetchRegistryCatalog(
  kind: RegistryCatalogKind,
  options: { includeInactive?: boolean } = {},
): Promise<RegistryCatalogItem[]> {
  const data = await registryRequestJson<CatalogListResponse | RegistryCatalogItem[]>(
    listPath(kind, Boolean(options.includeInactive)),
  );
  return Array.isArray(data) ? data : data.items;
}

export async function fetchRegistryCatalogItem(
  kind: RegistryCatalogKind,
  id: string,
): Promise<RegistryCatalogItem> {
  return registryRequestJson<RegistryCatalogItem>(
    `api/v1/admin/${kind}/${encodeURIComponent(id)}`,
  );
}

export async function createRegistryCatalogItem(
  kind: RegistryCatalogKind,
  body: CatalogCreateInput,
): Promise<RegistryCatalogItem> {
  return registryRequestJson<RegistryCatalogItem>(`api/v1/admin/${kind}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateRegistryCatalogItem(
  kind: RegistryCatalogKind,
  id: string,
  body: CatalogUpdateInput,
): Promise<RegistryCatalogItem> {
  return registryRequestJson<RegistryCatalogItem>(
    `api/v1/admin/${kind}/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
  );
}

export async function setRegistryCatalogActivation(
  kind: RegistryCatalogKind,
  id: string,
  body: CatalogActivationInput,
): Promise<RegistryCatalogItem> {
  return registryRequestJson<RegistryCatalogItem>(
    `api/v1/admin/${kind}/${encodeURIComponent(id)}/activation`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

export async function previewRegistryCatalogDependencies(
  kind: RegistryCatalogKind,
  id: string,
): Promise<RegistryDependencyPreview> {
  return registryRequestJson<RegistryDependencyPreview>(
    `api/v1/admin/${kind}/${encodeURIComponent(id)}/dependencies`,
  );
}
