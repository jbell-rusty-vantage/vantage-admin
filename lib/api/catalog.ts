"use client";

import type { ApiResponse, SelectOption } from "./types";

export type CatalogKind = "agents" | "merchants";

export type CatalogItem = {
  id: string;
  _id: string;
  name: string;
  normalized_name: string;
  active: boolean;
  created_from: string;
  role?: string;
  granot_crm_username?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type CatalogPayload = {
  name: string;
  active?: boolean;
  role?: string;
  granot_crm_username?: string;
};

type CatalogListResponse = {
  items: CatalogItem[];
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

export async function fetchCatalogItems(
  kind: CatalogKind,
  options: { includeInactive?: boolean } = {},
): Promise<CatalogItem[]> {
  const search = options.includeInactive ? "?include_inactive=true" : "";
  const data = await requestJson<CatalogListResponse>(
    proxyUrl(`api/v1/admin/catalog/${kind}${search}`),
  );
  return data.items;
}

export async function fetchManageCatalogItems(kind: CatalogKind): Promise<CatalogItem[]> {
  const path = kind === "agents" ? "api/v1/admin/catalog/agents" : "api/v1/admin/merchants";
  const data = await requestJson<CatalogListResponse>(proxyUrl(`${path}?include_inactive=true`));
  return data.items;
}

export async function createCatalogItem(
  kind: CatalogKind,
  body: CatalogPayload,
): Promise<CatalogItem> {
  return requestJson<CatalogItem>(proxyUrl(`api/v1/admin/${kind}`), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateCatalogItem(
  kind: CatalogKind,
  id: string,
  body: Partial<CatalogPayload>,
): Promise<CatalogItem> {
  return requestJson<CatalogItem>(proxyUrl(`api/v1/admin/${kind}/${encodeURIComponent(id)}`), {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function toCatalogOptions(items: CatalogItem[] | undefined): SelectOption[] {
  return (items ?? []).map((item) => ({ value: item.name, label: item.name }));
}
