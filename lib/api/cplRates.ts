"use client";

import type { ApiResponse } from "./types";

/**
 * Granular CPL (cost-per-lead) rate for one lead-type slot, e.g. "Best
 * Relocation Forms" vs "Best Relocation Inbounds". Mirrors
 * `CplRateItem` in `vantage-main-server/api/services/cpl/cplRate.service.ts`.
 */
export type CplRate = {
  id: string;
  label: string;
  source_company: string;
  lead_type: "form" | "call";
  local?: "local" | "long_distance";
  cpl: number;
  createdAt?: string;
  updatedAt?: string;
};

export type UpdateCplRateResult = {
  rate: CplRate;
  leads_updated: number;
};

type CplRateListResponse = {
  items: CplRate[];
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

export async function fetchCplRates(): Promise<CplRate[]> {
  const data = await requestJson<CplRateListResponse>(proxyUrl("api/v1/admin/cpl-rates"));
  return data.items;
}

export async function updateCplRate(label: string, cpl: number): Promise<UpdateCplRateResult> {
  return requestJson<UpdateCplRateResult>(
    proxyUrl(`api/v1/admin/cpl-rates/${encodeURIComponent(label)}`),
    {
      method: "PATCH",
      body: JSON.stringify({ cpl }),
    },
  );
}
