"use client";

import type { ApiResponse } from "./types";

export type MovingCarrier = {
  id: string;
  _id: string;
  name: string;
  normalized_name: string;
  dot_number: string;
  mc_number: string;
  active: boolean;
  created_from: string;
  createdAt?: string;
  updatedAt?: string;
};

export type MovingCarrierPayload = {
  name: string;
  dot_number: string;
  mc_number: string;
  active?: boolean;
};

export type CarrierImportMode = "patch" | "replace";

export type CarrierImportResult = {
  mode: CarrierImportMode;
  total_rows: number;
  valid_rows: number;
  created: number;
  updated: number;
  deactivated: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
  items: MovingCarrier[];
};

type MovingCarrierListResponse = {
  items: MovingCarrier[];
  page: number;
  limit: number;
  total: number;
  has_next_page: boolean;
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

export async function fetchMovingCarriers(options: { includeInactive?: boolean } = {}) {
  const search = new URLSearchParams({ limit: "250" });
  if (options.includeInactive) {
    search.set("include_inactive", "true");
  }
  const data = await requestJson<MovingCarrierListResponse>(
    proxyUrl(`api/v1/admin/moving-carriers?${search.toString()}`),
  );
  return data.items;
}

export async function createMovingCarrier(body: MovingCarrierPayload): Promise<MovingCarrier> {
  return requestJson<MovingCarrier>(proxyUrl("api/v1/admin/moving-carriers"), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateMovingCarrier(
  id: string,
  body: Partial<MovingCarrierPayload>,
): Promise<MovingCarrier> {
  return requestJson<MovingCarrier>(
    proxyUrl(`api/v1/admin/moving-carriers/${encodeURIComponent(id)}`),
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
  );
}

export async function importMovingCarriersFromCsv(input: {
  csv_text: string;
  mode: CarrierImportMode;
}): Promise<CarrierImportResult> {
  return requestJson<CarrierImportResult>(proxyUrl("api/v1/admin/moving-carriers/import"), {
    method: "POST",
    body: JSON.stringify(input),
  });
}
